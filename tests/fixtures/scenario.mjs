// Invented source definitions and prose only.
import { hash } from './map-freeze.mjs';
const origin = {
  type: 'Invented.Action',
  parameterHash: hash('invented parameters'),
  load: 'hash-match-positional',
};
export const action = (index, op, data = {}) => ({ index, op, origin: { ...origin }, ...data });
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
