import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime } from './camp-departure-runtime.mjs';

test('schemas1–34 reject prospective battle phases only at their real saved locations', () => {
  const first = { pack: { manifest: { campDeparture: { battleRounds: {} } } } };
  const second = { pack: { manifest: { battleStartup: { battleRounds: {} } } } };
  for (let schemaVersion = 1; schemaVersion <= 34; schemaVersion++)
    for (const form of [
      { scenario: first },
      { scenario: second },
      { scenario: { rounds: { version: 'source-battle-rounds-v1' } } },
      { scenario: { pack: { manifest: { rounds: { version: 'source-battle-rounds-v1' } } } } },
      {
        scenario: {
          pack: {
            manifest: { combat: { source: { shadow: { version: 'source-battle-shadow-v1' } } } },
          },
        },
      },
      { physical: { cycle: { seed: { scenario: second } } } },
      { episodes: [{ scenario: first }] },
      { scenario: { enemies: { groups: [{ battleRecipe: 'invented-source-recipe' }] } } },
    ])
      assert.throws(
        () => runtime.parseState({ schemaVersion, ...form }),
        /Fasi.*battaglia.*storico/,
      );
});

import { startHost } from './host-helper.mjs';
import { readBackup } from './skill-test-helper.mjs';
import { readyScenario, startScenario } from './scenario-helper.mjs';

test('complete schema34 payload migrates structurally to35 without altering any old domain value', async (t) => {
  const host = await startHost();
  t.after(() => host.dispose());
  const current = (await readBackup(host)).payload.state,
    old = { ...structuredClone(current), schemaVersion: 34 },
    raw = JSON.stringify(old);
  assert.deepEqual(runtime.parseState(old), current);
  assert.equal(JSON.stringify(old), raw);
  assert.deepEqual(runtime.parseState(runtime.parseState(old)), current);
});

test('battle phase words in old global dictionaries remain ordinary data', async (t) => {
  const r = await readyScenario(t, (pack) => {
    for (const name of [
      'battleRounds',
      'battle',
      'bannerPools',
      'scriptedGroups',
      'callbacks',
      'divideInt',
      'source-battle-rounds-v1',
    ])
      pack.globals.push({ name, type: 'string', value: 'inert/' + name });
  });
  assert.equal((await startScenario(r.host, r.player)).status, 200);
  const current = (await readBackup(r.host)).payload.state,
    old = { ...structuredClone(current), schemaVersion: 34 };
  assert.deepEqual(runtime.parseState(old), current);
});
