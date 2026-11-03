import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { readyOriginal, interact, playable, finishPhysical } from './original-encounter-helper.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';
import { readSession, readBackup, signBackup } from './skill-test-helper.mjs';
import { command } from './preparation-helper.mjs';
import { startHost } from './host-helper.mjs';
import { hash } from './fixtures/map-freeze.mjs';
async function ok(p) {
  const r = await p;
  assert.equal(r.status, 200, await r.text());
  return r;
}
export async function atToken(r) {
  await ok(cycleCommand(r, 'START_TURN'));
  await ok(cycleCommand(r, 'START_TRAVEL'));
  const s = await readSession(r.host),
    i = playable(s),
    dest = s.scenario.spaceBindings.find((b) => b.sourceId === i.spaceId).id;
  await ok(
    cycleCommand(r, 'MOVE_HERO', {
      fromSpaceId: s.journey.heroes[0].spaceId,
      destinationSpaceId: dest,
    }),
  );
  return readSession(r.host);
}
test('source-bound interaction retries once, resumes packless and rejects re-signed history/progress/return/position attacks', async (t) => {
  const r = await readyOriginal(t);
  let host = r.host;
  t.after(() => host.stop());
  const at = await atToken(r),
    i = playable(at),
    requestId = randomUUID();
  const intent = {
    type: 'INTERACT_SCENARIO',
    requestId,
    scenarioId: at.scenario.id,
    packFingerprint: at.scenario.packFingerprint,
    projectionFingerprint: at.scenario.projectionFingerprint,
    instanceId: i.id,
    sourceFingerprint: hash(i),
    heroId: at.round.activeHeroId,
    roundId: at.round.id,
    turnId: at.round.turnId,
  };
  const results = await Promise.all([
    command(host, r.player, intent, at),
    command(host, r.player, intent, at),
    command(host, r.player, { ...intent, requestId: randomUUID() }, at),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 200, 409]);
  const bodies = await Promise.all(results.filter((r) => r.status === 200).map((r) => r.json()));
  assert.deepEqual(bodies[0].receipt, bodies[1].receipt);
  assert.equal(
    (await command(host, r.player, { ...intent, instanceId: 'another-instance' }, at)).status,
    409,
  );
  const committed = await readBackup(host);
  await host.stop('SIGKILL');
  for (const path of [
    r.scenarioPath,
    join(host.dataDir, 'physical-content.json'),
    join(host.dataDir, 'physical-fronts.json'),
    join(host.dataDir, 'physical-last-stand.json'),
  ])
    await rm(path);
  host = await startHost({ LOTR_DATA_DIR: host.dataDir });
  r.host = host;
  assert.deepEqual((await readBackup(host)).payload, committed.payload);
  assert.equal((await command(host, r.player, intent, at)).status, 200);
  let s = await finishPhysical(r);
  assert.equal(s.scenario.pending.kind, 'choice');
  const pending = await readBackup(host),
    stable = await readSession(host);
  const restore = (b) =>
    host.request('/api/restores', {
      backup: b,
      generation: stable.generation,
      expectedRevision: stable.revision,
      confirmed: true,
    });
  for (const edit of [
    (b) => b.payload.state.round.heroes[0].actionsUsed--,
    (b) => b.payload.state.journey.travel.remaining++,
    (b) =>
      (b.payload.state.journey.heroes[0].spaceId = b.payload.state.journey.definition.startSpaceId),
    (b) => (playable(b.payload.state).variables.seen = false),
    (b) => b.payload.state.scenario.play.lore++,
    (b) => b.payload.state.scenario.play.tests[0].successes++,
    (b) => (b.payload.state.scenario.play.attempts[0].returned = true),
    (b) =>
      (b.payload.state.physical.runs.at(-1).spatial.heroes[0].spaceId = 'invented-other-space'),
    (b) => (b.payload.state.physical.cycle.seed.round.number = 999),
    (b) =>
      (b.payload.state.physical.cycle.seed.journey.heroes[0].spaceId =
        b.payload.state.journey.heroes[0].spaceId),
    (b) => {
      const ids = new Set(b.payload.state.physical.cycle.records.map((r) => r.requestId));
      b.payload.state.physical.cycle.records = [];
      b.payload.state.scenario.commands = b.payload.state.scenario.commands.filter(
        (r) => !ids.has(r.requestId),
      );
      b.payload.commands = b.payload.commands.filter((r) => !ids.has(r.requestId));
    },
    (b) => {
      const rec = b.payload.state.physical.cycle.records.find(
        (r) => r.intent.type === 'INTERACT_SCENARIO',
      );
      b.payload.state.physical.cycle.records = b.payload.state.physical.cycle.records.filter(
        (r) => r !== rec,
      );
      b.payload.state.scenario.commands = b.payload.state.scenario.commands.filter(
        (r) => r.requestId !== rec.requestId,
      );
      b.payload.commands = b.payload.commands.filter((r) => r.requestId !== rec.requestId);
    },
    (b) => {
      b.payload.state.schemaVersion = 14;
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
  for (const key of Object.keys(pending.payload.state).filter(
    (k) => !['generation', 'revision', 'updatedAt'].includes(k),
  ))
    assert.deepEqual(after.payload.state[key], pending.payload.state[key], key);
  assert.deepEqual(after.payload.commands, pending.payload.commands);
});
