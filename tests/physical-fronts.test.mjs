import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hash } from './fixtures/map-freeze.mjs';
import { diagnosticRaw, inventedFrontInput as input } from './fixtures/physical-fronts.mjs';
import { compilePhysicalFronts } from '../dist/physical-resolution-library.mjs';

test('front compiler binds all 36 definitions to raw fields and rejects unknown or altered programs', () => {
  const raw = diagnosticRaw(),
    ir = input(raw);
  const compiled = compilePhysicalFronts(raw, ir);
  assert.equal(compiled.definitions.length, 36);
  assert.equal(compiled.version, 1);
  assert.equal(compiled.rawFingerprint, hash(raw));
  assert.throws(() => compilePhysicalFronts(raw, { ...ir, definitions: ir.definitions.slice(1) }));
  for (const edit of [
    (c) => {
      c.cardHash = 'a'.repeat(64);
    },
    (c) => {
      c.originalHash = 'b'.repeat(64);
    },
    (c) => {
      c.body = [{ op: 'ignored-unknown' }];
    },
    (c) => {
      c.body = [{ op: 'suffer', hero: 'self', family: 'damage', n: -1, face: 'down' }];
    },
    (c) => {
      c.source.locator = 'Invented!Wrong';
    },
  ]) {
    const changed = structuredClone(ir);
    edit(changed.definitions[0]);
    assert.throws(() => compilePhysicalFronts(raw, changed));
  }
  const duplicate = structuredClone(ir);
  duplicate.definitions[1] = duplicate.definitions[0];
  assert.throws(() => compilePhysicalFronts(raw, duplicate));
});
