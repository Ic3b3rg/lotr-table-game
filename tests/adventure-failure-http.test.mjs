import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readyFailure, defeatHero, ok } from './adventure-failure-helper.mjs';
import { endTurns, finishCycle } from './original-round-helper.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';
import { readSession, readBackup } from './skill-test-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';
import { command } from './preparation-helper.mjs';

test('hero failure at the next Shadow owns source messages, concurrent role rewards and persistent first camp once', async (t) => {
  const r = await readyFailure(t);
  let s = await defeatHero(r);
  assert.equal(s.scenario.conclusion, undefined);
  await endTurns(r);
  const before = (await readBackup(r.host)).payload;
  await ok(cycleCommand(r, 'BEGIN_SHADOW', {}, r.other));
  s = await readSession(r.host);
  assert.equal(s.scenario.conclusion.timing, 'shadow-start');
  assert.equal(s.round.phase, 'action');
  assert.deepEqual(s.scenario.rounds, before.state.scenario.rounds);
  assert.equal(s.scenario.conclusion.xp.length, 0);
  const requestId = randomUUID(),
    at = s;
  const [a, b] = await Promise.all([
    scenarioInput(r.host, r.player, { kind: 'ack' }, { requestId }, at),
    scenarioInput(r.host, r.player, { kind: 'ack' }, { requestId }, at),
  ]);
  assert.equal(a.status, 200, await a.text());
  assert.equal(b.status, 200, await b.text());
  s = await readSession(r.host);
  assert.equal(s.scenario.conclusion.xp.length, 2);
  assert.equal(s.scenario.play.lore, 5);
  assert.deepEqual(
    s.scenario.conclusion.xp.map((x) => [x.heroId, x.roleId, x.amount]),
    before.state.preparation.heroes.map((h) => [h.heroId, h.roleId, 7]),
  );
  assert.equal((await scenarioInput(r.host, r.other, { kind: 'ack' }, {}, at)).status, 409);
  for (const stage of ['campaign-map', 'campaign-story', 'camp']) {
    await ok(scenarioInput(r.host, r.other, { kind: 'ack' }));
    s = await readSession(r.host);
    assert.equal(s.scenario.conclusion.stage, stage);
  }
  assert.equal(s.scenario.conclusion.campEntryCount, 1);
  const q = s.scenario.pending,
    old = s.scenario.conclusion.xp;
  await ok(
    scenarioInput(r.host, r.player, {
      kind: 'camp-role',
      heroId: s.preparation.heroes[0].heroId,
      roleId: 'role-3',
    }),
  );
  s = await readSession(r.host);
  assert.deepEqual(s.scenario.conclusion.xp, old);
  assert.equal(s.scenario.conclusion.campaign.heroes[0].roleId, 'role-3');
  assert.equal(
    (
      await scenarioInput(r.host, r.other, {
        kind: 'camp-role',
        heroId: s.preparation.heroes[0].heroId,
        roleId: 'role-4',
      })
    ).status,
    403,
  );
  assert.equal((await scenarioInput(r.host, r.player, { kind: 'ack' })).status, 409);
  for (const type of ['START_TURN', 'BEGIN_SHADOW', 'START_TRAVEL'])
    assert.equal(
      (
        await cycleCommand(
          r,
          type,
          type === 'START_TRAVEL' ? { turnId: randomUUID() } : {},
          r.other,
        )
      ).status,
      409,
    );
  const after = (await readBackup(r.host)).payload;
  for (const k of ['physical', 'preparation', 'journey', 'round']) {
    if (k === 'physical') {
      for (const f of ['runs', 'snapshot'])
        assert.deepEqual(after.state.physical[f], before.state.physical[f]);
      assert.deepEqual(after.state.physical.cycle.seed, before.state.physical.cycle.seed);
    } else assert.deepEqual(after.state[k], before.state[k]);
  }
  assert.ok(q);
  assert.equal(after.state.scenario.conclusion.transitionCount, 1);
});

test('last hero concludes at the immediate physical frontier, retaining the terminal parent and all source evidence', async (t) => {
  const r = await readyFailure(t);
  await defeatHero(r);
  const s = await defeatHero(r, r.other);
  assert.equal(s.scenario.conclusion.timing, 'no-active-heroes');
  assert.equal(s.scenario.conclusion.cause.heroId, s.preparation.heroes[1].heroId);
  assert.equal(s.scenario.conclusion.stage, 'conclusion');
  assert.equal(s.physical.lastStand.terminal.timing, 'no-active-heroes');
  assert.equal(s.scenario.pending.kind, 'message');
  const b = (await readBackup(r.host)).payload;
  assert.equal(b.state.physical.snapshot.parents.at(-1).returnCount, 0);
  assert.ok(b.state.scenario.conclusion.suspendedRequest);
  assert.equal(b.state.scenario.conclusion.xp.length, 0);
});

test('failure capability preserves the whole-phase gates for threat and unresolved thresholds', async (t) => {
  for (const pressure of [14, 79])
    await t.test(String(pressure), async (t) => {
      const r = await readyFailure(t, (p) => {
        p.globals.find((v) => v.name === 'pressure').value = pressure;
      });
      await endTurns(r);
      const before = (await readBackup(r.host)).payload;
      assert.equal((await cycleCommand(r, 'BEGIN_SHADOW')).status, 409);
      assert.deepEqual((await readBackup(r.host)).payload, before);
    });
});

test('one hero defeated during the running Shadow returns its physical parent and allows the due phase effects without an early conclusion', async (t) => {
  const r = await readyFailure(
    t,
    (p, f) => {
      const first = f.mapGeneration.projection.sections.find((s) => s.id === 0).tiles[0].source;
      const start = f.mapGeneration.projection.spaces.find(
        (s) => s.tileSource === first && s.index === 1,
      );
      p.manifest.rounds.darkness.spaces.find((s) => s.id === start.id).hasDarkness = true;
      p.manifest.rounds.darkness.face = 'faceup';
    },
    (c) => {
      c.heroes[1].stats.fear = 20;
    },
  );
  await endTurns(r);
  await ok(cycleCommand(r, 'BEGIN_SHADOW'));
  const s = await finishCycle(r),
    b = (await readBackup(r.host)).payload.state;
  assert.equal(s.physical.lastStand.heroes[0].defeated, true);
  assert.equal(s.physical.lastStand.heroes[1].defeated, false);
  assert.equal(s.scenario.conclusion, undefined);
  assert.equal(s.round.phase, 'shadow');
  assert.equal(s.round.shadowStep, 'threat');
  assert.equal(b.physical.snapshot.parents.at(-1).returnCount, 1);
  assert.equal(b.scenario.instances.find((i) => i.kind === 'timer').variables.remaining, 3);
});
