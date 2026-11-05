import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readyMission,
  reachMission,
  commitMission,
  drainMission,
  ok,
} from './mission-combat-helper.mjs';
import { endTurns, finishCycle } from './original-round-helper.mjs';
import { rally } from './second-shadow-helper.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';
import { drainCombat } from './combat-controller-helper.mjs';
import { readSession, readBackup } from './skill-test-helper.mjs';

async function nextRound(r) {
  await endTurns(r);
  await ok(cycleCommand(r, 'BEGIN_SHADOW'));
  for (let n = 0; n < 8; n++) {
    await drainCombat(
      r,
      () => null,
      (s) => !!s.scenario.pending,
    );
    await finishCycle(r);
    await drainMission(r);
    if (!(await readSession(r.host)).combat.current) break;
  }
  r.beforeThreat = (await readBackup(r.host)).payload.state;
  await ok(cycleCommand(r, 'CONFIRM_SHADOW_STEP', { step: 'threat' }));
  await drainMission(r);
  await finishCycle(r);
  await rally(r);
  return readSession(r.host);
}
test('the real Shadow activates and refreshes the bound group; its second startup tick removes groups and sends a timer callback without defeat inspiration', async (t) => {
  const r = await readyMission(t, { shadow: true });
  await reachMission(r);
  await ok(commitMission(r));
  await drainMission(r);
  const first = await nextRound(r),
    b = first.scenario.pack.manifest.firstCombat.bindings;
  assert.equal(first.scenario.instances.find((i) => i.kind === 'timer').variables[b.timerValue], 1);
  assert.equal(first.scenario.firstCombat.callbacks.length, 0);
  const second = await nextRound(r),
    state = r.beforeThreat,
    sc = state.scenario;
  const callback = sc.firstCombat.callbacks[0];
  assert.equal(callback.cause, 'timer');
  assert.equal(callback.returned, true);
  assert.equal(sc.firstCombat.callbacks.length, 1);
  assert.ok(
    sc.enemies.groups.every((g) => g.removed === 'timer' || g.figures.every((f) => f.health === 0)),
  );
  assert.ok(
    sc.enemies.groups.some((g) => g.removed === 'timer' && g.figures.some((f) => f.health > 0)),
  );
  assert.ok(state.combat.attempts.every((a) => a.reward === null));
  assert.equal(sc.instances.find((i) => i.kind === 'timer').variables[b.running], false);
  assert.equal(sc.play.lore, 2);
  assert.equal(second.round.phase, 'action');
  assert.equal(second.round.number, 3);
});

test('expiry before interaction hides the source person and follows the same targeted logic without creating a group or a paid attempt', async (t) => {
  const r = await readyMission(t, { shadow: true });
  await nextRound(r);
  await nextRound(r);
  const sc = (await readBackup(r.host)).payload.state.scenario;
  assert.equal(sc.firstCombat.spawns.length, 0);
  assert.equal(sc.play.attempts.length, 0);
  assert.equal(sc.firstCombat.callbacks[0].cause, 'timer');
  assert.equal(sc.firstCombat.callbacks[0].groupId, null);
  assert.equal(sc.firstCombat.callbacks[0].returned, true);
  assert.equal(
    sc.instances.find((i) => i.prefab === r.pack.manifest.firstCombat.prefab).visible,
    false,
  );
  assert.equal(sc.play.lore, 2);
});
