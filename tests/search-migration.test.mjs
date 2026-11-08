import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { readyScenario, startScenario } from './scenario-helper.mjs';
import { readBackup } from './skill-test-helper.mjs';
const built = buildSync({
  stdin: {
    contents: "export { parseState } from './src/server/state';",
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

test('schemas through24 reject new search forms at owned paths and in the immutable origin', () => {
  for (let schemaVersion = 1; schemaVersion <= 24; schemaVersion++)
    for (const field of [
      { scenario: { pack: { manifest: { searches: {} } } } },
      {
        scenario: {
          pack: { definitions: [{ states: [{ actions: [{ op: 'message', recovery: {} }] }] }] },
        },
      },
      {
        scenario: {
          pack: {
            definitions: [
              {
                states: [
                  {
                    actions: [
                      {
                        op: 'choice',
                        origin: { type: 'FFG.JIME.Actions.DisplayMessageCancelConfirm' },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
      },
      { physical: { runs: [{ program: { children: [{ kind: 'search-recovery' }] } }] } },
      { physical: { runs: [{ program: { immediateSkillReset: true } }] } },
      { physical: { snapshot: { active: { scoutPrepareAllowed: false } } } },
      { physical: { snapshot: { parents: [{ results: [{ kind: 'search-recovery' }] }] } } },
    ])
      for (const seed of [false, true])
        assert.throws(
          () =>
            parseState(
              seed
                ? { schemaVersion, physical: { cycle: { seed: field } } }
                : { schemaVersion, ...field },
            ),
          /ricerc|storico/i,
        );
});
test('normal dictionary words remain valid and the migration changes only schemaVersion', async (t) => {
  const r = await readyScenario(t, (pack) => {
    for (const name of [
      'searches',
      'recovery',
      'search-recovery',
      'scoutPrepareAllowed',
      'immediateSkillReset',
    ]) {
      pack.globals.push({ name, type: 'string', value: name });
      pack.definitions[0].variables.push({ name, type: 'string', value: name });
    }
  });
  assert.equal((await startScenario(r.host, r.player)).status, 200);
  const raw = (await readBackup(r.host)).payload.state;
  assert.equal(raw.schemaVersion, 34);
  for (let schemaVersion = 10; schemaVersion <= 24; schemaVersion++) {
    const old = { ...structuredClone(raw), schemaVersion };
    if (schemaVersion === 10) delete old.physical;
    const before = structuredClone(old);
    assert.deepEqual(parseState(old), raw);
    assert.deepEqual(old, before);
  }
});
