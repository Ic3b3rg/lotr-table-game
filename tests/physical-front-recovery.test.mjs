import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { readyFronts } from './physical-front-helper.mjs';
import { reachPhysical } from './physical-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';
import { readSession, readBackup, signBackup } from './skill-test-helper.mjs';
import { startHost } from './host-helper.mjs';

const restore = async (host, backup) => {
  const s = await readSession(host);
  return host.request('/api/restores', {
    backup,
    generation: s.generation,
    expectedRevision: s.revision,
    confirmed: true,
  });
};
test('P1 concurrent intent, crash, packless restore and re-signed tampering preserve the exact continuation', async (t) => {
  const ready = await readyFronts(t);
  let host = ready.host;
  t.after(() => host.stop());
  const s = await reachPhysical(ready),
    requestId = randomUUID(),
    input = { kind: 'physical-choice', option: '0' };
  const results = await Promise.all([
    scenarioInput(host, ready.player, input, { requestId }, s),
    scenarioInput(host, ready.player, input, { requestId }, s),
    scenarioInput(host, ready.player, input, { requestId: randomUUID() }, s),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 200, 409]);
  const bodies = await Promise.all(results.filter((r) => r.status === 200).map((r) => r.json()));
  assert.deepEqual(bodies[0].receipt, bodies[1].receipt);
  const committed = await readBackup(host);
  assert.equal(committed.payload.state.physical.runs[0].answers.length, 1);
  await host.stop('SIGKILL');
  for (const path of [
    ready.scenarioPath,
    ready.physicalPath,
    join(host.dataDir, 'physical-fronts.json'),
  ])
    await rm(path);
  host = await startHost({ LOTR_DATA_DIR: host.dataDir });
  assert.deepEqual((await readBackup(host)).payload, committed.payload);
  assert.equal((await scenarioInput(host, ready.player, input, { requestId }, s)).status, 200);
  assert.equal(
    (
      await scenarioInput(
        host,
        ready.player,
        { kind: 'physical-choice', option: '1' },
        { requestId },
        s,
      )
    ).status,
    409,
  );
  const before = await readSession(host);
  for (const edit of [
    (b) =>
      b.payload.state.physical.snapshot.resolution.resources.preparation.heroes[0].inspiration++,
    (b) => b.payload.state.physical.runs[0].context.preparation.heroes[0].inspiration++,
    (b) => (b.payload.state.physical.runs[0].answers[0].cursor = '0'.repeat(64)),
    (b) => (b.payload.state.physical.snapshot.resolution.history[0].active.actorHeroId = 'hero-2'),
    (b) => (b.payload.state.physical.fronts.artifact.definitions[0].body = [{ op: 'keep-faceup' }]),
    (b) => (b.payload.state.physical.snapshot.resolution.faceup = ['invented-fear-2-copy-1']),
    (b) => {
      const p = b.payload.state;
      const id = p.physical.runs[0].answers[0].evidence.requestId;
      p.scenario.commands = p.scenario.commands.filter((c) => c.requestId !== id);
      b.payload.commands = b.payload.commands.filter((c) => c.requestId !== id);
    },
  ]) {
    const changed = structuredClone(committed);
    edit(changed);
    signBackup(changed);
    assert.equal((await restore(host, changed)).status, 422);
    assert.deepEqual(await readSession(host), before);
  }
  assert.equal((await restore(host, committed)).status, 200);
  const after = await readBackup(host);
  for (const k of ['physical', 'preparation', 'scenario', 'mapGeneration'])
    assert.deepEqual(after.payload.state[k], committed.payload.state[k]);
  assert.deepEqual(after.payload.commands, committed.payload.commands);
  assert.notEqual(after.payload.state.generation, committed.payload.state.generation);
});

test('schema11 pending P0 imports as12 without changing its physical program, entropy or receipts', async (t) => {
  const { readyPhysical } = await import('./physical-helper.mjs');
  const ready = await readyPhysical(t);
  await reachPhysical(ready);
  const backup = await readBackup(ready.host),
    expected = structuredClone(backup);
  backup.payload.state.schemaVersion = 11;
  signBackup(backup);
  assert.equal((await restore(ready.host, backup)).status, 200);
  const after = await readBackup(ready.host);
  assert.equal(after.payload.state.schemaVersion, 26);
  assert.deepEqual(after.payload.state.physical, expected.payload.state.physical);
  assert.deepEqual(after.payload.state.scenario, expected.payload.state.scenario);
  assert.deepEqual(after.payload.commands, expected.payload.commands);
});

test('schema12 pending P1a migrates intact and rejects a newer cycle disguised as12', async (t) => {
  const ready = await readyFronts(t);
  await reachPhysical(ready);
  const backup = await readBackup(ready.host),
    original = structuredClone(backup);
  backup.payload.state.schemaVersion = 12;
  signBackup(backup);
  const r = await restore(ready.host, backup);
  assert.equal(r.status, 200, await r.text());
  const after = await readBackup(ready.host);
  assert.equal(after.payload.state.schemaVersion, 26);
  assert.deepEqual(after.payload.state.physical, original.payload.state.physical);
  assert.deepEqual(after.payload.state.scenario, original.payload.state.scenario);
  assert.deepEqual(after.payload.commands, original.payload.commands);
  const forged = structuredClone(backup);
  forged.payload.state.physical.version = 3;
  signBackup(forged);
  assert.equal((await restore(ready.host, forged)).status, 422);
});
