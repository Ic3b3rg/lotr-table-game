import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as combat from '../dist/combat-library.mjs';
import { deploymentSource, deploymentContext } from './fixtures/source-deployment.mjs';

test('deployment compiler derives the complete owned pool and refuses missing source dependencies', () => {
  const source = deploymentSource();
  const a = combat.compileSourceDeployment(source);
  assert.deepEqual(
    a.compiled.models.map((m) => m.source),
    ['fixture.assets:10'],
  );
  assert.equal(a.compiled.bonuses.length, 1);
  for (const missing of ['fixture.assets:11', 'fixture.assets:30']) {
    const bad = structuredClone(source);
    bad.assets = bad.assets.filter((a) => a.source !== missing);
    assert.throws(() => combat.compileSourceDeployment(bad));
  }
});

test('deployment uses real budget, figures, modifiers, frozen positions and replayable randomness', () => {
  const a = combat.compileSourceDeployment(deploymentSource());
  const context = deploymentContext();
  const result = combat.generateDeployment(a, context);
  assert.ok(result.groups.length);
  assert.deepEqual(combat.generateDeployment(a, context), result);
  assert.ok(result.remaining >= 0 && result.remaining < context.points);
  assert.ok(result.cursor > context.cursor);
  for (const group of result.groups) {
    assert.equal(group.source, 'fixture.assets:10');
    assert.equal(group.exhausted, false);
    assert.equal(group.logic, null);
    assert.ok(group.figures.length >= 1 && group.figures.length <= 3);
    assert.deepEqual(group.position, context.spaces.find((s) => s.id === group.spaceId).position);
    for (const f of group.figures) {
      assert.equal(f.health, 4 + group.bonuses.length);
      assert.equal(f.sorcery, group.bonuses.length);
    }
  }
  assert.deepEqual(context, deploymentContext());
});

test('deployment failure settles without a fabricated group; availability and pool are not interchangeable', () => {
  const a = combat.compileSourceDeployment(deploymentSource());
  const noSpace = combat.generateDeployment(a, deploymentContext({ spaces: [] }));
  assert.deepEqual(noSpace.groups, []);
  assert.equal(noSpace.reason, 'no-space');
  const noUnits = combat.generateDeployment(
    a,
    deploymentContext({ reserved: [{ source: 'fixture.assets:10', count: 6 }] }),
  );
  assert.deepEqual(noUnits.groups, []);
  assert.equal(noUnits.reason, 'no-eligible-model');
  const noBudget = combat.generateDeployment(a, deploymentContext({ points: 4 }));
  assert.deepEqual(noBudget.groups, []);
  assert.equal(noBudget.reason, 'no-eligible-model');
});
