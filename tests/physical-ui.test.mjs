import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as lib from '../dist/physical-resolution-library.mjs';

const active = {
  kind: 'prevent',
  runId: '00000000-0000-4000-8000-000000000001',
  child: 0,
  grant: 0,
  authorizationId: 'invented-budget',
  actorHeroId: 'hero-2',
  actorPlayerId: 'actor',
  heroId: 'hero-1',
  remaining: { damage: 3, fear: 2 },
  budget: 2,
  creditCost: 1,
};
const session = () => ({
  scenario: {
    id: 'scenario',
    packFingerprint: 'pack',
    projectionFingerprint: 'projection',
    pending: {
      id: 'pending',
      kind: 'physical',
      fingerprint: 'source',
      heroId: 'hero-2',
      physical: { parentId: active.runId, child: 0, grant: 0 },
    },
  },
  physical: { active },
});
test('physical UI answers bind the current source and contain only allocations', () => {
  assert.equal(typeof lib.bindPhysicalAnswer, 'function');
  const command = lib.bindPhysicalAnswer(session(), { damage: 1, fear: 1 });
  assert.equal(command.type, 'SCENARIO_INPUT');
  assert.equal(command.heroId, 'hero-2');
  assert.equal(command.pendingId, 'pending');
  assert.equal(command.sourceFingerprint, 'source');
  assert.deepEqual(command.input, { kind: 'physical-prevent', damage: 1, fear: 1 });
  assert.ok(!('program' in command));
  assert.ok(!('target' in command));
  for (const edit of [
    (s) => {
      s.scenario.pending.physical.child = 1;
    },
    (s) => {
      s.scenario.pending.kind = 'test';
    },
    (s) => {
      s.scenario.pending = null;
    },
  ]) {
    const s = session();
    edit(s);
    assert.throws(() => lib.bindPhysicalAnswer(s, { damage: 1, fear: 1 }));
  }
});
test('physical allocation UI distinguishes optional prevention from mandatory exact discard', () => {
  assert.equal(typeof lib.physicalAllocationProblem, 'function');
  assert.equal(lib.physicalAllocationProblem(active, { damage: 0, fear: 0 }), null);
  assert.equal(lib.physicalAllocationProblem(active, { damage: 1, fear: 1 }), null);
  for (const counts of [
    { damage: 3, fear: 0 },
    { damage: -1, fear: 1 },
    { damage: 0.5, fear: 0 },
  ])
    assert.ok(lib.physicalAllocationProblem(active, counts));
  const discard = {
    ...active,
    kind: 'discard',
    count: 2,
    minimum: 2,
    available: { damage: 2, fear: 1 },
    families: ['damage', 'fear'],
  };
  assert.ok(lib.physicalAllocationProblem(discard, { damage: 0, fear: 0 }));
  assert.equal(lib.physicalAllocationProblem(discard, { damage: 1, fear: 1 }), null);
  assert.ok(lib.physicalAllocationProblem(discard, { damage: 0, fear: 2 }));
});

test('P1 UI binds a typed decision to its precise source cursor without hidden state', () => {
  const s = session();
  s.physical.active = {
    ...active,
    kind: 'decision',
    cursor: 'c'.repeat(64),
    mode: 'choose',
    title: 'Scelta inventata',
    options: [
      { id: '0', label: 'Scarta una preparata' },
      { id: '1', label: 'Subisci' },
    ],
    minimum: 1,
    maximum: 1,
    remaining: { damage: 0, fear: 0 },
  };
  s.scenario.pending.physical = {
    parentId: active.runId,
    child: 0,
    grant: null,
    cursor: 'c'.repeat(64),
  };
  assert.equal(typeof lib.bindPhysicalDecision, 'function');
  const intent = lib.bindPhysicalDecision(s, { kind: 'physical-choice', option: '0' });
  assert.deepEqual(intent.input, { kind: 'physical-choice', option: '0' });
  assert.equal(intent.sourceFingerprint, 'source');
  s.scenario.pending.physical.cursor = 'd'.repeat(64);
  assert.throws(() => lib.bindPhysicalDecision(s, { kind: 'physical-choice', option: '0' }));
});
