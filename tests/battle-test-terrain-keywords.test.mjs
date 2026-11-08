import test from 'node:test';
import assert from 'node:assert/strict';
import { compileCombatClosure, applyGroupHits } from '../dist/combat-library.mjs';
import { closureFixture, groupFixture } from './fixtures/combat-closure.mjs';

// Independent finite arithmetic, not resolveFigureHits or compiler-derived output.
function oracle(figures, hits, modifiers) {
  const result = structuredClone(figures);
  let remaining = hits;
  for (const f of result) {
    if (!f.health) continue;
    const shield =
      (modifiers.includes('pierce') ? 0 : f.armor) + (modifiers.includes('smite') ? 0 : f.sorcery);
    const wound = Math.min(f.health, Math.max(0, remaining - shield));
    remaining = Math.max(0, remaining - shield - wound);
    f.health -= wound;
    if (!f.health) {
      f.armor = 0;
      f.sorcery = 0;
    }
  }
  return { figures: result, remaining };
}
test('prospective fire smite reaches finite-figure resolution; historical closure remains gated', () => {
  const a = compileCombatClosure(closureFixture()),
    g = groupFixture();
  assert.throws(() => applyGroupHits(a, structuredClone(g), 4, ['smite']), /closure/);
  const expected = oracle(g.figures, 4, ['smite']);
  const result = applyGroupHits(a, g, 4, ['smite'], true);
  assert.deepEqual(g.figures, expected.figures);
  assert.equal(result.unusedHits, expected.remaining);
});
test('independent finite armor/sorcery/figure oracle covers both keywords, duplicates and stun immunity', () => {
  const a = compileCombatClosure(closureFixture());
  for (const hits of [0, 1, 3, 6, 11])
    for (const modifiers of [
      ['pierce'],
      ['smite'],
      ['pierce', 'smite'],
      ['smite', 'smite'],
      ['smite', 'stun'],
    ]) {
      const g = groupFixture();
      g.figures.forEach((f, n) => {
        f.health = 3 + n;
        f.armor = 1 + n;
        f.sorcery = 2 - n;
      });
      const expected = oracle(g.figures, hits, modifiers),
        result = applyGroupHits(a, g, hits, modifiers, true);
      assert.deepEqual(g.figures, expected.figures, JSON.stringify({ hits, modifiers }));
      assert.equal(result.unusedHits, expected.remaining);
      assert.equal(g.exhausted, false, 'existing source stun immunity stays authoritative');
    }
});
