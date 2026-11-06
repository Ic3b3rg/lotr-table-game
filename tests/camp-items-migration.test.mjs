import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { readyScenario, startScenario } from './scenario-helper.mjs';
import { readBackup } from './skill-test-helper.mjs';
const code = buildSync({
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
  'data:text/javascript;base64,' + Buffer.from(code.outputFiles[0].contents).toString('base64')
);

test('schemas through27 reject item upgrade forms at their bounded structural paths, including original seed and cycle intents', () => {
  for (let schemaVersion = 1; schemaVersion <= 27; schemaVersion++) {
    for (const scenario of [
      { pack: { manifest: { campItems: {} } } },
      { commands: [{ kind: 'camp-item' }] },
    ])
      for (const seed of [false, true])
        assert.throws(
          () =>
            parseState(
              seed
                ? { schemaVersion, physical: { cycle: { seed: { scenario } } } }
                : { schemaVersion, scenario },
            ),
          /oggetti.*storico/i,
        );
    assert.throws(
      () =>
        parseState({
          schemaVersion,
          physical: { cycle: { records: [{ intent: { input: { kind: 'camp-item' } } }] } },
        }),
      /oggetti.*storico/i,
    );
  }
});

test('structural migration preserves whole gameplay and ordinary dictionaries, with no camp item capability retrofit', async (t) => {
  const r = await readyScenario(t, (pack) => {
    for (const name of ['campItems', 'camp-item', 'item', 'upgrade', 'lore', 'fromModelId']) {
      pack.globals.push({ name, type: 'string', value: name });
      pack.definitions[0].variables.push({ name, type: 'string', value: name });
    }
  });
  assert.equal((await startScenario(r.host, r.player)).status, 200);
  const current = (await readBackup(r.host)).payload.state;
  assert.equal(current.schemaVersion, 29);
  for (let schemaVersion = 10; schemaVersion <= 27; schemaVersion++) {
    const old = { ...structuredClone(current), schemaVersion };
    if (schemaVersion === 10) delete old.physical;
    const before = structuredClone(old);
    assert.deepEqual(parseState(old), current);
    assert.deepEqual(old, before);
  }
  assert.equal(current.scenario.pack.manifest.campItems, undefined);
});
