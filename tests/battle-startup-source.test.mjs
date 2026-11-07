import test from 'node:test';
import assert from 'node:assert/strict';
import { departureFixture, hash } from './fixtures/camp-departure.mjs';
import {
  validateCampDepartureSource,
  generateBattleDeployment,
} from '../dist/scenario-library.mjs';

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
    (c) => (c.instructions[8].perHero = 3),
    (c) => (c.instructions[8].anchor = c.instructions[9].anchor),
    (c) => (c.instructions[8].filter.MustHaveAny = 0),
    (c) => (c.instructions[11].anchor = 'clue'),
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
