import test from 'node:test';
import assert from 'node:assert/strict';
import {
  terrainPhysical,
  enemyChild,
  attackChild,
  physicalAnswer,
  settleSelection,
  finishPhysical,
} from './fixtures/battle-test-terrain-physical.mjs';

for (const tokens of [1, 2])
  for (const reveal of [1, 3])
    test(`${tokens} boulders, ${reveal} available fate: free per-token limit and new-test reset`, () => {
      const f = terrainPhysical({ kind: 'rock', tokens, reveal, success: 0, inspiration: 0 });
      f.open([enemyChild('first'), enemyChild('second')]);
      const use = Math.min(tokens, reveal);
      for (let n = 0; n < use; n++) {
        const option = f.p.snapshot.active.options.find((o) => o.id.startsWith('terrain:boulder:'));
        assert.ok(option);
        physicalAnswer(f, option.id);
        settleSelection(f);
        assert.equal(f.p.snapshot.resolution.sourceTest.successes, n + 1);
        assert.equal(f.p.snapshot.resolution.sourceTest.fateRemaining, reveal - n - 1);
        assert.equal(f.p.snapshot.resolution.resources.preparation.heroes[0].inspiration, 0);
        assert.equal(f.p.snapshot.resolution.sourceTest.terrain.bouldersUsed.length, n + 1);
        const before = structuredClone(f.p);
        assert.throws(() => physicalAnswer(f, option.id));
        assert.deepEqual(f.p, before);
      }
      assert.ok(!f.p.snapshot.active.options.some((o) => o.id.startsWith('terrain:boulder:')));
      physicalAnswer(f, 'resolve');
      const allocation = f.p.snapshot.active;
      assert.equal(allocation.mode, 'allocate');
      physicalAnswer(f, { kind: 'physical-allocate', ability: null, damage: 1, fear: 0 });
      assert.equal(f.p.snapshot.resolution.sourceTest.terrain.bouldersUsed.length, 0);
      assert.equal(
        f.p.snapshot.active.options.filter((o) => o.id.startsWith('terrain:boulder:')).length,
        tokens,
      );
      physicalAnswer(
        f,
        f.p.snapshot.active.options.find((o) => o.id.startsWith('terrain:boulder:')).id,
      );
      settleSelection(f);
      finishPhysical(f);
      assert.equal(f.p.snapshot.parents[0].returnCount, 1);
      assert.ok(f.p.snapshot.parents[0].results.every((r) => r.enemyOutcome.negated.damage === 1));
    });
test('boulders do not manufacture tests, attack conversions or other-cell allowance', () => {
  for (const options of [{ otherCell: true }, { fate: 0 }]) {
    const f = terrainPhysical({ kind: 'rock', success: 1, ...options });
    f.open([enemyChild()]);
    assert.ok(!f.p.snapshot.active.options.some((o) => o.id.startsWith('terrain:boulder:')));
    finishPhysical(f);
  }
  const f = terrainPhysical({ kind: 'rock' });
  f.open([attackChild]);
  assert.ok(!f.p.snapshot.active.options.some((o) => o.id.startsWith('terrain:boulder:')));
  finishPhysical(f);
  const g = terrainPhysical({ kind: 'rock' }),
    noTest = enemyChild();
  noTest.outcome.offered = { damage: 0, fear: 0 };
  g.open([noTest]);
  assert.equal(g.p.snapshot.resolution.sourceTest, undefined);
  finishPhysical(g);
});

test('two colocated tokens convert distinct icons on one actual revealed copy', () => {
  const f = terrainPhysical({
    kind: 'rock',
    tokens: 2,
    reveal: 1,
    success: 0,
    fate: 2,
    inspiration: 0,
  });
  f.open([enemyChild()]);
  let first;
  for (let n = 0; n < 2; n++) {
    physicalAnswer(
      f,
      f.p.snapshot.active.options.find((o) => o.id.startsWith('terrain:boulder:')).id,
    );
    const icon = f.p.snapshot.active.options[0].id;
    if (n) assert.notEqual(icon, first);
    else first = icon;
    settleSelection(f);
  }
  assert.equal(f.p.snapshot.resolution.sourceTest.successes, 2);
  assert.equal(f.p.snapshot.resolution.sourceTest.fateRemaining, 0);
  finishPhysical(f);
});
