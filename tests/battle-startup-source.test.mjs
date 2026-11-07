import test from 'node:test';
import assert from 'node:assert/strict';
import { departureFixture, hash } from './fixtures/camp-departure.mjs';
import { compileSourceDeployment } from '../dist/combat-library.mjs';
import {
  validateCampDepartureSource,
  generateBattleDeployment,
} from '../dist/scenario-library.mjs';

const sealDeployment = (cap) => {
  for (const a of cap.deployment.assets) a.dataHash = hash(a.data);
  cap.deploymentHash = hash(compileSourceDeployment(cap.deployment));
};

test('source startup accepts a separate introduction and distinct presentation and persistent objective', async () => {
  const { cap } = await departureFixture();
  let source;
  assert.doesNotThrow(() => {
    source = validateCampDepartureSource(cap);
  });
  assert.equal(source.s.instructions[8].op, 'message');
  assert.equal(source.s.instructions[9].op, 'spawn');
  const objective = source.s.instructions.find((i) => i.op === 'objective');
  assert.notEqual(objective.text, objective.objectiveText);
  const missing = structuredClone(cap);
  delete missing.instructions.find((i) => i.op === 'objective').objectiveText;
  assert.throws(() => validateCampDepartureSource(missing));
});

test('battle preflight binds the deployment model and unfiltered adventure authority before generation', async () => {
  const { cap } = await departureFixture();
  const foreign = structuredClone(cap),
    model = foreign.deployment.assets.find((a) => a.cls === 'AdventureModel');
  model.source = 'fixture.assets:99';
  foreign.deployment.adventure = model.source;
  sealDeployment(foreign);
  assert.throws(() => validateCampDepartureSource(foreign), /[Mm]odello/);

  const narrowed = structuredClone(cap);
  narrowed.deployment.assets.find((a) => a.cls === 'AdventureModel').data.GlobalEnemyFilter = {
    MustHaveAny: 1024,
    MustHaveAll: 0,
    ExcludeIfAny: 0,
  };
  sealDeployment(narrowed);
  assert.throws(() => validateCampDepartureSource(narrowed), /[Ff]iltro/);
});

test('battle preflight rejects missing or duplicate reachable bonus costs instead of shrinking choices', async () => {
  const { cap } = await departureFixture();
  for (const costs of [
    [],
    [{ Num: 2, Cost: 3 }],
    [
      { Num: 1, Cost: 2 },
      { Num: 1, Cost: 3 },
    ],
  ]) {
    const bad = structuredClone(cap);
    bad.deployment.assets.find((a) => a.cls === 'EnemyBonusModel').data.Costs = costs;
    sealDeployment(bad);
    assert.throws(() => validateCampDepartureSource(bad), /[Cc]osti|[Cc]osto/);
  }
});

test('source language eligibility excludes a marked bonus without changing the owned model or bonus closure', async () => {
  const { cap } = await departureFixture();
  cap.deployment.assets.find((a) => a.cls === 'EnemyBonusModel').data.UnsupportedLanguage.Italian =
    1;
  sealDeployment(cap);
  const compiled = validateCampDepartureSource(cap).deployment.compiled;
  assert.equal(compiled.models.length, 2);
  assert.equal(compiled.bonuses.length, 1);
  assert.equal(compiled.bonuses[0].unsupported, true);
  const result = generateBattleDeployment(cap, 3, 'c'.repeat(64));
  assert.ok(result.groups.length > 0);
  assert.ok(result.groups.every((g) => g.bonuses.length === 0));
  assert.ok(result.attempts.every((a) => a.draws.every((d) => d.kind !== 'bonus')));
});

test('battle preflight rederives the complete 10/19/3/16 topology and thirteen source bindings', async () => {
  const { cap } = await departureFixture(),
    before = structuredClone(cap),
    source = validateCampDepartureSource(cap);
  assert.equal(source.layout.cells.length, 10);
  assert.equal(source.layout.geometricEdges.length, 19);
  assert.equal(source.layout.walls.length, 3);
  assert.equal(source.layout.walkableEdges.length, 16);
  assert.equal(source.layout.placements.length, 13);
  assert.equal(source.board.runtimeReady, false);
  assert.deepEqual(source.board.gates.boonQuantities, [null, null, null]);
  assert.deepEqual(cap, before);
  for (const edit of [
    (c) => c.instructions.reverse(),
    (c) => (c.instructions[3].count = 2),
    (c) => (c.instructions.find((i) => i.op === 'spawn').perHero = 3),
    (c) => {
      const points = c.instructions.filter((i) => i.op === 'spawn');
      points[0].anchor = points[1].anchor;
    },
    (c) => (c.instructions.find((i) => i.op === 'spawn').filter.MustHaveAny = 0),
    (c) => (c.instructions.find((i) => i.op === 'marker').anchor = 'clue'),
    (c) => (c.instructions[5].kinds = ['wall', 'wall']),
    (c) => c.deployment.assets.pop(),
  ]) {
    const bad = structuredClone(cap);
    edit(bad);
    assert.throws(() => validateCampDepartureSource(bad));
  }
  const forged = structuredClone(cap);
  forged.board.compiled.layouts[0].walkableEdges.pop();
  const { artifactFingerprint, ...body } = forged.board;
  forged.board.artifactFingerprint = hash(body);
  forged.boardFingerprint = forged.board.artifactFingerprint;
  assert.throws(() => validateCampDepartureSource(forged), /recompilation|Artifact/);
});

test('H2 keeps the unaffordable ranged source point empty without substitutes; all budgets share live finite availability', async () => {
  const { cap } = await departureFixture();
  for (const heroes of [2, 3, 4, 5]) {
    const before = structuredClone(cap),
      r = generateBattleDeployment(cap, heroes, 'c'.repeat(64));
    assert.deepEqual(generateBattleDeployment(cap, heroes, 'c'.repeat(64)), r);
    assert.deepEqual(cap, before);
    assert.equal(r.attempts.length, 3);
    assert.ok(r.attempts.flatMap((a) => a.draws).some((d) => d.kind === 'spawn-point'));
    if (heroes === 2) {
      assert.equal(r.attempts[0].groups.length, 0);
      assert.equal(r.attempts[0].remaining, 8);
      assert.equal(r.attempts[0].reason, 'no-eligible-model');
    }
    const models = validateCampDepartureSource(cap).deployment.compiled.models;
    for (const m of models)
      assert.ok(
        r.groups.filter((g) => g.source === m.source).reduce((n, g) => n + g.figures.length, 0) <=
          m.capacity,
      );
    assert.ok(r.groups.filter((g) => g.bonuses.length).length <= 6 - cap.reservedEliteBanners);
    assert.equal(
      new Set(r.groups.filter((g) => g.tokenId >= 0).map((g) => g.tokenId)).size,
      r.groups.filter((g) => g.tokenId >= 0).length,
    );
    assert.deepEqual(
      r.attempts.flatMap((a) => a.groups),
      r.groups.map((g) => g.id),
    );
  }
});
