import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  readyThreatTokens,
  reachThreatToken,
  commitThreatToken,
  threatTokenNode,
  threatTokenIntent,
  resolveThreatTest,
  ok,
} from './threat-tokens-http-helper.mjs';
import { readBackup, readSession } from './skill-test-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';
import { command } from './preparation-helper.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';

test('HTTP failure and retry charge distinct actions, consume real fate conversions and return once with immutable origin', async (t) => {
  const r = await readyThreatTokens(t);
  await reachThreatToken(r);
  const before = (await readBackup(r.host)).payload,
    view = await readSession(r.host);
  assert.equal(view.scenario.pending, null);
  assert.deepEqual((await readBackup(r.host)).payload, before);
  await ok(commitThreatToken(r));
  await resolveThreatTest(r, 0);
  let s = await readSession(r.host);
  assert.equal(s.scenario.pending.kind, 'message');
  assert.equal(s.round.heroes[0].actionsUsed, 1);
  await ok(scenarioInput(r.host, r.player, { kind: 'ack' }));
  s = await readSession(r.host);
  assert.equal(threatTokenNode(s).visible, true);
  assert.equal(threatTokenNode(s).settled, true);
  assert.equal(s.scenario.play.active, null);
  await ok(commitThreatToken(r));
  await resolveThreatTest(r, 2);
  s = await readSession(r.host);
  assert.equal(s.scenario.play.tests.at(-1).successes, 2);
  assert.equal(s.round.heroes[0].actionsUsed, 2);
  const resources = (await readBackup(r.host)).payload.state.physical.snapshot.resolution.resources;
  assert.equal(resources.boonCustody.length, 1);
  assert.equal(resources.boonCustody[0].kind, 'determined');
  await ok(scenarioInput(r.host, r.player, { kind: 'ack' }));
  const final = (await readBackup(r.host)).payload;
  assert.equal(threatTokenNode(final.state).stopped, true);
  assert.deepEqual(final.state.journey, before.state.journey);
  assert.deepEqual(final.state.physical.cycle.seed, before.state.physical.cycle.seed);
  assert.equal(final.state.scenario.play.attempts.length, 2);
  assert.ok(final.state.scenario.play.attempts.every((a) => a.returned));
  assert.equal((await commitThreatToken(r)).status, 409);
  assert.deepEqual((await readBackup(r.host)).payload, final);
});

test('HTTP spirit pass and null-product failure execute real rewards and fear without entering excluded states', async (t) => {
  for (const converted of [0, 2]) {
    const r = await readyThreatTokens(t);
    await reachThreatToken(r, 'null-product');
    const before = (await readBackup(r.host)).payload;
    await ok(commitThreatToken(r, 'null-product'));
    await resolveThreatTest(r, converted);
    let s = await readSession(r.host);
    if (converted) await ok(scenarioInput(r.host, r.player, { kind: 'ack' }));
    else {
      for (let n = 0; s.scenario.pending && n < 25; n++) {
        const q = s.physical.active;
        assert.equal(s.scenario.pending.kind, 'physical');
        assert.equal(q.kind, 'decision');
        const option =
          ['resolve', 'close', 'reveal'].find((id) => q.options.some((o) => o.id === id)) ??
          q.options[0].id;
        await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option }));
        s = await readSession(r.host);
      }
    }
    const final = (await readBackup(r.host)).payload;
    assert.equal(threatTokenNode(final.state, 'null-product').stopped, true);
    assert.equal(final.state.scenario.play.tests.at(-1).stat, 'spirit');
    assert.equal(final.state.scenario.play.tests.at(-1).target, 2);
    assert.equal(final.state.physical.snapshot.areas[0].fear.length, converted ? 0 : 1);
    if (converted)
      assert.equal(
        final.state.preparation.heroes[0].inspiration,
        Math.min(3, before.state.preparation.heroes[0].inspiration - converted + 1),
      );
    assert.equal(final.state.scenario.play.active, null);
    assert.deepEqual(final.state.physical.cycle.seed, before.state.physical.cycle.seed);
    assert.deepEqual(final.state.journey, before.state.journey);
    assert.ok(
      final.state.scenario.effects
        .filter((e) => e.instanceId === threatTokenNode(final.state, 'null-product').id)
        .every((e) => ![89, 90, 91].includes(e.state)),
    );
  }
});

test('HTTP real winner receipt survives concurrent retries; foreign owner/hero/space/source/card/cursor and stale inputs preserve whole payload and view', async (t) => {
  const r = await readyThreatTokens(t);
  await ok(cycleCommand(r, 'START_TURN'));
  const remote = await readSession(r.host),
    payload = (await readBackup(r.host)).payload;
  assert.equal((await commitThreatToken(r, 'null-product')).status, 409);
  assert.deepEqual((await readBackup(r.host)).payload, payload);
  assert.deepEqual(await readSession(r.host), remote);
  const s = await reachThreatToken(r),
    intent = threatTokenIntent(s),
    before = (await readBackup(r.host)).payload;
  for (const [actor, change] of [
    [r.other, {}],
    [r.player, { heroId: 'foreign-hero' }],
    [r.player, { sourceFingerprint: 'f'.repeat(64) }],
    [r.player, { instanceId: randomUUID() }],
    [r.player, { turnId: randomUUID() }],
  ]) {
    assert.ok(
      [403, 409].includes((await command(r.host, actor, { ...intent, ...change }, s)).status),
    );
    assert.deepEqual((await readBackup(r.host)).payload, before);
    assert.deepEqual(await readSession(r.host), s);
  }
  const commands = [0, 1].map(() => ({ ...intent, requestId: randomUUID() })),
    responses = await Promise.all(commands.map((c) => command(r.host, r.player, c, s)));
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
  const winner = responses.findIndex((r) => r.status === 200),
    receipt = (await responses[winner].json()).receipt,
    paid = (await readBackup(r.host)).payload,
    view = await readSession(r.host);
  for (let n = 0; n < 2; n++) {
    const retry = await ok(command(r.host, r.player, commands[winner], s));
    assert.deepEqual((await retry.json()).receipt, receipt);
    assert.deepEqual((await readBackup(r.host)).payload, paid);
    assert.deepEqual(await readSession(r.host), view);
  }
  for (const [actor, input, override] of [
    [r.other, { kind: 'physical-choice', option: 'reveal' }, {}],
    [r.player, { kind: 'physical-select', ids: ['foreign-copy:1'] }, {}],
    [r.player, { kind: 'choice', event: 'OWNED' }, {}],
    [r.player, { kind: 'physical-choice', option: 'reveal' }, { pendingId: randomUUID() }],
    [
      r.player,
      { kind: 'physical-choice', option: 'reveal' },
      { sourceFingerprint: 'd'.repeat(64) },
    ],
    [r.player, { kind: 'physical-choice', option: 'reveal' }, { heroId: 'hero-2' }],
  ]) {
    assert.ok([403, 409].includes((await scenarioInput(r.host, actor, input, override)).status));
    assert.deepEqual((await readBackup(r.host)).payload, paid);
    assert.deepEqual(await readSession(r.host), view);
  }
  assert.equal(
    (await command(r.host, r.player, { ...intent, requestId: randomUUID() }, s)).status,
    409,
  );
  assert.deepEqual((await readBackup(r.host)).payload, paid);
  assert.deepEqual(await readSession(r.host), view);
});

test('whole HTTP continuation gates unknown stock and future preparations before any costs, cards or random decisions', async (t) => {
  for (const mode of ['unknown-stock', 'future-preparation']) {
    const r = await readyThreatTokens(t, {
      stockVerified: mode !== 'unknown-stock',
      setupPrepare: false,
      edit(pack) {
        if (mode === 'future-preparation') {
          const p = pack.preparedEffects.find((p) => p.skillId === 'role-1-skill-3');
          Object.assign(p, { effect: 'requires-capability', capability: 'invented-late-consumer' });
          delete p.amount;
        }
      },
    });
    await reachThreatToken(r);
    const before = (await readBackup(r.host)).payload,
      view = await readSession(r.host),
      response = await commitThreatToken(r),
      body = await response.json();
    assert.equal(response.status, 409);
    assert.equal(
      body.error.code,
      mode === 'unknown-stock' ? 'SCENARIO_BOON_CAPABILITY' : 'SCENARIO_PHYSICAL_CAPABILITY',
    );
    assert.deepEqual((await readBackup(r.host)).payload, before);
    assert.deepEqual(await readSession(r.host), view);
  }
});
