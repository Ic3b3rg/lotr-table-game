import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime } from './camp-departure-runtime.mjs';
import { startHost } from './host-helper.mjs';
import { readBackup } from './skill-test-helper.mjs';
import { readyScenario, startScenario } from './scenario-helper.mjs';
import { readyTerrain, terrainTurn } from './battle-test-terrain-helper.mjs';
import { readSession, command, attackIntent, ok } from './battle-combat-helper.mjs';
import { signBackup } from './skill-test-helper.mjs';
import { recoverSeat } from './last-stand-helper.mjs';
import { join } from 'node:path';
import { rm } from 'node:fs/promises';

test('schemas1–33 reject prospective terrain at exact source/run/view locations, including archives and seeds', () => {
  const sc = { pack: { manifest: { campDeparture: { combat: { testTerrain: {} } } } } };
  const second = { pack: { manifest: { battleStartup: { combat: { testTerrain: {} } } } } };
  for (let schemaVersion = 1; schemaVersion <= 33; schemaVersion++)
    for (const form of [
      { scenario: sc },
      { scenario: second },
      { physical: { cycle: { seed: { scenario: sc } } } },
      { episodes: [{ scenario: sc }] },
      { physical: { runs: [{ spatial: { testTerrain: {} } }] } },
      { physical: { snapshot: { resolution: { sourceTest: { terrain: {} } } } } },
      { physical: { snapshot: { resolution: { sourceTest: { cards: [{ excluded: true }] } } } } },
      {
        episodes: [
          {
            physical: {
              snapshot: { resolution: { history: [{ active: { purpose: 'terrain-test' } }] } },
            },
          },
        ],
      },
    ])
      assert.throws(() => runtime.parseState({ schemaVersion, ...form }), /Terreno.*storico/);
});
test('whole schema33 payload migrates without retroactive policy; repeated parsing is byte stable', async (t) => {
  const host = await startHost();
  t.after(() => host.dispose());
  const current = (await readBackup(host)).payload.state,
    old = { ...structuredClone(current), schemaVersion: 33 },
    before = JSON.stringify(old);
  assert.deepEqual(runtime.parseState(old), current);
  assert.equal(JSON.stringify(old), before);
  assert.equal(
    JSON.stringify(runtime.parseState(runtime.parseState(old))),
    JSON.stringify(current),
  );
});
test('terrain words in historical globals remain ordinary data, not reserved dictionary keys', async (t) => {
  const r = await readyScenario(t, (p) => {
    for (const name of [
      'testTerrain',
      'terrain-test',
      'source-battle-test-terrain-v1',
      'fire',
      'rock',
      'tokens',
    ])
      p.globals.push({ name, type: 'string', value: 'inert/history/' + name });
  });
  assert.equal((await startScenario(r.host, r.player)).status, 200);
  const current = (await readBackup(r.host)).payload.state,
    old = { ...structuredClone(current), schemaVersion: 33 };
  assert.deepEqual(runtime.parseState(old), current);
  assert.equal(current.scenario.pack.manifest.battleStartup, undefined);
});

test('an activated schema33 battle restores packlessly with exact historical domains and the original fire gate', async (t) => {
  const r = await readyTerrain(t, { activate: false });
  await terrainTurn(r);
  const backup = await readBackup(r.host),
    old = structuredClone(backup);
  old.payload.state.schemaVersion = 33;
  assert.deepEqual(runtime.parseState(old.payload.state), backup.payload.state);
  assert.equal(
    JSON.stringify(runtime.parseState(old.payload.state)),
    JSON.stringify(backup.payload.state),
  );
  for (const path of r.sourcePaths) await rm(path);
  const host = await startHost({ LOTR_DATA_DIR: join(r.directory, 'historical33-empty') });
  t.after(() => host.stop());
  let s = await readSession(host);
  await ok(
    host.request('/api/restores', {
      backup: signBackup(old),
      generation: s.generation,
      expectedRevision: s.revision,
      confirmed: true,
    }),
  );
  for (const actor of r.actors) await recoverSeat(host, actor);
  const restored = (await readBackup(host)).payload,
    expected = structuredClone(backup.payload);
  for (const key of ['generation', 'revision', 'updatedAt'])
    expected.state[key] = restored.state[key];
  assert.deepEqual(restored, expected);
  assert.equal(restored.state.scenario.pack.manifest.battleStartup.combat.testTerrain, undefined);
  s = await readSession(host);
  const before = (await readBackup(host)).payload,
    offer = s.combat.attacks.find((o) => o.heroId === s.round.activeHeroId);
  assert.match(offer.reason, /braciere/);
  const response = await command(host, r.player, attackIntent(s, offer), s);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, 'ATTACK_CLOSURE');
  assert.deepEqual((await readBackup(host)).payload, before);
});
