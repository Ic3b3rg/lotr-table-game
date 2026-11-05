import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readyCamp,
  reachCamp,
  buyInput,
  training,
  campaignHero,
  scenarioInput,
  readSession,
  readBackup,
  ok,
} from './camp-skills-helper.mjs';
import { randomUUID } from 'node:crypto';
import { command } from './preparation-helper.mjs';

test('HTTP/SQLite camp purchase changes the real campaign inventory and role balance once, preserving reward and episode', async (t) => {
  const r = await readyCamp(t);
  let s = await reachCamp(r);
  const before = (await readBackup(r.host)).payload;
  const input = buyInput(s);
  const receipt = (await (await ok(scenarioInput(r.host, r.player, input))).json()).receipt;
  s = await readSession(r.host);
  assert.deepEqual(training(s).balances, [
    { heroId: 'hero-1', roleId: 'role-1', availableXP: 4 },
    { heroId: 'hero-2', roleId: 'role-2', availableXP: 6 },
  ]);
  assert.ok(campaignHero(s).skillCopies.includes(input.copy));
  assert.deepEqual(receipt.skill, {
    heroId: input.heroId,
    roleId: input.roleId,
    copy: input.copy,
    operation: 'buy',
    cost: 2,
    before: 6,
    after: 4,
  });
  const after = (await readBackup(r.host)).payload;
  assert.deepEqual(after.state.scenario.conclusion.xp, before.state.scenario.conclusion.xp);
  assert.deepEqual(after.state.preparation, before.state.preparation);
  assert.deepEqual(after.state.physical.cycle.seed, before.state.physical.cycle.seed);
  assert.equal(after.state.physical.cycle.records.at(-1).intent.input.kind, 'camp-skill');
  assert.equal((await scenarioInput(r.host, r.player, input)).status, 409);
  assert.deepEqual((await readBackup(r.host)).payload, after);
});

test('exact and zero balances, full-price refunds and repeated operations preserve historical XP and never mint copies', async (t) => {
  const r = await readyCamp(t, { reward: 2 });
  let s = await reachCamp(r);
  const original = structuredClone(s.scenario.conclusion),
    copies = [...campaignHero(s).skillCopies];
  const buy = buyInput(s),
    sell = { ...buy, operation: 'sell' };
  for (let n = 0; n < 4; n++) {
    await ok(scenarioInput(r.host, r.player, buy));
    s = await readSession(r.host);
    assert.equal(training(s).balances[0].availableXP, 0);
    assert.equal(campaignHero(s).skillCopies.filter((c) => c === buy.copy).length, 1);
    const full = (await readBackup(r.host)).payload;
    assert.equal((await scenarioInput(r.host, r.player, buyInput(s, { n: 1 }))).status, 409);
    assert.deepEqual((await readBackup(r.host)).payload, full);
    const response = await (await ok(scenarioInput(r.host, r.player, sell))).json();
    assert.deepEqual(response.receipt.skill, {
      heroId: buy.heroId,
      roleId: buy.roleId,
      copy: buy.copy,
      operation: 'sell',
      cost: 2,
      before: 0,
      after: 2,
    });
    s = await readSession(r.host);
    assert.equal(training(s).balances[0].availableXP, 2);
    assert.deepEqual(campaignHero(s).skillCopies, copies);
    const empty = (await readBackup(r.host)).payload;
    assert.equal((await scenarioInput(r.host, r.player, sell)).status, 409);
    assert.deepEqual((await readBackup(r.host)).payload, empty);
    assert.deepEqual(s.scenario.conclusion.xp, original.xp);
  }
});

test('zero XP permits reading but no purchase; insufficient and unplayed roles reject without changing any state', async (t) => {
  const r = await readyCamp(t, { reward: 0 });
  const s = await reachCamp(r),
    before = (await readBackup(r.host)).payload;
  for (const input of [
    buyInput(s),
    buyInput(s, { roleId: 'role-2' }),
    { ...buyInput(s), operation: 'sell' },
  ]) {
    assert.equal((await scenarioInput(r.host, r.player, input)).status, 409);
    assert.deepEqual((await readBackup(r.host)).payload, before);
  }
});

test('camp ownership, phase, role, non-upgrade copies, source/cursor/revision and anonymous PC fail atomically', async (t) => {
  const r = await readyCamp(t);
  let s = await readSession(r.host);
  let before = (await readBackup(r.host)).payload;
  // A real action phase precedes the camp; no fake conclusion is injected.
  assert.equal(
    (
      await command(
        r.host,
        r.player,
        {
          type: 'SCENARIO_INPUT',
          scenarioId: s.scenario.id,
          packFingerprint: s.scenario.packFingerprint,
          projectionFingerprint: s.scenario.projectionFingerprint,
          pendingId: randomUUID(),
          sourceFingerprint: 'f'.repeat(64),
          heroId: null,
          input: buyInput(s),
        },
        s,
      )
    ).status,
    409,
  );
  assert.deepEqual((await readBackup(r.host)).payload, before);
  s = await reachCamp(r);
  before = (await readBackup(r.host)).payload;
  const input = buyInput(s);
  assert.equal((await scenarioInput(r.host, r.other, input)).status, 403);
  const q = s.scenario.pending;
  const raw = {
    type: 'SCENARIO_INPUT',
    requestId: randomUUID(),
    generation: s.generation,
    expectedRevision: s.revision,
    scenarioId: s.scenario.id,
    packFingerprint: s.scenario.packFingerprint,
    projectionFingerprint: s.scenario.projectionFingerprint,
    pendingId: q.id,
    sourceFingerprint: q.fingerprint,
    heroId: null,
    input,
  };
  assert.equal((await r.host.request('/api/commands', raw)).status, 401);
  for (const override of [
    { pendingId: randomUUID() },
    { sourceFingerprint: 'e'.repeat(64) },
    { packFingerprint: 'd'.repeat(64) },
    { projectionFingerprint: 'b'.repeat(64) },
    { heroId: 'hero-1' },
  ]) {
    assert.equal((await scenarioInput(r.host, r.player, input, override, s)).status, 409);
    assert.deepEqual((await readBackup(r.host)).payload, before);
  }
  assert.equal(
    (
      await r.host.request(
        '/api/commands',
        { ...raw, requestId: randomUUID(), generation: randomUUID() },
        r.player.cookie,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await r.host.request(
        '/api/commands',
        { ...raw, requestId: randomUUID(), expectedRevision: s.revision - 1 },
        r.player.cookie,
      )
    ).status,
    409,
  );
  const nonsale = [...campaignHero(s).skillCopies, 'invented-title:1', 'foreign-copy:1'];
  for (const copy of nonsale) {
    assert.equal(
      (await scenarioInput(r.host, r.player, { ...input, copy, operation: 'sell' })).status,
      409,
    );
    assert.deepEqual((await readBackup(r.host)).payload, before);
  }
});

test('a role change transfers neither balance nor purchased cards and refunds the card role even when another role is selected', async (t) => {
  const r = await readyCamp(t);
  let s = await reachCamp(r);
  const buy = buyInput(s);
  await ok(scenarioInput(r.host, r.player, buy));
  await ok(
    scenarioInput(r.host, r.player, { kind: 'camp-role', heroId: 'hero-1', roleId: 'role-3' }),
  );
  s = await readSession(r.host);
  assert.equal(campaignHero(s).roleId, 'role-3');
  assert.equal(training(s).balances[0].roleId, 'role-1');
  assert.equal(training(s).balances[0].availableXP, 4);
  assert.ok(campaignHero(s).skillCopies.includes(buy.copy));
  const before = (await readBackup(r.host)).payload;
  assert.equal(
    (await scenarioInput(r.host, r.player, buyInput(s, { roleId: 'role-3' }))).status,
    409,
  );
  assert.deepEqual((await readBackup(r.host)).payload, before);
  await ok(scenarioInput(r.host, r.player, { ...buy, operation: 'sell' }));
  s = await readSession(r.host);
  assert.equal(training(s).balances[0].availableXP, 6);
  assert.equal(campaignHero(s).roleId, 'role-3');
  assert.equal(campaignHero(s).skillCopies.includes(buy.copy), false);
});

test('concurrent purchase intents and retries return the actual winning receipt, one debit and one common copy', async (t) => {
  const r = await readyCamp(t);
  let s = await reachCamp(r);
  const ids = [randomUUID(), randomUUID()],
    input = buyInput(s);
  const replies = await Promise.all(
    ids.map((requestId) => scenarioInput(r.host, r.player, input, { requestId }, s)),
  );
  assert.deepEqual(replies.map((r) => r.status).sort(), [200, 409]);
  const winner = replies.findIndex((r) => r.status === 200),
    receipt = await replies[winner].json();
  assert.deepEqual(
    await (await ok(scenarioInput(r.host, r.player, input, { requestId: ids[winner] }, s))).json(),
    receipt,
  );
  s = await readSession(r.host);
  assert.equal(training(s).balances[0].availableXP, 4);
  assert.equal(
    s.scenario.conclusion.campaign.heroes
      .flatMap((h) => h.skillCopies)
      .filter((c) => c === input.copy).length,
    1,
  );
  const before = (await readBackup(r.host)).payload;
  assert.equal(
    (
      await scenarioInput(
        r.host,
        r.player,
        { ...input, operation: 'sell' },
        { requestId: ids[winner] },
      )
    ).status,
    409,
  );
  assert.deepEqual((await readBackup(r.host)).payload, before);
});
