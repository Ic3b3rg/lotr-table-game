import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readyGenerator, offer, generate, waitGeneration } from './map-generation-helper.mjs';
import { readSession, readBackup } from './skill-test-helper.mjs';
import { command } from './preparation-helper.mjs';
test('il comando salva pending e ricevuta poi congela una sola mappa autorevole senza abilitare startup', async (t) => {
  const { host, player, other } = await readyGenerator(t);
  const before = await readSession(host),
    plan = await offer(host);
  assert.equal(plan.kind, 'ready');
  const requestId = randomUUID();
  const response = await generate(host, player, { requestId }, before);
  assert.equal(response.status, 200);
  const accepted = await response.json();
  assert.equal(accepted.receipt.status, 'pending');
  assert.equal(accepted.session.mapGeneration.status, 'pending');
  const pending = await readSession(host);
  assert.equal((await generate(host, other, {}, pending)).status, 409);
  const after = await waitGeneration(host);
  assert.equal(after.mapGeneration.projection.context.heroCount, 2);
  assert.equal(after.mapGeneration.projection.continuation.status, 'pending-startup');
  assert.equal(after.journey, null);
  assert.equal(after.round, null);
  assert.deepEqual(after.preparation, before.preparation);
  const repeat = await generate(
    host,
    player,
    {
      requestId,
      packFingerprint: plan.packFingerprint,
      contextFingerprint: plan.contextFingerprint,
    },
    before,
  );
  assert.equal(repeat.status, 200);
  const body = await repeat.json();
  assert.equal(body.receipt.status, 'frozen');
  assert.equal(body.receipt.projectionFingerprint, after.mapGeneration.projection.fingerprint);
  assert.equal(body.session.revision, after.revision);
  const backup = await readBackup(host);
  assert.equal(
    backup.payload.commands.find((c) => c.requestId === requestId).receipt.status,
    'frozen',
  );
  assert.equal((await command(host, player, { type: 'START_ROUNDS', agreed: true })).status, 409);
  assert.equal(
    (await command(host, player, { type: 'START_SCOUT', heroId: 'hero-1', count: 2 })).status,
    409,
  );
});
test('fingerprint, identità e revisioni errati non reclamano o iniziano una generazione', async (t) => {
  const { host, player } = await readyGenerator(t),
    before = await readSession(host),
    plan = await offer(host);
  for (const overrides of [
    { packFingerprint: '0'.repeat(64) },
    { contextFingerprint: '0'.repeat(64) },
  ])
    assert.equal((await generate(host, player, overrides)).status, 409);
  const stale = { ...before, revision: before.revision - 1 };
  assert.equal((await generate(host, player, {}, stale)).status, 409);
  const body = {
    type: 'GENERATE_ADVENTURE_MAP',
    packFingerprint: plan.packFingerprint,
    contextFingerprint: plan.contextFingerprint,
    generation: before.generation,
    expectedRevision: before.revision,
    requestId: randomUUID(),
    agreed: true,
  };
  assert.equal((await host.request('/api/commands', body)).status, 401);
  assert.deepEqual(await readSession(host), before);
});
