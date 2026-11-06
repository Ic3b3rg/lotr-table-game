import test from 'node:test';
import assert from 'node:assert/strict';
import { compileScenarioPack } from '../dist/scenario-library.mjs';
import { preparationCompilation } from './fixtures/camp-preparation.mjs';
import { hash } from './fixtures/map-freeze.mjs';

test('next preparation is optional, certified and preserves every previous frozen field', () => {
  const input = preparationCompilation(),
    old = structuredClone(input);
  delete old.pack.manifest.campPreparation;
  delete old.campPreparationCertificate;
  const before = compileScenarioPack(old),
    after = compileScenarioPack(input);
  const expected = structuredClone(before.pack);
  expected.manifest.campPreparation = input.pack.manifest.campPreparation;
  assert.deepEqual(after.pack, expected);
  delete input.campPreparationCertificate;
  assert.throws(() => compileScenarioPack(input), /preparazione.*attestat/i);
});

test('coherently signed preparation rejects unrelated source, catalog, previous capability and duplicate card bindings', () => {
  for (const edit of [
    (c) => {
      c.skillsFingerprint = 'e'.repeat(64);
    },
    (c) => {
      c.itemsFingerprint = 'e'.repeat(64);
    },
    (c) => {
      c.methods.select.assemblyHash = 'e'.repeat(64);
    },
    (c) => {
      c.cards[0].cardId = c.cards[1].cardId;
    },
    (c) => {
      c.cards[0].evidence[0].sourceId = 'missing';
    },
    (c) => {
      c.cards[0].kind = 'weakness';
    },
    (c) => {
      c.cards[0].number = 0;
    },
  ]) {
    const input = preparationCompilation();
    edit(input.pack.manifest.campPreparation);
    input.campPreparationCertificate.instructionHash = hash(input.pack.manifest.campPreparation);
    assert.throws(() => compileScenarioPack(input));
  }
});
