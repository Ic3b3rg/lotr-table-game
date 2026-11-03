import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as combat from '../dist/combat-library.mjs';
import { combatFixture, rehashAsset } from './fixtures/combat.mjs';
import { hash } from './fixtures/map-freeze.mjs';

test('compiler derives spawn, ordered slots and full instruction population from source fields', () => {
  assert.equal(typeof combat.compileCombatSource, 'function');
  const source = combatFixture(),
    a = combat.compileCombatSource(source);
  assert.equal(a.format, 'combat-artifact-v1');
  assert.deepEqual(a.compiled.enemy.stats, { health: 4, armor: 1, sorcery: 1 });
  assert.equal(a.compiled.spawns[0].size, 2);
  assert.equal(a.compiled.spawns[0].cost, 9);
  assert.equal(a.compiled.spawns[0].points, 9);
  assert.deepEqual(
    a.compiled.spawns[0].position.nodePosition,
    source.projection.spaces[0].nodePosition,
  );
  assert.equal(a.compiled.items[0].slots.length, 4);
  assert.notEqual(a.compiled.items[0].slots[0].id, a.compiled.items[0].slots[1].id);
  assert.deepEqual(
    a.compiled.items[0].slots.slice(0, 2).map(({ cost, hits }) => [cost, hits]),
    [
      [1, 2],
      [1, 2],
    ],
  );
  assert.equal(a.compiled.instructions.length, 3);
  assert.equal(a.compiled.instructions[1].addition.kind, 'gain-boon');
  assert.deepEqual(combat.verifyCombatArtifact(a), a);
});

test('compiler rejects forged fields, unknown instructions, broken references and ambiguous identities', () => {
  const source = combatFixture();
  for (const mutate of [
    (s) => {
      s.extra = 1;
    },
    (s) => {
      s.manifest.difficulty = 'hard';
    },
    (s) => {
      s.assets.push(structuredClone(s.assets[0]));
    },
    (s) => {
      s.assets[0].data.Health = 0;
      rehashAsset(s.assets[0]);
    },
    (s) => {
      s.assets[0].data.Activations.pop();
      rehashAsset(s.assets[0]);
    },
    (s) => {
      s.fsms[0].states[0].actions[0].type = 'Unknown.Run';
    },
    (s) => {
      s.fsms[0].states[0].actions[0].parameters.GroupSize.value = 1;
    },
    (s) => {
      s.fsms[0].states[0].actions[0].parameters.Logic.value.m_PathID++;
      s.fsms[0].states[0].actions[0].parameterHash = hash(
        s.fsms[0].states[0].actions[0].parameters,
      );
    },
    (s) => {
      s.items[0].cells.K = '1 Success: 8 hits, arbitrary';
    },
    (s) => {
      s.items[0].cells.G = 'Luck';
    },
    (s) => {
      s.additions[0].textHash = '0'.repeat(64);
    },
    (s) => {
      s.manifest.mechanics.pop();
    },
  ]) {
    const bad = structuredClone(source);
    mutate(bad);
    assert.throws(() => combat.compileCombatSource(bad));
  }
  const a = combat.compileCombatSource(source);
  a.compiled.spawns[0].points++;
  assert.throws(() => combat.verifyCombatArtifact(a));
});

test('compiler refuses getters before reading them and validates live variable bindings', () => {
  let calls = 0;
  const source = combatFixture();
  Object.defineProperty(source, 'projection', {
    enumerable: true,
    get() {
      calls++;
      throw new Error('getter executed');
    },
  });
  assert.throws(() => combat.compileCombatSource(source), /Accessor/);
  assert.equal(calls, 0);
  const bound = combatFixture(),
    action = bound.fsms[0].states[0].actions[0];
  bound.fsms[0].variables.push({ name: 'count', type: 'int', value: 2 });
  action.parameters.GroupSize = {
    kind: 'binding',
    scope: 'local',
    name: 'count',
    type: 'intVariables',
    initial: 2,
    serializedSample: 91,
    serializedUseVariable: false,
  };
  action.parameterHash = hash(action.parameters);
  assert.equal(combat.compileCombatSource(bound).compiled.spawns[0].size, 2);
  bound.fsms[0].variables[0].value = 3;
  assert.throws(() => combat.compileCombatSource(bound), /binding/i);
});

test('FSM evidence must identify the same native object as the linked component', () => {
  const source = combatFixture();
  source.fsms[1].objectHash = '0'.repeat(64);
  assert.throws(() => combat.compileCombatSource(source), /FSM.*oggetto/i);
});

test('bounded input rejects cycles, non JSON objects, sparse arrays and oversized strings', () => {
  for (const value of [new Date(), 3n, undefined, Array(2), 'x'.repeat(16385)])
    assert.throws(() => combat.compileCombatSource(value));
  const cycle = {};
  cycle.self = cycle;
  assert.throws(() => combat.compileCombatSource(cycle), /Ciclo/);
  const source = combatFixture();
  source.assets[0].data.Health = -1;
  rehashAsset(source.assets[0]);
  assert.throws(() => combat.compileCombatSource(source), /Salute/);
});

test('unknown equipment categories never silently lose mechanics', () => {
  const unknown = combatFixture();
  unknown.items[0].cells.C = 'Unrecognized';
  assert.throws(() => combat.compileCombatSource(unknown), /Categoria/);
});

test('extra uncompiled enemy models are refused at the source boundary', () => {
  const extra = combatFixture(),
    model = structuredClone(extra.assets[0]);
  model.source = 'invented.assets:999999';
  extra.assets.push(model);
  assert.throws(() => combat.compileCombatSource(extra), /EnemyModel/);
});
