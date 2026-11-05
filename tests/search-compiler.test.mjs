import test from 'node:test';
import assert from 'node:assert/strict';
import { compileScenarioPack, parseScenarioPack } from '../dist/scenario-library.mjs';
import { searchCompilation, sealSearches } from './fixtures/search-encounters.mjs';
import { certificates } from './fixtures/exploration.mjs';
import { hash } from './fixtures/map-freeze.mjs';

test('two complete invented searches certify the paid binary choice and local count before startup', () => {
  const raw = searchCompilation(),
    r = compileScenarioPack(raw);
  assert.deepEqual(parseScenarioPack(r.pack).pack, r.pack);
  assert.deepEqual(r.pack.manifest.searches.ownedProductIds, [0]);
  const pair = r.pack.manifest.searches.encounters.map((e) =>
    r.pack.definitions.find(
      (d) => d.source === r.pack.manifest.prefabs.find((p) => p.source === e.prefab).fsmSource,
    ),
  );
  assert.deepEqual(
    pair.map((d) => [d.states.length, d.states.reduce((n, s) => n + s.actions.length, 0)]),
    [
      [8, 8],
      [9, 9],
    ],
  );
  assert.deepEqual(pair[1].states.find((s) => s.index === 36).actions[0].sum, {
    scope: 'local',
    name: 'tally',
  });
});
test('searches require whole certificates, base context and distinct exclusive owners', () => {
  for (const edit of [
    (i) => delete i.searchesCertificate,
    (i) => delete i.pack.manifest.searches,
    (i) => i.pack.manifest.searches.ownedProductIds.push(5),
    (i) => i.certificates.at(-1).states.pop(),
    (i) =>
      i.certificates
        .at(-1)
        .deferredEdges.push({ from: 32, event: 'NODE CLICKED', to: 33, capability: 'missing' }),
    (i) =>
      (i.pack.manifest.searches.encounters[1].prefab =
        i.pack.manifest.searches.encounters[0].prefab),
    (i) => (i.pack.manifest.searches.encounters[0].model.source = 'missing.assets:9'),
    (i) => (i.pack.manifest.searches.methods.sum.assemblyHash = 'f'.repeat(64)),
  ]) {
    const i = searchCompilation();
    edit(i);
    if (i.pack.manifest.searches && i.searchesCertificate)
      i.searchesCertificate.instructionHash = hash(i.pack.manifest.searches);
    assert.throws(() => compileScenarioPack(i));
  }
});
test('coherently resigned changes cannot replace the binding, branches, effects or cleanup', () => {
  for (const edit of [
    (a, b) => (a.states.find((s) => s.index === 36).actions[0].options[1].cost = 'interact'),
    (a, b) =>
      (a.states.find((s) => s.index === 36).actions[0].origin.type =
        'FFG.JIME.Actions.DisplayMessageMultipleChoice'),
    (a, b) => (a.states.find((s) => s.index === 35).actions[0].recovery = undefined),
    (a, b) => (a.states.find((s) => s.index === 33).transitions.LEAVE = 36),
    (a, b) => a.states.find((s) => s.index === 34).actions.reverse(),
    (a, b) => (b.states.find((s) => s.index === 36).actions[0].sum = { kind: 'literal', value: 0 }),
    (a, b) => (b.variables[0].value = 1),
    (a, b) => (b.states.find((s) => s.index === 36).actions[0].bounds[1].maximum = 2),
    (a, b) => (b.states.find((s) => s.index === 36).actions[0].stat = 'might'),
    (a, b) => (b.states.find((s) => s.index === 37).actions[0].recovery.kind = 'scout'),
    (a, b) => (b.states.find((s) => s.index === 38).transitions.FINISHED = 32),
  ]) {
    const i = searchCompilation(),
      pair = i.pack.definitions.slice(-2);
    edit(...pair);
    sealSearches(i.pack);
    i.certificates = certificates(i.pack);
    i.searchesCertificate.instructionHash = hash(i.pack.manifest.searches);
    assert.throws(() => compileScenarioPack(i));
  }
});
