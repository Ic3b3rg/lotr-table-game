import test from 'node:test';
import assert from 'node:assert/strict';
import { startHost } from './host-helper.mjs';
import { readBackup } from './skill-test-helper.mjs';
import { runtime } from './threat-helper.mjs';

test('schema21 migrates structurally; every older format rejects the new input, program and origins also in the seed', async (t) => {
  const host = await startHost();
  t.after(() => host.dispose());
  const raw = (await readBackup(host)).payload.state,
    old = { ...raw, schemaVersion: 21 },
    before = structuredClone(old);
  assert.deepEqual(runtime.parseState(old), { ...old, schemaVersion: 22 });
  assert.deepEqual(old, before);
  const forms = [
    { pack: { manifest: { baseProducts: {} } } },
    { pack: { definitions: [{ states: [{ actions: [{ op: 'ownsProducts' }] }] }] } },
    { pack: { definitions: [{ states: [{ actions: [{ op: 'message', sprint: 1 }] }] }] } },
    { pending: { kind: 'sprint' } },
    { tasks: [{ kind: 'sprint' }] },
    { explorations: { attempts: [{ sprintOrigin: {} }] } },
  ];
  for (let schemaVersion = 1; schemaVersion <= 21; schemaVersion++) {
    for (const scenario of forms)
      for (const seed of [false, true]) {
        const bad = { ...old, schemaVersion };
        if (seed) bad.physical = { cycle: { seed: { scenario } } };
        else bad.scenario = scenario;
        assert.throws(() => runtime.parseState(bad), /base|scatto|storico/i);
      }
    for (const physical of [
      {
        cycle: {
          records: [{ intent: { input: { kind: 'source-sprint', destinationSpaceId: null } } }],
        },
      },
      { cycle: { seed: { combat: { operation: { origin: { kind: 'source-sprint' } } } } } },
    ])
      assert.throws(
        () => runtime.parseState({ ...old, schemaVersion, physical }),
        /base|scatto|storico/i,
      );
    assert.throws(
      () =>
        runtime.parseState({
          ...old,
          schemaVersion,
          combat: { operations: [{ origin: { kind: 'source-sprint' } }] },
        }),
      /base|scatto|storico/i,
    );
  }
});
