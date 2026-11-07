import test from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import {
  readyDeparture,
  confirmedCamp,
  readBackup,
  readSession,
  scenarioInput,
  ok,
  automaticInput,
  finishSetup,
} from './camp-departure-helper.mjs';
import { startHost } from './host-helper.mjs';
import { recoverSeat } from './last-stand-helper.mjs';

// Every path and process here is created by this test in the assigned checkout.
test('pending initial role trigger, Scout3 and spawn resume packless after SIGKILL and empty-host restore', async (t) => {
  const r = await readyDeparture(t, { roleScout: true }),
    camp = await confirmedCamp(r);
  await ok(
    scenarioInput(r.host, r.player, {
      kind: 'camp-depart',
      offerFingerprint: camp.campDeparture.fingerprint,
      agreed: true,
    }),
  );
  let sourceFilesRemoved = false,
    restores = 0;
  const resume = async (label) => {
    const before = await readBackup(r.host),
      old = r.host;
    await old.stop('SIGKILL');
    if (!sourceFilesRemoved) {
      for (const path of r.sourcePaths) await rm(path);
      sourceFilesRemoved = true;
    }
    r.host = await startHost({ LOTR_DATA_DIR: old.dataDir });
    t.after(() => r.host.stop());
    assert.deepEqual(
      (await readBackup(r.host)).payload,
      before.payload,
      label + ' restart must retain both full epochs and receipts',
    );
    const empty = await startHost({ LOTR_DATA_DIR: join(r.directory, `empty-${restores++}`) });
    t.after(() => empty.stop());
    const at = await readSession(empty);
    const result = await empty.request('/api/restores', {
      backup: before,
      generation: at.generation,
      expectedRevision: at.revision,
      confirmed: true,
    });
    assert.equal(result.status, 200, await result.text());
    const restored = (await readBackup(empty)).payload;
    const expected = structuredClone(before.payload);
    // Restore rotates administrative generation/revision/timestamp only; gameplay and every receipt stay byte-equivalent.
    for (const key of ['generation', 'revision', 'updatedAt'])
      expected.state[key] = restored.state[key];
    assert.deepEqual(restored, expected, label + ' empty-host restore');
    await r.host.stop();
    r.host = empty;
    for (const actor of r.actors) await recoverSeat(r.host, actor);
  };
  let s = await readSession(r.host);
  assert.equal(s.scenario.phase, 'setup');
  assert.equal(s.physical.active.mode, 'scout');
  assert.equal(s.physical.active.options.length, 1);
  await resume('role preparation trigger');
  let scout = false,
    spawn = false;
  for (let n = 0; n < 120; n++) {
    s = await readSession(r.host);
    if (!s.scenario.pending) break;
    const b = (await readBackup(r.host)).payload.state.scenario.battle;
    if (!scout && b.runKey === 'scout' && s.physical.active?.mode === 'scout') {
      await resume('Scout3');
      scout = true;
      s = await readSession(r.host);
    }
    if (!spawn && s.scenario.pending.kind === 'deployment') {
      await resume('spawn');
      spawn = true;
      s = await readSession(r.host);
    }
    const actor =
      r.actors.find((a) => a.body.player.id === s.scenario.pending.actorPlayerId) ?? r.player;
    await ok(scenarioInput(r.host, actor, automaticInput(s)));
  }
  assert.ok(scout && spawn);
  await finishSetup(r);
  s = await readSession(r.host);
  assert.equal(s.scenario.phase, 'action');
  assert.equal(s.scenario.handoffCount, 1);
  assert.equal(s.round.number, 1);
});
