import test from 'node:test';
import assert from 'node:assert/strict';
import {
  terrainPhysical,
  attackChild,
  physicalAnswer,
  settleSelection,
  finishPhysical,
} from './fixtures/battle-test-terrain-physical.mjs';

// Independent multiset oracle: individual printed/converted icons and surviving costs.
function oracle(cards, converted = [], removed = [], spent = 0) {
  const icons = cards
    .flatMap((c) => [
      ...Array.from({ length: c.success }, (_, n) => ({ copy: c.copy, id: `s${n}`, value: 1 })),
      ...Array.from({ length: c.fate }, (_, n) => ({
        copy: c.copy,
        id: `f${n}`,
        value: converted.includes(c.copy) ? 1 : 0,
      })),
    ])
    .filter((i) => !removed.includes(i.copy));
  const success = icons.reduce((n, i) => n + i.value, 0);
  return {
    success,
    remaining: success - spent,
    fate: icons.filter((i) => i.id.startsWith('f') && !converted.includes(i.copy)).length,
  };
}
for (const modifier of ['pierce', 'smite'])
  for (const timing of ['before', 'converted', 'spent'])
    test(`real fire ${modifier} removes all copy icons ${timing}`, () => {
      const f = terrainPhysical();
      f.open([attackChild]);
      const initial = f.p.snapshot.resolution.sourceTest.cards,
        paid = initial[0],
        rawHeld = [...f.p.snapshot.resolution.revealed[0].cards];
      let spent = 0;
      if (timing === 'converted') {
        physicalAnswer(f, 'inspiration');
        settleSelection(f, paid.copy);
      }
      if (timing === 'spent') {
        physicalAnswer(f, 'resolve');
        physicalAnswer(f, 'slot:one');
        spent = 1;
      }
      const option = `terrain:fire:${paid.copy}:${modifier}`;
      assert.ok(f.p.snapshot.active.options.some((o) => o.id === option));
      const inspiration = f.p.snapshot.resolution.resources.preparation.heroes[0].inspiration;
      physicalAnswer(f, option);
      const view = f.p.snapshot.resolution.sourceTest,
        expected = oracle(initial, timing === 'converted' ? [paid.copy] : [], [paid.copy], spent);
      assert.equal(view.successes, expected.success);
      assert.equal(view.fateRemaining, expected.fate);
      assert.equal(view.terrain.fire.modifier, modifier);
      assert.equal(view.terrain.fire.copy, paid.copy);
      assert.equal(view.terrain.fire.excludedSuccess, 1);
      assert.equal(view.terrain.fire.excludedFate, 1);
      assert.equal(f.p.snapshot.resolution.attackTest.remaining, expected.remaining);
      assert.equal(
        f.p.snapshot.resolution.resources.preparation.heroes[0].inspiration,
        inspiration,
      );
      assert.deepEqual(f.p.snapshot.resolution.revealed[0].cards, rawHeld.slice(1));
      assert.equal(
        f.p.snapshot.resolution.resources.preparation.heroes[0].discard.filter(
          (c) => c === rawHeld[0],
        ).length,
        1,
      );
      const unchanged = structuredClone(f.p);
      assert.throws(() => physicalAnswer(f, option));
      assert.deepEqual(f.p, unchanged);
      assert.ok(!f.p.snapshot.active.options.some((o) => o.id.startsWith('terrain:fire:')));
      finishPhysical(f);
      const result = f.p.snapshot.parents[0].results[0].attack;
      assert.deepEqual(result.modifiers, [modifier]);
      assert.equal(result.successes, 2);
      assert.equal(
        result.successes,
        result.allocations.reduce((n, a) => n + a.successes.length, 0) + result.unspent,
      );
      assert.equal(f.p.snapshot.parents[0].returnCount, 1);
      const all = f.p.snapshot.resolution.resources.preparation.heroes[0];
      assert.equal(
        [...all.deck, ...all.discard, ...all.prepared].filter((c) => c === rawHeld[0]).length,
        1,
      );
      assert.deepEqual(
        all.prepared,
        f.context.preparation.heroes[0].prepared,
        'revealed text cannot pay a prepared discard ability',
      );
    });
test('paid item costs cannot be funded by a later discarded copy; decline and no-fate stay playable', () => {
  const f = terrainPhysical();
  f.open([attackChild]);
  physicalAnswer(f, 'resolve');
  physicalAnswer(f, 'slot:one');
  physicalAnswer(f, 'slot:two');
  assert.ok(!f.p.snapshot.active.options.some((o) => o.id.startsWith('terrain:fire:')));
  finishPhysical(f);
  assert.equal(f.p.snapshot.parents[0].results[0].attack.hits, 5);
  for (const options of [{ fate: 0 }, { otherCell: true }, {}]) {
    const g = terrainPhysical(options);
    g.open([attackChild]);
    if (options.fate === 0 || options.otherCell)
      assert.ok(!g.p.snapshot.active.options.some((o) => o.id.startsWith('terrain:')));
    finishPhysical(g);
    assert.deepEqual(g.p.snapshot.parents[0].results[0].attack.modifiers, []);
  }
});

test('a mixed two-success/two-fate copy loses converted and unconverted icons together', () => {
  const f = terrainPhysical({ success: 2, fate: 2, reveal: 2 });
  f.open([attackChild]);
  const first = f.p.snapshot.resolution.sourceTest.cards[0];
  physicalAnswer(f, 'inspiration');
  settleSelection(f, first.copy);
  assert.equal(f.p.snapshot.resolution.sourceTest.successes, 5);
  assert.equal(f.p.snapshot.resolution.sourceTest.fateRemaining, 3);
  physicalAnswer(f, `terrain:fire:${first.copy}:smite`);
  assert.equal(f.p.snapshot.resolution.sourceTest.successes, 2);
  assert.equal(f.p.snapshot.resolution.sourceTest.fateRemaining, 2);
  assert.equal(f.p.snapshot.resolution.resources.preparation.heroes[0].inspiration, 1);
  finishPhysical(f);
});

test('a revealed-copy fire choice cannot cross into a distinct subsequent attack test', () => {
  const f = terrainPhysical();
  f.open([attackChild, attackChild]);
  const prior = f.p.snapshot.active.options.find((o) => o.id.startsWith('terrain:fire:')).id;
  physicalAnswer(f, prior);
  physicalAnswer(f, 'resolve');
  physicalAnswer(f, 'apply');
  assert.equal(f.p.snapshot.resolution.sourceTest.terrain.fire, null);
  assert.ok(!f.p.snapshot.active.options.some((o) => o.id === prior));
  const before = structuredClone(f.p);
  assert.throws(() => physicalAnswer(f, prior));
  assert.deepEqual(f.p, before);
  finishPhysical(f);
});
