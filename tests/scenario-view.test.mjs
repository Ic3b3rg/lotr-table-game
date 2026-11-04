import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';
const built = buildSync({
  entryPoints: [fileURLToPath(new URL('../src/server/store.ts', import.meta.url))],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  target: 'node24',
});
const { publicSession } = await import(
  `data:text/javascript;base64,${Buffer.from(Buffer.from(built.outputFiles[0].contents).toString() + '\n//# sourceURL=scenario-view-test.mjs').toString('base64')}`
);
test('ordinary scenario view omits deployment and exploration entropy while preserving the private replay input', () => {
  const secret = 'e'.repeat(64);
  const state = {
    mapGeneration: null,
    content: null,
    preparation: null,
    physical: null,
    players: [],
    scenario: {
      id: 'invented',
      instances: [],
      pack: { manifest: { playablePrefabs: [] } },
      enemies: { entropy: secret, cursor: 8, groups: [], attempts: [] },
      explorations: {
        version: 'source-exploration-v1',
        active: null,
        attempts: [{ id: 'retained-effect', entropy: secret, returned: true }],
      },
    },
  };
  const before = structuredClone(state);
  const view = publicSession(state);
  assert.equal(JSON.stringify(view).includes(secret), false);
  assert.equal('entropy' in view.scenario.enemies, false);
  assert.equal('entropy' in view.scenario.explorations.attempts[0], false);
  assert.equal(view.scenario.explorations.attempts[0].returned, true);
  assert.deepEqual(state, before);
});
