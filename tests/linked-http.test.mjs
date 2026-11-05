import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  readyLinked,
  prepareLinked,
  firstVisit,
  getResource,
  nextLinkedRound,
  linkedNode,
  linkedIntent,
  commitLinked,
  finishPhysical,
  ok,
} from './linked-http-helper.mjs';
import { command } from './preparation-helper.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';
import { readSession, readBackup } from './skill-test-helper.mjs';
import { startScenario } from './scenario-helper.mjs';

test('HTTP Store.once plays both reveal orders, keeps one cost and return across phones, and awards the source copy to another recipient', async (t) => {
  for (const beforeExploration of [false, true])
    await t.test(
      beforeExploration ? 'reveal before exploration' : 'reveal after exploration',
      async (t) => {
        const r = await readyLinked(t, { beforeExploration });
        const origin = (await readBackup(r.host)).payload.state.physical.cycle.seed;
        let s = await firstVisit(r);
        assert.equal(linkedNode(s).variables.seen, true);
        assert.equal(linkedNode(s, 1).visible, !beforeExploration);
        if (!beforeExploration) {
          const sameSpace = (await readBackup(r.host)).payload;
          assert.equal((await commitLinked(r, 1, r.player)).status, 409);
          assert.deepEqual((await readBackup(r.host)).payload, sameSpace);
        }
        s = await getResource(r);
        assert.equal(linkedNode(s).variables.supplied, true);
        assert.equal(linkedNode(s, 1).stopped, true);
        assert.equal(linkedNode(s, 1).visible, false);
        assert.equal(s.scenario.play.tests[0].stat, 'wit');
        assert.equal(s.scenario.play.tests[0].successes, 2);
        assert.ok(s.scenario.play.attempts.every((a) => a.returned));
        await nextLinkedRound(r);
        await ok(cycleCommand(r, 'START_TURN'));
        s = await readSession(r.host);
        const before = (await readBackup(r.host)).payload;
        const intent = { ...linkedIntent(s, 0, 'DELIVER'), requestId: randomUUID() };
        assert.equal((await command(r.host, r.other, intent, s)).status, 403);
        assert.deepEqual((await readBackup(r.host)).payload, before);
        const replies = await Promise.all([
          command(r.host, r.player, intent, s),
          command(r.host, r.player, intent, s),
        ]);
        assert.deepEqual(
          replies.map((r) => r.status),
          [200, 200],
        );
        assert.deepEqual(await replies[0].json(), await replies[1].json());
        await finishPhysical(r);
        await ok(scenarioInput(r.host, r.other, { kind: 'ack' }));
        s = await readSession(r.host);
        assert.equal(s.scenario.pending.kind, 'hero-choice');
        const selecting = (await readBackup(r.host)).payload;
        assert.equal(
          (await scenarioInput(r.host, r.other, { kind: 'choose-hero', heroId: 'hero-2' })).status,
          403,
        );
        assert.deepEqual((await readBackup(r.host)).payload, selecting);
        await ok(scenarioInput(r.host, r.player, { kind: 'choose-hero', heroId: 'hero-2' }));
        s = await finishPhysical(r);
        assert.equal(s.physical.lastStand.titles.length, 1);
        assert.equal(s.physical.lastStand.titles[0].heroId, 'hero-2');
        assert.equal(linkedNode(s).visible, false);
        assert.equal(linkedNode(s).stopped, true);
        assert.equal(s.round.heroes[0].actionsUsed, 1);
        const final = (await readBackup(r.host)).payload;
        assert.deepEqual(final.state.physical.cycle.seed, origin);
        assert.equal(
          (await command(r.host, r.player, { ...intent, requestId: randomUUID() }, s)).status,
          409,
        );
        assert.deepEqual((await readBackup(r.host)).payload, final);
      },
    );
});

test('HTTP source-bound cards and paid conversions reject actor, source, copy, cursor and stale inputs without partial effects', async (t) => {
  const r = await readyLinked(t, {
    catalogEdit: (c) => {
      for (const s of c.skills) s.fate = 1;
    },
  });
  await ok(cycleCommand(r, 'START_TURN'));
  let s = await readSession(r.host),
    before = (await readBackup(r.host)).payload;
  const original = linkedIntent(s);
  for (const edit of [
    (c) => (c.sourceFingerprint = 'f'.repeat(64)),
    (c) => (c.turnId = randomUUID()),
    (c) => (c.instanceId = 'foreign-invented'),
    (c) => (c.choiceEvent = 'DELIVER'),
  ]) {
    const c = structuredClone(original);
    edit(c);
    assert.equal((await command(r.host, r.player, c, s)).status, 409);
    assert.deepEqual((await readBackup(r.host)).payload, before);
  }
  await ok(commitLinked(r));
  await finishPhysical(r);
  await ok(scenarioInput(r.host, r.player, { kind: 'choice', event: 'STUDY' }));
  await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'reveal' }));
  s = await readSession(r.host);
  before = (await readBackup(r.host)).payload;
  const q = s.scenario.pending;
  assert.equal(s.physical.sourceTest.cards.length, 2);
  assert.equal(s.physical.sourceTest.successes, 2);
  for (const [input, override, status] of [
    [{ kind: 'choice', event: 'PASS' }, {}, 409],
    [{ kind: 'test-result', successes: 99 }, {}, 422],
    [{ kind: 'physical-choice', option: 'invented-foreign-copy:1' }, {}, 409],
    [{ kind: 'physical-choice', option: 'resolve' }, { sourceFingerprint: 'f'.repeat(64) }, 409],
    [{ kind: 'physical-choice', option: 'resolve' }, { pendingId: randomUUID() }, 409],
    [{ kind: 'physical-choice', option: 'resolve' }, { heroId: 'hero-2' }, 409],
    [{ kind: 'physical-choice', option: 'resolve' }, { cursor: 'f'.repeat(64) }, 422],
  ]) {
    assert.equal(
      (await scenarioInput(r.host, r.player, input, override, s)).status,
      status,
      JSON.stringify({ input, override }),
    );
    assert.deepEqual((await readBackup(r.host)).payload, before);
  }
  assert.equal(
    (
      await scenarioInput(
        r.host,
        r.player,
        { kind: 'physical-choice', option: 'resolve' },
        {},
        { ...s, revision: s.revision - 1 },
      )
    ).status,
    409,
  );
  assert.deepEqual((await readBackup(r.host)).payload, before);
  const inspiration = s.preparation.heroes[0].inspiration;
  const requestId = randomUUID();
  const replies = await Promise.all([
    scenarioInput(
      r.host,
      r.player,
      { kind: 'physical-choice', option: 'inspiration' },
      { requestId },
      s,
    ),
    scenarioInput(
      r.host,
      r.player,
      { kind: 'physical-choice', option: 'inspiration' },
      { requestId },
      s,
    ),
  ]);
  assert.deepEqual(
    replies.map((r) => r.status),
    [200, 200],
  );
  assert.deepEqual(await replies[0].json(), await replies[1].json());
  s = await readSession(r.host);
  assert.equal(s.preparation.heroes[0].inspiration, inspiration - 1);
  assert.equal(s.physical.sourceTest.successes, 3);
  assert.notEqual(s.scenario.pending.id, q.id);
  await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'resolve' }));
  await ok(scenarioInput(r.host, r.other, { kind: 'ack' }));
  await ok(scenarioInput(r.host, r.other, { kind: 'ack' }));
  s = await readSession(r.host);
  assert.equal(s.scenario.play.tests[0].successes, 3);
  assert.equal(s.round.heroes[0].actionsUsed, 1);
  assert.equal(linkedNode(s).variables.seen, true);
});

test('startup preflight checks the title binding before any scenario, cost or random initialization', async (t) => {
  const r = await prepareLinked(t, {
    edit: (p) => (p.manifest.linked.title.cardHash = 'f'.repeat(64)),
  });
  const before = (await readBackup(r.host)).payload;
  const reply = await startScenario(r.host, r.player);
  assert.equal(reply.status, 409);
  assert.equal((await reply.json()).error.code, 'SCENARIO_TITLE_CAPABILITY');
  assert.deepEqual((await readBackup(r.host)).payload, before);
});

test('a terminal damage descendant suspends the linked parent, keeps company resources and reaches the existing failure camp once', async (t) => {
  const r = await readyLinked(t, {
    catalogEdit: (c) => {
      for (const h of c.heroes) h.stats.damage = h.stats.fear = 1;
      for (const card of c.skills) {
        card.success = 0;
        card.fate = 0;
      }
    },
    frontEdit: (ir) => {
      for (const d of ir.definitions)
        d.body = d.cardId.includes('damage')
          ? [
              {
                op: 'suffer',
                hero: 'each-other-hero-any-distance',
                family: 'fear',
                n: 1,
                face: 'normal',
              },
              { op: 'keep-faceup' },
            ]
          : [{ op: 'keep-faceup' }];
    },
  });
  await firstVisit(r);
  await ok(cycleCommand(r, 'END_TURN'));
  await (await import('./linked-http-helper.mjs')).reachLinked(r);
  await ok(commitLinked(r, 1, r.other));
  await finishPhysical(r);
  const before = (await readBackup(r.host)).payload.state;
  await ok(scenarioInput(r.host, r.other, { kind: 'choice', event: 'CLIMB' }));
  let s = await finishPhysical(r);
  assert.ok(s.physical.lastStand.heroes.every((h) => h.defeated));
  assert.equal(s.scenario.conclusion.outcome, 'failure');
  assert.equal(s.scenario.conclusion.timing, 'no-active-heroes');
  assert.ok(s.scenario.conclusion.suspendedRequest);
  assert.equal(s.scenario.play.tests[0].successes, 0);
  assert.equal(s.scenario.play.attempts[1].returned, false);
  assert.equal(
    linkedNode(s).variables.supplied,
    false,
    'the terminal boundary suspends the still-unexecuted resource broadcast',
  );
  assert.equal(s.preparation.heroes.length, 2);
  assert.equal(s.physical.lastStand.titles.length, 0);
  for (let n = 0; n < 4; n++) await ok(scenarioInput(r.host, r.player, { kind: 'ack' }));
  s = await readSession(r.host);
  assert.equal(s.scenario.conclusion.stage, 'camp');
  assert.equal(s.scenario.conclusion.campEntryCount, 1);
  assert.equal(s.scenario.conclusion.xp.length, 2);
  for (const h of s.preparation.heroes) {
    const old = before.preparation.heroes.find((x) => x.heroId === h.heroId);
    assert.deepEqual(h.itemCopies, old.itemCopies);
    assert.deepEqual(
      [...h.composition].sort(),
      [...old.deck, ...old.prepared, ...old.discard].sort(),
    );
  }
  assert.equal(s.scenario.pack.manifest.rounds.threat.perHero, 3);
});
