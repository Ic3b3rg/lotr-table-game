import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileScenarioPack } from '../dist/scenario-library.mjs';
import { scenarioFixture } from './fixtures/scenario.mjs';
import { attachEncounter } from './original-encounter-helper.mjs';
import { attachExploration, certificates } from './fixtures/exploration.mjs';
function compilation() {
  const pack = scenarioFixture();
  attachEncounter(pack);
  attachExploration(pack);
  return { pack, certificates: certificates(pack) };
}
test('compiler certifies exploration separately from playable encounter interactions', () => {
  const input = compilation();
  const result = compileScenarioPack(input);
  assert.equal(result.pack.manifest.exploration.version, 'source-exploration-v1');
  assert.equal(result.pack.manifest.playablePrefabs.length, 1);
  assert.equal(result.pack.definitions.at(-1).states[2].actions[1].skipIntro, false);
});
test('compiler rejects missing callbacks, altered source instruction, and uncompiled adjacent receiver', () => {
  for (const edit of [
    (i) => i.pack.manifest.exploration.tiles[0].intros.splice(0),
    (i) => (i.pack.definitions.at(-1).states[1].actions[0].label[0].text += ' tampered'),
    (i) => i.pack.definitions.at(-1).states[3].actions.splice(0, 1),
    (i) => (i.pack.definitions.at(-1).states[2].actions[1].skipIntro = true),
    (i) => {
      i.certificates[0].handlers = { ...i.certificates[0].handlers, NEARBY_EXPLORED: 90 };
      i.certificates[0].deferredEdges.push({
        from: null,
        event: 'NEARBY_EXPLORED',
        to: 90,
        capability: 'unimplemented',
      });
    },
  ]) {
    const i = compilation();
    edit(i);
    assert.throws(() => compileScenarioPack(i));
  }
});
