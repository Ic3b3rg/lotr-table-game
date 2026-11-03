// Invented source definitions and prose only.
import { hash } from './map-freeze.mjs';
const origin = {
  parameterHash: hash('invented parameters'),
  load: 'hash-match-positional',
};
// Technical handler identifiers; all parameters, states, content and asset identities are invented.
const actionTypes = {
  message: 'FFG.JIME.Actions.DisplayMessage',
  getStart: 'FFG.JIME.Actions.GetStartTileId',
  revealTile: 'FFG.JIME.Actions.RevealTile',
  highlight: 'FFG.JIME.Actions.HighlightTileSpace',
  explore: 'FFG.JIME.Actions.ExploreTile',
  section: 'FFG.JIME.Actions.SetSectionVisibility',
  objective: 'FFG.JIME.Actions.SetObjective',
  threat: 'FFG.JIME.Actions.AddThreatEvent',
  set: 'HutongGames.PlayMaker.Actions.SetBoolValue',
  flip: 'HutongGames.PlayMaker.Actions.BoolFlip',
  getTile: 'FFG.JIME.Actions.GetTileId',
  getPosition: 'HutongGames.PlayMaker.Actions.GetPosition',
  branchBool: 'FFG.Common.Actions.CheckBool',
  broadcast: 'HutongGames.PlayMaker.Actions.SendEventByName',
  release: 'FFG.Common.Actions.FinishProcessingEvent',
  stop: 'FFG.Common.Actions.FinishFSM',
  revealNode: 'FFG.JIME.Actions.RevealNode',
  hideNode: 'FFG.JIME.Actions.HideThisNode',
  addInt: 'HutongGames.PlayMaker.Actions.IntAdd',
};
export const action = (index, op, data = {}) => ({
  index,
  op,
  origin: { ...origin, type: actionTypes[op] },
  ...data,
});
export const text = (value) => [{ kind: 'text', text: value, style: 'plain' }];
export const state = (index, actions = [], transitions = {}) => ({ index, actions, transitions });
export function scenarioFixture() {
  return {
    formatVersion: 1,
    algorithm: 'source-startup-ir-v1',
    identity: { adventureId: 1, adventureSource: 'example.assets:80000', language: 'Italian' },
    name: 'Avventura inventata',
    sources: [{ file: 'example.assets', sha256: hash('source') }],
    globals: [{ name: 'flag', type: 'bool', value: false }],
    principal: 'example.assets:70001',
    timers: [],
    definitions: [
      {
        source: 'example.assets:70001',
        initial: 0,
        variables: [{ name: 'start', type: 'int', value: 0 }],
        handlers: { SCENARIO_BEGIN: 1 },
        deferredHandlers: {},
        states: [
          state(0, [action(0, 'getStart', { target: { scope: 'local', name: 'start' } })]),
          state(1, [
            action(0, 'message', {
              mode: 'ordinary',
              text: text('Introduzione inventata'),
              ignoreLog: false,
            }),
          ]),
        ],
      },
      {
        source: 'example.assets:70002',
        initial: 0,
        variables: [],
        handlers: {},
        deferredHandlers: {},
        states: [state(0)],
      },
    ],
    manifest: {
      scope: 'startup-only',
      evidenceHash: hash('audit'),
      prefabs: [
        {
          source: 'example.assets:40000',
          modelSource: 'example.assets:30000',
          encounterId: 100000,
          nodeSource: 'example.assets:70003',
          nodeType: 'search',
          sourceNodeType: 0,
          token3DType: 2,
          fsmSource: 'example.assets:70002',
          initializationHash: hash('initialization'),
          closureHash: hash('closure'),
          inspection: text('Interazione inventata non ancora eseguibile'),
          capabilities: ['physical-effects'],
        },
      ],
    },
  };
}
