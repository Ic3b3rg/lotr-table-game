import test from 'node:test';
import assert from 'node:assert/strict';
import { startHost } from './host-helper.mjs';
import { readBackup } from './skill-test-helper.mjs';
import { runtime } from './threat-helper.mjs';
import { readyScenario, startScenario } from './scenario-helper.mjs';

test('historical variable names remain data rather than new product or sprint metadata', async (t) => {
  const names = [
    { name: 'baseProducts', type: 'int', value: 7 },
    { name: 'sprintOrigin', type: 'int', value: 8 },
    { name: 'op', type: 'string', value: 'ownsProducts' },
    { name: 'kind', type: 'string', value: 'source-sprint' },
  ];
  const { host, player } = await readyScenario(t, (pack) => {
    pack.globals.push(...structuredClone(names));
    pack.definitions[0].variables.push(...structuredClone(names));
  });
  assert.equal((await startScenario(host, player)).status, 200);
  const raw = (await readBackup(host)).payload.state;
  assert.equal(raw.scenario.pack.manifest.baseProducts, undefined);
  assert.equal(raw.scenario.globals.baseProducts, 7);
  assert.equal(raw.scenario.instances[0].variables.sprintOrigin, 8);
  for (let schemaVersion = 10; schemaVersion <= 21; schemaVersion++) {
    const old = { ...raw, schemaVersion },
      before = structuredClone(old);
    if (schemaVersion === 10) {
      delete old.physical;
      delete before.physical;
    }
    assert.deepEqual(runtime.parseState(old), raw);
    assert.deepEqual(old, before);
  }
});

test('schema21 migrates structurally; every older format rejects the new input, program and origins also in the seed', async (t) => {
  const host = await startHost();
  t.after(() => host.dispose());
  const raw = (await readBackup(host)).payload.state,
    old = { ...raw, schemaVersion: 21 },
    before = structuredClone(old);
  assert.deepEqual(runtime.parseState(old), { ...old, schemaVersion: 28 });
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
