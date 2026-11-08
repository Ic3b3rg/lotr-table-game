import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { readyStartup, revealStartupScout } from './startup-preparation-helper.mjs';
import { readBackup } from './skill-test-helper.mjs';
const code = buildSync({
  stdin: { contents: "export {parseState} from './src/server/state';", resolveDir: process.cwd() },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const { parseState } = await import(
  'data:text/javascript;base64,' + Buffer.from(code.outputFiles[0].contents).toString('base64')
);

test('schemas1–29 reject prospective startup forms at scenario, seed, run and result paths', () => {
  for (let schemaVersion = 1; schemaVersion <= 29; schemaVersion++) {
    for (const scenario of [
      { pack: { manifest: { startupPreparation: {} } } },
      { tasks: [{ kind: 'startup' }] },
    ])
      for (const seed of [false, true])
        assert.throws(
          () =>
            parseState(
              seed
                ? { schemaVersion, physical: { cycle: { seed: { scenario } } } }
                : { schemaVersion, scenario },
            ),
          /startup.*storico/i,
        );
    for (const physical of [
      { runs: [{ source: { instanceId: 'startup-preparation' } }] },
      { runs: [{ program: { startupRules: 'source-startup-preparation-v1' } }] },
      ...['prepared', 'startup-scout', 'startup-test'].map((kind) => ({
        runs: [{ program: { children: [{ kind }] } }],
      })),
      { snapshot: { parents: [{ results: [{ setup: {} }] }] } },
    ])
      assert.throws(() => parseState({ schemaVersion, physical }), /startup.*storico/i);
  }
});

test('schema31 structurally migrates a complete historical startup without enabling physical preparation', async (t) => {
  const ready = await readyStartup(t, {
    legacy: true,
    edit(pack) {
      for (const name of ['startupPreparation', 'startup', 'startupRules', 'prepared'])
        pack.globals.push({ name, type: 'string', value: name });
    },
  });
  await revealStartupScout(ready);
  const current = (await readBackup(ready.host)).payload.state;
  assert.equal(current.schemaVersion, 35);
  const old = { ...structuredClone(current), schemaVersion: 29 },
    copy = structuredClone(old);
  assert.deepEqual(parseState(old), current);
  assert.deepEqual(old, copy);
  assert.equal(current.scenario.pack.manifest.startupPreparation, undefined);
});
