import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readyMission,
  reachMission,
  commitMission,
  drainMission,
  ok,
} from './mission-combat-helper.mjs';
import { readSession, readBackup } from './skill-test-helper.mjs';

test('the real source interaction pays once, spawns two figures at the realized pose, binds logic and preserves the startup timer', async (t) => {
  const r = await readyMission(t);
  const before = await reachMission(r),
    actions = before.round.heroes[0].actionsUsed;
  await ok(commitMission(r));
  const s = await drainMission(r),
    backup = await readBackup(r.host),
    sc = backup.payload.state.scenario;
  assert.equal(s.round.heroes[0].actionsUsed, actions + 1);
  assert.equal(sc.firstCombat.spawns.length, 1);
  const spawn = sc.firstCombat.spawns[0],
    g = sc.enemies.groups.find((g) => g.id === spawn.groupId);
  assert.equal(spawn.outcome, 'spawned');
  assert.equal(spawn.grant, 'none');
  assert.equal(g.figures.length, 2);
  assert.equal(
    g.logic,
    r.pack.manifest.firstCombat.definitions.find((d) => d.role === 'logic').source,
  );
  assert.equal(spawn.availableBefore, 6);
  assert.equal(spawn.availableAfter, 4);
  assert.equal(spawn.budgetBefore, 0);
  assert.equal(spawn.budgetAfter, 0);
  assert.equal(g.spaceId, r.pack.manifest.firstCombat.pose.spaceId);
  assert.deepEqual(
    g.position,
    r.frozen.mapGeneration.projection.spaces.find((s) => s.id === g.spaceId).nodePosition,
  );
  const timer = sc.instances.find((i) => i.kind === 'timer'),
    b = r.pack.manifest.firstCombat.bindings;
  assert.equal(timer.variables[b.timerValue], 2);
  assert.equal(timer.variables[b.armed], true);
  assert.equal(timer.variables[b.revealed], false);
  assert.equal(sc.play.active, null);
  assert.equal(sc.play.attempts[0].returned, true);
});

test('unverified benefit quantities gate the complete persona before action, cards, spawn or random effects', async (t) => {
  const r = await readyMission(t, { verified: false });
  await reachMission(r);
  const before = await readBackup(r.host),
    view = await readSession(r.host);
  const result = await commitMission(r, 'TALK');
  assert.equal(result.status, 409);
  assert.match(await result.text(), /benefic|riserva|quantit/i);
  assert.deepEqual((await readBackup(r.host)).payload, before.payload);
  assert.deepEqual(await readSession(r.host), view);
});
