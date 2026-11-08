import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGeneratorPack } from '../dist/map-freeze-library.mjs';
import { catalogFixture } from './fixtures/catalog.mjs';
import { adventure3Generator } from './fixtures/adventure3-startup.mjs';

test('prospective A3 accepts the complete seven-section recipe without reinterpreting the four-section A1 format', () => {
  const raw = adventure3Generator(catalogFixture());
  const parsed = parseGeneratorPack(raw);
  assert.equal(parsed.identity.adventureId, 3);
  assert.equal(parsed.template.selection.standard.length, 120);
  assert.deepEqual(
    parsed.template.selection.sections.map((s) => s.index),
    [0, 1, 2, 3, 4, 5, 6],
  );
  assert.deepEqual(parsed.template.selection.requiredConnections, [
    [0, 1],
    [1, 3],
    [1, 4],
    [1, 5],
    [1, 6],
    [1, 2],
  ]);
  const disguised = structuredClone(raw);
  disguised.algorithm = 'session-A1-generator-pack-v1';
  disguised.identity.adventureId = 1;
  assert.throws(() => parseGeneratorPack(disguised));
});
