// Invented phase bindings, controller attestations and timer; no original content.
import { action, state } from './scenario.mjs';
import { hash } from './map-freeze.mjs';

export function attachRounds(pack, projection) {
  for (const p of pack.manifest.prefabs) p.sourceNodeType = p.nodeType === 'threat' ? 2 : 0;
  pack.globals.push(
    { name: 'phaseCounter', type: 'int', value: 1 },
    { name: 'pressure', type: 'int', value: 0 },
    { name: 'night', type: 'bool', value: false },
    { name: 'nightInstruction', type: 'string', value: '' },
  );
  const timer = pack.definitions.find((d) => d.source === pack.timers[0]);
  timer.variables.push({ name: 'remaining', type: 'int', value: 4 });
  timer.handlers.EXAMPLE_ROUND_END = 40;
  const local = (name) => ({ scope: 'local', name });
  const native = (index, op, type, fields) => ({
    index,
    op,
    ...fields,
    origin: { type, parameterHash: hash(fields), load: 'hash-match-positional' },
  });
  timer.states.push(
    state(
      40,
      [
        action(0, 'branchBool', {
          ref: local('running'),
          trueEvent: 'RUN',
          falseEvent: 'IDLE',
        }),
      ],
      { RUN: 41, IDLE: 43 },
    ),
    state(
      41,
      [
        native(0, 'subtractInt', 'HutongGames.PlayMaker.Actions.IntOperator', {
          left: { kind: 'variable', ref: local('remaining') },
          right: { kind: 'literal', value: 1 },
          target: local('remaining'),
        }),
      ],
      { FINISHED: 42 },
    ),
    {
      ...state(
        42,
        [
          native(0, 'compareInt', 'HutongGames.PlayMaker.Actions.IntCompare', {
            left: { kind: 'variable', ref: local('remaining') },
            right: { kind: 'literal', value: 0 },
            equalEvent: 'EXPIRED',
            lessEvent: 'EXPIRED',
            greaterEvent: 'ALIVE',
          }),
        ],
        { ALIVE: 43 },
      ),
      deferredTransitions: { EXPIRED: 'example-expiration' },
    },
    state(43, [action(0, 'release')]),
  );
  pack.manifest.rounds = {
    version: 'source-rounds-v1',
    projectionFingerprint: projection?.fingerprint ?? hash('invented projection'),
    evidenceHash: hash('invented phase evidence'),
    controller: {
      assemblyHash: hash('invented assembly'),
      method: '06002001',
      bodyHash: hash('invented body'),
    },
    configuration: {
      difficulty: 'normal',
      mapType: 'journey',
      disableDarkness: false,
      initialEnemyGroups: [],
    },
    bindings: {
      round: 'phaseCounter',
      threat: 'pressure',
      darkness: 'night',
      darknessOverride: 'nightInstruction',
    },
    events: { end: 'EXAMPLE_ROUND_END', start: 'EXAMPLE_ROUND_START' },
    threat: { perHero: 3, perToken: 2, perUnexploredTile: 1, limit: 80 },
    darkness: {
      amount: 1,
      negate: 'spirit',
      face: 'faceup',
      tokenPrefabs: [],
      spaces: (projection?.spaces ?? []).map((s) => ({
        id: s.id,
        source: s.source,
        hasDarkness: false,
        evidenceHash: hash(s.source),
      })),
    },
  };
  return pack.manifest.rounds;
}

export function roundsCertificate(pack) {
  return { instructionHash: hash(pack.manifest.rounds) };
}
