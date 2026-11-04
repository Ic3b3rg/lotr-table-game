import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as combat from '../dist/combat-library.mjs';
import { hash } from './fixtures/map-freeze.mjs';
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

test('deployment verification refuses accessors and inherited input without executing getters', () => {
  for (const location of ['source', 'compiled', 'inherited']) {
    const artifact = combat.compileSourceDeployment(deploymentSource());
    const source = artifact.source;
    let reads = 0;
    const getter = {
      enumerable: true,
      get() {
        reads++;
        return location === 'compiled' ? 1 : source;
      },
    };
    if (location === 'source') Object.defineProperty(artifact, 'source', getter);
    else if (location === 'compiled')
      Object.defineProperty(artifact.compiled.preferences, 'bonus', getter);
    else {
      delete artifact.source;
      Object.setPrototypeOf(artifact, Object.defineProperty({}, 'source', getter));
    }
    assert.throws(() => combat.verifySourceDeployment(artifact), location);
    assert.equal(reads, 0, location);
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

test('deployment keeps first-match repeated bonus costs and excludes only the source language flag', () => {
  const source = deploymentSource();
  const bonus = source.assets.find((a) => a.cls === 'EnemyBonusModel');
  bonus.data.Costs = [
    { Num: 1, Cost: 2 },
    { Num: 1, Cost: 8 },
    { Num: 1, Cost: 12 },
  ];
  // Re-attest this entirely invented fixture after changing the native-shaped table.
  bonus.dataHash = hash(bonus.data);
  const a = combat.compileSourceDeployment(source);
  assert.deepEqual(a.compiled.bonuses[0].costs, [
    { size: 1, points: 2 },
    { size: 1, points: 8 },
    { size: 1, points: 12 },
  ]);
  bonus.data.UnsupportedLanguage.Italian = true;
  bonus.dataHash = hash(bonus.data);
  const b = combat.compileSourceDeployment(source);
  assert.equal(b.compiled.bonuses.length, 1);
  for (let n = 0; n < 8; n++)
    assert.ok(
      combat
        .generateDeployment(b, deploymentContext({ entropy: String(n).repeat(64) }))
        .groups.every((g) => g.bonuses.length === 0),
    );
});
