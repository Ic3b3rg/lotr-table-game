import { hash } from './fixtures/map-freeze.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { compileScenarioPack, parseScenarioPack } from '../dist/scenario-library.mjs';
import { campItemCompilation } from './fixtures/camp-items.mjs';

test('camp item capability is optional, source certified and frozen without changing earlier fields', () => {
  const input = campItemCompilation();
  const old = structuredClone(input);
  delete old.pack.manifest.campItems;
  delete old.campItemsCertificate;
  const previous = compileScenarioPack(old);
  const expected = structuredClone(previous.pack);
  expected.manifest.campItems = structuredClone(input.pack.manifest.campItems);
  const compiled = compileScenarioPack(input);
  assert.deepEqual(compiled.pack, expected);
  assert.deepEqual(parseScenarioPack(compiled.pack).pack, expected);
  const missing = structuredClone(input);
  delete missing.campItemsCertificate;
  assert.throws(() => compileScenarioPack(missing), /oggett|campo|attestat/i);
  delete missing.pack.manifest.campItems;
  const historical = compileScenarioPack(missing);
  delete expected.manifest.campItems;
  assert.deepEqual(historical.pack, expected);
});

test('coherently certified item capabilities reject duplicate identities, stock, rank jumps, products, evidence and unrelated controllers', () => {
  for (const edit of [
    (cap) => {
      cap.ownedProductIds = [1];
    },
    (cap) => {
      cap.product.items[0].quantity++;
    },
    (cap) => {
      cap.cards[0].quantity++;
    },
    (cap) => {
      cap.cards[0].model.source = cap.cards[1].model.source;
    },
    (cap) => {
      cap.cards[0].model.modelId = cap.cards[1].model.modelId;
    },
    (cap) => {
      cap.cards[5].model.level = 3;
    },
    (cap) => {
      cap.methods.confirm.assemblyHash = 'e'.repeat(64);
    },
    (cap) => {
      cap.failureFingerprint = 'd'.repeat(64);
    },
    (cap) => {
      cap.cards[0].evidence.links[0].sourceId = 'missing';
    },
  ]) {
    const input = campItemCompilation();
    edit(input.pack.manifest.campItems);
    input.campItemsCertificate.instructionHash = hash(input.pack.manifest.campItems);
    assert.throws(() => compileScenarioPack(input));
  }
});
