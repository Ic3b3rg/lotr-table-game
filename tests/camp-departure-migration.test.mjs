import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime } from './camp-departure-runtime.mjs';
import { readyDeparture, readBackup } from './camp-departure-helper.mjs';
import { signBackup } from './skill-test-helper.mjs';

test('schemas1–30 reject departure forms at their exact authoritative locations', () => {
  const forms = [
    { episodes: [] },
    { preparation: { episode: {} } },
    { physical: { episode: {} } },
    { physical: { cycle: { version: 3 } } },
    { physical: { cycle: { seed: { departure: {} } } } },
    { physical: { cycle: { seed: { preparation: { episode: {} } } } } },
    { physical: { fronts: { campaignSkills: [] } } },
    { physical: { snapshot: { resolution: { resources: { preparation: { episode: {} } } } } } },
    { physical: { runs: [{ context: { preparation: { episode: {} } } }] } },
    ...['battle-equipment', 'battle-loss-weakness'].map((kind) => ({
      physical: { runs: [{ program: { children: [{ kind }] } }] },
    })),
    { physical: { runs: [{ program: { children: [{ kind: 'startup-scout', count: 3 }] } }] } },
    ...['after-prepare-scout', 'after-setup-scout', 'after-setup-inspiration'].map((op) => ({
      physical: { fronts: { artifact: { policies: [{ effects: [{ op }] }] } } },
    })),
    { physical: { cycle: { records: [{ intent: { input: { kind: 'camp-depart' } } }] } } },
  ];
  for (const scenario of [
    { pack: { manifest: { campDeparture: {} } } },
    { pack: { manifest: { battleStartup: {} } } },
    { battle: {} },
    { commands: [{ kind: 'camp-depart' }] },
  ])
    forms.push({ scenario }, { physical: { cycle: { seed: { scenario } } } });
  for (let schemaVersion = 1; schemaVersion <= 30; schemaVersion++) {
    for (const form of forms)
      assert.throws(
        () => runtime.parseState({ schemaVersion, ...form }),
        /partenza.*storico/i,
        JSON.stringify({ schemaVersion, form }),
      );
    for (const receipt of [{ departure: {} }, { kind: 'camp-depart' }]) {
      const backup = signBackup({
        format: 'lotr-offline-session',
        formatVersion: 1,
        exportedAt: new Date().toISOString(),
        payload: { state: { schemaVersion }, commands: [{ receipt }] },
      });
      assert.equal(runtime.BackupSchema.safeParse(backup).success, false);
    }
  }
});

test('schema30 migration preserves the complete A1 payload and similarly named dictionary data', async (t) => {
  const r = await readyDeparture(t, {
    edit(pack) {
      delete pack.manifest.campDeparture;
      for (const name of [
        'episodes',
        'campDeparture',
        'battleStartup',
        'departure',
        'battle-equipment',
        'after-setup-scout',
      ])
        pack.globals.push({ name, type: 'string', value: name });
    },
  });
  const current = (await readBackup(r.host)).payload.state,
    old = { ...structuredClone(current), schemaVersion: 30 },
    before = structuredClone(old);
  assert.deepEqual(runtime.parseState(old), current);
  assert.deepEqual(old, before);
  assert.equal(current.episodes, undefined);
  assert.equal(current.physical.cycle.version, 2);
});
