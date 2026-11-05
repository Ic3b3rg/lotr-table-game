import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { prepareItem } from './item-http-helper.mjs';
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
test('schema23 is structural; ordinary inventory words in variable dictionaries remain data in versions10–22', async (t) => {
  const r = await prepareItem(t),
    raw = (await readBackup(r.host)).payload.state;
  // This is the ordinary pre-startup state, with no item capability introduced into a run.
  assert.equal(raw.scenario, null);
  for (let schemaVersion = 10; schemaVersion <= 22; schemaVersion++) {
    const old = { ...structuredClone(raw), schemaVersion };
    if (schemaVersion === 10) delete old.physical;
    const expected = { ...structuredClone(old), schemaVersion: 28, physical: null };
    assert.deepEqual(parseState(old), expected);
    assert.equal(old.schemaVersion, schemaVersion);
  }
});
test('historical schemas reject item forms at contract paths including the immutable seed', () => {
  for (let schemaVersion = 1; schemaVersion <= 22; schemaVersion++)
    for (const field of [
      { scenario: { pack: { manifest: { items: {} } } } },
      { scenario: { pack: { definitions: [{ states: [{ actions: [{ op: 'addItem' }] }] }] } } },
      { scenario: { pack: { definitions: [{ states: [{ actions: [{ op: 'modalWait' }] }] }] } } },
      { physical: { snapshot: { resolution: { resources: { itemCustody: [] } } } } },
      { physical: { runs: [{ program: { children: [{ kind: 'scenario-item' }] } }] } },
      {
        physical: {
          fronts: { artifact: { policies: [{ effects: [{ op: 'fear-facedown-only' }] }] } },
        },
      },
      { scenario: { conclusion: { campaign: { inventory: [] } } } },
    ])
      for (const seed of [false, true]) {
        const raw = seed
          ? { schemaVersion, physical: { cycle: { seed: field } } }
          : { schemaVersion, ...field };
        assert.throws(() => parseState(raw), /oggett|inventario|storico/i);
      }
});
test('inventory words in global/local variables and events do not mark a capability in schemas10–22', async (t) => {
  const { readyScenario, startScenario } = await import('./scenario-helper.mjs');
  const names = [
    { name: 'items', type: 'int', value: 7 },
    { name: 'itemCustody', type: 'int', value: 8 },
    { name: 'inventory', type: 'string', value: 'scenario-item' },
    { name: 'op', type: 'string', value: 'addItem' },
    { name: 'kind', type: 'string', value: 'modalWait' },
  ];
  const r = await readyScenario(t, (pack) => {
    pack.globals.push(...structuredClone(names));
    pack.definitions[0].variables.push(...structuredClone(names));
  });
  assert.equal((await startScenario(r.host, r.player)).status, 200);
  const raw = (await readBackup(r.host)).payload.state;
  assert.equal(raw.scenario.globals.items, 7);
  for (let schemaVersion = 10; schemaVersion <= 22; schemaVersion++) {
    const old = { ...structuredClone(raw), schemaVersion };
    if (schemaVersion === 10) delete old.physical;
    const before = structuredClone(old);
    assert.deepEqual(parseState(old), raw);
    assert.deepEqual(old, before);
  }
});
