import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';

const built = buildSync({
  entryPoints: [fileURLToPath(new URL('../src/combat/controller.ts', import.meta.url))],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  target: 'node24',
});
const { combatPending, answerCombat } = await import(
  `data:text/javascript;base64,${Buffer.from(built.outputFiles[0].contents).toString('base64')}`
);

test('defeat reward permits the attacker and nearby living heroes, rejecting a distant recipient', () => {
  const placements = [
    ['attacker', 'origin'],
    ['same-space', 'origin'],
    ['adjacent', 'next'],
    ['distant', 'far'],
    ['defeated', 'next'],
  ];
  const state = {
    combat: { active: 'attack', attempts: [{ id: 'attack', heroId: 'attacker', stage: 'reward' }] },
    physical: {
      snapshot: { active: null, lastStand: { heroes: [{ heroId: 'defeated', defeated: true }] } },
    },
    preparation: {
      heroes: placements.map(([heroId]) => ({ heroId, playerId: `owner-${heroId}` })),
    },
    content: { heroes: placements.map(([id]) => ({ id, name: { text: id } })) },
    journey: {
      heroes: placements.map(([heroId, spaceId]) => ({ heroId, spaceId })),
      definition: {
        connections: [
          ['origin', 'next'],
          ['next', 'far'],
        ],
      },
    },
  };
  const q = combatPending(state);
  assert.deepEqual(
    q.options.map((o) => o.id),
    ['reward:attacker', 'reward:same-space', 'reward:adjacent'],
  );
  const before = structuredClone(state);
  assert.throws(
    () =>
      answerCombat(
        state,
        q.actorPlayerId,
        {
          type: 'COMBAT_INPUT',
          combatId: q.combatId,
          pendingId: q.id,
          sourceFingerprint: q.sourceFingerprint,
          choice: 'reward:distant',
        },
        'reward-forged-recipient',
      ),
    (error) => error.code === 'COMBAT_OPTION',
  );
  assert.deepEqual(state, before);
});
