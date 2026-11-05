import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  readyLair,
  reachLair,
  lair,
  lairIntent,
  commitLair,
  finishPhysical,
  ok,
} from './lair-victory-http-helper.mjs';
import { readBackup, readSession } from './skill-test-helper.mjs';
import { command } from './preparation-helper.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';
import { state } from './fixtures/scenario.mjs';
import { message } from './fixtures/clue-progression.mjs';

test('HTTP Store.once: two phones share failed/retried cards and costs, one victory, rewards, return and camp; wrong actor, stale and concurrent retry are immutable', async (t) => {
  const r = await readyLair(t);
  let s = await reachLair(r),
    origin = (await readBackup(r.host)).payload.state.physical.cycle.seed;
  const before = (await readBackup(r.host)).payload;
  const intent = lairIntent(s, randomUUID());
  assert.equal((await command(r.host, r.other, intent, s)).status, 403);
  assert.deepEqual((await readBackup(r.host)).payload, before);
  for (const field of ['sourceFingerprint', 'instanceId', 'heroId']) {
    const bad = {
      ...intent,
      [field]: field === 'sourceFingerprint' ? 'f'.repeat(64) : 'invented-foreign',
    };
    assert.ok([403, 409].includes((await command(r.host, r.player, bad, s)).status));
    assert.deepEqual((await readBackup(r.host)).payload, before);
  }
  const replies = await Promise.all([
    command(r.host, r.player, intent, s),
    command(r.host, r.player, intent, s),
  ]);
  assert.deepEqual(
    replies.map((x) => x.status),
    [200, 200],
  );
  assert.deepEqual(await replies[0].json(), await replies[1].json());
  s = await readSession(r.host);
  assert.equal(s.round.heroes[0].actionsUsed, 2);
  const during = (await readBackup(r.host)).payload;
  assert.equal(
    (await scenarioInput(r.host, r.other, { kind: 'physical-choice', option: 'reveal' })).status,
    403,
  );
  assert.deepEqual((await readBackup(r.host)).payload, during);
  s = await finishPhysical(r);
  assert.equal(s.scenario.play.tests[0].total, 3);
  assert.equal(lair(s).state, 103);
  await ok(scenarioInput(r.host, r.other, { kind: 'ack' }));
  s = await readSession(r.host);
  assert.equal(lair(s).state, 107);
  assert.equal(s.scenario.play.attempts[0].returned, true);
  const afterFail = (await readBackup(r.host)).payload;
  assert.equal(
    (await command(r.host, r.player, { ...intent, requestId: randomUUID() }, s)).status,
    409,
  );
  assert.deepEqual((await readBackup(r.host)).payload, afterFail);
  await ok(cycleCommand(r, 'END_TURN'));
  await reachLair(r, r.other);
  await ok(commitLair(r, r.other));
  s = await finishPhysical(r);
  assert.equal(s.scenario.play.tests[1].total, 6);
  assert.equal(lair(s).state, 104);
  const testCards = structuredClone(s.preparation);
  await ok(scenarioInput(r.host, r.player, { kind: 'ack' }));
  s = await readSession(r.host);
  assert.equal(s.scenario.conclusion.outcome, 'victory');
  assert.equal(s.scenario.conclusion.stage, 'campaign-map');
  assert.equal(s.scenario.conclusion.xp.length, 2);
  assert.ok(s.scenario.conclusion.xp.every((x) => x.amount === 6));
  assert.equal(s.scenario.play.active, null);
  assert.ok(s.scenario.play.attempts.every((a) => a.returned));
  assert.equal(s.scenario.conclusion.cause.playerId, r.other.body.player.id);
  assert.deepEqual(s.preparation, testCards);
  assert.equal(s.scenario.play.lore, 3);
  await ok(scenarioInput(r.host, r.other, { kind: 'ack' }));
  await ok(scenarioInput(r.host, r.player, { kind: 'ack' }));
  s = await readSession(r.host);
  assert.equal(s.scenario.conclusion.stage, 'camp');
  assert.equal(s.scenario.conclusion.transitionCount, 1);
  assert.equal(s.scenario.conclusion.campEntryCount, 1);
  assert.deepEqual((await readBackup(r.host)).payload.state.physical.cycle.seed, origin);
  const camp = (await readBackup(r.host)).payload;
  assert.equal((await cycleCommand(r, 'START_TURN')).status, 409);
  assert.deepEqual((await readBackup(r.host)).payload, camp);
});

test('P1/P2 descendants defeat the first actor after a paid failed lair trial; the survivor retries its retained total and all heroes receive XP', async (t) => {
  const r = await readyLair(t, {
    edit: (p) => {
      const d = p.definitions.find(
        (d) =>
          d.source ===
          p.manifest.prefabs.find((x) => x.source === p.manifest.lair.prefab).fsmSource,
      );
      d.states.find((s) => s.index === 103).actions[0].consequence = {
        family: 'fear',
        amount: 1,
        face: 'faceup',
      };
    },
    catalogEdit: (c) => {
      c.heroes[0].stats.fear = 1;
    },
    frontEdit: (ir) => {
      for (const d of ir.definitions) d.body = [{ op: 'keep-faceup' }];
    },
  });
  await reachLair(r);
  await ok(commitLair(r));
  let s = await finishPhysical(r);
  assert.equal(s.physical.lastStand.heroes[0].defeated, true);
  assert.equal(s.round.activeHeroId, null);
  assert.equal(lair(s).state, 107);
  assert.equal(s.scenario.play.tests[0].total, 3);
  assert.equal(s.scenario.conclusion, undefined, 'one survivor retains the source loss window');
  assert.equal(s.scenario.globals.companyCount, 2);
  assert.equal(lair(s).variables.difficulty, 4);
  const retained = structuredClone(s.preparation.heroes[0]);
  await reachLair(r, r.other);
  await ok(commitLair(r, r.other));
  s = await finishPhysical(r);
  assert.equal(s.scenario.play.tests[1].total, 6);
  await ok(scenarioInput(r.host, r.player, { kind: 'ack' }));
  s = await readSession(r.host);
  assert.equal(s.scenario.conclusion.outcome, 'victory');
  assert.deepEqual(s.preparation.heroes[0], retained);
  assert.equal(s.scenario.conclusion.xp.length, 2);
  assert.ok(s.physical.parents.every((p) => p.returnCount === 1));
  assert.equal(s.scenario.globals.companyCount, 2);
});

test('lair card conversions pay inspiration exactly once and persist real revealed copies before the source callback', async (t) => {
  const r = await readyLair(t, {
    catalogEdit: (c) => {
      for (const card of c.skills) {
        card.success = 0;
        card.fate = 1;
      }
    },
    edit: (p) => {
      const d = p.definitions.find(
        (d) =>
          d.source ===
          p.manifest.prefabs.find((x) => x.source === p.manifest.lair.prefab).fsmSource,
      );
      const trial = d.states.find((s) => s.index === 102);
      trial.index = 110;
      d.states.push(
        state(
          102,
          [message(0, 'Preparazione inventata: ottieni una ispirazione.', { inspiration: 1 })],
          { FINISHED: 110 },
        ),
      );
    },
  });
  await reachLair(r);
  await ok(commitLair(r));
  let s = await readSession(r.host);
  assert.equal(s.scenario.pending.kind, 'message');
  await ok(scenarioInput(r.host, r.other, { kind: 'ack' }));
  s = await readSession(r.host);
  assert.ok(s.physical.active.options.some((o) => o.id === 'reveal'));
  await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'reveal' }));
  s = await readSession(r.host);
  const cards = structuredClone(s.physical.sourceTest.cards),
    before = s.preparation.heroes[0].inspiration;
  const immutable = (await readBackup(r.host)).payload;
  for (const override of [
    { pendingId: randomUUID() },
    { sourceFingerprint: 'e'.repeat(64) },
    { heroId: 'hero-2' },
    { input: { kind: 'physical-choice', option: 'foreign-copy:999' } },
  ]) {
    assert.equal(
      (
        await scenarioInput(
          r.host,
          r.player,
          { kind: 'physical-choice', option: 'resolve' },
          override,
          s,
        )
      ).status,
      409,
    );
    assert.deepEqual((await readBackup(r.host)).payload, immutable);
  }
  assert.equal(
    (
      await scenarioInput(
        r.host,
        r.player,
        { kind: 'physical-choice', option: 'resolve' },
        { cursor: 99 },
        s,
      )
    ).status,
    422,
  );
  assert.deepEqual((await readBackup(r.host)).payload, immutable);
  assert.ok(cards.length > 0);
  assert.ok(s.physical.active.options.some((o) => o.id === 'inspiration'));
  const q = s.scenario.pending,
    id = randomUUID(),
    input = { kind: 'physical-choice', option: 'inspiration' };
  const intent = {
    type: 'SCENARIO_INPUT',
    requestId: id,
    scenarioId: s.scenario.id,
    packFingerprint: s.scenario.packFingerprint,
    projectionFingerprint: s.scenario.projectionFingerprint,
    pendingId: q.id,
    sourceFingerprint: q.fingerprint,
    heroId: q.heroId,
    input,
  };
  const replies = await Promise.all([
    command(r.host, r.player, intent, s),
    command(r.host, r.player, intent, s),
  ]);
  assert.deepEqual(
    replies.map((r) => r.status),
    [200, 200],
  );
  s = await readSession(r.host);
  assert.equal(s.physical.sourceTest.successes, 1);
  assert.equal(s.preparation.heroes[0].inspiration, before - 1);
  assert.deepEqual(s.physical.sourceTest.cards, cards);
  await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'resolve' }));
  s = await readSession(r.host);
  assert.equal(s.scenario.play.tests[0].successes, 1);
  assert.equal(s.scenario.play.tests[0].total, 1);
});

test('when the lair consequence removes every hero the immediate physical terminal keeps its parent and the failure receiver wins its own boundary', async (t) => {
  const r = await readyLair(t, {
    edit: (p) => {
      const d = p.definitions.find(
        (d) =>
          d.source ===
          p.manifest.prefabs.find((x) => x.source === p.manifest.lair.prefab).fsmSource,
      );
      d.states.find((s) => s.index === 103).actions[0].consequence = {
        family: 'damage',
        amount: 1,
        face: 'faceup',
      };
    },
    catalogEdit: (c) => {
      for (const h of c.heroes) h.stats.damage = h.stats.fear = 1;
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
  await reachLair(r);
  await ok(commitLair(r));
  let s = await finishPhysical(r);
  assert.ok(s.physical.lastStand.heroes.every((h) => h.defeated));
  assert.equal(s.scenario.conclusion.outcome, 'failure');
  assert.equal(s.scenario.conclusion.timing, 'no-active-heroes');
  assert.ok(s.scenario.conclusion.suspendedRequest);
  assert.equal(s.scenario.play.tests[0].total, 3);
  assert.equal(
    s.scenario.play.attempts[0].returned,
    false,
    'the terminal parent is preserved, not returned as success',
  );
  for (let n = 0; n < 4; n++) await ok(scenarioInput(r.host, r.other, { kind: 'ack' }));
  s = await readSession(r.host);
  assert.equal(s.scenario.conclusion.stage, 'camp');
  assert.equal(s.scenario.conclusion.xp.length, 2);
  assert.ok(s.scenario.conclusion.xp.every((x) => x.amount === 7));
  assert.equal(s.scenario.globals.companyCount, 2);
});
