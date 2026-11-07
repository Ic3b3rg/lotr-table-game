// Entirely invented scenario for transaction/recovery tests; never original acceptance.
import assert from 'node:assert/strict';
import { readyOriginal, finishPhysical } from './original-encounter-helper.mjs';
import { attachRounds } from './fixtures/source-rounds.mjs';
import { attachFollowup } from './fixtures/shadow-followup.mjs';
import { attachExploration } from './fixtures/exploration.mjs';
import { fixed, addEncounter } from './fixtures/map-encounters.mjs';
import { state, action, text } from './fixtures/scenario.mjs';
import { native, global, literal, variable, message } from './fixtures/clue-progression.mjs';
import { hash } from './fixtures/map-freeze.mjs';
import {
  startTravel,
  destinations,
  explore,
  finishExploration,
} from './original-exploration-helper.mjs';
import { command } from './preparation-helper.mjs';
import { readSession } from './skill-test-helper.mjs';

export function attachClues(pack, frozen) {
  const p = frozen.mapGeneration.projection,
    nodes = pack.manifest.prefabs.filter((m) =>
      p.assignments.some(
        (a) =>
          a.prefab.source === m.source && p.spaces.find((s) => s.id === a.spaceId).sectionId === 1,
      ),
    );
  assert.equal(nodes.length, 4);
  const event = 'INVENTED_TRACE',
    fortEvent = 'INVENTED_KEEP';
  for (const prefab of nodes) {
    const d = pack.definitions.find((d) => d.source === prefab.fsmSource);
    d.initial = 0;
    d.variables = [];
    d.handlers = { REVEALED: 6 };
    d.deferredHandlers = {};
    d.states = [
      state(0, [], { 'NODE CLICKED': 1 }),
      state(
        1,
        [
          native(0, 'confirm', 'FFG.JIME.Actions.DisplayMessageCancelConfirm', {
            text: text('Ricerca inventata'),
            label: text('Esamina'),
            cancelLabel: text('Annulla'),
            confirmEvent: 'GO',
            cancelEvent: 'CANCEL',
          }),
        ],
        { GO: 2, CANCEL: 0 },
      ),
      state(
        2,
        [
          native(0, 'sourceTest', 'FFG.JIME.Actions.DisplayMessageCancelConfirm', {
            text: text('Prova inventata'),
            stat: 'might',
            target: 1,
            passEvent: 'PASS',
            failEvent: 'FAIL',
          }),
        ],
        { PASS: 3, FAIL: 5 },
      ),
      state(3, [message(0, 'Premio inventato', { inspiration: 1 })], { FINISHED: 4 }),
      state(4, [action(0, 'broadcast', { event }), action(1, 'hideNode'), action(2, 'stop')]),
      state(
        5,
        [
          message(0, 'Errore inventato', {
            consequence: { family: 'damage', amount: 1, face: 'facedown' },
          }),
        ],
        { FINISHED: 0 },
      ),
      state(6, [message(0, 'Colloca la ricerca inventata')], { FINISHED: 7 }),
      state(7, [action(0, 'release')], { FINISHED: 0 }),
    ];
    prefab.nodeType = 'search';
    prefab.sourceNodeType = 0;
    prefab.inspection = text('Indizio inventato');
  }
  const fort = pack.manifest.prefabs[1],
    d = pack.definitions.find((d) => d.source === fort.fsmSource);
  pack.globals.push(
    { name: 'missionTile', type: 'int', value: 0 },
    { name: 'missionPosition', type: 'vector', value: [0, 0, 0] },
  );
  d.initial = 8;
  d.variables = [];
  d.handlers = { PRE_REVEAL: 6, [fortEvent]: 3 };
  d.deferredHandlers = {};
  d.states = [
    state(0),
    state(
      8,
      [
        action(0, 'getTile', { target: global('missionTile') }),
        action(1, 'getPosition', { target: global('missionPosition') }),
      ],
      { FINISHED: 0 },
    ),
    state(
      6,
      [
        native(0, 'switchInt', 'HutongGames.PlayMaker.Actions.IntSwitch', {
          value: variable(global('clueTotal')),
          cases: [{ equals: literal(0), event: 'ZERO' }],
        }),
      ],
      { ZERO: 3, FINISHED: 4 },
    ),
    state(
      3,
      [
        action(0, 'revealNode'),
        message(1, 'Covo inventato rivelato'),
        native(2, 'lore', 'FFG.JIME.Actions.AddLore', { amount: 2 }),
      ],
      { FINISHED: 5 },
    ),
    state(4, [action(0, 'hideNode')], { FINISHED: 5 }),
    state(5, [action(0, 'release')]),
  ];
  const main = pack.definitions.find((d) => d.source === pack.principal);
  main.handlers[event] = 70;
  main.states.push(
    state(70, [action(0, 'addInt', { target: global('clueTotal'), value: literal(-1) })], {
      FINISHED: 71,
    }),
    state(
      71,
      [
        native(0, 'switchInt', 'HutongGames.PlayMaker.Actions.IntSwitch', {
          value: variable(global('clueTotal')),
          cases: [
            { equals: literal(-1), event: 'SENTINEL' },
            { equals: literal(2), event: 'FIRST' },
            { equals: literal(1), event: 'NEXT' },
            { equals: literal(0), event: 'LAST' },
          ],
        }),
      ],
      { SENTINEL: 0, FIRST: 72, NEXT: 73, LAST: 74, FINISHED: 0 },
    ),
    state(
      72,
      [action(0, 'section', { sectionId: 3, text: text('Colloca {tile}, luogo inventato') })],
      { FINISHED: 73 },
    ),
    state(
      73,
      [
        message(0, 'Annuncio inventato: sette.'),
        native(1, 'lore', 'FFG.JIME.Actions.AddLore', { amount: 2 }),
        action(2, 'objective', {
          id: 8,
          text: text('Tracce inventate da trovare: {left}.'),
          bindings: [{ placeholder: '{left}', ref: global('clueTotal') }],
        }),
      ],
      { FINISHED: 0 },
    ),
    state(74, [action(0, 'broadcast', { event: fortEvent })], { FINISHED: 0 }),
  );
  pack.manifest.clues = {
    version: 'source-clues-v1',
    projectionFingerprint: p.fingerprint,
    encounters: nodes.map((m) => m.source),
    counter: global('clueTotal'),
    event,
    fortEvent,
    fort: { prefab: fort.source, tile: global('missionTile'), position: global('missionPosition') },
    evidenceHash: hash('invented evidence'),
  };
}
export function readyClues(t, edit = () => {}, frontEdit) {
  return readyOriginal(
    t,
    (pack, frozen) => {
      attachRounds(pack, frozen.mapGeneration.projection);
      attachFollowup(pack, frozen);
      attachExploration(
        pack,
        frozen.mapGeneration.projection.sections.flatMap((s) => s.tiles).map((t) => t.source),
      );
      attachClues(pack, frozen);
      edit(pack, frozen);
    },
    undefined,
    frontEdit,
    (raw) => {
      const input = {
        assembly: { selection: raw.template.selection },
        placement: raw.template.placement,
      };
      for (const tile of [2, 3])
        for (const space of [0, 1]) fixed(input, 1, tile, addEncounter(input), space);
    },
  );
}
export async function atClue(ready) {
  const s = await startTravel(ready),
    to = destinations(s).find((sp) =>
      s.mapGeneration.projection.assignments.some(
        (a) =>
          a.spaceId === s.scenario.spaceBindings.find((b) => b.id === sp.id)?.sourceId &&
          s.scenario.pack.manifest.clues.encounters.includes(a.prefab.source),
      ),
    );
  assert.ok(to, 'invented clue must be reachable');
  const r = await explore(ready, to);
  assert.equal(r.status, 200, await r.text());
  return finishExploration(ready);
}
export function clueIntent(s, requestId) {
  const pos = s.journey.heroes.find((h) => h.heroId === s.round.activeHeroId),
    sc = s.scenario,
    node = sc.instances.find(
      (i) =>
        sc.pack.manifest.clues.encounters.includes(i.prefab) &&
        sc.spaceBindings.find((b) => b.sourceId === i.spaceId)?.id === pos.spaceId,
    );
  assert.ok(node);
  return {
    type: 'INTERACT_SCENARIO',
    ...(requestId ? { requestId } : {}),
    scenarioId: sc.id,
    packFingerprint: sc.packFingerprint,
    projectionFingerprint: sc.projectionFingerprint,
    instanceId: node.id,
    sourceFingerprint: s.encounterFingerprints[node.id],
    heroId: s.round.activeHeroId,
    roundId: s.round.id,
    turnId: s.round.turnId,
  };
}
export async function commitClue(r, requestId) {
  const s = await readSession(r.host);
  return command(r.host, r.player, clueIntent(s, requestId), s);
}
export { finishPhysical };
