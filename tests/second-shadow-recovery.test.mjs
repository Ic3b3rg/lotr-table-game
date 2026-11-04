import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { atSecondShadow, answerFollowup, drainFollowup, rally } from './second-shadow-helper.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';
import { command } from './preparation-helper.mjs';
import { readSession, readBackup, signBackup } from './skill-test-helper.mjs';
import { startHost } from './host-helper.mjs';
import { finishCycle } from './original-round-helper.mjs';

test('callback reward, placements, threshold trials and between-owner rally persist through kill/packless restore and once', async (t) => {
  const r = await atSecondShadow(t);
  let host = r.host;
  t.after(() => host.stop());
  const at = await readSession(host),
    intent = { type: 'BEGIN_SHADOW', roundId: at.round.id, agreed: true, requestId: randomUUID() };
  const responses = await Promise.all([
    command(host, r.player, intent, at),
    command(host, r.player, intent, at),
    command(host, r.other, { ...intent, requestId: randomUUID() }, at),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 200, 409]);
  const receipts = await Promise.all(
    responses.filter((r) => r.status === 200).map((r) => r.json()),
  );
  assert.deepEqual(receipts[0].receipt, receipts[1].receipt);
  for (const path of [
    r.scenarioPath,
    ...['physical-content.json', 'physical-fronts.json', 'physical-last-stand.json'].map((f) =>
      join(host.dataDir, f),
    ),
  ])
    await rm(path);
  async function roundtrip() {
    const before = await readBackup(host);
    await host.stop('SIGKILL');
    host = await startHost({ LOTR_DATA_DIR: host.dataDir });
    r.host = host;
    assert.deepEqual((await readBackup(host)).payload, before.payload);
    const stable = await readSession(host);
    const res = await host.request('/api/restores', {
      backup: before,
      generation: stable.generation,
      expectedRevision: stable.revision,
      confirmed: true,
    });
    assert.equal(res.status, 200, await res.text());
    const after = await readBackup(host);
    for (const key of Object.keys(before.payload.state).filter(
      (k) => !['generation', 'revision', 'updatedAt'].includes(k),
    ))
      assert.deepEqual(after.payload.state[key], before.payload.state[key], key);
    assert.deepEqual(after.payload.commands, before.payload.commands);
    for (const actor of [r.player, r.other]) {
      const x = await host.request('/api/recover', {
        recoveryCode: actor.recoveryCode,
        generation: after.payload.state.generation,
      });
      assert.equal(x.status, 200);
      actor.cookie = x.headers.get('set-cookie').split(';')[0];
    }
    return after;
  }
  let s = await readSession(host);
  const q = s.scenario.pending,
    callbackIntent = {
      type: 'SCENARIO_INPUT',
      scenarioId: s.scenario.id,
      packFingerprint: s.scenario.packFingerprint,
      projectionFingerprint: s.scenario.projectionFingerprint,
      pendingId: q.id,
      sourceFingerprint: q.fingerprint,
      heroId: q.heroId,
      input: { kind: 'ack' },
      requestId: randomUUID(),
    };
  const callbackResponses = await Promise.all([
    command(host, r.player, callbackIntent, s),
    command(host, r.player, callbackIntent, s),
    command(host, r.other, { ...callbackIntent, requestId: randomUUID() }, s),
  ]);
  assert.deepEqual(callbackResponses.map((r) => r.status).sort(), [200, 200, 409]);
  const callbackReceipts = await Promise.all(
    callbackResponses.filter((r) => r.status === 200).map((r) => r.json()),
  );
  assert.deepEqual(callbackReceipts[0].receipt, callbackReceipts[1].receipt);
  s = await readSession(host);
  assert.equal(s.scenario.play.lore, 2);
  while (s.scenario.play.lore === 0) {
    const x = await answerFollowup(r, s);
    assert.equal(x.status, 200, await x.text());
    s = await readSession(host);
  }
  await roundtrip(); // reward is already entry-owned, message still pending
  for (let n = 0; n < 20; n++) {
    s = await readSession(host);
    if (s.scenario.pending?.kind === 'placement') break;
    const x = await answerFollowup(r, s);
    assert.equal(x.status, 200, await x.text());
  }
  await roundtrip(); // tiles in progress
  await drainFollowup(r);
  await roundtrip(); // objective/timer, before threat
  assert.equal((await cycleCommand(r, 'CONFIRM_SHADOW_STEP', { step: 'threat' })).status, 200);
  s = await readSession(host);
  assert.equal(s.scenario.pending.kind, 'physical');
  const stable = await readBackup(host);
  const ack = await command(
    host,
    r.player,
    {
      type: 'SCENARIO_INPUT',
      scenarioId: s.scenario.id,
      packFingerprint: s.scenario.packFingerprint,
      projectionFingerprint: s.scenario.projectionFingerprint,
      pendingId: s.scenario.pending.id,
      sourceFingerprint: s.scenario.pending.fingerprint,
      heroId: s.scenario.pending.heroId,
      input: { kind: 'ack' },
    },
    s,
  );
  assert.equal(ack.status, 409);
  assert.deepEqual((await readBackup(host)).payload, stable.payload);
  assert.equal((await answerFollowup(r, s)).status, 200);
  await roundtrip(); // real threshold test child
  await drainFollowup(r);
  await finishCycle(r);
  assert.equal((await cycleCommand(r, 'START_RALLY_SCOUT')).status, 200);
  await finishCycle(r);
  const checkpoint = await roundtrip();
  for (const edit of [
    (b) => b.payload.state.scenario.play.lore++,
    (b) => b.payload.state.scenario.enemies.groups[0].figures[0].health++,
    (b) => b.payload.state.scenario.enemies.groups[0].position[0]++,
    (b) => b.payload.state.scenario.enemies.attempts[0].draws[0].value++,
    (b) =>
      (b.payload.state.scenario.explorationMarkers[0].visible =
        !b.payload.state.scenario.explorationMarkers[0].visible),
    (b) => {
      b.payload.state.scenario.enemies.groups = [];
      b.payload.state.scenario.enemies.attempts = [];
    },
    (b) => b.payload.state.physical.cycle.seed.scenario.play.lore++,
  ]) {
    const bad = structuredClone(checkpoint);
    edit(bad);
    signBackup(bad);
    const at = await readSession(host);
    const x = await host.request('/api/restores', {
      backup: bad,
      generation: at.generation,
      expectedRevision: at.revision,
      confirmed: true,
    });
    assert.equal(x.status, 422);
    assert.deepEqual((await readBackup(host)).payload, checkpoint.payload);
  }
  assert.equal((await cycleCommand(r, 'START_RALLY_SCOUT', {}, r.other)).status, 200);
  await finishCycle(r);
  await roundtrip();
  assert.equal((await cycleCommand(r, 'END_RALLY')).status, 200);
  assert.equal((await cycleCommand(r, 'START_TURN')).status, 200);
  assert.equal((await readSession(host)).round.number, 3);
});
