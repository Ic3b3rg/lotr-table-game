import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  readyMission,
  reachMission,
  missionIntent,
  drainMission,
  ok,
} from './mission-combat-helper.mjs';
import { readSession, readBackup } from './skill-test-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';

test('owner, hero, space, source, concurrent/stale and retry requests preserve the immutable action origin and stable receipts', async (t) => {
  const r = await readyMission(t),
    s = await reachMission(r),
    before = await readBackup(r.host),
    origin = structuredClone(before.payload.state.physical.cycle.seed),
    c = {
      ...missionIntent(r, s, 'PUSH'),
      requestId: randomUUID(),
      generation: s.generation,
      expectedRevision: s.revision,
    };
  for (const [actor, changes, status] of [
    [r.other, {}, 403],
    [r.player, { heroId: 'hero-2' }, 403],
    [r.player, { sourceFingerprint: 'f'.repeat(64) }, 409],
    [r.player, { instanceId: 'node:foreign-space' }, 409],
    [r.player, { choiceEvent: 'invented-free-success' }, 409],
    [r.player, { turnId: randomUUID() }, 409],
  ]) {
    assert.equal(
      (
        await r.host.request(
          '/api/commands',
          { ...c, ...changes, requestId: randomUUID() },
          actor.cookie,
        )
      ).status,
      status,
    );
    assert.deepEqual((await readBackup(r.host)).payload, before.payload);
    assert.deepEqual(await readSession(r.host), s);
  }
  const race = await Promise.all(
    [c, { ...c, requestId: randomUUID() }].map((c) =>
      r.host.request('/api/commands', c, r.player.cookie),
    ),
  );
  assert.deepEqual(race.map((r) => r.status).sort(), [200, 409]);
  const receipt = await (await ok(r.host.request('/api/commands', c, r.player.cookie))).json();
  assert.deepEqual(
    await (await ok(r.host.request('/api/commands', c, r.player.cookie))).json(),
    receipt,
  );
  const committed = await readBackup(r.host),
    view = await readSession(r.host);
  assert.deepEqual(committed.payload.state.physical.cycle.seed, origin);
  assert.equal(committed.payload.state.scenario.play.attempts.length, 1);
  const q = view.scenario.pending;
  assert.equal(
    (
      await scenarioInput(
        r.host,
        r.player,
        { kind: 'physical-choice', option: 'reveal' },
        { sourceFingerprint: 'c'.repeat(64) },
      )
    ).status,
    409,
  );
  assert.equal(
    (await scenarioInput(r.host, r.other, { kind: 'physical-choice', option: 'reveal' })).status,
    403,
  );
  assert.deepEqual((await readBackup(r.host)).payload, committed.payload);
  assert.deepEqual(await readSession(r.host), view);
  await drainMission(r, { pause: (s) => s.scenario.pending?.kind === 'source-attack' });
  const grant = await readSession(r.host),
    full = await readBackup(r.host);
  assert.equal(
    (
      await scenarioInput(
        r.host,
        r.player,
        { kind: 'ack' },
        { pendingId: q.id, sourceFingerprint: q.fingerprint },
      )
    ).status,
    409,
  );
  assert.deepEqual((await readBackup(r.host)).payload, full.payload);
  assert.deepEqual(await readSession(r.host), grant);
});
