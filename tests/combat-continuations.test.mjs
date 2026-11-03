import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as combat from '../dist/combat-library.mjs';
import { combatFixture, seedFor, technicalPort, rehashAsset } from './fixtures/combat.mjs';
import { hash } from './fixtures/map-freeze.mjs';
const setup = (port = technicalPort(0), source = combatFixture(), seed = {}) => {
  const a = combat.compileCombatSource(source),
    k = combat.createCombatKernel(a, seedFor(a, seed), port);
  k.spawn({ id: 'spawn', spawnId: a.compiled.spawns[0].id });
  return { a, k };
};
const attack = (k, id = 'attack', slots = []) => {
  const a = k.checkpoint().artifact;
  const plan = k.planAttack({
    id,
    heroId: 'hero-2',
    itemCopies: ['sword:1'],
    stat: 'might',
    slots: slots.map((n) => ({ copyId: 'sword:1', slotId: a.compiled.items[0].slots[n].id })),
  });
  return k.applyPlan({ id: `${id}/apply`, planFingerprint: plan.plan.fingerprint });
};

test('counter selects before range from current size, with a fixed attacking hero and no redraw after retry', () => {
  const s = combatFixture(),
    far = s.projection.spaces[1].id;
  const { k } = setup(
    technicalPort(0, (r) => ({ ...r, afterTest: { spaceId: far, defeated: false } })),
    s,
  );
  const receipt = attack(k);
  assert.equal(receipt.continuation.kind, 'after-attack');
  assert.equal(receipt.continuation.reason, 'out-of-range');
  assert.equal(receipt.continuation.selection.heroId, 'hero-2');
  assert.equal(receipt.continuation.selection.population.length, 3);
  assert.equal(k.view().group.exhausted, false);
  const checkpoint = k.checkpoint();
  assert.deepEqual(combat.restoreCombatKernel(checkpoint).checkpoint(), checkpoint);
  assert.deepEqual(
    k.applyPlan({
      id: 'attack/apply',
      planFingerprint: checkpoint.journal[1].receipt.plan.fingerprint,
    }),
    receipt,
  );
  assert.equal(k.view().selections.length, 1);
  for (const mutate of [
    (c) => {
      c.state.selections[0].population.pop();
    },
    (c) => {
      c.state.selections[0].index++;
    },
    (c) => {
      c.state.randomCursor++;
    },
    (c) => {
      c.journal[2].receipt.continuation.selection.heroId = 'someone-else';
    },
  ]) {
    const bad = structuredClone(checkpoint);
    mutate(bad);
    const { fingerprint, ...data } = bad;
    bad.fingerprint = hash(data);
    assert.throws(() => combat.restoreCombatKernel(bad));
  }
});

test('enemy ranged trait uses the frozen movement graph for the same counterattack recipient', () => {
  const source = combatFixture(),
    home = source.projection.spaces[0].id;
  const edge = source.projection.movementGraph.edges.find((e) => e.a === home || e.b === home);
  const adjacent = edge.a === home ? edge.b : edge.a;
  source.assets[0].data.Traits = 1024;
  rehashAsset(source.assets[0]);
  const { k } = setup(
    technicalPort(0, (r) => ({ ...r, afterTest: { spaceId: adjacent, defeated: false } })),
    source,
  );
  assert.equal(attack(k).continuation.kind, 'physical');
});

test('a surviving single figure uses the reduced population without deleting the benefit candidate', () => {
  const { a, k } = setup(technicalPort(0, (r) => r, [{ effectId: 'remove-one', hits: 6 }]));
  k.applyExternal({ id: 'remove', effectId: 'remove-one' });
  const receipt = attack(k);
  const selection = receipt.continuation.selection;
  assert.equal(selection.size, 1);
  assert.deepEqual(
    selection.population.map((p) => p.source),
    a.compiled.instructions.slice(0, 2).map((i) => i.source),
  );
  assert.equal(
    selection.population.some((p) => p.source === a.compiled.instructions[1].source),
    true,
  );
});

test('provocation retains its movement/interact continuation and never exhausts a ready group', () => {
  const { k } = setup();
  const input = {
    id: 'provoke',
    heroId: 'hero-2',
    returnTo: { kind: 'movement', id: 'journey-original' },
  };
  const r = k.provoke(input);
  assert.equal(r.continuation.kind, 'physical');
  assert.equal(r.continuation.cause, 'provocation');
  assert.deepEqual(r.continuation.returnTo, input.returnTo);
  assert.equal(k.view().group.exhausted, false);
  assert.deepEqual(k.provoke(input), r);
  assert.deepEqual(combat.restoreCombatKernel(k.checkpoint()).checkpoint(), k.checkpoint());
  const stunned = setup(technicalPort(2));
  attack(stunned.k, 'stun', [3]);
  assert.equal(stunned.k.provoke(input).continuation.reason, 'exhausted');
  const second = attack(stunned.k, 'already-exhausted', []);
  assert.equal(second.continuation.reason, 'exhausted');
  assert.equal(stunned.k.view().selections.length, 0);
});

test('an attack interrupting activation returns its retained instruction without selecting a counterattack', () => {
  const s = combatFixture(),
    a = combat.compileCombatSource(s);
  const activation = { instructionSource: a.compiled.instructions[1].source, heroId: 'hero-2' };
  const { k } = setup(technicalPort(0), s, { activation });
  const r = attack(k);
  assert.equal(r.continuation.kind, 'resume-activation');
  assert.deepEqual(r.continuation.activation, activation);
  assert.equal(k.view().selections.length, 0);
});

test('capability separates the executable kernel from the missing original consumers before costs', () => {
  assert.equal(typeof combat.combatCapability, 'function');
  const { a, k } = setup();
  const before = k.checkpoint();
  const result = combat.combatCapability(a, {
    operation: 'original-attack',
    heroId: 'hero-2',
    shadowReached: false,
  });
  assert.equal(result.runtimeReady, false);
  assert.equal(result.kernelReady, true);
  for (const gate of [
    'attack-controller',
    'attack-windows',
    'persistent-attack-hooks',
    'physical-consequences-p2',
    'scenario-continuation',
    'boon-quantities-57',
  ])
    assert.equal(result.missing.includes(gate), true, gate);
  assert.equal(result.implemented.includes('figure-hits'), true);
  assert.equal(result.missing.includes('shadow-runtime'), false);
  assert.equal(
    combat
      .combatCapability(a, { operation: 'original-attack', heroId: 'hero-2', shadowReached: true })
      .missing.includes('shadow-runtime'),
    true,
  );
  assert.equal(combat.combatCapability(a, { operation: 'kernel' }).enabled, true);
  assert.deepEqual(k.checkpoint(), before);
});
