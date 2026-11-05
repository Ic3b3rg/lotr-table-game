import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import {
  readyMission,
  reachMission,
  commitMission,
  drainMission,
  ok,
} from './mission-combat-helper.mjs';
import { readBackup } from './skill-test-helper.mjs';
const code = buildSync({
  stdin: {
    resolveDir: process.cwd(),
    contents: "export {spawnFirstCombat} from './src/scenario/first-combat';",
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  target: 'node24',
}).outputFiles[0].text;
const runtime = await import(
  `data:text/javascript;base64,${Buffer.from(code + '\n//# sourceURL=mission-supply-test.mjs').toString('base64')}`
);

test('real compiler/program availability counts pending figures, preserves failure budgets and never shrinks two to one or invents bonuses', async (t) => {
  const r = await readyMission(t);
  await reachMission(r);
  await ok(commitMission(r));
  await drainMission(r);
  const original = (await readBackup(r.host)).payload.state,
    action = r.pack.definitions
      .find((d) => d.source === r.pack.principal)
      .states.flatMap((s) => s.actions)
      .find((a) => a.op === 'spawnFixed'),
    receipt = original.scenario.firstCombat.spawns[0],
    template = original.scenario.enemies.groups.find((g) => g.id === receipt.groupId);
  function state(count, placed, budget = 0) {
    const s = structuredClone(original),
      sc = s.scenario;
    sc.firstCombat.spawns = [];
    sc.firstCombat.callbacks = [];
    sc.play.active = sc.play.attempts[0].id;
    sc.globals[r.pack.manifest.followup.enemyPointsBinding] = budget;
    sc.enemies.groups = Array.from({ length: Math.ceil(count / 3) }, (_, n) => ({
      ...structuredClone(template),
      id: 'invented-pending-' + n,
      logic: null,
      placed,
      figures: Array.from({ length: Math.min(3, count - n * 3) }, (_, m) => ({
        ...structuredClone(template.figures[0]),
        id: `invented-pending-${n}-${m}`,
      })),
    }));
    return s;
  }
  for (const placed of [true, false]) {
    const s = state(4, placed, 9),
      spawn = runtime.spawnFirstCombat(s, action, 'invented-capacity-four-' + placed);
    assert.equal(spawn.outcome, 'spawned');
    assert.equal(spawn.availableBefore, 2);
    assert.equal(spawn.availableAfter, 0);
    assert.equal(spawn.budgetBefore, 9);
    assert.equal(spawn.budgetAfter, 9);
    assert.equal(s.scenario.enemies.groups.at(-1).figures.length, 2);
    assert.deepEqual(s.scenario.enemies.groups.at(-1).bonuses, []);
    assert.ok(
      s.scenario.enemies.groups.at(-1).tokenId >= 0,
      'a second normal group of the same model uses the existing banner allocator',
    );
    const short = state(5, placed, 9),
      before = structuredClone(short);
    assert.throws(
      () => runtime.spawnFirstCombat(short, action, 'invented-shortage-' + placed),
      /due posti/,
    );
    assert.deepEqual(short, before);
    const full = state(6, placed, 9),
      failed = runtime.spawnFirstCombat(
        full,
        { ...action, grant: true },
        'invented-full-' + placed,
      );
    assert.equal(failed.outcome, 'unavailable');
    assert.equal(failed.groupId, null);
    assert.equal(failed.grant, 'none');
    assert.equal(failed.budgetAfter, 9);
    assert.equal(full.scenario.enemies.groups.length, 2);
  }
  const removed = state(6, false);
  removed.scenario.enemies.groups.forEach((g) => (g.removed = 'timer'));
  assert.equal(runtime.spawnFirstCombat(removed, action, 'invented-removed').availableBefore, 6);
  assert.equal(r.pack.manifest.firstCombat.configuration.physicalInventoryPerType, null);
});
