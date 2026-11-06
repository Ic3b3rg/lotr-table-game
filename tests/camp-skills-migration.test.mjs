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

test('historical formats through26 reject every camp field and intent at its actual path, including the frozen seed', () => {
  for (let schemaVersion = 1; schemaVersion <= 26; schemaVersion++) {
    for (const scenario of [
      { pack: { manifest: { campSkills: {} } } },
      { conclusion: { campaign: { training: {} } } },
      { conclusion: { campaign: { heroes: [{ skillCopies: [] }] } } },
      { commands: [{ kind: 'camp-skill' }] },
    ]) {
      for (const seed of [false, true])
        assert.throws(
          () =>
            parseState(
              seed
                ? { schemaVersion, physical: { cycle: { seed: { scenario } } } }
                : { schemaVersion, scenario },
            ),
          /campo.*storico/i,
        );
    }
    assert.throws(
      () =>
        parseState({
          schemaVersion,
          physical: { cycle: { records: [{ intent: { input: { kind: 'camp-skill' } } }] } },
        }),
      /campo.*storico/i,
    );
  }
});

test('migration changes only schemaVersion and preserves ordinary dictionary words, without a shop retrofit', async (t) => {
  const r = await readyScenario(t, (pack) => {
    for (const name of ['campSkills', 'training', 'skillCopies', 'camp-skill', 'availableXP']) {
      pack.globals.push({ name, type: 'string', value: name });
      pack.definitions[0].variables.push({ name, type: 'string', value: name });
    }
  });
  assert.equal((await startScenario(r.host, r.player)).status, 200);
  const current = (await readBackup(r.host)).payload.state;
  assert.equal(current.schemaVersion, 29);
  for (let schemaVersion = 10; schemaVersion <= 26; schemaVersion++) {
    const old = { ...structuredClone(current), schemaVersion };
    if (schemaVersion === 10) delete old.physical;
    const before = structuredClone(old);
    assert.deepEqual(parseState(old), current);
    assert.deepEqual(old, before);
  }
  assert.equal(current.scenario.pack.manifest.campSkills, undefined);
});
