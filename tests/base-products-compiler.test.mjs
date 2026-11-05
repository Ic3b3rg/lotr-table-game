import test from 'node:test';
import assert from 'node:assert/strict';
import { compileScenarioPack, parseScenarioPack } from '../dist/scenario-library.mjs';
import { baseCompilation, sealBaseProducts } from './fixtures/base-products.mjs';
import { hash } from './fixtures/map-freeze.mjs';
import { native } from './fixtures/clue-progression.mjs';

test('explicit base input and all source evidence attest a single closure with the external branch retained as a gate', () => {
  const raw = baseCompilation(),
    r = compileScenarioPack(raw),
    cap = r.pack.manifest.baseProducts;
  assert.deepEqual(cap.ownedProductIds, [0]);
  assert.deepEqual(parseScenarioPack(r.pack).pack, r.pack);
  const p = r.pack.manifest.prefabs.find((p) => p.source === cap.prefab),
    d = r.pack.definitions.find((d) => d.source === p.fsmSource),
    c = raw.certificates.find((c) => c.source === d.source);
  assert.equal(c.states.length, 14);
  assert.equal(
    c.states.reduce((n, s) => n + s.actions.length, 0),
    14,
  );
  assert.equal(d.states.length, 9);
  assert.equal(
    d.states.some((s) =>
      s.actions.some((a) => ['addInt', 'awardTitle', 'chooseHero'].includes(a.op)),
    ),
    false,
  );
  assert.equal(
    d.states.find((s) => s.index === 91).deferredTransitions.EXTRA,
    'outside-approved-base-products',
  );
  for (const edit of [
    (r) => delete r.baseProductsCertificate,
    (r) => delete r.pack.manifest.baseProducts,
    (r) => delete r.pack.manifest.baseProducts.ownedProductIds,
    (r) => r.pack.manifest.baseProducts.ownedProductIds.push(5),
    (r) => r.pack.manifest.baseProducts.ownedProductIds.push(987),
    (r) => r.pack.manifest.baseProducts.ownedProductIds.splice(0, 1),
    (r) => r.pack.manifest.baseProducts.models.reverse(),
    (r) => (r.pack.manifest.baseProducts.models[1].id = 0),
    (r) => (r.pack.manifest.baseProducts.methods.product.assemblyHash = 'e'.repeat(64)),
    (r) => (r.pack.manifest.baseProducts.lifecycleHash = 'e'.repeat(64)),
    (r) => (r.certificates.at(-1).objectHash = 'e'.repeat(64)),
    (r) => r.certificates.at(-1).states.pop(),
  ]) {
    const bad = structuredClone(raw);
    edit(bad);
    if (bad.baseProductsCertificate && bad.pack.manifest.baseProducts)
      bad.baseProductsCertificate.instructionHash = hash(bad.pack.manifest.baseProducts);
    assert.throws(() => compileScenarioPack(bad));
  }
});

test('a re-signed guard cannot admit an owned requirement, mutate a counter or expose the external event', () => {
  const good = compileScenarioPack(baseCompilation()).pack;
  for (const edit of [
    (d) => (d.states.find((s) => s.index === 91).actions[0].products = ['example.assets:92100']),
    (d) => (d.states.find((s) => s.index === 91).actions[0].products = ['example.assets:99999']),
    (d) => {
      const s = d.states.find((s) => s.index === 91);
      s.transitions.EXTRA = 71;
      delete s.deferredTransitions.EXTRA;
    },
    (d) =>
      d.states
        .find((s) => s.index === 61)
        .actions.push(
          native(1, 'addInt', 'HutongGames.PlayMaker.Actions.IntAdd', {
            target: { scope: 'global', name: 'inventedChain' },
            value: { kind: 'literal', value: 1 },
          }),
        ),
    (d) => (d.handlers.EXTRA = 71),
  ]) {
    const bad = structuredClone(good),
      p = bad.manifest.prefabs.find((p) => p.source === bad.manifest.baseProducts.prefab);
    edit(bad.definitions.find((d) => d.source === p.fsmSource));
    sealBaseProducts(bad);
    assert.throws(() => parseScenarioPack(bad));
  }
});
