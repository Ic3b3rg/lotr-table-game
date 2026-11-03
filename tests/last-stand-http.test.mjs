import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readyLastStand } from './last-stand-helper.mjs';
import { reachPhysical } from './physical-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';
import { readSession, readBackup } from './skill-test-helper.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';

test('P2 HTTP computes the test and returns the exact scenario parent with conserved resources and receipts', async (t) => {
  const ready = await readyLastStand(t, undefined, undefined, (c) => {
    for (const s of c.skills) {
      s.success = 1;
      s.fate = 0;
    }
  });
  const first = await reachPhysical(ready);
  assert.equal(first.physical.active.kind, 'decision');
  assert.equal(first.physical.active.options[0].id, 'reveal');
  assert.equal(first.schemaVersion, 14);
  assert.equal(
    (await scenarioInput(ready.host, ready.other, { kind: 'physical-choice', option: 'reveal' }))
      .status,
    403,
  );
  assert.equal((await scenarioInput(ready.host, ready.player, { kind: 'ack' })).status, 409);
  for (const option of ['reveal', 'resolve']) {
    const r = await scenarioInput(ready.host, ready.player, { kind: 'physical-choice', option });
    assert.equal(r.status, 200, await r.text());
  }
  const done = await readSession(ready.host),
    backup = await readBackup(ready.host);
  assert.equal(done.scenario.pending.kind, 'objective');
  assert.equal(done.physical.parents[0].returnCount, 1);
  assert.equal(done.physical.lastStand.heroes[0].difficulty, 2);
  assert.equal(done.physical.lastStand.selections[0].outcome, 'pass');
  assert.equal(backup.payload.state.physical.snapshot.decks.damage.length, 28);
  assert.equal(backup.payload.state.preparation.heroes[0].inspiration, 2);
  for (const hidden of [
    'entropy',
    'rngCursor',
    'population',
    'instructionHash',
    'cardHash',
    'invented-damage-',
  ])
    assert.ok(!JSON.stringify(done).includes(hidden), hidden);
});

test('a defeated hero leaves the map, cannot take ordinary actions, and loss occurs at the next shadow boundary', async (t) => {
  const ready = await readyLastStand(
    t,
    (_pack, pr) => {
      pr.children[0].face = 'faceup';
    },
    (input) => {
      for (const d of input.definitions) d.body = [{ op: 'keep-faceup' }];
    },
  );
  await reachPhysical(ready);
  // No usable inspiration: the real zero-success test fails; faceup limit also forces failure.
  for (const option of ['reveal', 'resolve']) {
    const r = await scenarioInput(ready.host, ready.player, { kind: 'physical-choice', option });
    assert.equal(r.status, 200, await r.text());
  }
  const defeated = await readSession(ready.host);
  assert.equal(defeated.journey.heroes[0].removed, true);
  assert.equal(defeated.physical.lastStand.heroes[0].defeated, true);
  assert.equal(defeated.physical.lastStand.terminal, null);
  for (let n = 0; n < 3; n++) {
    const s = await readSession(ready.host);
    if (!s.scenario.pending) break;
    const r = await scenarioInput(ready.host, ready.other, { kind: 'ack' });
    assert.equal(r.status, 200, await r.text());
  }
  assert.equal((await cycleCommand(ready, 'START_TURN')).status, 409);
  let r = await cycleCommand(ready, 'START_TURN', {}, ready.other);
  assert.equal(r.status, 200, await r.text());
  r = await cycleCommand(ready, 'END_TURN', {}, ready.other);
  assert.equal(r.status, 200, await r.text());
  r = await cycleCommand(ready, 'BEGIN_SHADOW', {}, ready.other);
  assert.equal(r.status, 200, await r.text());
  const terminal = await readSession(ready.host);
  assert.equal(terminal.physical.lastStand.terminal.timing, 'shadow-start');
  assert.equal(terminal.physical.lastStand.terminal.kind, 'adventure-loss');
  assert.equal(
    (await cycleCommand(ready, 'CONFIRM_SHADOW_STEP', { step: 'enemies' }, ready.other)).status,
    409,
  );
  const p = (await readBackup(ready.host)).payload.state.physical;
  assert.equal(p.snapshot.areas[0].damage.length, 5);
  assert.equal(p.snapshot.parents[0].returnCount, 1);
});
