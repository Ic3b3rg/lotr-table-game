import test from 'node:test';
import assert from 'node:assert/strict';
import { startHost } from './host-helper.mjs';
import { readBackup } from './skill-test-helper.mjs';
import { runtime } from './threat-helper.mjs';

test('schema19 migrates structurally; all older formats reject lair capability, opcode and outcome even in the origin', async (t) => {
  const host = await startHost();
  t.after(() => host.dispose());
  const raw = (await readBackup(host)).payload.state;
  const previous = { ...raw, schemaVersion: 19 },
    before = structuredClone(previous);
  assert.deepEqual(runtime.parseState(previous), { ...previous, schemaVersion: 32 });
  assert.deepEqual(previous, before);
  const cases = [
    { pack: { manifest: { lair: {} } } },
    { conclusion: { outcome: 'victory' } },
    { conclusion: { version: 'source-lair-victory-v1' } },
    { pack: { definitions: [{ states: [{ actions: [{ op: 'endGame' }] }] }] } },
  ];
  for (const schemaVersion of [19, 18, 17, 16, 15, 10])
    for (const scenario of cases)
      for (const seed of [false, true]) {
        const bad = { ...previous, schemaVersion };
        if (seed) bad.physical = { cycle: { seed: { scenario } } };
        else bad.scenario = scenario;
        assert.throws(() => runtime.parseState(bad), /covo|vittoria|storico/i);
      }
});
