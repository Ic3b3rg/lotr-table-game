import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { readyScenario, startScenario } from './scenario-helper.mjs';
import { readBackup } from './skill-test-helper.mjs';
const built = buildSync({
  stdin: {
    contents: "export {parseState} from './src/server/state';",
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const { parseState } = await import(
  'data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].contents).toString('base64')
);
test('historical schemas through25 reject threat token additions at manifest and null-guard paths, including the immutable origin', () => {
  for (let schemaVersion = 1; schemaVersion <= 25; schemaVersion++)
    for (const field of [
      { scenario: { pack: { manifest: { threatTokens: {} } } } },
      {
        scenario: {
          pack: {
            definitions: [{ states: [{ actions: [{ op: 'ownsProducts', products: [null] }] }] }],
          },
        },
      },
    ])
      for (const seed of [false, true])
        assert.throws(
          () =>
            parseState(
              seed
                ? { schemaVersion, physical: { cycle: { seed: field } } }
                : { schemaVersion, ...field },
            ),
          /segnalini minaccia.*storico/i,
        );
});
test('schema26 migration preserves whole ordinary states and treats dictionary names as ordinary words', async (t) => {
  const r = await readyScenario(t, (pack) => {
    for (const name of [
      'threatTokens',
      'null-product-not-owned',
      'admittedStates',
      'excludedStates',
    ]) {
      pack.globals.push({ name, type: 'string', value: name });
      pack.definitions[0].variables.push({ name, type: 'string', value: name });
    }
  });
  assert.equal((await startScenario(r.host, r.player)).status, 200);
  const raw = (await readBackup(r.host)).payload.state;
  assert.equal(raw.schemaVersion, 34);
  for (let schemaVersion = 10; schemaVersion <= 25; schemaVersion++) {
    const old = { ...structuredClone(raw), schemaVersion };
    if (schemaVersion === 10) delete old.physical;
    const before = structuredClone(old);
    assert.deepEqual(parseState(old), raw);
    assert.deepEqual(old, before);
  }
});
