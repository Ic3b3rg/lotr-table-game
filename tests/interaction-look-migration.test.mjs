import test from 'node:test';
import assert from 'node:assert/strict';
import { startHost } from './host-helper.mjs';
import { readBackup, signBackup } from './skill-test-helper.mjs';
import { runtime } from './interaction-look-runtime.mjs';
import { readyOriginal } from './original-encounter-helper.mjs';

test('schemas 1–31 reject new forms only at their exact authoritative locations', () => {
  const forms = [
    { physical: { fronts: { artifact: { interactionLook: {} } } } },
    {
      physical: {
        fronts: { artifact: { policies: [{ effects: [{ op: 'before-interact-look' }] }] } },
      },
    },
    { physical: { cycle: { interactionLookRules: 'source-interaction-look-v1' } } },
    { physical: { runs: [{ program: { interactionLookRules: 'source-interaction-look-v1' } }] } },
    { physical: { runs: [{ program: { interactionBefore: 'once' } }] } },
    { physical: { snapshot: { resolution: { privateLooks: [] } } } },
    { physical: { snapshot: { resolution: { interactionWindow: {} } } } },
    { physical: { snapshot: { active: { purpose: 'interaction-look' } } } },
    {
      physical: {
        snapshot: { resolution: { history: [{ active: { purpose: 'interaction-order' } }] } },
      },
    },
    { scenario: { play: { attempts: [{ beforeInteraction: {} }] } } },
    {
      physical: {
        cycle: { seed: { scenario: { play: { attempts: [{ beforeInteraction: {} }] } } } },
      },
    },
    { combat: { operation: { interactionOrder: {} } } },
    { scenario: { pack: { manifest: { campDeparture: { fronts: { interactionLook: {} } } } } } },
    {
      physical: {
        cycle: {
          seed: {
            scenario: {
              pack: {
                manifest: {
                  battleStartup: {
                    fronts: { policies: [{ effects: [{ op: 'before-interact-look' }] }] },
                  },
                },
              },
            },
          },
        },
      },
    },
    { physical: { cycle: { seed: { combat: { operations: [{ interactionOrder: {} }] } } } } },
    {
      scenario: {
        pack: {
          definitions: [
            {
              states: [
                {
                  actions: [
                    {
                      op: 'physical',
                      program: { interactionLookRules: 'source-interaction-look-v1' },
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    },
    { episodes: [{ physical: { snapshot: { resolution: { privateLooks: [] } } } }] },
  ];
  for (let schemaVersion = 1; schemaVersion <= 31; schemaVersion++)
    for (const form of forms) {
      assert.throws(
        () => runtime.parseState({ schemaVersion, ...form }),
        /interazione privata.*storico/i,
      );
      const backup = signBackup({
        format: 'lotr-offline-session',
        formatVersion: 1,
        exportedAt: new Date().toISOString(),
        payload: { state: { schemaVersion, ...form }, commands: [] },
      });
      assert.equal(runtime.BackupSchema.safeParse(backup).success, false);
    }
});

test('new-form names in source dictionaries remain inert and an old A1 cycle stays unactivated', async (t) => {
  const r = await readyOriginal(t, (pack) => {
    for (const name of [
      'interactionLook',
      'privateLooks',
      'interactionWindow',
      'before-interact-look',
      'interactionOrder',
      'interactionLookRules',
    ])
      pack.globals.push({ name, type: 'string', value: 'historical/path/is/inert/data/' + name });
  });
  const current = (await readBackup(r.host)).payload.state;
  const old = { ...structuredClone(current), schemaVersion: 31 },
    before = structuredClone(old);
  assert.deepEqual(runtime.parseState(old), current);
  assert.deepEqual(old, before);
  assert.equal(current.physical.cycle.interactionLookRules, undefined);
  assert.equal(current.physical.snapshot.resolution.privateLooks, undefined);
});

test('historical 1–31 empty sessions migrate structurally without executing new rules or interpreting dictionary names', async (t) => {
  const host = await startHost();
  t.after(() => host.dispose());
  const current = (await readBackup(host)).payload.state;
  assert.equal(current.schemaVersion, 33);
  for (let version = 1; version <= 31; version++) {
    const old = { ...structuredClone(current), schemaVersion: version };
    if (version <= 10) delete old.physical;
    if (version <= 9) delete old.scenario;
    if (version <= 8) delete old.mapGeneration;
    if (version <= 6) delete old.group;
    if (version <= 5) delete old.journey;
    if (version <= 4) delete old.round;
    if (version <= 3) delete old.scout;
    if (version <= 2) delete old.skillTest;
    if (version <= 1) {
      delete old.content;
      delete old.preparation;
    }
    const before = structuredClone(old);
    assert.deepEqual(runtime.parseState(old), current, `version ${version}`);
    assert.deepEqual(old, before);
  }
});
