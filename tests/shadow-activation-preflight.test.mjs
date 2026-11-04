import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { closureFixture, groupFixture, sha } from './fixtures/combat-closure.mjs';
import { attachActivationSource } from './fixtures/shadow-activations.mjs';
import { digest } from '../dist/map-freeze-library.mjs';

const built = buildSync({
  stdin: {
    contents: `
      export { preflightSourceShadow, advanceSourceActivations } from './src/scenario/round-source';
      export { initialCombat, combatPending } from './src/combat/controller';
      export { compileCombatClosure } from './src/combat/closure-compiler';
      export { activationTargets } from './src/combat/movement';
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
  preflightSourceShadow,
  advanceSourceActivations,
  initialCombat,
  compileCombatClosure,
  activationTargets,
} = await import(
  `data:text/javascript;base64,${Buffer.from(Buffer.from(built.outputFiles[0].contents).toString() + '\n//# sourceURL=shadow-activation-preflight.mjs').toString('base64')}`
);

// Invented two-group encounter: a--b--c, hero at a, threat at b.
function encounter({ forcedMove = true, reverse = false } = {}) {
  const source = attachActivationSource(closureFixture(), ['fixture.assets:40']);
  const first = source.assets.find((a) => a.cls === 'EnemyModel');
  first.data.Traits = 0;
  first.data.Activations = [{ m_FileID: 0, m_PathID: 50 }];
  const second = structuredClone(first);
  second.source = 'fixture.assets:11';
  second.data.Activations = [{ m_FileID: 0, m_PathID: 51 }];
  source.models.push(second.source);
  source.assets.push(second);
  source.texts.push({
    key: 'invented-move',
    value: 'Invented movement consequence.',
    file: 'fixture.assets',
    locator: 'invented-move',
    sha256: sha('Invented movement consequence.'),
  });
  source.additions[0].effect = { op: 'gain-boon', boon: 'hidden' };
  source.additions[0].predicate = 'always';
  source.additions.push({
    key: 'invented-move',
    textHash: sha('Invented movement consequence.'),
    predicate: 'always',
    window: 'condition-known',
    effect: { op: 'move-pair-toward-threat', amount: 1 },
  });
  source.assets.find((a) => a.source === 'fixture.assets:50').data.KeyAttackAdditionalEffect =
    forcedMove ? 'invented-move' : '';
  if (!forcedMove) source.additions.pop();
  source.assets.find((a) => a.source === 'fixture.assets:51').data.MinGroupSize = 1;
  source.assets.forEach((a) => (a.dataHash = digest(a.data)));
  const artifact = compileCombatClosure(source);
  const groups = [
    { ...groupFixture(), id: 'first', bonuses: [], spaceId: 'a' },
    { ...groupFixture(), id: 'later', source: 'fixture.assets:11', bonuses: [], spaceId: 'c' },
  ];
  if (reverse) groups.reverse();
  const spaces = ['a', 'b', 'c'];
  return {
    preparation: {
      heroes: [{ heroId: 'invented-hero', playerId: '00000000-0000-4000-8000-000000000001' }],
    },
    physical: { snapshot: { active: null, resolution: { resources: { boons: [] } } } },
    round: { id: '00000000-0000-4000-8000-000000000002', number: 1, phase: 'action' },
    journey: { heroes: [{ heroId: 'invented-hero', spaceId: 'ordinary-a' }] },
    scenario: {
      id: '00000000-0000-4000-8000-000000000003',
      rounds: { active: null, frames: [] },
      pack: {
        definitions: [],
        manifest: {
          combat: artifact,
          rounds: {
            configuration: { initialEnemyGroups: [], disableDarkness: false },
            bindings: {
              round: 'round',
              threat: 'threat',
              darkness: 'darkness',
              darknessOverride: 'override',
            },
            events: { end: 'ROUND_END', start: 'ROUND_START' },
            threat: { perHero: 1, perToken: 1, perUnexploredTile: 1, limit: 64 },
            darkness: {
              spaces: spaces.map((id) => ({ id, hasDarkness: false })),
              tokenPrefabs: [],
            },
          },
          followup: {},
          prefabs: [{ source: 'fixture.assets:90', nodeType: 'threat', sourceNodeType: 2 }],
        },
      },
      globals: { round: 1, threat: 0, darkness: false, override: '' },
      enemies: { groups },
      tiles: [{ source: 'fixture.assets:40', visible: true, explored: true }],
      threats: [],
      instances: [
        {
          id: 'threat-b',
          visible: true,
          stopped: false,
          prefab: 'fixture.assets:90',
          spaceId: 'b',
          kind: 'node',
        },
      ],
      spaceBindings: spaces.map((id) => ({ id: 'ordinary-' + id, sourceId: id })),
      tasks: [],
      events: [],
    },
    mapGeneration: {
      status: 'frozen',
      projection: {
        spaces: spaces.map((id) => ({ id, tileSource: 'fixture.assets:40' })),
        movementGraph: {
          edges: [
            { a: 'a', b: 'b' },
            { a: 'b', b: 'c' },
          ],
        },
      },
    },
  };
}

test('whole Shadow gates a later attack enabled by forced movement before any phase effect', () => {
  const state = encounter(),
    before = structuredClone(state);
  const later = state.scenario.enemies.groups[1];
  assert.equal(
    activationTargets(
      state,
      later.spaceId,
      state.scenario.pack.manifest.combat.compiled.models[1].instructions[0].activation,
      null,
      0,
    )[0].branch,
    'alternative',
  );
  assert.throws(
    () => preflightSourceShadow(state, '0'.repeat(64)),
    (error) => error.code === 'ROUND_SOURCE_CAPABILITY' && /benefici/.test(error.message),
  );
  assert.deepEqual(state, before, 'no movement, draw, RNG, tick, threat or receipt is committed');

  for (const options of [{ forcedMove: false }, { reverse: true }]) {
    const allowed = encounter(options),
      original = structuredClone(allowed);
    assert.doesNotThrow(() => preflightSourceShadow(allowed, '0'.repeat(64)));
    assert.deepEqual(allowed, original, 'unreachable or already completed alternatives stay legal');
  }
});

test('groups with no reachable hero finish their alternatives and let the Shadow continue once', () => {
  const state = encounter({ forcedMove: false });
  state.content = { heroes: [{ id: 'invented-hero', name: { text: 'Invented hero' } }] };
  state.physical.entropy = '1'.repeat(64);
  state.journey.heroes[0].spaceId = 'ordinary-isolated';
  state.scenario.spaceBindings.push({ id: 'ordinary-isolated', sourceId: 'isolated' });
  state.mapGeneration.projection.spaces.push({ id: 'isolated', tileSource: 'fixture.assets:40' });
  state.mapGeneration.projection.movementGraph.edges = [];
  state.scenario.pack.manifest.rounds.darkness.spaces.push({ id: 'isolated', hasDarkness: false });
  state.round.phase = 'shadow';
  state.round.shadowStep = 'enemies';
  const frame = { id: '00000000-0000-4000-8000-000000000005', stage: 'enemies', activated: [] };
  state.scenario.rounds.active = frame.id;
  state.scenario.rounds.frames.push(frame);
  state.scenario.pending = null;
  state.combat = initialCombat(state);
  assert.equal(advanceSourceActivations(state), true);
  assert.equal(state.combat.active, null);
  assert.deepEqual(frame.activated, ['first', 'later']);
  assert.ok(state.combat.attempts.every((a) => a.returned && a.packet === null));
  assert.ok(state.scenario.enemies.groups.every((g) => g.exhausted && !g.attackReduction));
  assert.equal(state.round.shadowStep, 'darkness');
  const completed = structuredClone(state);
  assert.equal(advanceSourceActivations(state), false);
  assert.deepEqual(state, completed);
});
