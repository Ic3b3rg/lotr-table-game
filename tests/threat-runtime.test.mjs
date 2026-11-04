import test from 'node:test';
import assert from 'node:assert/strict';
import { readyThreats, drainThreats, runtime, endTurns } from './threat-helper.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';
import { readBackup, readSession } from './skill-test-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';
import { action } from './fixtures/scenario.mjs';

test('legal cap continuation preflights the actual terminal path before effects and concludes after every reached callback', async (t) => {
  const r = await readyThreats(t);
  await endTurns(r);
  const before = await readBackup(r.host),
    raw = before.payload.state;
  const immutable = structuredClone(raw);
  assert.doesNotThrow(() => runtime.preflightSourceShadow(raw, 'a'.repeat(64)));
  assert.deepEqual(raw, immutable);
  const physicalRuns = raw.physical.runs.length;
  let response = await cycleCommand(r, 'BEGIN_SHADOW');
  assert.equal(response.status, 200, await response.text());
  let s = await readSession(r.host);
  assert.equal(s.scenario.globals.pressure, 60);
  assert.equal(s.scenario.conclusion, undefined);
  response = await cycleCommand(r, 'CONFIRM_SHADOW_STEP', { step: 'threat' });
  assert.equal(response.status, 200, await response.text());
  const seen = [];
  s = await drainThreats(r, (s) => {
    seen.push([
      s.scenario.rounds.frames.at(-1).threshold,
      s.scenario.pending?.kind,
      s.scenario.globals.night,
      s.physical.active?.darknessHeroes,
    ]);
  });
  const frame = s.scenario.rounds.frames.at(-1);
  assert.deepEqual(frame.handled, [
    'example.assets:999',
    'example.assets:1000',
    ...s.scenario.pack.manifest.threatContinuations.thresholds.map((t) => t.source),
  ]);
  assert.equal(s.scenario.threats.length, 0);
  assert.equal(frame.stage, 'conclusion');
  assert.deepEqual(frame.activated, []);
  assert.deepEqual(frame.refreshed, []);
  assert.equal(s.round.phase, 'shadow');
  assert.equal(s.scenario.globals.pressure, 62);
  assert.equal(s.scenario.globals.night, true);
  assert.equal(s.scenario.conclusion.timing, 'threat-increase');
  assert.deepEqual(s.scenario.conclusion.cause, {
    kind: 'threat',
    before: 60,
    after: 62,
    limit: 62,
    frameId: frame.id,
    controllerHash: s.scenario.pack.manifest.rounds.controller.bodyHash,
  });
  assert.ok(seen.some(([, kind]) => kind === 'deployment'));
  assert.ok(
    seen.some(
      ([source, , night]) =>
        source === s.scenario.pack.manifest.threatContinuations.thresholds[1].source && night,
    ),
  );
  const after = await readBackup(r.host);
  assert.ok(
    after.payload.state.physical.runs.length > physicalRuns,
    'the earlier source group trial used real physics',
  );
  assert.equal(after.payload.state.physical.snapshot.lastStand.lossDue, null);
  assert.equal(
    after.payload.state.physical.runs.some((x) =>
      x.program.children.some((c) => c.kind === 'rally-reset'),
    ),
    false,
  );
  for (let n = 0; n < 4; n++) {
    const reply = await scenarioInput(r.host, n % 2 ? r.other : r.player, { kind: 'ack' });
    assert.equal(reply.status, 200, await reply.text());
  }
  s = await readSession(r.host);
  assert.equal(s.scenario.conclusion.stage, 'camp');
  assert.equal(s.scenario.conclusion.transitionCount, 1);
  assert.equal(s.scenario.conclusion.campEntryCount, 1);
  assert.equal(s.scenario.conclusion.xp.length, s.preparation.heroes.length);
  assert.equal(s.scenario.play.lore, 5);
  assert.equal(s.scenario.conclusion.campaign.next.status, 'requires-content');
});

test('an exact synthetic threshold registers the next callback and refreshes once without retroactive activation or darkness suffering', async (t) => {
  const r = await readyThreats(t, { before: 46, perHero: 0, limit: 83 });
  await endTurns(r);
  for (const [type, fields] of [
    ['BEGIN_SHADOW', {}],
    ['CONFIRM_SHADOW_STEP', { step: 'threat' }],
  ]) {
    const x = await cycleCommand(r, type, fields);
    assert.equal(x.status, 200, await x.text());
  }
  const s = await drainThreats(r),
    frame = s.scenario.rounds.frames.at(-1);
  assert.equal(s.round.phase, 'rally');
  assert.equal(frame.threat.after, 46);
  assert.deepEqual(
    s.scenario.threats.map((t) => t.threshold),
    [61],
  );
  assert.equal(frame.handled.length, 4);
  assert.equal(s.scenario.globals.night, true);
  const raw = (await readBackup(r.host)).payload.state;
  assert.deepEqual(
    runtime.sourceDarknessHeroes(raw),
    [0, 1],
    'next consumer observes the shared global immediately',
  );
  const context = structuredClone(raw);
  context.scenario.play.active = 'invented-context';
  context.scenario.play.attempts.push({
    id: 'invented-context',
    heroId: context.preparation.heroes[0].heroId,
  });
  const instruction = { op: 'sourceTest', stat: 'wisdom', target: 1 };
  assert.deepEqual(
    runtime.encounterProgram(context, instruction).darknessHeroes,
    [0, 1],
    'ordinary source encounters share the newly active global',
  );
  assert.deepEqual(frame.darknessHeroes, [], 'the earlier darkness phase is not replayed');
  assert.deepEqual(frame.activated, []);
  assert.equal(new Set(frame.refreshed).size, frame.refreshed.length);
  assert.equal(
    frame.refreshed.length,
    s.scenario.enemies.groups.filter((g) => g.figures.some((f) => f.health > 0)).length,
  );
});

test('cap already reached at Shadow start concludes before enemy, darkness, timer, RNG and a new frame', async (t) => {
  const r = await readyThreats(t, { before: 84, limit: 83 });
  await endTurns(r);
  const before = await readBackup(r.host);
  const response = await cycleCommand(r, 'BEGIN_SHADOW');
  assert.equal(response.status, 200, await response.text());
  const after = await readBackup(r.host),
    s = after.payload.state;
  assert.equal(s.scenario.conclusion.timing, 'threat-start');
  assert.equal(s.scenario.conclusion.cause.frameId, null);
  assert.equal(s.round.phase, 'action');
  assert.deepEqual(s.scenario.rounds, before.payload.state.scenario.rounds);
  assert.deepEqual(s.physical.runs, before.payload.state.physical.runs);
  assert.deepEqual(s.scenario.enemies, before.payload.state.scenario.enemies);
});

test('cap overshoot sorts the live list and duplicate registrations in nested callbacks execute each receiver and spawn once', async (t) => {
  const r = await readyThreats(t, {
    before: 61,
    edit(pack) {
      const principal = pack.definitions.find((d) => d.source === pack.principal);
      const entry = principal.states.find((s) => s.actions.some((a) => a.op === 'threat'));
      const rows = pack.manifest.threatContinuations.thresholds;
      for (const row of [rows[2], rows[1], rows[1]]) {
        const index = Math.max(...entry.actions.map((a) => a.index)) + 1;
        entry.actions.push(
          action(index, 'threat', { source: row.source, threshold: row.threshold }),
        );
      }
    },
  });
  await endTurns(r);
  const before = await readSession(r.host);
  assert.deepEqual(
    before.scenario.threats.map((t) => t.threshold),
    [15, 61, 46],
  );
  for (const [type, fields] of [
    ['BEGIN_SHADOW', {}],
    ['CONFIRM_SHADOW_STEP', { step: 'threat' }],
  ]) {
    const response = await cycleCommand(r, type, fields);
    assert.equal(response.status, 200, await response.text());
  }
  const s = await drainThreats(r),
    sc = s.scenario,
    frame = sc.rounds.frames.at(-1);
  assert.equal(sc.conclusion.cause.after, 63);
  assert.ok(sc.conclusion.cause.after > sc.conclusion.cause.limit);
  assert.deepEqual(frame.handled, [
    'example.assets:999',
    'example.assets:1000',
    ...sc.pack.manifest.threatContinuations.thresholds.map((t) => t.source),
  ]);
  assert.equal(new Set(frame.handled).size, 5);
  assert.equal(sc.enemies.attempts.length, 5, 'all spawn callbacks run even at or above the cap');
  assert.equal(new Set(sc.enemies.attempts.map((a) => a.effectId)).size, 5);
  const raw = (await readBackup(r.host)).payload.state;
  const model = raw.scenario.pack.manifest.followup.deployment.compiled.models[0];
  assert.ok(
    sc.enemies.groups.flatMap((g) => g.figures.filter((f) => f.health > 0)).length <=
      model.capacity,
  );
  for (const row of sc.pack.manifest.threatContinuations.thresholds) {
    const receiver = sc.instances.find((i) => i.definition === row.definition);
    assert.equal(
      receiver.variables.points,
      row.multiplier * s.preparation.heroes.length,
      'each source budget is recomputed independently of the previous residual',
    );
    assert.equal(receiver.stopped, true);
  }
});
