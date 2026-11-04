import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compileCombatClosure,
  verifyCombatClosure,
  groupAttackPacket,
} from '../dist/combat-library.mjs';
import { closureFixture, groupFixture } from './fixtures/combat-closure.mjs';
import { digest } from '../dist/map-freeze-library.mjs';
import { attachActivationSource } from './fixtures/shadow-activations.mjs';

test('optional activation closure binds instruction keys, policies and company without changing legacy artifacts', () => {
  const legacy = compileCombatClosure(closureFixture());
  assert.equal(legacy.source.shadow, undefined);
  assert.equal(legacy.compiled.models[0].instructions[0].activation, undefined);
  assert.deepEqual(verifyCombatClosure(legacy), legacy);
  const source = attachActivationSource(closureFixture());
  const a = compileCombatClosure(source);
  const i = a.compiled.models[0].instructions[0];
  assert.equal(i.activation.movement, 1);
  assert.equal(i.activation.randomHero, true);
  assert.equal(i.activation.primary.key, 'primary');
  assert.equal(i.activation.interrupted.key, 'interrupted');
  assert.deepEqual(verifyCombatClosure(a), a);
  for (const mutate of [
    (s) => s.shadow.instructions.pop(),
    (s) => s.shadow.instructions.push(s.shadow.instructions[0]),
    (s) => (s.shadow.companyFingerprint = 'a'.repeat(64)),
    (s) => (s.assets.find((a) => a.cls === 'EnemyActivationModel').data.KeyActivation = 'missing'),
    (s) => (s.shadow.controller.enemyPointsPerHero = 1),
  ]) {
    const bad = structuredClone(source);
    mutate(bad);
    assert.throws(() => compileCombatClosure(bad));
  }
});

test('primary activation reduces normal and elite executed packets without redrawing retained instructions', () => {
  const a = compileCombatClosure(attachActivationSource(closureFixture()));
  const selected = a.compiled.models[0].instructions[1];
  for (const bonuses of [[], groupFixture().bonuses]) {
    const g = groupFixture();
    g.figures = g.figures.slice(0, 1);
    g.bonuses = bonuses;
    g.attackReduction = 50;
    const streams = { instruction: 4, reduction: 0, target: 7 };
    const packet = groupAttackPacket(
      a,
      g,
      { model: g.source, groupId: g.id, source: selected.source, fingerprint: digest(selected) },
      'activation',
      'a'.repeat(64),
      streams,
    );
    assert.equal(packet.size, 1);
    assert.equal(packet.damage + packet.fear, 1);
    assert.equal(streams.instruction, 4);
    assert.equal(streams.target, 7);
    assert.equal(g.attackReduction, 50, 'packet calculation does not count an unexecuted attack');
  }
});
