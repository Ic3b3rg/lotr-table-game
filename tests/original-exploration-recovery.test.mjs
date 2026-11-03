import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import {
  readyExploration,
  startTravel,
  destinations,
  exploreIntent,
  finishExploration,
} from './original-exploration-helper.mjs';
import { readSession, readBackup, signBackup } from './skill-test-helper.mjs';
import { command } from './preparation-helper.mjs';
import { startHost } from './host-helper.mjs';
test('exploration concurrent retry, packless pending restart/restore, and re-signed pose/reward/cost/event/return/history attacks', async (t) => {
  const r = await readyExploration(t),
    at = await startTravel(r),
    to = destinations(at)[0],
    intent = { ...exploreIntent(at, to), requestId: randomUUID() };
  let host = r.host;
  t.after(() => host.stop());
  const responses = await Promise.all([
    command(host, r.player, intent, at),
    command(host, r.player, intent, at),
    command(host, r.player, { ...intent, requestId: randomUUID() }, at),
  ]);
  assert.deepEqual(responses.map((x) => x.status).sort(), [200, 200, 409]);
  const successes = await Promise.all(
    responses.filter((x) => x.status === 200).map((x) => x.json()),
  );
  assert.deepEqual(successes[0].receipt, successes[1].receipt);
  assert.equal(
    (await command(host, r.player, { ...intent, destinationSpaceId: 'foreign' }, at)).status,
    409,
  );
  const pending = await readBackup(host);
  assert.equal(pending.payload.state.scenario.pending.kind, 'exploration-intro');
  assert.equal(pending.payload.state.explorationFingerprints, undefined);
  await host.stop('SIGKILL');
  for (const p of [
    r.scenarioPath,
    join(host.dataDir, 'physical-content.json'),
    join(host.dataDir, 'physical-fronts.json'),
    join(host.dataDir, 'physical-last-stand.json'),
  ])
    await rm(p);
  host = await startHost({ LOTR_DATA_DIR: host.dataDir });
  r.host = host;
  assert.deepEqual((await readBackup(host)).payload, pending.payload);
  assert.equal((await command(host, r.player, intent, at)).status, 200);
  let stable = await readSession(host);
  const restore = (b) =>
    host.request('/api/restores', {
      backup: b,
      generation: stable.generation,
      expectedRevision: stable.revision,
      confirmed: true,
    });
  for (const edit of [
    (b) => b.payload.state.round.heroes[0].actionsUsed++,
    (b) => b.payload.state.journey.travel.remaining++,
    (b) =>
      (b.payload.state.journey.heroes[0].spaceId = b.payload.state.journey.definition.startSpaceId),
    (b) => (b.payload.state.scenario.explorations.attempts[0].reward = 1),
    (b) => (b.payload.state.scenario.explorations.attempts[0].returned = true),
    (b) =>
      (b.payload.state.scenario.explorations.attempts[0].intro =
        1 - b.payload.state.scenario.explorations.attempts[0].intro),
    (b) => (b.payload.state.scenario.explorations.attempts[0].movementCost = 0),
    (b) => b.payload.state.scenario.events.pop(),
    (b) => b.payload.state.scenario.tasks[0].spaceIndex++,
    (b) => b.payload.state.physical.cycle.seed.round.number++,
    (b) => {
      const s = b.payload.state,
        ids = new Set(s.physical.cycle.records.map((r) => r.requestId));
      s.physical.cycle.records = [];
      s.scenario.commands = s.scenario.commands.filter((c) => !ids.has(c.requestId));
      b.payload.commands = b.payload.commands.filter((c) => !ids.has(c.requestId));
    },
    (b) => {
      b.payload.state.scenario.commands = [];
      b.payload.state.physical.cycle.records = [];
      b.payload.commands = [];
    },
  ]) {
    const bad = structuredClone(pending);
    edit(bad);
    signBackup(bad);
    const res = await restore(bad);
    assert.equal(res.status, 422, await res.text());
    assert.deepEqual(await readSession(host), stable);
  }
  const restored = await restore(pending);
  assert.equal(restored.status, 200, await restored.text());
  const after = await readBackup(host);
  for (const k of Object.keys(pending.payload.state).filter(
    (k) => !['generation', 'revision', 'updatedAt'].includes(k),
  ))
    assert.deepEqual(after.payload.state[k], pending.payload.state[k], k);
  assert.deepEqual(after.payload.commands, pending.payload.commands);
  for (const actor of [r.player, r.other]) {
    const recovered = await host.request('/api/recover', {
      recoveryCode: actor.recoveryCode,
      generation: after.payload.state.generation,
    });
    assert.equal(recovered.status, 200);
    actor.cookie = recovered.headers.get('set-cookie').split(';')[0];
  }
  await finishExploration(r);
  const completed = await readBackup(host);
  await host.stop('SIGKILL');
  host = await startHost({ LOTR_DATA_DIR: host.dataDir });
  r.host = host;
  assert.deepEqual((await readBackup(host)).payload, completed.payload);
  stable = await readSession(host);
  const bad = structuredClone(completed);
  bad.payload.state.scenario.explorations.attempts[0].returned = false;
  signBackup(bad);
  assert.equal((await restore(bad)).status, 422);
});
