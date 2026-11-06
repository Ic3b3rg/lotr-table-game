import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileScenarioPack } from '../dist/scenario-library.mjs';
import { scenarioFixture } from './fixtures/scenario.mjs';
import { startupMaterial } from './startup-preparation-helper.mjs';
import { hash } from './fixtures/map-freeze.mjs';

test('startup preparation requires an explicit compiler certificate bound to the frozen capability', () => {
  const pack = scenarioFixture();
  pack.manifest.scope = 'synthetic-physical-p1';
  pack.manifest.startupPreparation = startupMaterial().capability;
  const input = {
    pack,
    certificates: pack.definitions.map((d) => ({
      source: d.source,
      objectHash: hash(d),
      lifecycleHash: hash('invented lifecycle'),
      initial: d.initial,
      handlers: d.handlers,
      states: d.states.map((s) => ({
        index: s.index,
        transitions: s.transitions,
        actions: s.actions.map((a) => ({
          index: a.index,
          type: a.origin.type,
          parameterHash: a.origin.parameterHash,
          enabled: true,
        })),
      })),
      deferredEdges: [],
    })),
    startupPreparationCertificate: { instructionHash: hash(pack.manifest.startupPreparation) },
  };
  assert.deepEqual(
    compileScenarioPack(input).pack.manifest.startupPreparation,
    pack.manifest.startupPreparation,
  );
  for (const edit of [
    (r) => delete r.startupPreparationCertificate,
    (r) => (r.startupPreparationCertificate.instructionHash = '0'.repeat(64)),
    (r) => delete r.pack.manifest.startupPreparation,
    (r) => (r.pack.manifest.scope = 'startup-only'),
  ]) {
    const bad = structuredClone(input);
    edit(bad);
    assert.throws(() => compileScenarioPack(bad));
  }
});
