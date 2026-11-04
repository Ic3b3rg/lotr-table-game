import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { compileCombatClosure, compileSourceDeployment } from '../dist/combat-library.mjs';
import { closureFixture, groupFixture } from './fixtures/combat-closure.mjs';
import { deploymentSource } from './fixtures/source-deployment.mjs';

const built = buildSync({
  entryPoints: [fileURLToPath(new URL('../src/combat/controller.ts', import.meta.url))],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  target: 'node24',
});
const { advanceCombat, combatPending, answerCombat } = await import(
  `data:text/javascript;base64,${Buffer.from(built.outputFiles[0].contents).toString('base64')}`
);

test('a due movement still moves the enemy after P2 defeats its recipient, then returns once', () => {
  const source = closureFixture();
  source.additions[0].effect = { op: 'move-pair-toward-threat', amount: 1 };
  const artifact = compileCombatClosure(source);
  const deployment = deploymentSource();
  for (const asset of source.assets.filter((a) => a.cls !== 'EnemyActivationModel'))
    deployment.assets[deployment.assets.findIndex((a) => a.source === asset.source)] = asset;
  const group = groupFixture();
  const attempt = {
    id: 'acquired-movement',
    heroId: 'fallen',
    playerId: 'owner-fallen',
    kind: 'hero-attack',
    groupId: group.id,
    stage: 'enemy-frontier',
    runId: null,
    selection: { model: group.source, source: 'fixture.assets:51' },
    outcome: { suffered: { damage: 1, fear: 0 }, sealed: true },
    frontier: { addition: 'pending', physicalRole: null },
  };
  const state = {
    combat: { active: attempt.id, attempts: [attempt] },
    physical: {
      snapshot: {
        active: null,
        areas: [],
        lastStand: {
          heroes: [
            { heroId: 'fallen', defeated: true },
            { heroId: 'survivor', defeated: false },
          ],
        },
      },
    },
    preparation: {
      heroes: [
        { heroId: 'fallen', playerId: 'owner-fallen' },
        { heroId: 'survivor', playerId: 'owner-survivor' },
      ],
    },
    content: {
      heroes: [
        { id: 'fallen', name: { text: 'Fallen' } },
        { id: 'survivor', name: { text: 'Survivor' } },
      ],
    },
    journey: {
      heroes: [
        { heroId: 'fallen', spaceId: 'ordinary-origin', removed: true },
        { heroId: 'survivor', spaceId: 'ordinary-target' },
      ],
      definition: {
        spaces: [
          { id: 'ordinary-origin', label: 'Origin' },
          { id: 'ordinary-target', label: 'Target' },
        ],
      },
    },
    scenario: {
      pack: {
        manifest: {
          combat: artifact,
          followup: { deployment: compileSourceDeployment(deployment) },
          prefabs: [{ source: 'invented-threat', nodeType: 'threat' }],
        },
      },
      enemies: { groups: [group] },
      tiles: [{ source: group.tileSource, visible: true, explored: true }],
      instances: [
        {
          id: 'target',
          prefab: 'invented-threat',
          visible: true,
          stopped: false,
          spaceId: 'target-space',
        },
      ],
      spaceBindings: [
        { id: 'ordinary-origin', sourceId: group.spaceId },
        { id: 'ordinary-target', sourceId: 'target-space' },
      ],
    },
    mapGeneration: {
      status: 'frozen',
      projection: {
        spaces: [
          { id: group.spaceId, tileSource: group.tileSource, index: 0 },
          { id: 'target-space', tileSource: group.tileSource, index: 1 },
        ],
        movementGraph: { edges: [{ a: group.spaceId, b: 'target-space' }] },
        sections: [
          {
            tiles: [
              {
                source: group.tileSource,
                hexes: [
                  { space: 0, worldCenter: [0, 0, 0] },
                  { space: 1, worldCenter: [1, 0, 0] },
                ],
              },
            ],
          },
        ],
      },
    },
  };
  const heroBefore = structuredClone(state.journey.heroes[0]);
  advanceCombat(state);
  assert.equal(attempt.stage, 'movement');
  const pending = combatPending(state);
  assert.equal(pending.actorPlayerId, 'owner-survivor');
  assert.equal(pending.options.length, 1);
  answerCombat(
    state,
    pending.actorPlayerId,
    {
      type: 'COMBAT_INPUT',
      combatId: pending.combatId,
      pendingId: pending.id,
      sourceFingerprint: pending.sourceFingerprint,
      choice: pending.options[0].id,
    },
    'resolve-enemy-movement',
  );
  advanceCombat(state);
  assert.equal(group.spaceId, 'target-space');
  assert.deepEqual(group.position, [1, 0, 0]);
  assert.deepEqual(state.journey.heroes[0], heroBefore);
  assert.equal(attempt.frontier.addition, 'completed');
  assert.equal(attempt.returned, true);
  assert.equal(state.combat.active, null);
  advanceCombat(state);
  assert.equal(group.spaceId, 'target-space');
});
