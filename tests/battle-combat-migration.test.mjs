import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime } from './camp-departure-runtime.mjs';
import { startHost } from './host-helper.mjs';
import { readBackup } from './skill-test-helper.mjs';
import { readyScenario, startScenario } from './scenario-helper.mjs';

test('prospective battle forms are rejected at exact locations in schemas1–32', () => {
  const scenario = { pack: { manifest: { campDeparture: { combat: {} } } } };
  for (let schemaVersion = 1; schemaVersion <= 32; schemaVersion++)
    for (const form of [
      { scenario },
      { physical: { cycle: { seed: { scenario } } } },
      { episodes: [{ scenario }] },
      { scenario: { pack: { manifest: { battleStartup: { combat: {} } } } } },
      { scenario: { pack: { manifest: { scope: 'battle-combat-v1' } } } },
    ])
      assert.throws(
        () => runtime.parseState({ schemaVersion, ...form }),
        /Combattimento battaglia.*storico/,
        JSON.stringify({ schemaVersion, form }),
      );
});

test('historical schemas1–32 migrate whole empty sessions without activating prospective rules', async (t) => {
  const host = await startHost();
  t.after(() => host.dispose());
  const current = (await readBackup(host)).payload.state;
  for (let schemaVersion = 1; schemaVersion <= 32; schemaVersion++) {
    const old = { ...structuredClone(current), schemaVersion };
    for (const [lastAbsent, key] of [
      [10, 'physical'],
      [9, 'scenario'],
      [8, 'mapGeneration'],
      [6, 'group'],
      [5, 'journey'],
      [4, 'round'],
      [3, 'scout'],
      [2, 'skillTest'],
      [1, 'content'],
      [1, 'preparation'],
    ])
      if (schemaVersion <= lastAbsent) delete old[key];
    const before = structuredClone(old);
    assert.deepEqual(runtime.parseState(old), current, `schema${schemaVersion}`);
    assert.deepEqual(old, before);
  }
});

test('battle capability names in ordinary historical dictionaries remain inert data', async (t) => {
  const r = await readyScenario(t, (pack) => {
    for (const name of [
      'battle-combat-v1',
      'source-battle-combat-v1',
      'battleStartup',
      'combat',
      'terminal',
      'darkness',
    ])
      pack.globals.push({ name, type: 'string', value: 'historical/path/is/inert/' + name });
  });
  assert.equal((await startScenario(r.host, r.player)).status, 200);
  const current = (await readBackup(r.host)).payload.state,
    old = { ...structuredClone(current), schemaVersion: 32 },
    before = structuredClone(old);
  assert.deepEqual(runtime.parseState(old), current);
  assert.deepEqual(old, before);
  assert.equal(current.combat, undefined);
  assert.equal(current.scenario.pack.manifest.battleStartup, undefined);
});
