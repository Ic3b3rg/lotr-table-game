import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  readySearches,
  reachSearch,
  commitSearch,
  searchNode,
  searchIntent,
  resolveCount,
  ok,
} from './search-http-helper.mjs';
import { readBackup, readSession } from './skill-test-helper.mjs';
import { command } from './preparation-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';

test('HTTP choice pays once, retains both options and keeps the entire origin and residual travel', async (t) => {
  for (const event of ['RESTORE', 'STUDY']) {
    const r = await readySearches(t);
    await reachSearch(r);
    const before = (await readBackup(r.host)).payload,
      view = await readSession(r.host);
    // The initial inspection is a GET/read; no pending or source event is entered.
    assert.deepEqual((await readBackup(r.host)).payload, before);
    assert.equal(view.scenario.pending, null);
    await ok(commitSearch(r));
    let s = await readSession(r.host);
    assert.deepEqual(
      s.scenario.pending.options.map((o) => o.event),
      ['RESTORE', 'STUDY'],
    );
    assert.equal(s.round.heroes[0].actionsUsed, 2);
    await ok(scenarioInput(r.host, r.player, { kind: 'choice', event }));
    s = await readSession(r.host);
    if (event === 'STUDY') {
      const q = s.physical.active;
      await ok(
        scenarioInput(r.host, r.player, {
          kind: 'physical-scout',
          prepare: q.options[0].id,
          top: [],
          bottom: [q.options[1].id],
          discard: null,
        }),
      );
    }
    await ok(scenarioInput(r.host, r.player, { kind: 'ack' }));
    const after = (await readBackup(r.host)).payload;
    assert.equal(searchNode(after.state).stopped, true);
    assert.equal(searchNode(after.state).visible, false);
    assert.equal(after.state.round.heroes[0].actionsUsed, 2);
    assert.deepEqual(after.state.journey, before.state.journey);
    assert.deepEqual(after.state.physical.cycle.seed, before.state.physical.cycle.seed);
    assert.equal(after.state.scenario.play.attempts.at(-1).returned, true);
    assert.equal((await commitSearch(r)).status, 409);
    assert.deepEqual((await readBackup(r.host)).payload, after);
  }
});

test('HTTP count outcomes use paid conversion, preserve the local binding, and reject preparation during a look', async (t) => {
  for (const converted of [0, 1, 2]) {
    const r = await readySearches(t);
    await reachSearch(r, 'challenge');
    const travel = (await readSession(r.host)).journey.travel;
    await ok(commitSearch(r, 'challenge'));
    let s = await resolveCount(r, converted),
      actor = s.preparation.heroes[0];
    assert.equal(s.scenario.play.tests[0].successes, converted);
    assert.equal(
      searchNode((await readBackup(r.host)).payload.state, 'challenge').variables.tally,
      converted,
    );
    if (converted === 1) {
      const q = s.physical.active,
        payload = (await readBackup(r.host)).payload;
      assert.equal(q.scoutPrepareAllowed, false);
      for (const input of [
        {
          kind: 'physical-scout',
          prepare: q.options[0].id,
          top: [],
          bottom: [q.options[1].id],
          discard: null,
        },
        {
          kind: 'physical-scout',
          prepare: null,
          top: ['foreign-copy:1'],
          bottom: [],
          discard: null,
        },
        {
          kind: 'physical-scout',
          prepare: null,
          top: [q.options[0].id, q.options[0].id],
          bottom: [],
          discard: null,
        },
      ]) {
        assert.equal((await scenarioInput(r.host, r.player, input)).status, 409);
        assert.deepEqual((await readBackup(r.host)).payload, payload);
        assert.deepEqual(await readSession(r.host), s);
      }
      await ok(
        scenarioInput(r.host, r.player, {
          kind: 'physical-scout',
          prepare: null,
          discard: null,
          top: [q.options[1].id],
          bottom: [q.options[0].id],
        }),
      );
    } else if (converted === 2) {
      assert.deepEqual(
        s.physical.active.options.map((o) => o.id),
        ['scout', 'prepare-discard'],
      );
      await ok(
        scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'prepare-discard' }),
      );
      s = await readSession(r.host);
      const copy = s.physical.active.options[0].id;
      await ok(scenarioInput(r.host, r.player, { kind: 'physical-select', ids: [copy] }));
      assert.ok((await readSession(r.host)).preparation.heroes[0].prepared.includes(copy));
    }
    await ok(scenarioInput(r.host, r.player, { kind: 'ack' }));
    s = await readSession(r.host);
    assert.equal(s.scenario.play.active, null);
    assert.equal(searchNode(s, 'challenge').stopped, true);
    assert.equal(s.round.heroes[0].actionsUsed, 2);
    assert.deepEqual(s.journey.travel, travel);
    assert.equal(
      s.preparation.heroes[0].inspiration,
      actor.inspiration + (converted === 2 ? 1 : 0),
    );
  }
});

test('HTTP concurrent commands and stale/foreign owner, hero, source and cursor preserve whole payload/view', async (t) => {
  const r = await readySearches(t);
  await ok(cycleCommand(r, 'START_TURN'));
  const remote = await readSession(r.host),
    remotePayload = (await readBackup(r.host)).payload;
  assert.notEqual(
    remote.journey.heroes.find((h) => h.heroId === remote.round.activeHeroId).spaceId,
    remote.scenario.spaceBindings.find((b) => b.sourceId === searchNode(remote).spaceId).id,
  );
  assert.equal((await commitSearch(r)).status, 409);
  assert.deepEqual((await readBackup(r.host)).payload, remotePayload);
  assert.deepEqual(await readSession(r.host), remote);
  await reachSearch(r);
  const s = await readSession(r.host),
    intent = searchIntent(s),
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
  }
  for (const [actor, input, override] of [
    [r.other, { kind: 'choice', event: 'STUDY' }, {}],
    [r.player, { kind: 'choice', event: 'CANCEL' }, {}],
    [r.player, { kind: 'choice', event: 'STUDY' }, { pendingId: randomUUID() }],
    [r.player, { kind: 'choice', event: 'STUDY' }, { sourceFingerprint: 'd'.repeat(64) }],
  ]) {
    assert.ok([403, 409].includes((await scenarioInput(r.host, actor, input, override)).status));
    assert.deepEqual((await readBackup(r.host)).payload, paid);
    assert.deepEqual(await readSession(r.host), view);
  }
});
