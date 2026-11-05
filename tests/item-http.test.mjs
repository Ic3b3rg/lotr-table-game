import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  readyItem,
  prepareItem,
  reachItem,
  commitItem,
  itemIntent,
  itemNode,
  ok,
} from './item-http-helper.mjs';
import { readBackup, readSession } from './skill-test-helper.mjs';
import { command } from './preparation-helper.mjs';
import { scenarioInput, startScenario } from './scenario-helper.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';
test('HTTP/SQLite commits source cost, cards, unique custody and callback with stable retries and full rejection invariants', async (t) => {
  const r = await readyItem(t);
  await ok(cycleCommand(r, 'START_TURN'));
  const remote = (await readBackup(r.host)).payload;
  assert.equal((await commitItem(r)).status, 409);
  assert.deepEqual((await readBackup(r.host)).payload, remote);
  await reachItem(r);
  const s = await readSession(r.host),
    intent = { ...itemIntent(s), requestId: randomUUID() },
    before = (await readBackup(r.host)).payload;
  assert.equal((await command(r.host, r.other, intent, s)).status, 403);
  assert.deepEqual((await readBackup(r.host)).payload, before);
  const responses = await Promise.all([
    command(r.host, r.player, intent, s),
    command(r.host, r.player, intent, s),
  ]);
  assert.deepEqual(
    responses.map((r) => r.status),
    [200, 200],
  );
  const receipt = await responses[0].json();
  assert.deepEqual(await responses[1].json(), receipt);
  for (const [actor, input, override] of [
    [r.other, { kind: 'physical-choice', option: 'reveal' }, {}],
    [r.player, { kind: 'choice', event: 'YES' }, {}],
    [r.player, { kind: 'physical-choice', option: 'reveal' }, { heroId: 'hero-2' }],
    [r.player, { kind: 'physical-select', ids: ['foreign-copy:1'] }, {}],
    [
      r.player,
      { kind: 'physical-choice', option: 'reveal' },
      { sourceFingerprint: 'f'.repeat(64) },
    ],
    [r.player, { kind: 'physical-choice', option: 'reveal' }, { pendingId: randomUUID() }],
  ]) {
    const old = (await readBackup(r.host)).payload;
    assert.ok([403, 409].includes((await scenarioInput(r.host, actor, input, override)).status));
    assert.deepEqual((await readBackup(r.host)).payload, old);
  }
  for (const option of ['reveal', 'inspiration', 'resolve'])
    await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option }));
  assert.equal((await readSession(r.host)).scenario.play.tests[0].successes, 3);
  await ok(scenarioInput(r.host, r.player, { kind: 'ack' }));
  let v = await readSession(r.host);
  assert.equal(v.scenario.pending.kind, 'physical');
  const awarding = (await readBackup(r.host)).payload;
  assert.equal(awarding.state.physical.snapshot.resolution.resources.itemCustody.length, 1);
  assert.equal(
    (await scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'foreign-hero' }))
      .status,
    409,
  );
  assert.deepEqual((await readBackup(r.host)).payload, awarding);
  const hero = v.preparation.heroes[0].heroId;
  await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: hero }));
  v = await readSession(r.host);
  assert.equal(v.physical.inventory[0].copy, 'trinket:1');
  assert.equal(v.physical.inventory[0].remaining, 2);
  assert.equal(v.scenario.play.active, null);
  assert.equal(itemNode(v).visible, false);
  assert.equal(v.journey.travel.remaining, 1);
  assert.equal(v.round.heroes[0].actionsUsed, 2);
  const payload = (await readBackup(r.host)).payload;
  assert.equal(payload.state.physical.snapshot.resolution.resources.itemCustody[0].heroId, hero);
  assert.equal(payload.state.physical.snapshot.resolution.resources.depletion[0].remaining, 2);
  const retry = await (await command(r.host, r.player, intent, s)).json();
  assert.deepEqual(retry, { receipt: receipt.receipt, session: v });
  assert.deepEqual((await readBackup(r.host)).payload, payload);
});
test('startup rejects a mismatching printed card before freezing any new scenario or consuming randomness', async (t) => {
  const r = await prepareItem(t, {
      edit: (pack) => (pack.manifest.items.grant.cardHash = 'e'.repeat(64)),
    }),
    before = (await readBackup(r.host)).payload;
  assert.equal((await startScenario(r.host, r.player)).status, 409);
  assert.deepEqual((await readBackup(r.host)).payload, before);
});
