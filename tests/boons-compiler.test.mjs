import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as api from '../dist/physical-resolution-library.mjs';
import {
  inspectPhysicalContent,
  requirePhysicalFamily,
} from '../dist/physical-content-library.mjs';
import { boonFixture } from './fixtures/boons.mjs';
import { binding } from './fixtures/physical-fronts.mjs';

test('boon compiler separates verified definitions from unverified stock without certifying family57', () => {
  const f = boonFixture(false);
  const a = api.compileBoons(f.raw, f.boonInput);
  assert.equal(a.stock.status, 'unverified');
  assert.equal(a.runtimeReady, false);
  assert.equal(a.definitions.length, 3);
  assert.deepEqual(a.stock.copies, []);
  assert.equal(inspectPhysicalContent(f.raw).status, 'diagnostic');
  assert.throws(() => requirePhysicalFamily(f.raw, 'boon'));
  assert.ok(Object.isFrozen(a) && Object.isFrozen(a.definitions[0].effects));
  assert.doesNotThrow(() => api.validateBoonArtifact(f.raw, JSON.parse(JSON.stringify(a))));
});

test('boon compiler derives effects and exact copy stock from invented attested fields', () => {
  const f = boonFixture();
  const a = api.compileBoons(f.raw, f.boonInput);
  assert.equal(a.runtimeReady, true);
  assert.equal(a.stock.status, 'verified');
  assert.equal(a.stock.copies.length, 15);
  assert.deepEqual(a.stock.quantities, { determined: 2, emboldened: 4, hidden: 9 });
  assert.equal(a.definitions[1].effects[0].n, 4);
  assert.equal(a.definitions[2].effects[1].n, 5);
  assert.equal(f.boonInput.definitions[1].effects[0].n, undefined);
});

test('boon compiler rejects missing definitions, fields, provenance, foreign copies and forged effects', () => {
  const f = boonFixture();
  for (const edit of [
    (x) => x.boonInput.definitions.pop(),
    (x) => {
      x.boonInput.definitions[1].kind = 'determined';
    },
    (x) => {
      x.boonInput.definitions[0].cardHash = 'f'.repeat(64);
    },
    (x) => {
      x.boonInput.definitions[0].originalHash = 'f'.repeat(64);
    },
    (x) => {
      x.boonInput.definitions[0].mechanicsHash = 'f'.repeat(64);
    },
    (x) => {
      x.boonInput.rules[0].sourceId = 'missing-source';
    },
    (x) => {
      x.boonInput.definitions[0].source.locator = 'wrong';
    },
    (x) => {
      x.boonInput.definitions[1].effects[0].valueIndex = 1;
    },
    (x) => {
      x.boonInput.definitions[1].effects[0].n = 2;
    },
    (x) => {
      x.raw.cards.find((c) => c.family === 'boon').text.status = 'unresolved';
    },
  ]) {
    const x = structuredClone({ raw: f.raw, boonInput: f.boonInput });
    edit(x);
    assert.throws(() => api.compileBoons(x.raw, x.boonInput));
  }
  const a = structuredClone(api.compileBoons(f.raw, f.boonInput));
  a.stock.copies[0].id = 'foreign-copy';
  assert.throws(() => api.validateBoonArtifact(f.raw, a));
});

test('boon compiler rejects accessors, non-JSON and oversized inputs before traversal', () => {
  const f = boonFixture();
  let reads = 0;
  Object.defineProperty(f.boonInput, 'injected', {
    enumerable: true,
    get() {
      reads++;
      return 1;
    },
  });
  assert.throws(() => api.compileBoons(f.raw, f.boonInput));
  assert.equal(reads, 0);
  assert.throws(() =>
    api.compileBoons(f.raw, { ...boonFixture().boonInput, extra: 'x'.repeat(20000) }),
  );
});

test('boon rules freeze before any run and survive serialization; retrofits and changed stock fail', () => {
  const f = boonFixture(false),
    a = api.compileBoons(f.raw, f.boonInput);
  const fronts = {
    artifact: api.compilePhysicalFronts(f.raw, f.ir, f.catalog),
    catalog: f.catalog,
  };
  const p = api.freezePhysical(
    f.raw,
    binding,
    f.heroes,
    '1'.repeat(64),
    undefined,
    fronts,
    undefined,
    a,
  );
  assert.deepEqual(p.boons, a);
  assert.doesNotThrow(() => api.validatePhysical(JSON.parse(JSON.stringify(p))));
  const changed = structuredClone(p);
  changed.boons.runtimeReady = true;
  assert.throws(() => api.validatePhysical(changed));
  const legacy = api.freezePhysical(f.raw, binding, f.heroes, '1'.repeat(64), undefined, fronts);
  assert.equal(legacy.boons, undefined);
  assert.deepEqual(api.physicalView(legacy).boons, undefined);
});
