import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime, interactScenario } from './clue-progression-helper.mjs';
import { native, message } from './fixtures/clue-progression.mjs';
import { state, action } from './fixtures/scenario.mjs';
import { binding, hash } from './fixtures/physical-fronts.mjs';
import {
  freezePhysical,
  compilePhysicalFronts,
  compileLastStand,
  openPhysical,
  validatePhysical,
} from '../dist/physical-resolution-library.mjs';

function scarcity(family, amounts, remaining) {
  const f = runtime([
    state(0, [], { 'NODE CLICKED': 1 }),
    state(
      1,
      [
        native(0, 'confirm', 'FFG.JIME.Actions.DisplayMessageCancelConfirm', {
          text: message(0, 'Conseguenza inventata').text,
          label: message(0, 'Conferma').text,
          cancelLabel: message(0, 'Annulla').text,
          confirmEvent: 'YES',
          cancelEvent: 'NO',
        }),
      ],
      { YES: 2, NO: 0 },
    ),
    ...amounts.map((amount, index) =>
      state(
        index + 2,
        [
          message(0, 'Danno o paura inventati', {
            consequence: { family, amount, face: 'facedown' },
          }),
        ],
        { FINISHED: index + 3 },
      ),
    ),
    state(amounts.length + 2, [action(0, 'stop')]),
  ]);
  // Valid invented capacity, with prior cards transferred by the real consumer.
  // No deck/area editing or original-company reachability is implied.
  for (const hero of f.catalog.heroes) hero.stats[family] = 20;
  const p = freezePhysical(
    f.raw,
    binding,
    f.heroes,
    '1'.repeat(64),
    undefined,
    { artifact: compilePhysicalFronts(f.raw, f.ir, f.catalog), catalog: f.catalog },
    compileLastStand(f.raw, f.lastStandInput),
  );
  p.version = 3;
  openPhysical(
    p,
    {
      effectId: 'invented-prior-effect',
      instanceId: 'invented-prior',
      state: 0,
      entry: 1,
      action: 0,
      parameterHash: hash('invented-prior'),
    },
    {
      profile: 'source-fronts-v1',
      initialCredits: f.heroes.map(() => 0),
      limits: f.heroes.map(() => ({ kind: 'requires-capability', capability: 'source-derived' })),
      darknessHeroes: [],
      children: f.heroes.map((_, hero) => ({
        kind: 'suffer',
        hero,
        face: 'facedown',
        cards: [{ family, amount: hero === 2 ? 10 - remaining : 9 }],
        prevention: [],
      })),
    },
    structuredClone(f.context),
  );
  validatePhysical(p);
  const s = f.state,
    sc = s.scenario,
    hero = f.heroes[0];
  s.physical = p;
  s.preparation = structuredClone(p.snapshot.resolution.resources.preparation);
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
  assert.equal(p.snapshot.decks[family].length, remaining);
  return {
    f,
    command: {
      type: 'INTERACT_SCENARIO',
      scenarioId: sc.id,
      packFingerprint: sc.packFingerprint,
      projectionFingerprint: sc.projectionFingerprint,
      instanceId: f.i.id,
      heroId: hero.heroId,
      roundId: s.round.id,
      turnId: s.round.turnId,
      sourceFingerprint: hash(f.i),
      requestId: 'invented-preflight-supply-000001',
    },
  };
}

test('known physical shortage gates the whole clue continuation before costs, cards or randomness', () => {
  for (const family of ['damage', 'fear']) {
    for (const amounts of [[2], [1, 1]]) {
      const { f, command } = scarcity(family, amounts, 1),
        before = structuredClone(f.state);
      assert.throws(
        () => interactScenario(f.state, f.heroes[0].playerId, command),
        (error) => error.code === 'SCENARIO_PHYSICAL_DECK_EMPTY',
      );
      assert.deepEqual(f.state, before);
      validatePhysical(f.state.physical);
    }
    const { f, command } = scarcity(family, [2], 2);
    assert.doesNotThrow(() => interactScenario(f.state, f.heroes[0].playerId, command));
    assert.equal(f.state.round.heroes[0].actionsUsed, 1);
    validatePhysical(f.state.physical);
  }
});
