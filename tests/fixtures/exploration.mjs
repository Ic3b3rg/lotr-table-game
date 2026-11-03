// Invented exploration template, identities, packets and reward data.
import { state, action, text } from './scenario.mjs';
import { hash } from './map-freeze.mjs';
export function attachExploration(pack, tiles = ['example.assets:41000', 'example.assets:41001']) {
  const source = 'example.assets:71000';
  const confirm = {
    index: 0,
    op: 'confirm',
    origin: {
      type: 'FFG.JIME.Actions.DisplayMessageCancelConfirm',
      parameterHash: hash('invented exploration confirmation'),
      load: 'hash-match-positional',
    },
    text: text('Entrare ed esplorare la tessera inventata?'),
    label: text('Esplora'),
    cancelLabel: text('Annulla'),
    confirmEvent: 'YES',
    cancelEvent: 'NO',
  };
  pack.definitions.push({
    source,
    initial: 0,
    variables: [{ name: 'tile', type: 'int', value: -1 }],
    handlers: { 'NODE CLICKED': 1 },
    states: [
      state(0),
      state(1, [confirm], { YES: 2, NO: 0 }),
      state(
        2,
        [
          action(0, 'getTile', { target: { scope: 'local', name: 'tile' } }),
          action(1, 'explore', {
            tile: { kind: 'variable', ref: { scope: 'local', name: 'tile' } },
            noInspiration: false,
            skipIntro: false,
            skipOutro: false,
            skipAdjacentSectionEvent: false,
          }),
        ],
        { FINISHED: 3 },
      ),
      state(3, [action(0, 'hideNode'), action(1, 'stop')]),
    ],
  });
  pack.manifest.exploration = {
    version: 'source-exploration-v1',
    definition: source,
    tiles: tiles.map((source) => ({
      source,
      intros: [
        text('Introduzione inventata A; rimuovi esplorazione.'),
        text('Introduzione inventata B; rimuovi esplorazione.'),
      ],
    })),
    inspiration: 1,
    outro: text('Riprendi il viaggio inventato.'),
    adjacent: { event: 'NEARBY_EXPLORED', variable: null },
    evidenceHash: hash('invented template and coroutine evidence'),
  };
  return pack.manifest.exploration;
}
export function certificates(pack) {
  return pack.definitions.map((d) => ({
    source: d.source,
    objectHash: hash(d.source),
    lifecycleHash: hash('invented lifecycle'),
    initial: d.initial,
    handlers: d.handlers,
    states: d.states.map((s) => ({
      index: s.index,
      transitions: s.transitions,
      actions: s.actions.map((a) => ({
        index: a.index,
        type: a.origin.type,
        parameterHash: a.origin.parameterHash,
        enabled: true,
        instructionHash: hash(a),
      })),
    })),
    deferredEdges: [],
  }));
}
