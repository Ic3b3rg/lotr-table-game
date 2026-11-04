import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readyRounds, endTurns, finishCycle } from './original-round-helper.mjs';
import { atSecondShadow, rally, answerFollowup, drainFollowup } from './second-shadow-helper.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';
import { readSession, readBackup } from './skill-test-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';

test('second shadow suspends real source requests, deploys at the threshold, and returns to a legal round', async (t) => {
  const ready = await atSecondShadow(t);
  const before = (await readBackup(ready.host)).payload.state;
  let r = await cycleCommand(ready, 'BEGIN_SHADOW');
  assert.equal(r.status, 200, await r.text());
  let s = await readSession(ready.host);
  assert.equal(s.scenario.pending.kind, 'message');
  assert.equal(s.round.phase, 'shadow');
  const requests = [];
  for (let n = 0; s.scenario.pending && n < 30; n++) {
    requests.push(s.scenario.pending.kind);
    r = await scenarioInput(ready.host, ready.player, { kind: 'ack' });
    assert.equal(r.status, 200, await r.text());
    s = await readSession(ready.host);
  }
  assert.ok(requests.includes('placement'));
  assert.ok(requests.includes('exploration-markers'));
  assert.equal(s.scenario.play.lore, 2);
  const frame = s.scenario.rounds.frames.at(-1);
  assert.ok(frame.threat.tiles.length > before.scenario.rounds.frames[0].threat.tiles.length);
  r = await cycleCommand(ready, 'CONFIRM_SHADOW_STEP', { step: 'threat' });
  assert.equal(r.status, 200, await r.text());
  s = await readSession(ready.host);
  for (let n = 0; s.scenario.pending && n < 30; n++) {
    r = await answerFollowup(ready, s);
    assert.equal(r.status, 200, await r.text());
    s = await readSession(ready.host);
  }
  assert.equal(s.round.phase, 'rally');
  assert.ok(s.physical.sourceTest === null);
  assert.equal(
    (await readBackup(ready.host)).payload.state.physical.runs.filter((r) =>
      r.program.children.some((c) => c.kind === 'group-test'),
    ).length,
    1,
  );
  assert.ok(s.scenario.enemies.groups.length);
  assert.ok(s.scenario.enemies.groups.every((g) => g.placed && !g.exhausted));
  assert.deepEqual(
    s.scenario.threats.map((t) => t.threshold),
    [50],
  );
  await finishCycle(ready);
  await rally(ready);
  r = await cycleCommand(ready, 'START_TURN');
  assert.equal(r.status, 200, await r.text());
  const after = (await readBackup(ready.host)).payload.state;
  assert.equal(after.round.number, 3);
  assert.deepEqual(after.physical.cycle.seed, before.physical.cycle.seed);
  assert.deepEqual(after.mapGeneration, before.mapGeneration);
  const placed = after.scenario.enemies.groups.find(
    (g) =>
      g.spaceId ===
      after.scenario.spaceBindings.find((b) => b.id === after.journey.heroes[0].spaceId).sourceId,
  );
  if (placed) {
    const b = await readBackup(ready.host);
    const x = await cycleCommand(ready, 'START_TRAVEL');
    assert.equal(x.status, 409);
    assert.equal((await x.json()).error.code, 'ENEMY_PROVOCATION_CAPABILITY');
    assert.deepEqual((await readBackup(ready.host)).payload, b.payload);
  }
  await endTurns(ready);
  const stable = await readBackup(ready.host);
  const blocked = await cycleCommand(ready, 'BEGIN_SHADOW');
  assert.equal(blocked.status, 409);
  assert.equal((await blocked.json()).error.code, 'ROUND_SOURCE_CAPABILITY');
  assert.deepEqual((await readBackup(ready.host)).payload, stable.payload);
});

test('a missing dependency at the end of the callback prevents the entire second shadow', async (t) => {
  const ready = await atSecondShadow(t, (pack) => {
    const s = pack.definitions
      .find((d) => d.source === 'example.assets:810')
      .states.find((s) => s.index === 4);
    s.transitions = {};
    s.deferredTransitions = { FINISHED: 'example-final-consumer' };
  });
  const before = await readBackup(ready.host);
  const r = await cycleCommand(ready, 'BEGIN_SHADOW');
  assert.equal(r.status, 409);
  const error = (await r.json()).error;
  assert.equal(error.code, 'ROUND_SOURCE_CAPABILITY');
  assert.doesNotMatch(error.message, /example-final-consumer/);
  assert.deepEqual((await readBackup(ready.host)).payload, before.payload);
});

test('an exact reached threshold deploys, while a later missing threshold gates the whole tick', async (t) => {
  for (const missing of [false, true])
    await t.test(missing ? 'multiple-threshold preflight' : 'exact threshold 15', async (t) => {
      const ready = await atSecondShadow(t, (pack, frozen) => {
        const p = frozen.mapGeneration.projection;
        const tiles = (id) => p.sections.find((s) => s.id === id).tiles.length;
        pack.manifest.rounds.threat.perHero = 0;
        pack.manifest.rounds.threat.perToken = 0;
        pack.globals.find((v) => v.name === 'pressure').value = 15 - (2 * tiles(1) + tiles(2));
        if (missing)
          pack.definitions
            .find((d) => d.source === 'example.assets:811')
            .states.find((s) => s.index === 2).actions[0].threshold = 15;
      });
      const before = await readBackup(ready.host);
      let r = await cycleCommand(ready, 'BEGIN_SHADOW');
      if (missing) {
        assert.equal(r.status, 409);
        assert.equal((await r.json()).error.code, 'ROUND_SOURCE_CAPABILITY');
        assert.deepEqual((await readBackup(ready.host)).payload, before.payload);
        return;
      }
      assert.equal(r.status, 200, await r.text());
      await drainFollowup(ready);
      const s = await readSession(ready.host);
      assert.equal(s.scenario.rounds.frames.at(-1).threat.after, 15);
      r = await cycleCommand(ready, 'CONFIRM_SHADOW_STEP', { step: 'threat' });
      assert.equal(r.status, 200, await r.text());
      await drainFollowup(ready);
      assert.ok((await readSession(ready.host)).scenario.enemies.groups.length);
    });
});

test('an unfunded deployment returns through its source continuation without a fabricated enemy', async (t) => {
  const ready = await atSecondShadow(t, (pack) => {
    pack.definitions
      .find((d) => d.source === 'example.assets:811')
      .states.find((s) => s.index === 1).actions[0].right = { kind: 'literal', value: 0 };
  });
  assert.equal((await cycleCommand(ready, 'BEGIN_SHADOW')).status, 200);
  await drainFollowup(ready);
  assert.equal((await cycleCommand(ready, 'CONFIRM_SHADOW_STEP', { step: 'threat' })).status, 200);
  await drainFollowup(ready);
  const s = await readSession(ready.host);
  assert.equal(s.round.phase, 'rally');
  assert.deepEqual(s.scenario.enemies.groups, []);
  assert.equal(s.scenario.enemies.attempts[0].reason, 'no-budget');
  assert.deepEqual(s.scenario.enemies.attempts[0].groups, []);
  assert.equal(s.scenario.enemies.cursor, 0);
  assert.deepEqual(
    s.scenario.threats.map((t) => t.threshold),
    [50],
  );
});

test('the objective reads its bound global at entry while its announcement stays literal', async (t) => {
  const ready = await atSecondShadow(t, (pack) => {
    pack.globals.find((v) => v.name === 'clueTotal').value = 7;
  });
  assert.equal((await cycleCommand(ready, 'BEGIN_SHADOW')).status, 200);
  const s = await drainFollowup(ready);
  assert.equal(
    s.scenario.objective.text.map((t) => t.text ?? '').join(''),
    'Obiettivo inventato: 7.',
  );
  assert.ok(
    s.scenario.messageLog.some((m) => m.text.some((t) => t.text === 'Annuncio inventato: zero.')),
  );
});
