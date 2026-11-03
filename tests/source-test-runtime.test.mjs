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
import { frontFixture, binding, evidence, hash } from './fixtures/physical-fronts.mjs';
import { source } from './fixtures/physical-resolution.mjs';
test('source test reveals real cards, pays conversions and returns its own result', () => {
  const f = frontFixture();
  const h = f.context.preparation.heroes[0];
  h.inspiration = 2;
  const artifact = compilePhysicalFronts(f.raw, f.ir, f.catalog);
  const p = freezePhysical(f.raw, binding, f.heroes, '1'.repeat(64), undefined, {
    artifact,
    catalog: f.catalog,
  });
  const id = openPhysical(
    p,
    source,
    f.program([{ kind: 'test', hero: 0, stat: 'wisdom', target: null }]),
    f.context,
  );
  assert.equal(p.snapshot.active.options[0].id, 'reveal');
  answerPhysical(
    p,
    id,
    { kind: 'physical-choice', option: 'reveal' },
    evidence(1, f.heroes[0].playerId),
  );
  const view = physicalView(p);
  assert.equal(view.sourceTest.stat, 'wisdom');
  assert.equal(view.sourceTest.heroId, h.heroId);
  assert.ok(view.sourceTest.cards.length > 0);
  const before = view.sourceTest.successes;
  if (view.sourceTest.fateRemaining) {
    answerPhysical(
      p,
      id,
      { kind: 'physical-choice', option: 'inspiration' },
      evidence(2, f.heroes[0].playerId),
    );
    assert.equal(physicalView(p).sourceTest.successes, before + 1);
    assert.equal(p.snapshot.resolution.resources.preparation.heroes[0].inspiration, 1);
  }
  const successes = physicalView(p).sourceTest.successes;
  answerPhysical(
    p,
    id,
    { kind: 'physical-choice', option: 'resolve' },
    evidence(3, f.heroes[0].playerId),
  );
  assert.equal(p.snapshot.parents[0].results[0].successes, successes);
  assert.equal(p.snapshot.parents[0].returnCount, 1);
  assert.equal(physicalView(p).sourceTest, null);
  assert.doesNotThrow(() => validatePhysical(JSON.parse(JSON.stringify(p))));
});

test('a conversion scout holds the source-test cards and cannot replace its parent result', () => {
  const f = frontFixture(),
    h = f.context.preparation.heroes[0],
    card = f.catalog.skills.find((c) => c.id === 'role-1-skill-1');
  f.ir.policies.push({
    id: card.id,
    kind: 'skill',
    definitionHash: hash(card),
    source: { sourceId: 'invented', locator: 'Fixture!nested-source-test' },
    effects: [{ op: 'convert-one-scout', scout: 1 }],
  });
  const artifact = compilePhysicalFronts(f.raw, f.ir, f.catalog),
    p = freezePhysical(f.raw, binding, f.heroes, '1'.repeat(64), undefined, {
      artifact,
      catalog: f.catalog,
    });
  const id = openPhysical(
    p,
    source,
    f.program([{ kind: 'test', hero: 0, stat: 'wisdom', target: null }]),
    f.context,
  );
  let n = 0;
  const answer = (input) => answerPhysical(p, id, input, evidence(++n, f.heroes[0].playerId));
  answer({ kind: 'physical-choice', option: 'reveal' });
  const before = physicalView(p).sourceTest.successes;
  const held = [...p.snapshot.resolution.revealed[0].cards];
  answer({ kind: 'physical-choice', option: h.prepared[0] });
  assert.equal(p.snapshot.active.mode, 'scout');
  assert.equal(physicalView(p).sourceTest.successes, before + 1);
  assert.ok(p.snapshot.active.options.every((o) => !held.includes(o.id)));
  const top = p.snapshot.active.options.map((o) => o.id);
  answer({ kind: 'physical-scout', prepare: null, discard: null, top, bottom: [] });
  assert.equal(p.snapshot.active.mode, 'choose');
  assert.equal(physicalView(p).sourceTest.successes, before + 1);
  answer({ kind: 'physical-choice', option: 'resolve' });
  assert.equal(p.snapshot.parents[0].results[0].successes, before + 1);
  assert.equal(p.snapshot.parents[0].returnCount, 1);
  assert.doesNotThrow(() => validatePhysical(JSON.parse(JSON.stringify(p))));
});
