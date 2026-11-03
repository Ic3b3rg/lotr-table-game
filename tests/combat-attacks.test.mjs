import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  compileCombatSource,
  createCombatKernel,
  restoreCombatKernel,
} from '../dist/combat-library.mjs';
import { combatFixture, seedFor, technicalPort } from './fixtures/combat.mjs';
const setup = (port = technicalPort(), source = combatFixture(), seedChanges = {}) => {
  const a = compileCombatSource(source),
    k = createCombatKernel(a, seedFor(a, seedChanges), port);
  k.spawn({ id: 'spawn', spawnId: a.compiled.spawns[0].id });
  return { a, k };
};
const attack = (a, indexes = [0, 1], id = 'attack') => ({
  id,
  heroId: 'hero-2',
  itemCopies: ['sword:1'],
  stat: 'might',
  slots: indexes.map((n) => ({ copyId: 'sword:1', slotId: a.compiled.items[0].slots[n].id })),
});
const apply = (k, plan, id = 'apply') =>
  k.applyPlan({ id, planFingerprint: plan.plan.fingerprint });

test('two equal printed slots spend distinct successes, with no implicit hits for unspent symbols', () => {
  const { a, k } = setup();
  assert.equal(typeof k.planAttack, 'function');
  const plan = k.planAttack(attack(a));
  assert.deepEqual(
    plan.plan.allocations.map((p) => p.successes),
    [['attack/success/0'], ['attack/success/1']],
  );
  assert.equal(plan.plan.hits, 4);
  assert.deepEqual(plan.plan.unspent, ['attack/success/2']);
  assert.deepEqual(
    k.view().group.figures.map((f) => f.health),
    [4, 4],
  );
  const result = apply(k, plan);
  assert.deepEqual(
    k.view().group.figures.map((f) => f.health),
    [2, 4],
  );
  assert.deepEqual(
    k.view().group.figures.map((f) => [f.armor, f.sorcery]),
    [
      [1, 1],
      [1, 1],
    ],
  );
  assert.equal(result.continuation.kind, 'physical');
  assert.equal(result.continuation.cause, 'counterattack');
  assert.equal(result.continuation.heroId, 'hero-2');
  assert.equal(k.view().group.exhausted, true);
  assert.deepEqual(apply(k, plan), result);
  const checkpoint = k.checkpoint();
  assert.deepEqual(restoreCombatKernel(checkpoint).checkpoint(), checkpoint);
  assert.deepEqual(k.planAttack(attack(a, [], 'next')).gates, ['physical-consequences-p2']);
});

test('slot reuse, foreign equipment, duplicate symbols and client-declared results are rejected atomically', () => {
  const { a, k } = setup();
  const before = k.checkpoint();
  for (const input of [
    attack(a, [0, 0]),
    { ...attack(a), itemCopies: ['rare-armor:1'] },
    { ...attack(a), itemCopies: ['sword:2'] },
    { ...attack(a), stat: 'wit' },
    { ...attack(a), successes: 99 },
    { ...attack(a), hits: 99 },
  ])
    assert.throws(() => k.planAttack(input));
  assert.deepEqual(k.checkpoint(), before);
  const duplicate = setup(technicalPort(2, (r) => ({ ...r, successes: ['same', 'same'] })));
  assert.throws(() => duplicate.k.planAttack(attack(duplicate.a)), /duplicat/);
  const poor = setup(technicalPort(1));
  assert.throws(() => poor.k.planAttack(attack(poor.a, [2])), /success/i);
  const forged = setup(technicalPort(2, (r) => ({ ...r, contextFingerprint: '0'.repeat(64) })));
  assert.throws(() => forged.k.planAttack(attack(forged.a)), /contesto/i);
  const noPort = setup({});
  assert.deepEqual(noPort.k.planAttack(attack(noPort.a)).gates, ['attack-controller']);
});

test('zero hits remains an attack and can counterattack while external hits never select an instruction', () => {
  const { a, k } = setup(technicalPort(0));
  const result = apply(k, k.planAttack(attack(a, [])));
  assert.equal(result.hits, 0);
  assert.deepEqual(
    k.view().group.figures.map((f) => f.health),
    [4, 4],
  );
  assert.equal(result.continuation.kind, 'physical');
  const external = setup(technicalPort(0, (r) => r, [{ effectId: 'invented', hits: 0 }]));
  const r = external.k.applyExternal({ id: 'external', effectId: 'invented' });
  assert.equal(r.continuation.kind, 'external-complete');
  assert.equal(external.k.view().selections.length, 0);
  assert.equal(external.k.view().group.exhausted, false);
});

test('pierce skips armor per figure, stun exhausts, and removals yield only one group callback', () => {
  const pierced = setup(technicalPort(2));
  apply(pierced.k, pierced.k.planAttack(attack(pierced.a, [2])));
  assert.deepEqual(
    pierced.k.view().group.figures.map((f) => f.health),
    [0, 4],
  );
  const stunned = setup(technicalPort(2));
  const stun = apply(stunned.k, stunned.k.planAttack(attack(stunned.a, [3])));
  assert.equal(stun.continuation.kind, 'after-attack');
  assert.equal(stun.continuation.reason, 'stun');
  assert.equal(stunned.k.view().group.exhausted, true);
  assert.deepEqual(
    stunned.k.view().group.figures.map((f) => f.health),
    [3, 4],
  );
  const external = setup(
    technicalPort(0, (r) => r, [
      { effectId: 'first', hits: 7 },
      { effectId: 'last', hits: 6 },
    ]),
  );
  external.k.applyExternal({ id: 'external-1', effectId: 'first' });
  assert.deepEqual(
    external.k.view().group.figures.map((f) => f.health),
    [0, 4],
  );
  assert.equal(external.k.view().availability.inPlay, 1);
  assert.equal(external.k.view().callbacks.length, 0);
  const callback = external.k.applyExternal({ id: 'external-2', effectId: 'last' });
  assert.equal(callback.continuation.kind, 'scenario-callback');
  assert.equal(callback.continuation.cause, 'external-effect');
  assert.equal(callback.continuation.event, 'DEFEATED');
  assert.equal(external.k.view().availability.inPlay, 0);
  assert.equal(external.k.view().callbacks.length, 1);
  assert.equal('lore' in external.k.view(), false);
  assert.equal('inspiration' in external.k.view(), false);
  assert.deepEqual(external.k.applyExternal({ id: 'external-2', effectId: 'last' }), callback);
  assert.equal(external.k.view().callbacks.length, 1);
});

test('required hooks gate before adapter or slot spending, and late result hooks also remain explicit', () => {
  const source = combatFixture(),
    a = compileCombatSource(source),
    seed = seedFor(a);
  seed.heroes[0].requiredHooks = ['persistent-attack-hooks'];
  let reads = 0;
  const k = createCombatKernel(a, seed, {
    attackResult() {
      reads++;
      throw new Error('must not read');
    },
  });
  k.spawn({ id: 'spawn', spawnId: a.compiled.spawns[0].id });
  const before = k.checkpoint();
  assert.deepEqual(k.planAttack(attack(a)).gates, ['persistent-attack-hooks']);
  assert.equal(reads, 0);
  assert.deepEqual(k.checkpoint(), before);
  const late = setup(technicalPort(2, (r) => ({ ...r, requiredHooks: ['attack-windows'] })));
  assert.deepEqual(late.k.planAttack(attack(late.a)).gates, ['attack-windows']);
  assert.equal(late.k.view().pendingPlan, null);
});
