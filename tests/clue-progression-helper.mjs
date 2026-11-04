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
    contents: `export { pumpPhaseEvent, resumeScenario, interactScenario } from './src/scenario/runtime'; export { explorationProblem } from './src/shared/exploration';`,
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  target: 'node24',
});
export const { pumpPhaseEvent, resumeScenario, interactScenario, explorationProblem } =
  await import(
    `data:text/javascript;base64,${Buffer.from(Buffer.from(code.outputFiles[0].contents).toString() + '\n//# sourceURL=clue-runtime-driver.mjs').toString('base64')}`
  );

export function runtime(states, variables = []) {
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
      players: f.heroes.map((h) => ({ id: h.playerId })),
      journey: { heroes: f.heroes, definition: { connections: [] } },
      mapGeneration: {
        status: 'frozen',
        projection: { spaces: [{ id: i.spaceId, hasDarkness: false }] },
      },
    },
  };
}
export function answer(f, input) {
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
export function finish(f) {
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
