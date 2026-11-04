import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readyRounds, endTurns, finishCycle, answerCycle } from './original-round-helper.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';
import { readSession, readBackup } from './skill-test-helper.mjs';
import { state, action } from './fixtures/scenario.mjs';
import { hash } from './fixtures/map-freeze.mjs';
import { attachRounds } from './fixtures/source-rounds.mjs';
import {
  readyExploration,
  startTravel,
  destinations,
  explore,
  finishExploration,
} from './original-exploration-helper.mjs';

test('original phase runs the hidden timer before source threat, resets real decks and opens the next legal turn', async (t) => {
  const ready = await readyRounds(t);
  await endTurns(ready);
  const before = (await readBackup(ready.host)).payload.state;
  let r = await cycleCommand(ready, 'BEGIN_SHADOW');
  assert.equal(r.status, 200, await r.text());
  const shadow = (await readBackup(ready.host)).payload.state;
  assert.equal(shadow.round.phase, 'shadow');
  assert.equal(shadow.round.shadowStep, 'threat');
  const timer = shadow.scenario.instances.find((i) => i.kind === 'timer');
  assert.equal(timer.variables.remaining, 3);
  assert.equal(timer.visible, false);
  assert.equal(timer.processing, 0);
  const frame = shadow.scenario.rounds.frames[0];
  const activeTokens = before.scenario.instances.filter(
    (i) =>
      i.visible &&
      !i.stopped &&
      before.scenario.pack.manifest.prefabs.some(
        (p) => p.source === i.prefab && p.sourceNodeType === 2,
      ),
  );
  const unexplored = before.scenario.tiles.filter((x) => x.visible && !x.explored);
  const delta = before.preparation.heroes.length * 3 + activeTokens.length * 2 + unexplored.length;
  assert.equal(frame.threat.delta, delta);
  assert.equal(shadow.scenario.globals.pressure, 0);
  assert.deepEqual(shadow.scenario.events.at(-1).receivers, [timer.id]);
  assert.equal(shadow.scenario.events.at(-1).event, 'EXAMPLE_ROUND_END');
  r = await cycleCommand(ready, 'CONFIRM_SHADOW_STEP', { step: 'threat' });
  assert.equal(r.status, 200, await r.text());
  const reset = (await readBackup(ready.host)).payload.state;
  assert.equal(reset.round.phase, 'rally');
  assert.equal(reset.scenario.globals.pressure, delta);
  for (const h of reset.preparation.heroes) {
    const old = before.preparation.heroes.find((x) => x.heroId === h.heroId);
    assert.deepEqual(h.prepared, old.prepared);
    assert.deepEqual(h.discard, []);
    assert.deepEqual([...h.deck].sort(), [...old.deck, ...old.discard].sort());
  }
  r = await cycleCommand(ready, 'END_RALLY');
  assert.equal(r.status, 409);
  for (const actor of [ready.player, ready.other]) {
    r = await cycleCommand(ready, 'START_RALLY_SCOUT', {}, actor);
    assert.equal(r.status, 200, await r.text());
    const s = await readSession(ready.host);
    const choices = s.physical.active.options.map((o) => o.id);
    r = await answerCycle(
      ready,
      {
        kind: 'physical-scout',
        prepare: choices[0],
        top: [],
        bottom: choices.slice(1).reverse(),
        discard: null,
      },
      s,
      actor,
    );
    assert.equal(r.status, 200, await r.text());
    await finishCycle(ready);
  }
  r = await cycleCommand(ready, 'END_RALLY');
  assert.equal(r.status, 200, await r.text());
  r = await cycleCommand(ready, 'START_TURN', {}, ready.other);
  assert.equal(r.status, 200, await r.text());
  const after = (await readBackup(ready.host)).payload.state;
  assert.equal(after.round.number, 2);
  assert.equal(after.round.phase, 'action');
  assert.equal(after.scenario.globals.phaseCounter, 2);
  assert.equal(after.scenario.rounds.active, null);
  assert.equal(after.scenario.rounds.frames[0].stage, 'complete');
  assert.deepEqual(after.physical.cycle.seed, before.physical.cycle.seed);
  assert.deepEqual(after.mapGeneration, before.mapGeneration);
  assert.deepEqual(after.scenario.objective, before.scenario.objective);
  assert.equal(after.scenario.play.lore, before.scenario.play.lore);
});

test('a reached timer expiry or threat boundary rejects the whole phase before any mutation', async (t) => {
  for (const boundary of ['timer', 'threat'])
    await t.test(boundary, async (t) => {
      const ready = await readyRounds(t, (pack) => {
        if (boundary === 'timer')
          pack.definitions
            .find((d) => d.source === pack.timers[0])
            .variables.find((v) => v.name === 'remaining').value = 1;
        else pack.globals.find((v) => v.name === 'pressure').value = 14;
      });
      await endTurns(ready);
      const before = await readBackup(ready.host);
      const r = await cycleCommand(ready, 'BEGIN_SHADOW');
      assert.equal(r.status, 409);
      assert.equal((await r.json()).error.code, 'ROUND_SOURCE_CAPABILITY');
      assert.deepEqual((await readBackup(ready.host)).payload, before.payload);
    });
});

test('invented native darkness opens real negation and fear fronts before the timer, with source reactions', async (t) => {
  const ready = await readyRounds(
    t,
    (pack, frozen) => {
      const p = frozen.mapGeneration.projection;
      const first = p.sections.find((s) => s.id === 0).tiles[0].source;
      const start = p.spaces.find((s) => s.tileSource === first && s.index === 1);
      pack.manifest.rounds.darkness.spaces.find((s) => s.id === start.id).hasDarkness = true;
    },
    undefined,
    (fronts) => {
      for (const d of fronts.definitions.filter((d) => d.cardId.includes('fear'))) {
        d.body = [{ op: 'keep-faceup' }];
        d.persistent = [
          {
            op: 'suffer',
            window: 'after-darkness-suffering-batch',
            hero: 'triggering-self-or-nearby',
            family: 'fear',
            n: 1,
            face: 'normal',
            condition: 'at-least-one-actually-suffered',
            source: 'this-card-not-darkness',
          },
        ];
      }
    },
  );
  await endTurns(ready);
  const before = (await readBackup(ready.host)).payload.state;
  const r = await cycleCommand(ready, 'BEGIN_SHADOW');
  assert.equal(r.status, 200, await r.text());
  const pending = (await readBackup(ready.host)).payload.state;
  assert.equal(pending.round.shadowStep, 'darkness');
  assert.equal(pending.scenario.instances.find((i) => i.kind === 'timer').variables.remaining, 4);
  assert.equal(pending.physical.cycle.pending.type, 'BEGIN_SHADOW');
  await finishCycle(ready);
  const after = (await readBackup(ready.host)).payload.state;
  assert.equal(after.round.shadowStep, 'threat');
  assert.equal(after.scenario.instances.find((i) => i.kind === 'timer').variables.remaining, 3);
  assert.ok(
    after.physical.snapshot.areas.reduce((n, a) => n + a.fear.length, 0) >=
      before.preparation.heroes.length * 2,
  );
  assert.equal(after.physical.runs.at(-1).program.children[0].kind, 'darkness');
  assert.ok(after.physical.snapshot.resolution.history.some((h) => h.active.mode === 'allocate'));
});

test('phase preflight evaluates the round-start receiver with the new threat before any tick or reset', async (t) => {
  const ready = await readyRounds(t, (pack) => {
    const d = pack.definitions.find((d) => d.source === pack.principal);
    d.handlers.EXAMPLE_ROUND_START = 60;
    d.states.push(
      {
        ...state(
          60,
          [
            {
              index: 0,
              op: 'compareInt',
              left: { kind: 'variable', ref: { scope: 'global', name: 'pressure' } },
              right: { kind: 'literal', value: 0 },
              equalEvent: 'DONE',
              lessEvent: 'DONE',
              greaterEvent: 'FUTURE',
              origin: {
                type: 'HutongGames.PlayMaker.Actions.IntCompare',
                parameterHash: hash('invented phase guard'),
                load: 'hash-match-positional',
              },
            },
          ],
          { DONE: 61 },
        ),
        deferredTransitions: { FUTURE: 'example-future-event' },
      },
      state(61, [action(0, 'release')]),
    );
  });
  await endTurns(ready);
  const before = await readBackup(ready.host);
  const r = await cycleCommand(ready, 'BEGIN_SHADOW');
  assert.equal(r.status, 409, await r.text());
  assert.deepEqual((await readBackup(ready.host)).payload, before.payload);
});

test('source threat excludes a hidden token and a tile explored through the real travel consumer', async (t) => {
  const ready = await readyExploration(t, (pack, frozen) => {
    attachRounds(pack, frozen.mapGeneration.projection);
    const d = pack.definitions.find((d) => d.source === pack.manifest.prefabs[0].fsmSource);
    d.states.find((s) => s.index === 2).actions.push(action(1, 'hideNode'));
  });
  const initial = (await readBackup(ready.host)).payload.state;
  const moving = await startTravel(ready),
    to = destinations(moving)[0];
  const entry = await explore(ready, to);
  assert.equal(entry.status, 200, await entry.text());
  await finishExploration(ready);
  await endTurns(ready);
  const before = (await readBackup(ready.host)).payload.state;
  assert.equal(
    before.scenario.tiles.filter((t) => t.visible && !t.explored).length,
    initial.scenario.tiles.filter((t) => t.visible && !t.explored).length - 1,
  );
  const shadow = await cycleCommand(ready, 'BEGIN_SHADOW');
  assert.equal(shadow.status, 200, await shadow.text());
  const after = (await readBackup(ready.host)).payload.state;
  const frame = after.scenario.rounds.frames[0];
  const hidden = before.scenario.instances.find(
    (i) => i.prefab === before.scenario.pack.manifest.prefabs[0].source,
  );
  assert.equal(hidden.visible, false);
  assert.ok(!frame.threat.tokens.includes(hidden.id));
  assert.ok(!frame.threat.tiles.includes(to.tileSource));
  assert.equal(
    frame.threat.delta,
    frame.threat.heroes * 3 + frame.threat.tokens.length * 2 + frame.threat.tiles.length,
  );
});

test('an uncompiled hidden receiver reached by the timer blocks before the whole phase', async (t) => {
  const ready = await readyRounds(t, (pack) => {
    pack.definitions
      .find((d) => d.source === pack.timers[0])
      .states.find((s) => s.index === 41)
      .actions.push(action(1, 'broadcast', { event: 'EXAMPLE_HIDDEN' }));
    pack.definitions.find((d) => d.source === pack.manifest.prefabs[1].fsmSource).deferredHandlers =
      { EXAMPLE_HIDDEN: 'example-hidden-consumer' };
  });
  await endTurns(ready);
  const before = await readBackup(ready.host);
  const r = await cycleCommand(ready, 'BEGIN_SHADOW');
  assert.equal(r.status, 409);
  assert.equal((await r.json()).error.code, 'ROUND_SOURCE_CAPABILITY');
  assert.deepEqual((await readBackup(ready.host)).payload, before.payload);
});
