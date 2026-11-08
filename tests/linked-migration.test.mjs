import test from 'node:test';
import assert from 'node:assert/strict';
import { startHost } from './host-helper.mjs';
import { readBackup } from './skill-test-helper.mjs';
import { runtime } from './threat-helper.mjs';

test('schema20 migrates structurally and every older format rejects linked forms also in its seed', async (t) => {
  const host = await startHost();
  t.after(() => host.dispose());
  const raw = (await readBackup(host)).payload.state;
  const old = { ...raw, schemaVersion: 20 },
    before = structuredClone(old);
  assert.deepEqual(runtime.parseState(old), { ...old, schemaVersion: 34 });
  assert.deepEqual(old, before);
  const forms = [
    { pack: { manifest: { linked: {} } } },
    { pack: { definitions: [{ states: [{ actions: [{ op: 'chooseHero' }] }] }] } },
    { pack: { definitions: [{ states: [{ actions: [{ op: 'awardTitle' }] }] }] } },
    {
      pack: {
        definitions: [
          { states: [{ actions: [{ op: 'choice', options: [{ cost: 'interact' }] }] }] },
        ],
      },
    },
    {
      pack: {
        definitions: [
          { states: [{ actions: [{ op: 'choice', options: [{ requirement: {} }] }] }] },
        ],
      },
    },
    { pending: { kind: 'hero-choice' } },
    { play: { attempts: [{ entryChoice: {} }] } },
  ];
  for (let schemaVersion = 1; schemaVersion <= 20; schemaVersion++) {
    for (const scenario of forms)
      for (const seed of [false, true]) {
        const bad = { ...old, schemaVersion };
        if (seed) bad.physical = { cycle: { seed: { scenario } } };
        else bad.scenario = scenario;
        assert.throws(() => runtime.parseState(bad), /collegat|titolo|storico/i);
      }
    const bad = {
      ...old,
      schemaVersion,
      physical: { runs: [{ program: { children: [{ kind: 'scenario-title' }] } }] },
    };
    assert.throws(() => runtime.parseState(bad), /collegat|titolo|storico/i);
    for (const physical of [
      { cycle: { records: [{ intent: { choiceEvent: 'DELIVER' } }] } },
      { cycle: { records: [{ intent: { input: { kind: 'choose-hero' } } }] } },
      { cycle: { seed: { combat: { operation: { origin: { choiceEvent: 'DELIVER' } } } } } },
    ])
      assert.throws(
        () => runtime.parseState({ ...old, schemaVersion, physical }),
        /collegat|titolo|storico/i,
      );
  }
});
