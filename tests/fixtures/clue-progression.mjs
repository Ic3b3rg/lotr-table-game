// Invented graph, identities, bindings and Italian packets. No original data.
import { scenarioFixture, state, action, text } from './scenario.mjs';
import { hash } from './map-freeze.mjs';
import { certificates } from './exploration.mjs';
export const local = (name) => ({ scope: 'local', name });
export const global = (name) => ({ scope: 'global', name });
export const literal = (value) => ({ kind: 'literal', value });
export const variable = (ref) => ({ kind: 'variable', ref });
export function native(index, op, type, fields) {
  return {
    index,
    op,
    ...fields,
    origin: { type, parameterHash: hash(fields), load: 'hash-match-positional' },
  };
}
export const message = (index, value, extra = {}) =>
  action(index, 'message', {
    mode: 'ordinary',
    text: text(value),
    ignoreLog: false,
    ...extra,
  });
export function clueCompilerFixture() {
  const pack = scenarioFixture(),
    principal = pack.definitions[0];
  pack.manifest.scope = 'original-encounter-v1';
  const original = structuredClone(pack.manifest.prefabs[0]);
  const confirm = native(0, 'confirm', 'FFG.JIME.Actions.DisplayMessageCancelConfirm', {
    text: text('Ricerca inventata'),
    label: text('Esamina'),
    cancelLabel: text('Annulla'),
    confirmEvent: 'COMMIT',
    cancelEvent: 'CANCEL',
  });
  pack.manifest.playablePrefabs = [original.source];
  pack.definitions[1].states = [
    state(0, [], { 'NODE CLICKED': 1 }),
    state(1, [confirm], { COMMIT: 0, CANCEL: 0 }),
  ];
  const clues = [];
  for (let n = 0; n < 4; n++) {
    const prefab = {
      ...structuredClone(original),
      source: `example.assets:${43000 + n}`,
      fsmSource: `example.assets:${73000 + n}`,
    };
    pack.manifest.prefabs.push(prefab);
    clues.push(prefab.source);
    pack.definitions.push({
      source: prefab.fsmSource,
      initial: 0,
      variables: [
        { name: 'sum', type: 'int', value: 0 },
        { name: 'last', type: 'int', value: 0 },
        { name: 'bound', type: 'int', value: 2 },
      ],
      handlers: {},
      deferredHandlers: {},
      states: [
        state(0, [], { 'NODE CLICKED': 1 }),
        state(1, [structuredClone(confirm)], { COMMIT: 2, CANCEL: 0 }),
        state(
          2,
          [
            native(0, 'challenge', 'FFG.JIME.Actions.DisplayMessageChallenge', {
              text: text('Prova inventata'),
              stat: 'agility',
              sum: n ? local('sum') : literal(0),
              bounds: [
                { maximum: local('bound'), event: 'LOW' },
                { maximum: 7, event: 'HIGH' },
              ],
            }),
          ],
          { LOW: 3, HIGH: 4 },
        ),
        state(
          3,
          [
            native(0, 'copyInt', 'HutongGames.PlayMaker.Actions.SetIntValue', {
              target: local('last'),
              value: variable(local('sum')),
            }),
          ],
          { FINISHED: 0 },
        ),
        state(4, [
          action(0, 'broadcast', { event: 'EXAMPLE_CLUE' }),
          action(1, 'hideNode'),
          action(2, 'stop'),
        ]),
      ],
    });
  }
  const fort = {
    ...structuredClone(original),
    source: 'example.assets:44000',
    fsmSource: 'example.assets:74000',
  };
  pack.manifest.prefabs.push(fort);
  pack.globals.push(
    { name: 'remaining', type: 'int', value: 3 },
    { name: 'fortTile', type: 'int', value: 0 },
    { name: 'fortPosition', type: 'vector', value: [0, 0, 0] },
  );
  principal.handlers.EXAMPLE_CLUE = 2;
  principal.states.push(
    state(2, [action(0, 'addInt', { target: global('remaining'), value: literal(-1) })], {
      FINISHED: 3,
    }),
    state(
      3,
      [
        native(0, 'switchInt', 'HutongGames.PlayMaker.Actions.IntSwitch', {
          value: variable(global('remaining')),
          cases: [{ equals: literal(0), event: 'ZERO' }],
        }),
      ],
      { ZERO: 4, FINISHED: 0 },
    ),
    state(4, [action(0, 'broadcast', { event: 'EXAMPLE_FORT' })], { FINISHED: 0 }),
  );
  pack.definitions.push({
    source: fort.fsmSource,
    initial: 0,
    variables: [],
    handlers: { EXAMPLE_FORT: 1 },
    deferredHandlers: {},
    states: [
      state(0, [
        action(0, 'getTile', { target: global('fortTile') }),
        action(1, 'getPosition', { target: global('fortPosition') }),
      ]),
      state(1, [action(0, 'revealNode'), message(1, 'Covo inventato rivelato')], { FINISHED: 2 }),
      state(2, [action(0, 'release')]),
    ],
  });
  pack.manifest.clues = {
    version: 'source-clues-v1',
    projectionFingerprint: hash('invented projection'),
    encounters: clues,
    counter: global('remaining'),
    event: 'EXAMPLE_CLUE',
    fortEvent: 'EXAMPLE_FORT',
    fort: { prefab: fort.source, tile: global('fortTile'), position: global('fortPosition') },
    evidenceHash: hash('invented source evidence'),
  };
  return pack;
}
export function clueCompilation(pack = clueCompilerFixture()) {
  return {
    pack,
    certificates: certificates(pack),
    cluesCertificate: { instructionHash: hash(pack.manifest.clues) },
  };
}
