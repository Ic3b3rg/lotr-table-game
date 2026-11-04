import test from 'node:test';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import * as combat from '../dist/combat-library.mjs';
import { closureFixture, groupFixture } from './fixtures/combat-closure.mjs';
import { digest } from '../dist/map-freeze-library.mjs';

test('closure compiler retains ordered instructions, resume rows, separate modifier mask and bonuses', () => {
  const a = combat.compileCombatClosure(closureFixture());
  assert.equal(combat.verifyCombatClosure(a).fingerprint, a.fingerprint);
  assert.deepEqual(
    a.compiled.models[0].instructions.map((i) => i.source),
    ['fixture.assets:50', 'fixture.assets:51'],
  );
  assert.equal(a.compiled.bonuses[0].blocked.includes('stun'), true);
  assert.equal(a.compiled.bonuses[0].blocked.includes('pierce'), false);
  assert.equal(a.compiled.items[0].slots.length, 2);
  const bad = structuredClone(a);
  bad.compiled.models[0].instructions.reverse();
  bad.fingerprint = digest({ source: bad.source, compiled: bad.compiled });
  assert.throws(() => combat.verifyCombatClosure(bad));
});

test('instruction precedes range and survives a smaller current size without redraw; progressive reduction has own stream', () => {
  const a = combat.compileCombatClosure(closureFixture());
  const group = groupFixture();
  const streams = { instruction: 0, reduction: 0 };
  const s = combat.selectGroupInstruction(a, group, 'invented-entropy', streams);
  assert.equal(s.population.length, 2);
  assert.equal(streams.instruction, 1);
  assert.equal(streams.reduction, 0);
  const chosen = {
    ...s,
    source: 'fixture.assets:51',
    fingerprint: digest(a.compiled.models[0].instructions[1]),
  };
  group.figures[1].health = 0;
  const packet = combat.groupAttackPacket(
    a,
    group,
    chosen,
    'counterattack',
    'invented-entropy',
    streams,
  );
  assert.deepEqual(packet.offered, { damage: 3, fear: 1 });
  assert.equal(streams.instruction, 1);
  group.attackReduction = 3;
  const reduced = combat.groupAttackPacket(
    a,
    group,
    chosen,
    'counterattack',
    'invented-entropy',
    streams,
  );
  assert.equal(reduced.damage + reduced.fear, 1);
  assert.equal(reduced.reductions.length, 3);
  assert.equal(group.attackReduction, 3);
  const provoke = combat.groupAttackPacket(
    a,
    group,
    chosen,
    'provocation',
    'invented-entropy',
    streams,
  );
  assert.deepEqual({ damage: provoke.damage, fear: provoke.fear }, packet.offered);
});

test('shared figure primitive keeps paid hits under immunity, restores surviving defenses, and removes once', () => {
  const a = combat.compileCombatClosure(closureFixture());
  const group = groupFixture();
  const r = combat.applyGroupHits(a, group, 4, ['stun']);
  assert.equal(group.exhausted, false);
  assert.equal(group.figures[0].health, 1);
  assert.equal(group.figures[0].armor, 1);
  assert.equal(r.applied, 3);
  const kill = combat.applyGroupHits(a, group, 30, ['pierce']);
  assert.equal(kill.defeated, true);
  assert.equal(kill.removed.length, 2);
  assert.equal(combat.applyGroupHits(a, group, 30, []).defeated, false);
});

test('full preflight distinguishes mandatory acquisition from known absence consumption and never filters candidates', () => {
  const source = closureFixture();
  source.additions[0].effect = { op: 'lose-boon-or-weakness', boon: 'determined' };
  const a = combat.compileCombatClosure(source);
  assert.deepEqual(
    combat.preflightCombatGroup(a, groupFixture(), { boons: [], quantities: null }),
    [],
  );
  source.additions[0].effect = { op: 'gain-boon', boon: 'hidden' };
  const gated = combat.compileCombatClosure(source);
  assert.deepEqual(
    combat.preflightCombatGroup(gated, groupFixture(), { boons: [], quantities: null }),
    ['boon-quantities-57'],
  );
  assert.equal(gated.compiled.models[0].instructions.length, 2);
});

test('untrusted accessor rejected before execution and closure omission refused', () => {
  let calls = 0;
  const source = closureFixture();
  Object.defineProperty(source, 'assets', {
    get() {
      calls++;
      return [];
    },
    enumerable: true,
  });
  assert.throws(() => combat.compileCombatClosure(source));
  assert.equal(calls, 0);
  const missing = closureFixture();
  missing.assets = missing.assets.filter((a) => a.source !== 'fixture.assets:51');
  assert.throws(() => combat.compileCombatClosure(missing));
});

test('native stat symbols share the existing compiler namespace, including Might and Spirit', () => {
  for (const [icon, stat] of [
    ['\uf463', 'might'],
    ['\uf462', 'agility'],
    ['\uf461', 'spirit'],
  ]) {
    const source = closureFixture();
    const t = source.texts[0];
    t.value = `Invented instruction (${icon} negates).`;
    t.sha256 = createHash('sha256').update(t.value).digest('hex');
    assert.equal(
      combat.compileCombatClosure(source).compiled.models[0].instructions[0].negate,
      stat,
    );
  }
});

test('boon supply keeps unknown availability distinct from an empty verified supply and known absent possession', () => {
  assert.deepEqual(combat.boonSupply(null, [], 'hidden'), { status: 'unknown', available: null });
  assert.deepEqual(combat.boonSupply({ hidden: 0, determined: 0, emboldened: 0 }, [], 'hidden'), {
    status: 'empty',
    available: 0,
  });
  assert.deepEqual(
    combat.boonSupply(
      { hidden: 2, determined: 0, emboldened: 0 },
      [{ heroId: 'invented-owner', kind: 'hidden' }],
      'hidden',
    ),
    { status: 'available', available: 1 },
  );
  assert.throws(() =>
    combat.boonSupply(
      { hidden: 0, determined: 0, emboldened: 0 },
      [{ heroId: 'invented-owner', kind: 'hidden' }],
      'hidden',
    ),
  );
});
