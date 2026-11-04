import test from 'node:test';
import assert from 'node:assert/strict';
import { compileScenarioPack, parseScenarioPack } from '../dist/scenario-library.mjs';
import { clueCompilation } from './fixtures/clue-progression.mjs';
import { hash } from './fixtures/map-freeze.mjs';
test('optional clue capability certifies four encounter closures and hidden fort receiver before startup', () => {
  const raw = clueCompilation(),
    a = compileScenarioPack(raw);
  assert.equal(a.pack.manifest.clues.version, 'source-clues-v1');
  assert.equal(a.pack.manifest.clues.encounters.length, 4);
  assert.equal(
    a.pack.manifest.playablePrefabs.length,
    1,
    'legacy manifest remains a single closure',
  );
  assert.deepEqual(parseScenarioPack(a.pack).pack, a.pack);
  for (const edit of [
    (r) => delete r.cluesCertificate,
    (r) => r.pack.manifest.clues.encounters.pop(),
    (r) => (r.pack.manifest.clues.encounters[1] = r.pack.manifest.clues.encounters[0]),
    (r) => (r.pack.manifest.clues.fort.tile.name = 'missing'),
    (r) =>
      delete r.pack.definitions.find((d) => d.source === 'example.assets:74000').handlers
        .EXAMPLE_FORT,
    (r) =>
      (r.pack.definitions.find(
        (d) => d.source === 'example.assets:73000',
      ).states[2].actions[0].stat = 'might'),
    (r) => delete r.pack.manifest.clues,
  ]) {
    const bad = structuredClone(raw);
    edit(bad);
    assert.throws(() => compileScenarioPack(bad));
  }
});
test('clue capability does not widen old pack validation or allow final fort interaction', () => {
  const raw = clueCompilation();
  raw.pack.manifest.playablePrefabs.push(raw.pack.manifest.clues.fort.prefab);
  assert.throws(() => compileScenarioPack(raw));
  const forged = clueCompilation();
  forged.pack.manifest.clues.encounters[0] = forged.pack.manifest.clues.fort.prefab;
  forged.cluesCertificate.instructionHash = hash(forged.pack.manifest.clues);
  assert.throws(() => compileScenarioPack(forged));
});
