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
    spawn = false,
    introduction = false,
    objective = false;
  for (let n = 0; n < 120; n++) {
    s = await readSession(r.host);
    if (!s.scenario.pending) break;
    const frozen = (await readBackup(r.host)).payload.state,
      b = frozen.scenario.battle,
      instruction = frozen.scenario.pack.manifest.battleStartup.instructions[b.cursor];
    if (!scout && b.runKey === 'scout' && s.physical.active?.mode === 'scout') {
      await resume('Scout3');
      scout = true;
      s = await readSession(r.host);
    }
    if (instruction.op === 'message') {
      assert.equal(introduction, false, 'The source introduction appears once');
      assert.equal(s.scenario.pending.kind, 'message');
      assert.equal(
        frozen.scenario.enemies.entropy,
        null,
        'No spawn entropy before the source introduction',
      );
      assert.deepEqual(frozen.scenario.enemies.groups, []);
      await resume('standalone source introduction');
      introduction = true;
      s = await readSession(r.host);
    }
    assert.notEqual(
      s.scenario.pending.kind,
      'deployment-intro',
      'A spawn point must not invent another introduction',
    );
    if (!spawn && s.scenario.pending.kind === 'deployment') {
      assert.equal(introduction, true);
      await resume('spawn');
      spawn = true;
      s = await readSession(r.host);
    }
    if (s.scenario.pending.kind === 'objective') {
      assert.deepEqual(frozen.scenario.objective.text, [
        { kind: 'text', style: 'plain', text: instruction.objectiveText },
      ]);
      assert.deepEqual(s.scenario.pending.text, [
        { kind: 'text', style: 'plain', text: instruction.text },
      ]);
      assert.notDeepEqual(s.scenario.pending.text, frozen.scenario.objective.text);
      await resume('distinct objective presentation and summary');
      objective = true;
      s = await readSession(r.host);
    }
    const actor =
      r.actors.find((a) => a.body.player.id === s.scenario.pending.actorPlayerId) ?? r.player;
    await ok(scenarioInput(r.host, actor, automaticInput(s)));
  }
  assert.ok(scout && introduction && spawn && objective);
  await finishSetup(r);
  s = await readSession(r.host);
  assert.equal(s.scenario.phase, 'action');
  assert.equal(s.scenario.handoffCount, 1);
  assert.equal(s.round.number, 1);
  const final = (await readBackup(r.host)).payload.state.scenario,
    intro = final.pack.manifest.battleStartup.instructions.find((i) => i.op === 'message');
  assert.equal(final.messageLog.filter((m) => m.text[0]?.text === intro.text).length, 1);
});
