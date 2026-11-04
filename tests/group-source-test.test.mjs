import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  compilePhysicalFronts,
  freezePhysical,
  openPhysical,
  answerPhysical,
  validatePhysical,
  physicalView,
} from '../dist/physical-resolution-library.mjs';
import { frontFixture, binding, evidence } from './fixtures/physical-fronts.mjs';
import { source } from './fixtures/physical-resolution.mjs';

test('a source group trial orders owners and resolves real tests and failed covered damage once', () => {
  const f = frontFixture();
  const artifact = compilePhysicalFronts(f.raw, f.ir, f.catalog);
  const p = freezePhysical(f.raw, binding, f.heroes, '3'.repeat(64), undefined, {
    artifact,
    catalog: f.catalog,
  });
  const id = openPhysical(
    p,
    source,
    f.program([
      {
        kind: 'group-test',
        hero: 0,
        heroes: [0, 1, 2],
        stat: 'agility',
        target: 99,
        failure: { family: 'damage', amount: 2, face: 'facedown' },
      },
    ]),
    f.context,
  );
  let n = 0;
  const trials = [];
  while (p.snapshot.active && n < 60) {
    const q = p.snapshot.active;
    assert.equal(q.kind, 'decision');
    const choice = q.options.find((o) => o.id === 'reveal' || o.id === 'resolve') ?? q.options[0];
    if (choice.id === 'reveal') trials.push(q.actorHeroId);
    const input = { kind: 'physical-choice', option: choice.id };
    const before = structuredClone(p);
    assert.throws(() =>
      answerPhysical(p, id, input, evidence(100 + n, '00000000-0000-4000-8000-000000000099')),
    );
    assert.deepEqual(p, before);
    answerPhysical(p, id, input, evidence(++n, q.actorPlayerId));
  }
  assert.equal(p.snapshot.active, null);
  assert.equal(new Set(trials).size, 3);
  assert.ok(p.snapshot.areas.every((h) => h.damage.length === 2 && h.fear.length === 0));
  assert.equal(p.snapshot.resolution.faceup.length, 0);
  const result = p.snapshot.parents[0];
  assert.equal(result.returnCount, 1);
  assert.ok(result.results[0].tests.every((t) => t.outcome === 'fail'));
  assert.deepEqual(
    result.results[0].tests.map((t) => t.heroId),
    trials,
  );
  assert.equal(physicalView(p).sourceTest, null);
  assert.doesNotThrow(() => validatePhysical(JSON.parse(JSON.stringify(p))));
  assert.throws(() =>
    answerPhysical(
      p,
      id,
      { kind: 'physical-choice', option: 'resolve' },
      evidence(++n, f.heroes[0].playerId),
    ),
  );
});
