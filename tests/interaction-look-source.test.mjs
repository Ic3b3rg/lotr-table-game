import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readyLook,
  reachLook,
  interact,
  readSession,
  readBackup,
  scenarioInput,
  ok,
} from './interaction-look-helper.mjs';

test('real three-owner A1 confirmation looks and rewards before the source callback', async (t) => {
  const r = await readyLook(t);
  const before = await reachLook(r),
    original = (await readBackup(r.host)).payload.state;
  assert.equal(before.players.length, 3);
  await ok(interact(r));
  const waiting = await readSession(r.host);
  assert.equal(waiting.physical.active?.purpose, 'interaction-look');
  assert.equal(
    waiting.preparation.heroes[0].inspiration,
    before.preparation.heroes[0].inspiration + 1,
  );
  assert.equal(waiting.scenario.pending.kind, 'physical');
  const privateState = (await readBackup(r.host)).payload.state;
  assert.deepEqual(privateState.preparation.heroes[0].deck, original.preparation.heroes[0].deck);
  assert.equal(privateState.physical.snapshot.resolution.privateLooks.length, 1);
  assert.equal(privateState.scenario.play.attempts[0].returned, false);
  await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'continue' }));
  assert.equal((await readSession(r.host)).scenario.pending.kind, 'message');
  await ok(scenarioInput(r.host, r.player, { kind: 'ack' }));
  const done = (await readBackup(r.host)).payload.state;
  assert.equal(done.scenario.play.attempts[0].returned, true);
  assert.equal(done.round.heroes[0].actionsUsed, original.round.heroes[0].actionsUsed + 1);
  assert.deepEqual(done.journey.travel, original.journey.travel);
});
