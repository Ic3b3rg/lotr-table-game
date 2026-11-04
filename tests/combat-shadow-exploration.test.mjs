import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { attachExploration } from './fixtures/exploration.mjs';

const built = buildSync({
  stdin: {
    contents: `
      export { prepareExploration } from './src/scenario/exploration';
      export { explorationSource } from './src/shared/exploration';
      export { ScenarioSchema, ScenarioViewSchema, scenarioView } from './src/shared/scenario';
      export { digest } from './src/map-freeze/hash';
    `,
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  target: 'node24',
});
const {
  prepareExploration,
  explorationSource,
  ScenarioSchema,
  ScenarioViewSchema,
  scenarioView,
  digest,
} = await import(
  `data:text/javascript;base64,${Buffer.from(Buffer.from(built.outputFiles[0].contents).toString() + '\n//# sourceURL=combat-shadow-exploration.mjs').toString('base64')}`
);
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function fixture() {
  const pack = {
    principal: 'fixture.assets:2',
    definitions: [{ source: 'fixture.assets:2', handlers: {}, deferredHandlers: {}, states: [] }],
    manifest: {
      scope: 'original-encounter-v1',
      prefabs: [],
      combat: { source: { shadow: { version: 'source-shadow-activations-v1' } } },
    },
  };
  attachExploration(pack, ['fixture.assets:41']);
  const state = {
    revision: 0,
    generation: uuid(3),
    round: { id: uuid(2), turnId: null, phase: 'shadow' },
    preparation: { heroes: [{ heroId: 'invented-hero', playerId: uuid(1) }] },
    physical: { snapshot: { active: null } },
    combat: {
      active: uuid(5),
      attempts: [
        { id: uuid(6), kind: 'activation', activation: { frameId: uuid(7) } },
        {
          id: uuid(5),
          parentId: uuid(6),
          heroId: 'invented-hero',
          kind: 'provocation',
          stage: 'movement',
          movement: { selected: { actor: 'hero', from: 'a', destination: 'b' }, provoked: [] },
        },
      ],
    },
    journey: {
      id: uuid(2),
      heroes: [{ heroId: 'invented-hero', spaceId: 'ordinary-a' }],
      definition: { connections: [['ordinary-a', 'ordinary-b']] },
    },
    scenario: {
      id: uuid(2),
      phase: 'action',
      pack,
      packFingerprint: '1'.repeat(64),
      projectionFingerprint: '2'.repeat(64),
      pending: null,
      play: { active: null },
      rounds: { active: uuid(7), frames: [{ id: uuid(7), stage: 'enemies' }] },
      enemies: { groups: [] },
      explorations: { version: 'source-exploration-v1', active: null, attempts: [] },
      instances: [],
      tiles: [{ source: 'fixture.assets:41', visible: true, explored: false }],
      spaceBindings: [
        { id: 'ordinary-a', sourceId: 'a' },
        { id: 'ordinary-b', sourceId: 'b' },
      ],
    },
    mapGeneration: {
      status: 'frozen',
      projection: { assignments: [], spaces: [{ id: 'b', tileSource: 'fixture.assets:41' }] },
    },
  };
  const command = {
    type: 'EXPLORE_SCENARIO',
    requestId: uuid(4),
    generation: state.generation,
    expectedRevision: 0,
    mapId: uuid(2),
    roundId: uuid(2),
    turnId: null,
    heroId: 'invented-hero',
    fromSpaceId: 'ordinary-a',
    destinationSpaceId: 'ordinary-b',
    scenarioId: uuid(2),
    packFingerprint: state.scenario.packFingerprint,
    projectionFingerprint: state.scenario.projectionFingerprint,
    sourceFingerprint: digest(explorationSource(state.scenario, 'fixture.assets:41')),
  };
  return { state, command };
}

test('forced exploration retains a strict Shadow origin through a provocation child and recovery', () => {
  const { state, command } = fixture();
  prepareExploration(state, uuid(1), command, '3'.repeat(64), uuid(5));
  const attempts = ScenarioSchema.shape.explorations.parse(
    JSON.parse(JSON.stringify(state.scenario.explorations)),
  );
  assert.deepEqual(attempts.attempts[0].shadowOrigin, {
    version: 'source-shadow-exploration-v1',
    frameId: uuid(7),
    attemptId: uuid(5),
  });
  assert.equal(attempts.attempts[0].turnId, null);
  assert.equal(state.journey.heroes[0].spaceId, 'ordinary-b');
  const visible = ScenarioViewSchema.shape.explorations.parse(
    scenarioView(state.scenario).explorations,
  );
  assert.equal('entropy' in visible.attempts[0], false);
  assert.deepEqual(visible.attempts[0].shadowOrigin, attempts.attempts[0].shadowOrigin);
  const unbound = structuredClone(attempts);
  delete unbound.attempts[0].shadowOrigin;
  assert.equal(ScenarioSchema.shape.explorations.safeParse(unbound).success, false);

  for (const invalidate of [
    (s) => delete s.scenario.pack.manifest.combat.source.shadow,
    (s) => (s.scenario.rounds.active = uuid(8)),
    (s) => (s.combat.attempts[0].parentId = uuid(5)),
  ]) {
    const { state: rejected, command: input } = fixture();
    invalidate(rejected);
    const before = structuredClone(rejected);
    assert.throws(() => prepareExploration(rejected, uuid(1), input, '3'.repeat(64), uuid(5)));
    assert.deepEqual(
      rejected,
      before,
      'invalid context cannot move the hero or create a source request',
    );
  }
});
