import test from 'node:test';
import assert from 'node:assert/strict';
import { compileScenarioPack, parseScenarioPack } from '../dist/scenario-library.mjs';
import {
  threatTokenCompilation,
  sealThreatTokens,
  threatTokenCertificates,
} from './fixtures/threat-tokens.mjs';
import { hash } from './fixtures/map-freeze.mjs';

test('two threat token owners retain all twenty states and twenty-one certified actions with an explicit null-only exclusion', () => {
  const i = threatTokenCompilation(),
    r = compileScenarioPack(i);
  assert.deepEqual(parseScenarioPack(r.pack).pack, r.pack);
  const owners = r.pack.manifest.threatTokens.encounters,
    ds = owners.map((o) =>
      r.pack.definitions.find(
        (d) => d.source === r.pack.manifest.prefabs.find((p) => p.source === o.prefab).fsmSource,
      ),
    );
  assert.deepEqual(
    ds.map((d) => [d.states.length, d.states.reduce((n, s) => n + s.actions.length, 0)]),
    [
      [8, 9],
      [9, 9],
    ],
  );
  assert.equal(
    i.certificates.slice(-2).reduce((n, c) => n + c.states.length, 0),
    20,
  );
  assert.equal(
    i.certificates
      .slice(-2)
      .reduce((n, c) => n + c.states.reduce((n, s) => n + s.actions.length, 0), 0),
    21,
  );
  assert.deepEqual(ds[1].states.find((s) => s.index === 88).actions[0].products, [null]);
  assert.deepEqual(owners[1].excludedStates, [89, 90, 91]);
});
test('whole source inventory, attestation and declared base products are required before startup', () => {
  for (const edit of [
    (i) => delete i.threatTokensCertificate,
    (i) => delete i.pack.manifest.threatTokens,
    (i) => i.pack.manifest.threatTokens.ownedProductIds.push(5),
    (i) => i.certificates.at(-1).states.pop(),
    (i) => i.pack.manifest.threatTokens.encounters[0].admittedStates.push(80),
    (i) => i.pack.manifest.threatTokens.encounters[1].excludedStates.pop(),
    (i) => (i.pack.manifest.threatTokens.methods.threat.assemblyHash = 'f'.repeat(64)),
  ]) {
    const i = threatTokenCompilation();
    edit(i);
    if (i.threatTokensCertificate && i.pack.manifest.threatTokens)
      i.threatTokensCertificate.instructionHash = hash(i.pack.manifest.threatTokens);
    assert.throws(() => compileScenarioPack(i));
  }
});
test('resigned programs cannot reinterpret null, admit corruption, swap tests or rewards, or move the threat floor', () => {
  for (const edit of [
    (a, b, c) => (b.states.find((s) => s.index === 88).actions[0].products = [a.source]),
    (a, b, c) => (b.states.find((s) => s.index === 88).actions[0].products = []),
    (a, b, c) => (b.states.find((s) => s.index === 88).actions[0].missingEvent = 'OWNED'),
    (a, b, c) => (b.states.find((s) => s.index === 88).transitions.OWNED = 87),
    (a, b, c) => (a.states.find((s) => s.index === 86).actions[0].stat = 'might'),
    (a, b, c) => (b.states.find((s) => s.index === 86).actions[0].target = 1),
    (a, b, c) => (a.states.find((s) => s.index === 85).actions[1].value.value = -3),
    (a, b, c) => (a.states.find((s) => s.index === 85).actions[0].boon = 'hidden'),
    (a, b, c) => (a.states.find((s) => s.index === 87).transitions.FINISHED = 84),
    (a, b, c) => (c.threat.action = 0),
    (a, b, c) => (b.states.find((s) => s.index === 87).actions[0].consequence.amount = 2),
  ]) {
    const i = threatTokenCompilation();
    edit(...i.pack.definitions.slice(-2), i.pack.manifest.threatTokens);
    sealThreatTokens(i.pack);
    i.certificates = threatTokenCertificates(i.pack);
    i.threatTokensCertificate.instructionHash = hash(i.pack.manifest.threatTokens);
    assert.throws(() => compileScenarioPack(i));
  }
});

test('resigned whole certificates cannot hide a missing excluded state behind a duplicate or replace its source action class', () => {
  for (const edit of [
    (c) => {
      c.states[c.states.length - 1] = structuredClone(c.states.at(-2));
    },
    (c) => {
      c.states.at(-1).actions[0].type = 'FFG.Common.Actions.FinishFSM';
    },
  ]) {
    const i = threatTokenCompilation(),
      c = i.certificates.at(-1);
    edit(c);
    i.pack.manifest.threatTokens.encounters[1].certificateHash = hash(c);
    i.threatTokensCertificate.instructionHash = hash(i.pack.manifest.threatTokens);
    assert.throws(() => compileScenarioPack(i));
  }
});
