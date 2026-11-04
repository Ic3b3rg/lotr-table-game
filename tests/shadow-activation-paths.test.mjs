import test from 'node:test';
import assert from 'node:assert/strict';
import * as combat from '../dist/combat-library.mjs';

function context() {
  return {
    preparation: { heroes: ['first', 'second', 'third'].map((heroId) => ({ heroId })) },
    journey: {
      heroes: [
        { heroId: 'first', spaceId: 'ordinary-c' },
        { heroId: 'second', spaceId: 'ordinary-d' },
        { heroId: 'third', spaceId: 'ordinary-z' },
      ],
    },
    scenario: {
      tiles: [{ source: 'fixture:1', visible: true }],
      spaceBindings: ['a', 'b', 'c', 'd', 'e', 'z'].map((id) => ({
        id: 'ordinary-' + id,
        sourceId: id,
      })),
    },
    mapGeneration: {
      status: 'frozen',
      projection: {
        spaces: ['a', 'b', 'c', 'd', 'e', 'z'].map((id) => ({ id, tileSource: 'fixture:1' })),
        movementGraph: {
          edges: [
            ['a', 'b'],
            ['a', 'e'],
            ['b', 'c'],
            ['e', 'c'],
            ['a', 'd'],
          ].map(([a, b]) => ({ a, b })),
        },
      },
    },
  };
}
const policy = { movement: 1, alternativeMovement: 4, alternativeDestination: 'hero' };

test('activation planning retains initial target, nearest fallback and all shortest path ties', () => {
  assert.equal(typeof combat.activationTargets, 'function');
  const s = context();
  assert.deepEqual(combat.activationTargets(s, 'a', policy, 'first', 1), [
    { heroId: 'first', branch: 'primary', distance: 2, moves: 1, stop: 1 },
  ]);
  assert.deepEqual(combat.activationSteps(s, 'a', 'first'), ['b', 'e']);
  assert.deepEqual(combat.activationTargets(s, 'a', policy, 'third', 0), [
    { heroId: 'second', branch: 'primary', distance: 1, moves: 1, stop: 0 },
  ]);
  const fallback = combat.activationTargets(s, 'a', { ...policy, movement: 0 }, 'third', 0);
  assert.deepEqual(fallback, [
    { heroId: 'second', branch: 'alternative', distance: 1, moves: 1, stop: 0 },
  ]);
  assert.equal(s.journey.heroes[0].spaceId, 'ordinary-c');
  s.journey.heroes[1].removed = true;
  assert.deepEqual(combat.activationTargets(s, 'a', policy, 'second', 0), [
    { heroId: 'first', branch: 'alternative', distance: 2, moves: 2, stop: 0 },
  ]);
});

test('activation target randomness is a separate ordered active-company stream', () => {
  assert.equal(typeof combat.selectActivationHero, 'function');
  const streams = { instruction: 17, reduction: 9, target: 0 };
  const chosen = combat.selectActivationHero(['third', 'first', 'second'], 'a'.repeat(64), streams);
  assert.deepEqual(chosen.population, ['third', 'first', 'second']);
  assert.equal(chosen.heroId, chosen.population[chosen.index]);
  assert.equal(chosen.cursorBefore, 0);
  assert.equal(chosen.cursorAfter, streams.target);
  assert.equal(streams.instruction, 17);
  assert.equal(streams.reduction, 9);
  const replay = { instruction: 0, reduction: 0, target: 0 };
  assert.deepEqual(combat.selectActivationHero(chosen.population, 'a'.repeat(64), replay), chosen);
  const invalid = { instruction: 0, reduction: 0, target: -1 };
  assert.throws(() => combat.selectActivationHero(chosen.population, 'a'.repeat(64), invalid));
  assert.equal(invalid.target, -1);
});
