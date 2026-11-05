import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { readyMission } from './mission-combat-helper.mjs';
import { readyScenario, startScenario } from './scenario-helper.mjs';
import { readBackup } from './skill-test-helper.mjs';
const code = buildSync({
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
  'data:text/javascript;base64,' +
    Buffer.from(
      Buffer.from(code.outputFiles[0].contents).toString() +
        '\n//# sourceURL=mission-migration-runtime.mjs',
    ).toString('base64')
);

test('schemas through23 reject every new mission shape at contract paths including the immutable seed', async (t) => {
  const r = await readyMission(t),
    raw = (await readBackup(r.host)).payload.state;
  assert.equal(raw.schemaVersion, 28);
  assert.throws(
    () => parseState({ ...structuredClone(raw), schemaVersion: 23 }),
    /primo|scontro|storico/i,
  );
  for (let schemaVersion = 1; schemaVersion <= 23; schemaVersion++)
    for (const field of [
      { scenario: { pack: { manifest: { firstCombat: {} } } } },
      { scenario: { firstCombat: {} } },
      { scenario: { pack: { definitions: [{ states: [{ actions: [{ op: 'spawnFixed' }] }] }] } } },
      {
        scenario: { pack: { definitions: [{ states: [{ actions: [{ op: 'removeEnemies' }] }] }] } },
      },
      {
        scenario: {
          pack: { definitions: [{ states: [{ actions: [{ op: 'message', boon: 'hidden' }] }] }] },
        },
      },
      { scenario: { tasks: [{ kind: 'spawnFixed' }] } },
      { scenario: { pending: { kind: 'source-attack' } } },
      { scenario: { effects: [{ op: 'spawnFixed' }] } },
      { physical: { snapshot: { parents: [{ results: [{ kind: 'source-boon' }] }] } } },
      { scenario: { enemies: { groups: [{ removed: 'timer' }] } } },
      { physical: { runs: [{ program: { children: [{ kind: 'source-boon' }] } }] } },
      {
        scenario: {
          pack: {
            definitions: [
              { states: [{ actions: [{ program: { children: [{ kind: 'source-boon' }] } }] }] },
            ],
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
          /primo|scontro|storico/i,
        );
});

test('the source bridge cannot be erased from both current state and its initial round1 origin', async (t) => {
  const r = await readyMission(t),
    raw = (await readBackup(r.host)).payload.state;
  const bad = structuredClone(raw);
  delete bad.scenario.firstCombat;
  delete bad.physical.cycle.seed.scenario.firstCombat;
  assert.throws(() => parseState(bad));
});

test('migration is structural and normal dictionary names remain data through23', async (t) => {
  const names = [
    'firstCombat',
    'source-attack',
    'spawnFixed',
    'removeEnemies',
    'source-boon',
    'removed',
  ];
  const r = await readyScenario(t, (pack) => {
    for (const name of names) {
      pack.globals.push({ name, type: 'string', value: name });
      pack.definitions[0].variables.push({ name, type: 'string', value: name });
    }
  });
  assert.equal((await startScenario(r.host, r.player)).status, 200);
  const raw = (await readBackup(r.host)).payload.state;
  for (let schemaVersion = 10; schemaVersion <= 23; schemaVersion++) {
    const old = { ...structuredClone(raw), schemaVersion };
    if (schemaVersion === 10) delete old.physical;
    const before = structuredClone(old);
    assert.deepEqual(parseState(old), { ...raw, schemaVersion: 28 });
    assert.deepEqual(old, before);
  }
});
