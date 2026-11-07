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

test('formats1–28 reject next choices only at exact scenario, seed and intent paths', () => {
  for (let schemaVersion = 1; schemaVersion <= 28; schemaVersion++) {
    for (const scenario of [
      { pack: { manifest: { campPreparation: {} } } },
      { conclusion: { campaign: { preparation: {} } } },
      { conclusion: { stage: 'camp-preparation' } },
      { pending: { kind: 'camp-preparation' } },
      ...['camp-prepare', 'camp-select-role', 'camp-accessory', 'camp-confirm', 'camp-return'].map(
        (kind) => ({ commands: [{ kind }] }),
      ),
    ])
      for (const seed of [false, true])
        assert.throws(
          () =>
            parseState(
              seed
                ? { schemaVersion, physical: { cycle: { seed: { scenario } } } }
                : { schemaVersion, scenario },
            ),
          /preparazione.*storico/i,
        );
    for (const kind of [
      'camp-prepare',
      'camp-select-role',
      'camp-accessory',
      'camp-confirm',
      'camp-return',
    ])
      assert.throws(
        () =>
          parseState({
            schemaVersion,
            physical: {
              cycle: { records: [{ intent: { type: 'SCENARIO_INPUT', input: { kind } } }] },
            },
          }),
        /preparazione.*storico/i,
      );
  }
});

test('schema29 migration preserves whole gameplay and similarly named ordinary dictionaries', async (t) => {
  const r = await readyScenario(t, (pack) => {
    for (const name of [
      'campPreparation',
      'camp-preparation',
      'camp-confirm',
      'recipe',
      'summaryHash',
      'confirmedRevision',
      'preparation',
    ]) {
      pack.globals.push({ name, type: 'string', value: name });
      pack.definitions[0].variables.push({ name, type: 'string', value: name });
    }
  });
  assert.equal((await startScenario(r.host, r.player)).status, 200);
  const current = (await readBackup(r.host)).payload.state;
  assert.equal(current.schemaVersion, 32);
  for (let schemaVersion = 10; schemaVersion <= 28; schemaVersion++) {
    const old = { ...structuredClone(current), schemaVersion };
    if (schemaVersion === 10) delete old.physical;
    const copy = structuredClone(old);
    assert.deepEqual(parseState(old), current);
    assert.deepEqual(old, copy);
  }
  assert.equal(current.scenario.pack.manifest.campPreparation, undefined);
});
