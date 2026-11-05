import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { readyBase, reachBase, commitBase, baseNode, ok } from './base-products-http-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';
import { readSession, readBackup, signBackup } from './skill-test-helper.mjs';
import { startHost } from './host-helper.mjs';
import { recoverSeat } from './last-stand-helper.mjs';
import { runtime } from './threat-helper.mjs';

function admin(actual, expected) {
  const copy = structuredClone(actual);
  for (const k of ['generation', 'revision', 'updatedAt']) copy[k] = expected[k];
  return copy;
}
async function restoreCut(t, r) {
  const backup = await readBackup(r.host),
    view = await readSession(r.host),
    origin = structuredClone(backup.payload.state.physical.cycle.seed);
  await r.host.stop('SIGKILL');
  const next = await startHost();
  t.after(() => next.dispose());
  for (const f of ['scenario-pack', 'physical-content', 'physical-fronts', 'physical-last-stand'])
    await assert.rejects(access(join(next.dataDir, f + '.json')));
  const empty = await readSession(next);
  assert.equal(empty.scenario, null);
  await ok(
    next.request('/api/restores', {
      backup,
      generation: empty.generation,
      expectedRevision: empty.revision,
      confirmed: true,
    }),
  );
  const after = (await readBackup(next)).payload;
  assert.deepEqual({ ...after, state: admin(after.state, backup.payload.state) }, backup.payload);
  assert.deepEqual(admin(await readSession(next), view), view);
  assert.deepEqual(after.state.physical.cycle.seed, origin);
  await recoverSeat(next, r.player);
  await recoverSeat(next, r.other);
  r.host = next;
  return backup;
}

test('five accepted SIGKILL boundaries preserve whole payloads, views and receipts packless through cost, cards, conversion, reward and the product guard', async (t) => {
  const r = await readyBase(t);
  await reachBase(r);
  const origin = (await readBackup(r.host)).payload.state.physical.cycle.seed;
  let cuts = 0;
  await ok(commitBase(r));
  await restoreCut(t, r);
  cuts++;
  await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'reveal' }));
  await restoreCut(t, r);
  cuts++;
  await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'inspiration' }));
  await restoreCut(t, r);
  cuts++;
  await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'resolve' }));
  const reward = await restoreCut(t, r);
  cuts++;
  assert.equal(reward.payload.state.scenario.pending.kind, 'message');
  await ok(scenarioInput(r.host, r.other, { kind: 'ack' }));
  const final = await restoreCut(t, r);
  cuts++;
  assert.equal(cuts, 5);
  assert.deepEqual(final.payload.state.physical.cycle.seed, origin);
  assert.equal(final.payload.state.scenario.globals.inventedChain, 7);
  assert.equal(final.payload.state.physical.snapshot.lastStand.titles.length, 0);
  assert.equal(baseNode(final.payload.state).stopped, true);
  const edits = [
    (b) => b.payload.state.scenario.play.tests[0].successes++,
    (b) => (b.payload.state.scenario.play.attempts[0].cost = 0),
    (b) => (b.payload.state.scenario.play.attempts[0].returned = false),
    (b) => b.payload.state.scenario.globals.inventedChain++,
    (b) => b.payload.state.scenario.pack.manifest.baseProducts.ownedProductIds.push(5),
    (b) =>
      b.payload.state.physical.cycle.seed.scenario.pack.manifest.baseProducts.ownedProductIds.push(
        987,
      ),
    (b) =>
      (b.payload.state.physical.cycle.seed.scenario.pack.manifest.baseProducts.models[1].id = 0),
    (b) =>
      (b.payload.state.physical.cycle.records.find(
        (r) => r.intent.input?.option === 'inspiration',
      ).playerId = r.other.body.player.id),
    (b) =>
      (b.payload.state.physical.cycle.records.find(
        (r) => r.intent.input?.option === 'inspiration',
      ).intent.sourceFingerprint = 'd'.repeat(64)),
    (b) => b.payload.state.preparation.heroes[0].inspiration++,
    (b) => (b.payload.commands.at(-1).receipt.source = 'e'.repeat(64)),
    (b) => (b.payload.state.schemaVersion = 21),
  ];
  for (const edit of edits) {
    const bad = structuredClone(final);
    edit(bad);
    signBackup(bad);
    assert.equal(runtime.BackupSchema.safeParse(bad).success, false);
  }
  const bad = structuredClone(final);
  edits[3](bad);
  signBackup(bad);
  const at = await readSession(r.host),
    before = (await readBackup(r.host)).payload;
  assert.equal(
    (
      await r.host.request('/api/restores', {
        backup: bad,
        generation: at.generation,
        expectedRevision: at.revision,
        confirmed: true,
      })
    ).status,
    422,
  );
  assert.deepEqual((await readBackup(r.host)).payload, before);
});

test('accepted sprint, exploration callbacks and cleanup survive five more packless SIGKILL restores without another movement or cost', async (t) => {
  const r = await readyBase(t, { unexploredNeighbor: true });
  await reachBase(r);
  await ok(commitBase(r));
  await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'reveal' }));
  await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'resolve' }));
  const pending = await restoreCut(t, r);
  let cuts = 1;
  const state = pending.payload.state,
    q = state.scenario.pending;
  const destination = q.options.find(
    (o) =>
      o.event.startsWith('move:') &&
      state.scenario.tiles.some(
        (t) =>
          !t.explored &&
          state.mapGeneration.projection.spaces.some(
            (c) =>
              c.tileSource === t.source &&
              state.scenario.spaceBindings.some(
                (b) => b.sourceId === c.id && o.event === `move:${b.id}`,
              ),
          ),
      ),
  );
  assert.ok(destination);
  await ok(
    scenarioInput(r.host, r.player, {
      kind: 'source-sprint',
      destinationSpaceId: destination.event.slice(5),
    }),
  );
  await restoreCut(t, r);
  cuts++;
  for (let n = 0; n < 25; n++) {
    const s = await readSession(r.host),
      q = s.scenario.pending;
    if (!q) break;
    const actor = q.actorPlayerId === r.other.body.player.id ? r.other : r.player;
    await ok(scenarioInput(r.host, actor, { kind: 'ack' }));
    if (cuts < 4) {
      await restoreCut(t, r);
      cuts++;
    }
  }
  const final = await restoreCut(t, r);
  cuts++;
  assert.equal(cuts, 5);
  assert.equal(final.payload.state.scenario.pending, null);
  assert.equal(final.payload.state.scenario.explorations.attempts[0].returned, true);
  assert.equal(final.payload.state.journey.travel.remaining, 1);
  assert.equal(final.payload.state.round.heroes[0].actionsUsed, 2);
  assert.equal(final.payload.state.scenario.globals.inventedChain, 7);
  for (const [original, edit] of [
    [pending, (b) => (b.payload.state.scenario.tasks[0].fromSpaceId = 'foreign-space')],
    [pending, (b) => (b.payload.state.scenario.pending.actorPlayerId = r.other.body.player.id)],
    [
      final,
      (b) =>
        (b.payload.state.scenario.explorations.attempts[0].sprintOrigin.attemptId =
          '00000000-0000-4000-8000-000000000001'),
    ],
    [final, (b) => b.payload.state.journey.travel.remaining--],
    [
      final,
      (b) =>
        (b.payload.state.physical.cycle.records.find(
          (r) => r.intent.input?.kind === 'source-sprint',
        ).intent.input.destinationSpaceId = null),
    ],
  ]) {
    const bad = structuredClone(original);
    edit(bad);
    signBackup(bad);
    assert.equal(runtime.BackupSchema.safeParse(bad).success, false);
  }
});
