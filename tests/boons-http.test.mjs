import test from 'node:test';
import assert from 'node:assert/strict';
import { readyBoonCombat, attackToBoon } from './boons-http-helper.mjs';
import { drainCombat } from './combat-controller-helper.mjs';
import { readBackup, readSession } from './skill-test-helper.mjs';
import { command } from './preparation-helper.mjs';
import { endTurns } from './original-round-helper.mjs';
import {
  attachActivationSource,
  attachActivationThreshold,
} from './fixtures/shadow-activations.mjs';

test('real combat controller acquires once through the ordinary ledger with receiver, retry and stale protection', async (t) => {
  const ready = await readyBoonCombat(t);
  const s = await attackToBoon(ready);
  assert.equal(s.physical.active.mode, 'choose');
  const before = await readBackup(ready.host),
    q = s.physical.cycle.pending;
  const input = {
    type: 'CYCLE_INPUT',
    runId: q.runId,
    pendingId: q.pendingId,
    sourceFingerprint: q.sourceFingerprint,
    input: { kind: 'physical-choice', option: 'hidden' },
    requestId: 'invented-boon-http-once-0000001',
  };
  assert.equal((await command(ready.host, ready.other, input, s)).status, 403);
  assert.deepEqual((await readBackup(ready.host)).payload, before.payload);
  const responses = await Promise.all([
    command(ready.host, ready.player, input, s),
    command(ready.host, ready.player, input, s),
  ]);
  const bodies = await Promise.all(
    responses.map(async (r) => {
      assert.equal(r.status, 200, await r.clone().text());
      return r.json();
    }),
  );
  assert.deepEqual(bodies[0], bodies[1]);
  const after = await readBackup(ready.host);
  assert.equal(after.payload.state.physical.snapshot.resolution.resources.boonCustody.length, 1);
  assert.equal(
    after.payload.state.physical.snapshot.resolution.resources.boonCustody[0].heroId,
    'hero-1',
  );
  assert.deepEqual(
    after.payload.state.physical.cycle.seed,
    before.payload.state.physical.cycle.seed,
  );
  assert.equal(
    (
      await command(
        ready.host,
        ready.player,
        { ...input, requestId: 'invented-boon-http-stale-000001' },
        s,
      )
    ).status,
    409,
  );
  assert.deepEqual((await readBackup(ready.host)).payload, after.payload);
  await drainCombat(ready);
  assert.equal((await readSession(ready.host)).combat.current, null);
});

test('unverified source stock exposes the known next-Shadow blocker without spending, drawing or changing a payload', async (t) => {
  const ready = await readyBoonCombat(t, false, (src, pack, frozen) => {
    attachActivationSource(src, [
      ...new Set(frozen.mapGeneration.projection.spaces.map((s) => s.tileSource)),
    ]);
    src.shadow.controller = { ...src.shadow.controller, ...pack.manifest.rounds.controller };
    attachActivationThreshold(src, pack);
  });
  await endTurns(ready);
  const before = await readBackup(ready.host),
    s = await readSession(ready.host);
  assert.equal(s.physical.nextShadow.enabled, false);
  assert.match(s.physical.nextShadow.reason, /riserva.*verificat/i);
  assert.deepEqual((await readBackup(ready.host)).payload, before.payload);
});
