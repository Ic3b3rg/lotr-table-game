import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readyMission,
  reachMission,
  commitMission,
  drainMission,
  ok,
} from './mission-combat-helper.mjs';
import { readBackup } from './skill-test-helper.mjs';

test('real P2 defeat of the persona actor preserves its source result, global spawn and return without another attack or a new loss poll', async (t) => {
  const r = await readyMission(t, {
    success: 0,
    catalogEdit(c) {
      c.heroes[0].stats.fear = 2;
    },
  });
  await reachMission(r);
  await ok(commitMission(r, 'PUSH'));
  await drainMission(r);
  const state = (await readBackup(r.host)).payload.state,
    sc = state.scenario,
    hero = state.preparation.heroes[0].heroId;
  assert.equal(sc.play.tests[0].total, 0);
  assert.equal(sc.play.tests[0].heroId, hero);
  assert.equal(sc.play.attempts[0].returned, true);
  assert.equal(sc.play.active, null);
  assert.equal(sc.firstCombat.spawns[0].actorHeroId, hero);
  assert.equal(sc.firstCombat.spawns[0].outcome, 'spawned');
  assert.equal(sc.firstCombat.spawns[0].grant, 'none');
  assert.equal(sc.firstCombat.spawns[0].returned, true);
  assert.ok(sc.enemies.groups[0].figures.every((f) => f.health > 0));
  assert.equal(
    state.physical.snapshot.lastStand.heroes.find((h) => h.heroId === hero).defeated,
    true,
  );
  assert.equal(state.journey.heroes.find((h) => h.heroId === hero).removed, true);
  assert.equal(sc.conclusion, undefined);
  assert.equal(state.physical.snapshot.lastStand.terminal, null);
  assert.equal(sc.firstCombat.callbacks.length, 0);
});
