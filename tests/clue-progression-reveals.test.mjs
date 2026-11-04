import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime, finish, pumpPhaseEvent, explorationProblem } from './clue-progression-helper.mjs';
import { native, global, literal, variable, message } from './fixtures/clue-progression.mjs';
import { state, action, text } from './fixtures/scenario.mjs';
import { attachExploration } from './fixtures/exploration.mjs';

function fortRuntime(explored) {
  const f = runtime([]),
    s = f.state,
    sc = s.scenario,
    pack = sc.pack,
    cap = pack.manifest.clues,
    tile = { kind: 'variable', ref: cap.fort.tile };
  f.i.kind = 'principal';
  f.i.definition = pack.principal;
  f.i.id = 'principal';
  sc.play.active = null;
  sc.play.attempts = [];
  sc.globals.remaining = 0;
  sc.globals.fortTile = 9;
  sc.globals.fortPosition = [1, 2, 3];
  pack.definitions[0].states = [
    state(
      0,
      [
        native(0, 'isExplored', 'FFG.JIME.Actions.IsTileExplored', {
          tile,
          trueEvent: 'ALREADY',
          falseEvent: 'FORCE',
        }),
      ],
      { ALREADY: 1, FORCE: 2 },
    ),
    state(1, [action(0, 'broadcast', { event: cap.fortEvent })], { FINISHED: 3 }),
    state(
      2,
      [
        action(0, 'explore', {
          tile,
          noInspiration: true,
          skipIntro: false,
          skipOutro: true,
          skipAdjacentSectionEvent: false,
          intro: text('Ingresso imposto inventato'),
        }),
      ],
      { FINISHED: 3 },
    ),
    state(3),
  ];
  const d = pack.definitions.find((d) => d.source === 'example.assets:74000');
  d.handlers = { EXAMPLE_FORT: 1, PRE_REVEAL: 3 };
  d.states = [
    state(0),
    state(
      1,
      [
        action(0, 'revealNode'),
        message(1, 'Covo inventato'),
        native(2, 'lore', 'FFG.JIME.Actions.AddLore', { amount: 1 }),
      ],
      { FINISHED: 5 },
    ),
    state(2, [action(0, 'release')]),
    state(
      5,
      [
        action(0, 'objective', { id: 3, text: text('Obiettivo finale inventato') }),
        message(1, 'Annuncio obiettivo inventato', { mode: 'objective' }),
      ],
      { FINISHED: 2 },
    ),
    state(
      3,
      [
        native(0, 'switchInt', 'HutongGames.PlayMaker.Actions.IntSwitch', {
          value: variable(cap.counter),
          cases: [{ equals: literal(0), event: 'ZERO' }],
        }),
      ],
      { ZERO: 1, FINISHED: 4 },
    ),
    state(4, [action(0, 'hideNode'), action(1, 'release')]),
  ];
  const fort = {
    ...structuredClone(f.i),
    id: 'fort',
    kind: 'encounter',
    definition: d.source,
    prefab: cap.fort.prefab,
    spaceId: 'fort-space',
    settled: true,
    visible: false,
  };
  sc.instances.push(fort);
  const source = 'example.assets:50000';
  sc.tiles = [{ source, visible: true, explored }];
  sc.explorationMarkers = [
    { source: 'example.assets:50001', tileSource: source, visible: !explored },
  ];
  s.mapGeneration.projection = {
    sections: [{ id: 3, tiles: [{ source, hashId: 9 }] }],
    spaces: [
      {
        id: 'fort-space',
        tileSource: source,
        index: 0,
        sectionId: 3,
        connected: [],
        nodePosition: [1, 2, 3],
      },
    ],
    assignments: [{ spaceId: 'fort-space', prefab: { source: cap.fort.prefab } }],
  };
  attachExploration(pack, [source]);
  pack.manifest.followup = {};
  return { ...f, fort, source };
}
test('forced fort exploration uses the frozen tile, original intro and PRE_REVEAL instead of an extra broadcast', () => {
  for (const explored of [false, true]) {
    const f = fortRuntime(explored),
      before = f.state.preparation.heroes.map((h) => h.inspiration);
    pumpPhaseEvent(f.state);
    if (!explored) {
      assert.equal(f.state.scenario.pending.kind, 'exploration-intro');
      assert.equal(f.state.scenario.pending.tileSource, f.source);
      assert.equal(f.fort.visible, false);
    }
    finish(f);
    const sc = f.state.scenario;
    assert.equal(sc.play.lore, 1);
    assert.equal(sc.objective.id, 3);
    assert.equal(f.fort.visible, true);
    assert.equal(f.fort.processing, 0);
    assert.equal(sc.tiles[0].explored, true);
    assert.equal(sc.explorationMarkers[0].visible, false);
    assert.deepEqual(
      f.state.preparation.heroes.map((h) => h.inspiration),
      before,
    );
    assert.equal(sc.events.filter((e) => e.event === 'PRE_REVEAL').length, explored ? 0 : 1);
    assert.equal(sc.events.filter((e) => e.event === 'EXAMPLE_FORT').length, explored ? 1 : 0);
    pumpPhaseEvent(f.state);
    assert.equal(sc.play.lore, 1);
  }
});
test('exploration closes equality, lore and release with the clue capability and keeps hidden receiver gates', () => {
  const f = fortRuntime(false),
    sc = f.state.scenario,
    p = f.state.mapGeneration.projection;
  assert.equal(explorationProblem(sc, p, f.source), null);
  const d = sc.pack.definitions.find((d) => d.source === f.fort.definition);
  d.deferredHandlers.PRE_REVEAL = 'missing';
  assert.match(explorationProblem(sc, p, f.source), /rivelazione/);
});
