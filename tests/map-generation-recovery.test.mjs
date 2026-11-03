import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile, unlink } from 'node:fs/promises';
import { readyGenerator, offer, generate, waitGeneration } from './map-generation-helper.mjs';
import { readSession, readBackup, signBackup } from './skill-test-helper.mjs';
import { startHost } from './host-helper.mjs';
import { command } from './preparation-helper.mjs';
import { hash } from './fixtures/map-freeze.mjs';
async function recover(host, player) {
  const state = await readSession(host),
    r = await host.request('/api/recover', {
      recoveryCode: player.recoveryCode,
      generation: state.generation,
    });
  assert.equal(r.status, 200);
  return { ...player, cookie: r.headers.get('set-cookie').split(';')[0] };
}
async function restore(host, backup) {
  const s = await readSession(host);
  return host.request('/api/restores', {
    backup,
    generation: s.generation,
    expectedRevision: s.revision,
    confirmed: true,
  });
}

test('SIGKILL pending, letture e nuova identità conservano input pulito e consentono ripresa esplicita', async (t) => {
  const { host, player, other, packPath } = await readyGenerator(t),
    plan = await offer(host),
    before = await readSession(host),
    requestId = randomUUID();
  const accepted = await generate(host, player, { requestId });
  assert.equal(accepted.status, 200);
  const pending = (await accepted.json()).session;
  await host.stop('SIGKILL');
  const restarted = await startHost({ LOTR_DATA_DIR: host.dataDir, LOTR_GENERATOR_PACK: packPath });
  t.after(() => restarted.stop());
  assert.deepEqual(await readSession(restarted), pending);
  assert.equal((await offer(restarted)).running, false);
  assert.equal((await offer(restarted)).canResume, true);
  assert.deepEqual(await readSession(restarted), pending);
  const identity = await recover(restarted, other);
  assert.equal(
    (
      await command(restarted, identity, {
        type: 'RESUME_ADVENTURE_MAP',
        jobId: pending.mapGeneration.job.id,
        packFingerprint: plan.packFingerprint,
        contextFingerprint: plan.contextFingerprint,
        agreed: true,
      })
    ).status,
    200,
  );
  const frozen = await waitGeneration(restarted);
  assert.equal(frozen.mapGeneration.projection.requestedSeed, 1);
  assert.deepEqual(frozen.preparation, before.preparation);
  const receipt = (await readBackup(restarted)).payload.commands.find(
    (c) => c.requestId === requestId,
  ).receipt;
  assert.equal(receipt.status, 'frozen');
  assert.equal(frozen.mapGeneration.requests.length, 2);
});

test('crash dopo commit e backup senza pack riusano il realizzato e la ricevuta senza draw o storia doppi', async (t) => {
  const { host, player, packPath } = await readyGenerator(t),
    plan = await offer(host),
    before = await readSession(host),
    requestId = randomUUID();
  assert.equal((await generate(host, player, { requestId })).status, 200);
  const frozen = await waitGeneration(host),
    backup = await readBackup(host);
  await host.stop('SIGKILL');
  await unlink(packPath);
  const restarted = await startHost({ LOTR_DATA_DIR: host.dataDir, LOTR_GENERATOR_PACK: packPath });
  t.after(() => restarted.stop());
  assert.deepEqual(await readSession(restarted), frozen);
  const owner = await recover(restarted, player);
  const replay = await command(
    restarted,
    owner,
    {
      type: 'GENERATE_ADVENTURE_MAP',
      requestId,
      requestedSeed: 1,
      packFingerprint: plan.packFingerprint,
      contextFingerprint: plan.contextFingerprint,
      agreed: true,
    },
    before,
  );
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).receipt.status, 'frozen');
  assert.deepEqual(await readSession(restarted), frozen);
  const destination = await startHost();
  t.after(() => destination.dispose());
  assert.equal((await restore(destination, backup)).status, 200);
  const after = await readSession(destination);
  assert.deepEqual(after.mapGeneration, frozen.mapGeneration);
  assert.deepEqual(after.preparation, frozen.preparation);
  assert.deepEqual((await readBackup(destination)).payload.commands, backup.payload.commands);
  const recovered = await recover(destination, player);
  const duplicate = await command(
    destination,
    recovered,
    {
      type: 'GENERATE_ADVENTURE_MAP',
      requestId,
      requestedSeed: 1,
      packFingerprint: plan.packFingerprint,
      contextFingerprint: plan.contextFingerprint,
      agreed: true,
    },
    { ...before, generation: after.generation },
  );
  assert.equal(duplicate.status, 200);
  assert.deepEqual(
    (await duplicate.json()).receipt,
    backup.payload.commands.find((c) => c.requestId === requestId).receipt,
  );
  assert.deepEqual(await readSession(destination), after);
});

test('import semanticamente invalido e ricevute alterate non sostituiscono il tavolo', async (t) => {
  const { host, player } = await readyGenerator(t);
  await generate(host, player);
  await waitGeneration(host);
  const backup = await readBackup(host),
    before = await readSession(host);
  const edits = [
    (b) => (b.payload.state.mapGeneration.projection.closure.selectedPrefabSources = []),
    (b) => (b.payload.state.mapGeneration.projection.spaces[0].connected = []),
    (b) => b.payload.state.mapGeneration.projection.movementGraph.edges.pop(),
    (b) => (b.payload.state.mapGeneration.projection.history.usedEncounterIds = []),
    (b) =>
      (b.payload.commands.find((c) => c.receipt.type === 'GENERATE_ADVENTURE_MAP').receipt.status =
        'pending'),
    (b) =>
      (b.payload.commands = b.payload.commands.filter(
        (c) => c.receipt.type !== 'GENERATE_ADVENTURE_MAP',
      )),
  ];
  for (const edit of edits) {
    const b = structuredClone(backup);
    edit(b);
    const p = b.payload.state.mapGeneration.projection;
    const { fingerprint, ...data } = p;
    p.fingerprint = hash(data);
    signBackup(b);
    assert.equal((await restore(host, b)).status, 422);
    assert.deepEqual(await readSession(host), before);
  }
});

test('restore durante pending invalida il worker precedente e non riapre la generazione leggendo', async (t) => {
  const { host, player } = await readyGenerator(t),
    backup = await readBackup(host);
  await generate(host, player);
  assert.equal((await restore(host, backup)).status, 200);
  const after = await readSession(host);
  assert.equal(after.mapGeneration, null);
  await new Promise((resolve) => setTimeout(resolve, 350));
  assert.deepEqual(await readSession(host), after);
});
