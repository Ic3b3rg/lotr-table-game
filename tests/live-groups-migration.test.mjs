import test from 'node:test';
import assert from 'node:assert/strict';
import { startHost } from './host-helper.mjs';
import { readBackup } from './skill-test-helper.mjs';
import { runtime } from './threat-helper.mjs';

test('schema18 migrates structurally and older formats reject new group rules even in the replay origin', async (t) => {
  const host = await startHost();
  t.after(() => host.dispose());
  const raw = (await readBackup(host)).payload.state;
  const previous = { ...raw, schemaVersion: 18 };
  const before = structuredClone(previous);
  assert.deepEqual(runtime.parseState(previous), { ...previous, schemaVersion: 23 });
  assert.deepEqual(previous, before);
  for (const schemaVersion of [18, 17, 15, 10])
    for (const change of [
      (s) => {
        s.scenario = { pack: { manifest: { liveGroups: { version: 'source-live-groups-v1' } } } };
      },
      (s) => {
        s.physical = { runs: [{ program: { groupRules: 'source-live-groups-v1' } }] };
      },
      (s) => {
        s.physical = { cycle: { seed: { scenario: { pack: { manifest: { liveGroups: {} } } } } } };
      },
    ]) {
      const bad = { ...previous, schemaVersion };
      change(bad);
      assert.throws(() => runtime.parseState(bad), /grupp/i);
    }
});
