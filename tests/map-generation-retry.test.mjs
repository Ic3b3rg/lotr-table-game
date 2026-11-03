import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readyGenerator, offer, generate, waitGeneration } from './map-generation-helper.mjs';
import { readSession, readBackup } from './skill-test-helper.mjs';
import { command } from './preparation-helper.mjs';
import { addEncounter, synchronize } from './fixtures/map-encounters.mjs';
import { hash } from './fixtures/map-freeze.mjs';
function holder(raw) {
  return { assembly: { selection: raw.template.selection }, placement: raw.template.placement };
}
test('retry fonte salva seed richiesto e riuscito distinti, pool trattenuti e storia in una sola realizzazione', async (t) => {
  const { host, player } = await readyGenerator(t, (raw) => {
    const h = holder(raw);
    raw.template.placement.sections[0].tileEncounters[0].specifySpaceIndex = false;
    const source = addEncounter(
      h,
      {},
      {
        specificTileModelSource: raw.template.selection.standard[0].modelSource,
        specificSpaceIndex: 0,
      },
    );
    raw.template.placement.sections[0].sectionEncounterSources.push(source);
    addEncounter(h, { type: 0 });
    synchronize(h);
  });
  assert.equal((await generate(host, player, { requestedSeed: 3 })).status, 200);
  const state = await waitGeneration(host),
    p = state.mapGeneration.projection;
  assert.equal(p.requestedSeed, 3);
  assert.equal(p.successfulSeed, 4);
  assert.equal(p.attempts.length, 1);
  assert.equal(p.attempts[0].sourceErrorCode, 2);
  assert.equal(p.attempts[0].reason, 'section-requirement');
  assert.equal(p.retryState.incoming.randomEncounterPool.length, 1);
  assert.equal(p.attempts[0].retainedFingerprint, hash(p.retryState.incoming));
  assert.deepEqual(p.history.usedEncounterIds, [100000, 100001]);
  assert.deepEqual(p.history.usedGroupIds, [90000]);
});
test('limite di batch lascia un confine pulito riprendibile con overflow int32 e pool crescenti', async (t) => {
  const { host, player } = await readyGenerator(t, (raw) => {
    const h = holder(raw),
      s = raw.template.placement.sections[0];
    s.tileEncounters.push(structuredClone(s.tileEncounters[0]));
    addEncounter(h, { type: 0 });
    synchronize(h);
  });
  assert.equal((await generate(host, player, { requestedSeed: 2147483647 })).status, 200);
  const paused = await waitGeneration(host, 'paused'),
    g = paused.mapGeneration;
  assert.equal(g.reason, 'attempt-batch-limit');
  assert.equal(g.job.attempt, 8);
  assert.equal(g.job.seed, -2147483641);
  assert.equal(g.job.incoming.randomEncounterPool.length, 8);
  assert.equal(g.job.attempts[7].retainedFingerprint, hash(g.job.incoming));
  assert.equal(paused.journey, null);
  assert.equal(paused.round, null);
  const plan = await offer(host);
  assert.equal(
    (
      await command(host, player, {
        type: 'RESUME_ADVENTURE_MAP',
        jobId: g.job.id,
        packFingerprint: plan.packFingerprint,
        contextFingerprint: plan.contextFingerprint,
        agreed: true,
      })
    ).status,
    200,
  );
  const resumed = await waitGeneration(host, 'paused');
  assert.equal(resumed.mapGeneration.job.attempt, 16);
  assert.equal(resumed.mapGeneration.job.incoming.randomEncounterPool.length, 16);
  for (const r of (await readBackup(host)).payload.commands.filter(
    (c) => c.receipt.jobId === g.job.id,
  ))
    assert.equal(r.receipt.status, 'paused');
});
test('concorrenza e requestId riusato per altro seed non avviano una seconda pipeline', async (t) => {
  const { host, player, other } = await readyGenerator(t),
    at = await readSession(host),
    plan = await offer(host),
    requestId = randomUUID();
  const responses = await Promise.all([
    generate(host, player, { requestId }, at),
    generate(host, other, {}, at),
    generate(host, player, { requestId }, at),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 200, 409]);
  const after = await waitGeneration(host);
  assert.equal(after.mapGeneration.requests.length, 1);
  const changed = await command(
    host,
    player,
    {
      type: 'GENERATE_ADVENTURE_MAP',
      packFingerprint: plan.packFingerprint,
      contextFingerprint: plan.contextFingerprint,
      requestedSeed: 2,
      agreed: true,
      requestId,
    },
    at,
  );
  assert.equal(changed.status, 409);
  assert.equal((await changed.json()).error.code, 'INTENT_CHANGED');
  assert.deepEqual(await readSession(host), after);
});
