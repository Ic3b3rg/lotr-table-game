import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime } from './adventure3-startup-runtime.mjs';

test('schemas1–35 reject A3 only at the actual authority, origin and projection seams', () => {
  const forms = [
    { episodes: [{}, {}] },
    { physical: { cycle: { version: 4 } } },
    { physical: { cycle: { seed: { departure: { version: 'camp-departure-v2' } } } } },
    { physical: { cycle: { records: [{ generation: '00000000-0000-4000-8000-000000000001' }] } } },
    { mapGeneration: { projection: { algorithm: 'frozen-A3-v1' } } },
    { mapGeneration: { projection: { context: { policy: 'camp-A3-v1' } } } },
  ];
  for (const scenario of [
    { journeyStartup: {} },
    { pack: { identity: { adventureId: 3 } } },
    { pack: { manifest: { journeyStartup: {} } } },
    { pack: { manifest: { campDeparture: { version: 'source-camp-departure-A3-v1' } } } },
    { pack: { manifest: { campDeparture: { continuation: {} } } } },
    { pack: { manifest: { battleStartup: { continuation: {} } } } },
    ...[
      { op: 'delay' },
      { op: 'highlight', randomSpace: 'unity-range-port-v1' },
      { op: 'message', scoutCount: 3 },
      { op: 'section', sectionId: 6 },
    ].map((action) => ({ pack: { definitions: [{ states: [{ actions: [action] }] }] } })),
  ])
    forms.push({ scenario }, { physical: { cycle: { seed: { scenario } } } });
  for (let schemaVersion = 1; schemaVersion <= 35; schemaVersion++)
    for (const form of forms)
      assert.throws(
        () => runtime.parseState({ schemaVersion, ...form }),
        /prospettiche.*storico/i,
        JSON.stringify({ schemaVersion, form }),
      );
});
