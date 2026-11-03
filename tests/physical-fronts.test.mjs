import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hash } from './fixtures/map-freeze.mjs';
import { diagnosticRaw } from './fixtures/physical-resolution.mjs';
import { compilePhysicalFronts } from '../dist/physical-resolution-library.mjs';

function input(raw) {
  return {
    version: 1,
    definitions: raw.cards
      .filter((c) => ['damage', 'fear'].includes(c.family))
      .map((c) => ({
        cardId: c.id,
        cardHash: hash(c),
        originalHash: hash(c.text.original),
        source: c.text.original?.reference ?? c.text.evidence[0],
        body: [{ op: 'self-flip-down' }],
        persistent: [],
      })),
    policies: [],
  };
}
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
export { input as inventedFrontInput };
