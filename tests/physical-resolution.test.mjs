import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  freezePhysical,
  openPhysical,
  answerPhysical,
  validatePhysical,
  physicalView,
} from '../dist/physical-resolution-library.mjs';
import {
  binding,
  participants,
  source,
  program,
  suffer,
  grant,
  discard,
  diagnosticRaw,
  evidence,
} from './fixtures/physical-resolution.mjs';
import { requirePhysicalFamily } from '../dist/physical-content-library.mjs';

const fresh = () => freezePhysical(diagnosticRaw(), binding, participants, '1'.repeat(64));
const count = (p) =>
  Object.values(p.snapshot.decks).flat().length +
  p.snapshot.areas.flatMap((h) => [...h.damage, ...h.fear]).length;

test('freezes raw independent families, 56 copies and a private reproducible physical stream', () => {
  const p = fresh();
  assert.equal(p.snapshot.decks.damage.length, 28);
  assert.equal(p.snapshot.decks.fear.length, 28);
  assert.equal(count(p), 56);
  assert.deepEqual(p, freezePhysical(diagnosticRaw(), binding, participants, '1'.repeat(64)));
  assert.notDeepEqual(
    p.snapshot.decks,
    freezePhysical(diagnosticRaw(), binding, participants, '2'.repeat(64)).snapshot.decks,
  );
  assert.doesNotThrow(() => validatePhysical(p));
  assert.throws(() =>
    freezePhysical(requirePhysicalFamily(diagnosticRaw(), 'damage'), binding, participants),
  );
  const view = JSON.stringify(physicalView(p));
  for (const forbidden of [
    'invented-damage-',
    'invented-fear-',
    'entropy',
    'raw',
    'ordinal',
    'sha256',
  ])
    assert.ok(!view.includes(forbidden), forbidden);
});

test('all 32 parents can complete 32 children without exhausting the random journal', () => {
  const p = fresh();
  const pr = program(Array.from({ length: 16 }, () => [suffer(0, 1, 1), discard(0, 2)]).flat());
  for (let n = 0; n < 32; n++) {
    openPhysical(p, { ...source, effectId: `principal:${n}:0`, entry: n }, pr);
    assert.equal(count(p), 56);
    assert.equal(p.snapshot.parents[n].completedChildren, 32);
    assert.equal(p.snapshot.parents[n].returnCount, 1);
    assert.equal(p.snapshot.parents[n].status, 'completed');
  }
  assert.equal(p.snapshot.random.length, 1026);
  assert.equal(p.snapshot.decks.damage.length, 28);
  assert.equal(p.snapshot.decks.fear.length, 28);
  assert.equal(p.snapshot.active, null);
  assert.doesNotThrow(() => validatePhysical(JSON.parse(JSON.stringify(p))));
});

test('a source parent suspends for authorized cross-hero allocation then resolves children and returns once', () => {
  const p = fresh(),
    initial = structuredClone(p.snapshot.decks);
  const id = openPhysical(p, source, program());
  assert.equal(p.snapshot.active.kind, 'prevent');
  assert.equal(p.snapshot.active.actorPlayerId, participants[1].playerId);
  assert.equal(p.snapshot.active.heroId, participants[0].heroId);
  assert.equal(count(p), 56);
  assert.throws(() =>
    answerPhysical(p, id, { kind: 'physical-prevent', damage: 3, fear: 0 }, evidence()),
  );
  assert.throws(() =>
    answerPhysical(
      p,
      id,
      { kind: 'physical-prevent', damage: 1, fear: 1 },
      evidence(0, participants[0].playerId),
    ),
  );
  answerPhysical(p, id, { kind: 'physical-prevent', damage: 1, fear: 1 }, evidence());
  assert.equal(p.snapshot.credits[1], 0);
  assert.equal(p.snapshot.parents[0].completedChildren, 2);
  assert.equal(p.snapshot.active.kind, 'discard');
  assert.deepEqual(p.snapshot.areas[0].damage, initial.damage.slice(0, 2));
  assert.deepEqual(p.snapshot.areas[0].fear, initial.fear.slice(0, 1));
  const serialized = JSON.stringify(p);
  assert.doesNotThrow(() => validatePhysical(JSON.parse(serialized)));
  answerPhysical(
    p,
    id,
    { kind: 'physical-discard', damage: 1, fear: 1 },
    evidence(1, participants[0].playerId),
  );
  assert.equal(p.snapshot.parents[0].status, 'completed');
  assert.equal(p.snapshot.parents[0].returnCount, 1);
  assert.equal(p.snapshot.active, null);
  assert.equal(p.snapshot.areas[0].damage.length, 1);
  assert.equal(p.snapshot.areas[0].fear.length, 0);
  assert.equal(p.snapshot.decks.damage.length, 26);
  assert.equal(p.snapshot.decks.fear.at(-1), initial.fear[0]);
  assert.equal(count(p), 56);
  assert.throws(() =>
    answerPhysical(p, id, { kind: 'physical-discard', damage: 1, fear: 1 }, evidence(2)),
  );
  assert.throws(() => openPhysical(p, source, program()));
  assert.doesNotThrow(() => validatePhysical(p));
  const publicText = JSON.stringify(physicalView(p));
  for (const card of diagnosticRaw().cards.filter((c) => ['damage', 'fear'].includes(c.family))) {
    assert.ok(!publicText.includes(card.id));
    assert.ok(!publicText.includes(card.name.value));
  }
});

test('zero, fully prevented and automatic discards finish without empty confirmations', () => {
  const p = fresh();
  const id = openPhysical(
    p,
    source,
    program([suffer(0, 0, 0), suffer(0, 1, 1, [grant()]), discard(2, 3)]),
  );
  assert.equal(p.snapshot.parents[0].completedChildren, 1);
  answerPhysical(p, id, { kind: 'physical-prevent', damage: 1, fear: 1 }, evidence());
  assert.equal(p.snapshot.parents[0].status, 'completed');
  assert.equal(p.snapshot.parents[0].results.length, 3);
  assert.equal(p.snapshot.decks.damage.length, 28);
  assert.equal(p.snapshot.decks.fear.length, 28);
  assert.equal(count(p), 56);
});

test('unavailable faceup, effective limits and last stand remain precise suspended gates', () => {
  for (const [edit, reason] of [
    [
      (pr) => {
        pr.children[0].face = 'faceup';
      },
      'faceup-handler-unavailable',
    ],
    [
      (pr) => {
        pr.limits[0] = { kind: 'requires-capability', capability: 'invented-passive' };
      },
      'effective-limits-unavailable',
    ],
    [
      (pr) => {
        pr.limits[0].damage = 1;
      },
      'last-stand-unavailable',
    ],
  ]) {
    const p = fresh(),
      pr = program([suffer(0, 1, 0)]);
    edit(pr);
    openPhysical(p, source, pr);
    assert.equal(p.snapshot.active.kind, 'gate');
    assert.equal(p.snapshot.active.reason, reason);
    assert.equal(p.snapshot.parents[0].returnCount, 0);
    assert.equal(count(p), 56);
    assert.doesNotThrow(() => validatePhysical(p));
  }
});

test('a truly empty required deck suspends on the exact missing draw and retains paid cost', () => {
  const p = fresh(),
    pr = program([suffer(0, 29, 0, [grant(1, 1)])]);
  const id = openPhysical(p, source, pr);
  answerPhysical(p, id, { kind: 'physical-prevent', damage: 0, fear: 0 }, evidence());
  assert.equal(p.snapshot.active.reason, 'required-deck-empty');
  assert.equal(p.snapshot.active.remaining.damage, 1);
  assert.equal(p.snapshot.areas[0].damage.length, 28);
  assert.equal(p.snapshot.decks.damage.length, 0);
  assert.equal(count(p), 56);
  assert.doesNotThrow(() => validatePhysical(p));
  const paid = fresh(),
    id2 = openPhysical(paid, source, program([suffer(0, 30, 0, [grant(1, 1)])]));
  answerPhysical(paid, id2, { kind: 'physical-prevent', damage: 1, fear: 0 }, evidence());
  assert.equal(paid.snapshot.credits[1], 0);
  assert.equal(paid.snapshot.active.reason, 'required-deck-empty');
  assert.doesNotThrow(() => validatePhysical(paid));
});

test('replay rejects missing/duplicated copies, skipped children, altered randomness/costs and journal erasure', () => {
  const p = fresh(),
    id = openPhysical(p, source, program());
  answerPhysical(p, id, { kind: 'physical-prevent', damage: 1, fear: 0 }, evidence());
  for (const edit of [
    (x) => x.snapshot.decks.damage.pop(),
    (x) => x.snapshot.decks.fear.push(x.snapshot.decks.fear[0]),
    (x) => {
      x.snapshot.parents[0].completedChildren++;
    },
    (x) => {
      x.snapshot.random[0].indices[0] = 99;
    },
    (x) => {
      x.entropy = 'f'.repeat(64);
    },
    (x) => {
      x.snapshot.credits[1]++;
    },
    (x) => {
      x.runs[0].answers = [];
    },
  ]) {
    const changed = structuredClone(p);
    edit(changed);
    assert.throws(() => validatePhysical(changed));
  }
});

test('multiple source grants have independent owners, costs and residual budgets', () => {
  const p = fresh(),
    g2 = { ...grant(2, 1), id: 'second-invented-authorization' };
  const id = openPhysical(p, source, program([suffer(0, 2, 2, [grant(), g2])]));
  answerPhysical(p, id, { kind: 'physical-prevent', damage: 1, fear: 1 }, evidence());
  assert.equal(p.snapshot.active.actorPlayerId, participants[2].playerId);
  assert.deepEqual(p.snapshot.active.remaining, { damage: 1, fear: 1 });
  assert.equal(p.snapshot.credits[1], 0);
  answerPhysical(
    p,
    id,
    { kind: 'physical-prevent', damage: 0, fear: 1 },
    evidence(1, participants[2].playerId),
  );
  assert.equal(p.snapshot.credits[2], 0);
  assert.equal(p.snapshot.areas[0].damage.length, 1);
  assert.equal(p.snapshot.areas[0].fear.length, 0);
  assert.equal(p.snapshot.parents[0].results[0].costs.length, 2);
  assert.equal(count(p), 56);
});

test('typed bounds and source target constraints reject arbitrary values without changing state', () => {
  for (const edit of [
    (pr) => {
      pr.children[0].hero = 4;
    },
    (pr) => {
      pr.children[0].cards[0].amount = -1;
    },
    (pr) => {
      pr.children[0].cards[0].amount = 57;
    },
    (pr) => {
      pr.children[0].cards[0].amount = 1.5;
    },
    (pr) => {
      pr.children[0].cards[0].amount = '3';
    },
    (pr) => {
      pr.children[0].prevention[0].actor = 4;
    },
    (pr) => {
      pr.children[0].origin = 'client';
    },
  ]) {
    const p = fresh(),
      before = structuredClone(p),
      pr = program();
    edit(pr);
    assert.throws(() => openPhysical(p, source, pr));
    assert.deepEqual(p, before);
  }
  const p = fresh(),
    id = openPhysical(p, source, program()),
    before = structuredClone(p);
  for (const input of [
    { kind: 'physical-prevent', damage: -1, fear: 0 },
    { kind: 'physical-prevent', damage: 0.5, fear: 0 },
    { kind: 'physical-prevent', damage: 0, fear: 0, hero: 2 },
    { kind: 'physical-discard', damage: 0, fear: 0 },
    { kind: 'ack' },
  ]) {
    assert.throws(() => answerPhysical(p, id, input, evidence()));
    assert.deepEqual(p, before);
  }
});

test('unaffordable or distant synthetic contributions never grant original Protection', () => {
  for (const setup of ['unaffordable', 'distant']) {
    const heroes = structuredClone(participants),
      pr = program([suffer(0, 1, 0, [grant()])]);
    if (setup === 'distant') heroes[1].spaceId = 'another-invented-space';
    else pr.initialCredits[1] = 0;
    const p = freezePhysical(diagnosticRaw(), binding, heroes, '1'.repeat(64));
    openPhysical(p, source, pr);
    assert.equal(p.snapshot.active, null);
    assert.equal(p.snapshot.areas[0].damage.length, 1);
    assert.equal(p.snapshot.parents[0].results[0].costs.length, 0);
  }
});

test('the bounded parent limit rejects the next source without corrupting an accepted save', () => {
  const p = fresh(),
    pr = program([suffer(0, 0, 0)]);
  for (let n = 0; n < 32; n++)
    openPhysical(p, { ...source, effectId: `invented:${n}:0`, entry: n }, pr);
  const before = structuredClone(p);
  assert.throws(() => openPhysical(p, { ...source, effectId: 'invented:32:0', entry: 32 }, pr));
  assert.deepEqual(p, before);
  assert.doesNotThrow(() => validatePhysical(p));
});

test('an unimplemented effective limit still gates the source barrier for cards already owned', () => {
  const p = fresh();
  openPhysical(p, source, program([suffer(0, 2, 0)]));
  const pr = program([discard(0, 0)]);
  pr.limits[0] = { kind: 'requires-capability', capability: 'invented-limit-modifier' };
  openPhysical(p, { ...source, effectId: 'principal:2:0', entry: 2, state: 2 }, pr);
  assert.equal(p.snapshot.active?.reason, 'effective-limits-unavailable');
  assert.equal(p.snapshot.parents[0].returnCount, 1);
  assert.equal(p.snapshot.parents[1].returnCount, 0);
  assert.equal(p.snapshot.areas[0].damage.length, 2);
});
