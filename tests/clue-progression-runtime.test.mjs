import test from 'node:test';
import assert from 'node:assert/strict';
import { hash } from './fixtures/map-freeze.mjs';
import { native, local, global, literal, variable, message } from './fixtures/clue-progression.mjs';
import { state, action } from './fixtures/scenario.mjs';
import { runtime, finish, pumpPhaseEvent, interactScenario } from './clue-progression-helper.mjs';
test('ordered integer equality copies a binding and uses FINISHED only when no case matches', () => {
  const f = runtime(
    [
      state(
        0,
        [
          native(0, 'copyInt', 'HutongGames.PlayMaker.Actions.SetIntValue', {
            target: local('saved'),
            value: variable(local('total')),
          }),
        ],
        { FINISHED: 1 },
      ),
      state(
        1,
        [
          native(0, 'switchInt', 'HutongGames.PlayMaker.Actions.IntSwitch', {
            value: variable(local('saved')),
            cases: [
              { equals: literal(2), event: 'TWO' },
              { equals: literal(2), event: 'DUPLICATE' },
            ],
          }),
        ],
        { TWO: 2, DUPLICATE: 3, FINISHED: 3 },
      ),
      state(2, [action(0, 'set', { target: global('flag'), value: true })]),
      state(3),
    ],
    [
      { name: 'total', type: 'int', value: 2 },
      { name: 'saved', type: 'int', value: 0 },
    ],
  );
  pumpPhaseEvent(f.state);
  assert.equal(f.i.variables.saved, 2);
  assert.equal(f.state.scenario.globals.flag, true);
});
test('literal challenge sum is temporary while bound sums retain actual cards and resolve dynamic upper bounds', () => {
  for (const sum of [literal(0), local('total')]) {
    const f = runtime(
      [
        state(
          0,
          [
            native(0, 'challenge', 'FFG.JIME.Actions.DisplayMessageChallenge', {
              text: message(0, 'Prova inventata').text,
              stat: 'agility',
              sum,
              bounds: [
                { maximum: local('bound'), event: 'LOW' },
                { maximum: 8, event: 'HIGH' },
              ],
            }),
          ],
          { LOW: 1, HIGH: 2 },
        ),
        state(1, [message(0, 'Esito basso inventato')]),
        state(2, [message(0, 'Esito alto inventato')]),
      ],
      [
        { name: 'total', type: 'int', value: 4 },
        { name: 'bound', type: 'int', value: 1 },
      ],
    );
    pumpPhaseEvent(f.state);
    finish(f);
    const result = f.state.scenario.play.tests[0];
    assert.ok(result.successes >= 0);
    assert.equal(result.total, Math.min(99, result.successes + ('scope' in sum ? 4 : 0)));
    assert.equal(f.i.variables.total, 'scope' in sum ? result.total : 4);
    assert.equal(f.i.state, result.total <= 1 ? 1 : 2);
    assert.equal(f.state.physical.snapshot.parents[0].returnCount, 1);
  }
});
test('message inspiration uses the existing physical consumer once and records a single source message', () => {
  const f = runtime([state(0, [message(0, 'Premio inventato', { inspiration: 1 })])]);
  const before = f.state.preparation.heroes[0].inspiration;
  pumpPhaseEvent(f.state);
  finish(f);
  pumpPhaseEvent(f.state);
  assert.equal(f.state.preparation.heroes[0].inspiration, before + 1);
  assert.equal(f.state.scenario.messageLog.length, 1);
  assert.equal(f.state.physical.snapshot.parents.length, 1);
});
test('whole clue continuation rejects a hidden receiver behind a possible result before paying any action', () => {
  const f = runtime([
    state(0, [], { 'NODE CLICKED': 1 }),
    state(
      1,
      [
        native(0, 'confirm', 'FFG.JIME.Actions.DisplayMessageCancelConfirm', {
          text: message(0, 'Ricerca inventata').text,
          label: message(0, 'Cerca').text,
          cancelLabel: message(0, 'Annulla').text,
          confirmEvent: 'YES',
          cancelEvent: 'NO',
        }),
      ],
      { YES: 2, NO: 0 },
    ),
    state(
      2,
      [
        native(0, 'challenge', 'FFG.JIME.Actions.DisplayMessageChallenge', {
          text: message(0, 'Prova inventata').text,
          stat: 'might',
          sum: literal(0),
          bounds: [
            { maximum: 98, event: 'LOW' },
            { maximum: 99, event: 'HIGH' },
          ],
        }),
      ],
      { LOW: 0, HIGH: 3 },
    ),
    state(3, [action(0, 'broadcast', { event: 'HIDDEN_DEPENDENCY' })]),
  ]);
  const s = f.state,
    sc = s.scenario,
    hero = f.heroes[0];
  f.i.settled = true;
  sc.play.active = null;
  sc.play.attempts = [];
  s.round = {
    id: s.generation,
    turnId: s.generation,
    phase: 'action',
    activeHeroId: hero.heroId,
    heroes: f.heroes.map((h) => ({ heroId: h.heroId, actionsUsed: 0, turnEnded: false })),
  };
  const d = sc.pack.definitions.find((d) => d.source === 'example.assets:74000');
  d.deferredHandlers.HIDDEN_DEPENDENCY = 'unavailable-original-effect';
  sc.instances.push({
    ...structuredClone(f.i),
    id: 'hidden',
    definition: d.source,
    prefab: sc.pack.manifest.clues.fort.prefab,
    visible: false,
  });
  const before = structuredClone(s),
    c = {
      type: 'INTERACT_SCENARIO',
      scenarioId: sc.id,
      packFingerprint: sc.packFingerprint,
      projectionFingerprint: sc.projectionFingerprint,
      instanceId: f.i.id,
      heroId: hero.heroId,
      roundId: s.round.id,
      turnId: s.round.turnId,
      sourceFingerprint: hash(f.i),
      requestId: 'invented-preflight-request-000001',
    };
  assert.throws(() => interactScenario(s, hero.playerId, c));
  assert.deepEqual(s, before, 'gate must precede cost, event, cards and RNG');
});
