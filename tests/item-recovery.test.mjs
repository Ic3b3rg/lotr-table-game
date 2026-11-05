import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { readyItem, reachItem, commitItem, itemNode, ok } from './item-http-helper.mjs';
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

test('six accepted SIGKILL boundaries preserve whole payloads, views and receipts packless through cost, cards, conversion, acquisition and its callback', async (t) => {
  const r = await readyItem(t);
  await reachItem(r);
  const origin = (await readBackup(r.host)).payload.state.physical.cycle.seed;
  let cuts = 0;
  await ok(commitItem(r));
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
  const acquired = await restoreCut(t, r);
  cuts++;
  assert.equal(acquired.payload.state.physical.snapshot.resolution.resources.itemCustody.length, 1);
  const hero = acquired.payload.state.preparation.heroes[0].heroId;
  await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: hero }));
  const final = await restoreCut(t, r);
  cuts++;
  assert.equal(cuts, 6);
  assert.deepEqual(final.payload.state.physical.cycle.seed, origin);
  assert.equal(
    final.payload.state.physical.snapshot.resolution.resources.itemCustody[0].heroId,
    hero,
  );
  assert.equal(
    final.payload.state.physical.snapshot.resolution.resources.depletion[0].remaining,
    2,
  );
  assert.equal(final.payload.state.physical.snapshot.lastStand.titles.length, 0);
  assert.equal(itemNode(final.payload.state).stopped, true);
  const edits = [
    (b) => b.payload.state.scenario.play.tests[0].successes++,
    (b) => (b.payload.state.scenario.play.attempts[0].cost = 0),
    (b) => (b.payload.state.scenario.play.attempts[0].returned = false),
    (b) => b.payload.state.physical.snapshot.resolution.resources.depletion[0].remaining--,
    (b) =>
      (b.payload.state.physical.snapshot.resolution.resources.itemCustody[0].heroId =
        r.other.body.player.id),
    (b) =>
      (b.payload.state.physical.snapshot.resolution.resources.itemCustody[0].copy =
        'foreign-copy:1'),
    (b) =>
      (b.payload.state.physical.snapshot.resolution.resources.itemCustody[0].source =
        'foreign-source'),
    (b) => (b.payload.state.physical.runs.at(-1).answers[0].cursor = 'd'.repeat(64)),
    (b) => b.payload.state.scenario.pack.manifest.items.ownedProductIds.push(5),
    (b) =>
      b.payload.state.physical.cycle.seed.scenario.pack.manifest.items.ownedProductIds.push(987),
    (b) => (b.payload.state.physical.cycle.seed.scenario.pack.manifest.items.grant.quantity = 2),
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
    (b) => (b.payload.state.schemaVersion = 22),
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
