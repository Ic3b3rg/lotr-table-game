import test from 'node:test';
import assert from 'node:assert/strict';
import { compileScenarioPack, parseScenarioPack } from '../dist/scenario-library.mjs';
import { itemCompilation, sealItem } from './fixtures/item-encounter.mjs';
import { hash } from './fixtures/map-freeze.mjs';
import { certificates } from './fixtures/exploration.mjs';
test('the complete concurrent-modal graph and explicit base inventory are certified before startup', () => {
  const raw = itemCompilation(),
    r = compileScenarioPack(raw),
    cap = r.pack.manifest.items;
  assert.deepEqual(parseScenarioPack(r.pack).pack, r.pack);
  assert.deepEqual(cap.initialInventory, []);
  assert.deepEqual(cap.ownedProductIds, [0]);
  assert.equal(cap.grant.quantity, 1);
  const p = r.pack.manifest.prefabs.find((p) => p.source === cap.prefab),
    d = r.pack.definitions.find((d) => d.source === p.fsmSource);
  assert.equal(d.states.length, 9);
  assert.equal(
    d.states.reduce((n, s) => n + s.actions.length, 0),
    10,
  );
  assert.equal(d.states.find((s) => s.index === 13).actions[1].op, 'modalWait');
  for (const edit of [
    (r) => delete r.itemsCertificate,
    (r) => delete r.pack.manifest.items,
    (r) => delete r.pack.manifest.items.initialInventory,
    (r) => r.pack.manifest.items.initialInventory.push('trinket:1'),
    (r) => r.pack.manifest.items.ownedProductIds.push(5),
    (r) => (r.pack.manifest.items.grant.quantity = 2),
    (r) => (r.pack.manifest.items.modal.owner = 1),
    (r) => r.pack.manifest.items.baseSkillModelIds.push(9001),
    (r) => (r.pack.manifest.items.methods.enter.assemblyHash = 'e'.repeat(64)),
    (r) => r.certificates.at(-1).states.pop(),
    (r) =>
      r.certificates
        .at(-1)
        .states.find((s) => s.index === 13)
        .actions.pop(),
  ]) {
    const bad = structuredClone(raw);
    edit(bad);
    if (bad.itemsCertificate && bad.pack.manifest.items)
      bad.itemsCertificate.instructionHash = hash(bad.pack.manifest.items);
    assert.throws(() => compileScenarioPack(bad));
  }
});
test('re-signed changes cannot turn a waiting popup into a second test or change callback topology', () => {
  for (const edit of [
    (d) => d.states.find((s) => s.index === 13).actions.reverse(),
    (d) => d.states.find((s) => s.index === 13).actions.pop(),
    (d) => (d.states.find((s) => s.index === 13).transitions.LEAVE = 17),
    (d) => (d.states.find((s) => s.index === 18).actions[0].itemModel = 'example.assets:99999'),
    (d) => (d.states.find((s) => s.index === 15).transitions.FINISHED = 18),
  ]) {
    const pack = compileScenarioPack(itemCompilation()).pack,
      p = pack.manifest.prefabs.find((p) => p.source === pack.manifest.items.prefab),
      d = pack.definitions.find((d) => d.source === p.fsmSource);
    edit(d);
    sealItem(pack);
    assert.throws(() => parseScenarioPack(pack));
  }
});

test('re-signed product and item references must still belong to the declared source files', () => {
  for (const edit of [
    (c) => (c.product.source = 'missing.assets:1'),
    (c) => (c.grant.model.source = 'missing.assets:2'),
    (c) => (c.grant.upgrade.choices[0].source = 'missing.assets:3'),
    (c) => (c.titleModel.source = 'missing.assets:4'),
  ]) {
    const raw = itemCompilation();
    edit(raw.pack.manifest.items);
    if (raw.pack.manifest.items.grant.model.source.startsWith('missing.'))
      raw.pack.definitions.at(-1).states.find((s) => s.index === 18).actions[0].itemModel =
        raw.pack.manifest.items.grant.model.source;
    sealItem(raw.pack);
    raw.certificates = certificates(raw.pack);
    raw.itemsCertificate.instructionHash = hash(raw.pack.manifest.items);
    assert.throws(() => compileScenarioPack(raw), /fonte|inventario|modell|freeze/i);
  }
});
