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
