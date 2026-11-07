import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readyDeparture,
  confirmedCamp,
  scenarioInput,
  readSession,
  readBackup,
  ok,
  finishSetup,
} from './camp-departure-helper.mjs';
import { lookInput } from './interaction-look-helper.mjs';
import { signBackup } from './skill-test-helper.mjs';
import { runtime } from './interaction-look-runtime.mjs';
import { hash } from './fixtures/map-freeze.mjs';
import { startHost } from './host-helper.mjs';

test('A1 private results remain source-derived in the archived episode while A2 startup preserves its own boundary', async (t) => {
  const r = await readyDeparture(t, {
    frontEdit(ir, catalog, raw) {
      const input = lookInput(raw, catalog);
      ir.interactionLook = input.interactionLook;
      ir.policies.push(...input.policies);
    },
  });
  const camp = await confirmedCamp(r);
  await ok(
    scenarioInput(r.host, r.player, {
      kind: 'camp-depart',
      offerFingerprint: camp.campDeparture.fingerprint,
      agreed: true,
    }),
  );
  await finishSetup(r);
  const backup = await readBackup(r.host),
    state = backup.payload.state;
  assert.equal(state.physical.cycle.version, 3);
  assert.equal(state.physical.cycle.interactionLookRules, undefined);
  assert.equal(state.scenario.pack.manifest.scope, 'battle-startup-v1');
  assert.equal(state.physical.snapshot.resolution.privateLooks, undefined);
  assert.ok(state.episodes[0].physical.snapshot.resolution.privateLooks.length);
  assert.equal(runtime.BackupSchema.safeParse(backup).success, true);
  const bad = structuredClone(backup),
    archive = bad.payload.state.episodes[0];
  archive.physical.snapshot.resolution.privateLooks[0].reward = archive.physical.snapshot.resolution
    .privateLooks[0].reward
    ? 0
    : 1;
  bad.payload.state.physical.cycle.seed.departure.archiveFingerprint = hash(archive);
  signBackup(bad);
  assert.equal(runtime.BackupSchema.safeParse(bad).success, false);
  const empty = await startHost();
  t.after(() => empty.dispose());
  const initial = await readSession(empty);
  await ok(
    empty.request('/api/restores', {
      backup,
      generation: initial.generation,
      expectedRevision: initial.revision,
      confirmed: true,
    }),
  );
  const restored = (await readBackup(empty)).payload;
  for (const key of Object.keys(state).filter(
    (k) => !['generation', 'revision', 'updatedAt'].includes(k),
  ))
    assert.deepEqual(restored.state[key], state[key], key);
  assert.deepEqual(restored.commands, backup.payload.commands);
});
