import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import {
  compilePhysicalFronts,
  compileLastStand,
  freezePhysical,
} from '../dist/physical-resolution-library.mjs';
import { lastStandFixture } from './fixtures/last-stand.mjs';
import { binding, hash } from './fixtures/physical-fronts.mjs';
import {
  clueCompilerFixture,
  native,
  local,
  global,
  literal,
  variable,
  message,
} from './fixtures/clue-progression.mjs';
import { state, action } from './fixtures/scenario.mjs';
const code = buildSync({
  stdin: {
    contents: `export { pumpPhaseEvent, resumeScenario } from './src/scenario/runtime';`,
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  target: 'node24',
});
const { pumpPhaseEvent, resumeScenario } = await import(
  `data:text/javascript;base64,${Buffer.from(Buffer.from(code.outputFiles[0].contents).toString() + '\n//# sourceURL=clue-runtime-driver.mjs').toString('base64')}`
);

function runtime(states, variables = []) {
  const f = lastStandFixture(),
    pack = clueCompilerFixture(),
    d = pack.definitions.find((d) => d.source === 'example.assets:73000');
  d.states = states;
  d.variables = variables;
  const id = '00000000-0000-4000-8000-000000000099',
    hero = f.heroes[0];
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
  const i = {
    id: 'invented-clue',
    kind: 'encounter',
    definition: d.source,
    prefab: pack.manifest.clues.encounters[0],
    spaceId: 'source-space',
    variables: Object.fromEntries(variables.map((v) => [v.name, v.value])),
    state: 0,
    entry: 1,
    started: [],
    completed: [],
    stopped: false,
    settled: false,
    visible: true,
    processing: 0,
  };
  const sc = {
    id,
    phase: 'action',
    pack,
    packFingerprint: hash(pack),
    projectionFingerprint: hash('projection'),
    globals: Object.fromEntries(pack.globals.map((v) => [v.name, v.value])),
    instances: [i],
    pending: null,
    tasks: [],
    effects: [],
    events: [],
    commands: [],
    messageLog: [],
    play: {
      active: 'attempt',
      attempts: [
        {
          id: 'attempt',
          instanceId: i.id,
          heroId: hero.heroId,
          playerId: hero.playerId,
          returned: false,
        },
      ],
      tests: [],
      lore: 0,
    },
    tiles: [],
    spaceBindings: [{ id: hero.spaceId, sourceId: i.spaceId }],
  };
  return {
    ...f,
    i,
    state: {
      scenario: sc,
      preparation: structuredClone(f.context.preparation),
      content: { catalog: f.catalog },
      physical: p,
      revision: 0,
      generation: id,
      players: [],
      journey: { heroes: f.heroes, definition: { connections: [] } },
      mapGeneration: {
        status: 'frozen',
        projection: { spaces: [{ id: i.spaceId, hasDarkness: false }] },
      },
    },
  };
}
function answer(f, input) {
  const s = f.state,
    sc = s.scenario,
    q = sc.pending;
  resumeScenario(s, q.actorPlayerId ?? f.heroes[0].playerId, {
    type: 'SCENARIO_INPUT',
    requestId: `invented-request-000000000-${s.revision++}`,
    generation: s.generation,
    expectedRevision: s.revision,
    scenarioId: sc.id,
    packFingerprint: sc.packFingerprint,
    projectionFingerprint: sc.projectionFingerprint,
    pendingId: q.id,
    sourceFingerprint: q.fingerprint,
    heroId: q.heroId,
    input,
  });
}
function finish(f) {
  for (let n = 0; n < 100 && f.state.scenario.pending; n++) {
    const a = f.state.physical.snapshot.active;
    answer(
      f,
      a
        ? {
            kind: 'physical-choice',
            option:
              ['resolve', 'close', 'reveal'].find((id) => a.options?.some((o) => o.id === id)) ??
              a.options[0].id,
          }
        : { kind: 'ack' },
    );
  }
  assert.equal(f.state.scenario.pending, null);
}
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
