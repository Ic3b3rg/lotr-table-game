import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compilePhysicalFronts,
  freezePhysical,
  openPhysical,
  answerPhysical,
  validatePhysical,
  physicalView,
} from '../dist/physical-resolution-library.mjs';
import { frontFixture, binding, evidence, hash } from './fixtures/physical-fronts.mjs';
import { source } from './fixtures/physical-resolution.mjs';
const roundId = '00000000-0000-4000-8000-000000000099';
function fresh(edit = () => {}) {
  const f = frontFixture();
  f.catalog.heroes.forEach((h) => {
    h.maxHands = 2;
  });
  const combat = {
    version: 'combat-windows-v1',
    roundId,
    artifactFingerprint: hash('invented-closure'),
    clauses: [],
    heroes: [],
  };
  const clause = (cardId, window, effect, clause = 0) => ({
    cardId,
    definitionHash: hash(f.catalog.skills.find((s) => s.id === cardId)),
    originalHash: hash('invented primary'),
    locator: 'Invented!K1',
    clause,
    window,
    effect,
  });
  edit(f, combat, clause);
  const artifact = compilePhysicalFronts(f.raw, f.ir, f.catalog);
  const p = freezePhysical(f.raw, binding, f.heroes, '1'.repeat(64), undefined, {
    artifact,
    catalog: f.catalog,
  });
  const program = (children) => ({ ...f.program(children), combat });
  return { ...f, p, combat, program };
}
function answer(f, option) {
  const q = f.p.snapshot.active;
  const n = f.p.runs.at(-1).answers.length;
  const input = typeof option === 'string' ? { kind: 'physical-choice', option } : option;
  answerPhysical(f.p, q.runId, input, evidence(n, q.actorPlayerId));
}
const slots = [
  {
    id: 'invented-slot-1',
    copyId: 'invented-weapon:1',
    cost: 1,
    hits: 2,
    modifiers: [],
    label: '1 successo: 2 colpi',
  },
  {
    id: 'invented-slot-2',
    copyId: 'invented-weapon:1',
    cost: 2,
    hits: 3,
    modifiers: ['stun'],
    label: '2 successi: 3 colpi, Stordire',
  },
];
function startAttack(f, replaceCopy = null) {
  return openPhysical(
    f.p,
    source,
    f.program([
      {
        kind: 'attack-test',
        hero: 0,
        stat: 'might',
        groupId: 'invented-group',
        slots,
        replaceCopy,
      },
    ]),
    f.context,
  );
}
function finish(f) {
  for (let n = 0; f.p.snapshot.active && n < 100; n++) {
    const q = f.p.snapshot.active;
    assert.equal(q.kind, 'decision');
    if (q.mode === 'choose')
      answer(
        f,
        ['resolve', 'close', 'keep', 'apply'].find((id) => q.options.some((o) => o.id === id)) ??
          q.options[0].id,
      );
    else if (q.mode === 'scout')
      answer(f, {
        kind: 'physical-scout',
        prepare: null,
        discard: null,
        top: q.options.map((o) => o.id),
        bottom: [],
      });
    else if (q.mode === 'allocate')
      answer(f, { kind: 'physical-allocate', ability: null, damage: 0, fear: 0 });
    else
      answer(f, { kind: 'physical-select', ids: q.options.slice(0, q.minimum).map((o) => o.id) });
  }
  assert.equal(f.p.snapshot.active, null);
}

test('attack test reveals real cards, adds prepared success, spends each success/slot once and discards before return', () => {
  const f = fresh((f, c, clause) =>
    c.clauses.push(
      clause('role-1-skill-1', 'test-convert', { op: 'add-success', stat: 'might', n: 1 }),
    ),
  );
  startAttack(f);
  assert.ok(f.p.snapshot.resolution.revealed[0].cards.length > 0);
  assert.ok(f.p.snapshot.active.options.some((o) => o.id.startsWith('company:')));
  answer(f, f.p.snapshot.active.options.find((o) => o.id.startsWith('company:')).id);
  assert.equal(f.p.snapshot.resolution.resources.preparation.heroes[0].prepared.length, 0);
  answer(f, 'resolve');
  assert.equal(f.p.snapshot.resolution.attackTest.stage, 'spending');
  const before = f.p.snapshot.resolution.attackTest;
  if (before.successes > 0) {
    answer(f, 'slot:invented-slot-1');
    assert.ok(!f.p.snapshot.active.options.some((o) => o.id === 'slot:invented-slot-1'));
  }
  finish(f);
  const r = f.p.snapshot.parents[0].results[0].attack;
  const spent = r.allocations.flatMap((a) => a.successes);
  assert.equal(new Set(spent).size, spent.length);
  assert.equal(r.successes, spent.length + r.unspent);
  assert.deepEqual(f.p.snapshot.resolution.revealed, []);
  assert.doesNotThrow(() => validatePhysical(JSON.parse(JSON.stringify(f.p))));
});

test('strike keeps parent cards during the hero scout child and its once-per-round use survives paid-copy discard', () => {
  const f = fresh((f, c, clause) => {
    c.clauses.push(clause('role-1-skill-1', 'attack-test', { op: 'strike', n: 3 }));
    c.heroes.push({
      heroId: f.heroes[0].heroId,
      definitionHash: hash(f.catalog.heroes[0]),
      originalHash: hash('invented-hero'),
      locator: 'Invented!M1',
      effect: 'after-strike-scout-once',
    });
  });
  startAttack(f);
  const held = [...f.p.snapshot.resolution.revealed[0].cards];
  answer(f, f.p.snapshot.active.options.find((o) => o.id.startsWith('company:')).id);
  assert.ok(f.p.snapshot.active.options.some((o) => o.id === 'scout'));
  answer(f, 'scout');
  assert.equal(f.p.snapshot.active.mode, 'scout');
  assert.deepEqual(f.p.snapshot.resolution.revealed[0].cards, held);
  assert.ok(f.p.snapshot.resolution.revealed[1].cards.every((id) => !held.includes(id)));
  finish(f);
  assert.equal(f.p.snapshot.parents[0].results[0].attack.addedHits, 3);
  assert.equal(f.p.snapshot.resolution.resources.combatUses.length, 1);
});

test('direct enemy outcome survives self-discard and nested suffering; actual child cause is distinct', () => {
  const f = fresh((f) => {
    for (const d of f.ir.definitions.filter((d) => d.cardId.includes('damage')))
      d.body = [
        { op: 'suffer', hero: 'self', family: 'fear', n: 1, face: 'down' },
        { op: 'discard-self' },
      ];
  });
  const outcome = {
    attackId: 'invented-attack',
    groupId: 'invented-group',
    instructionId: 'fixture.assets:50',
    instructionHash: hash('instruction'),
    recipientHeroId: f.heroes[0].heroId,
    cause: 'counterattack',
    rootSource: 'invented-root',
    directSource: 'invented-base',
    returnTo: 'invented-return',
    artifactFingerprint: hash('closure'),
    projectionFingerprint: hash('projection'),
    figureIds: ['invented-figure'],
    offered: { damage: 1, fear: 0 },
    negated: { damage: 0, fear: 0 },
    prevented: { damage: 0, fear: 0 },
    suffered: { damage: 0, fear: 0 },
    childSources: [],
    sealed: false,
  };
  openPhysical(
    f.p,
    source,
    f.program([
      {
        kind: 'enemy-attack',
        hero: 0,
        negate: 'might',
        outcome,
        addition: {
          key: 'invented-extra',
          textHash: hash('text'),
          predicate: 'damage-positive',
          window: 'condition-known',
          effect: { op: 'discard-inspiration', amount: 1 },
        },
      },
    ]),
    f.context,
  );
  finish(f);
  const actual = f.p.snapshot.parents[0].results[0].enemyOutcome;
  assert.equal(actual.suffered.damage, 1);
  assert.equal(actual.suffered.fear, 0);
  assert.equal(
    actual.childSources.filter((s) => s.family === 'fear').reduce((n, s) => n + s.amount, 0),
    1,
  );
  assert.equal(actual.sealed, true);
  assert.equal(f.p.snapshot.areas[0].damage.length, 0);
  assert.equal(f.p.snapshot.areas[0].fear.length, 1);
  assert.equal(f.p.snapshot.resolution.resources.preparation.heroes[0].inspiration, 1);
  const bad = structuredClone(f.p);
  bad.snapshot.parents[0].results[0].enemyOutcome.suffered.damage = 0;
  assert.throws(() => validatePhysical(bad));
  const view = JSON.stringify(physicalView(f.p));
  for (const copy of f.p.snapshot.areas[0].fear) assert.ok(!view.includes(copy));
});

// This source consumes a boon; known absence follows the printed fallback, without a supply assertion.
test('known absent consumed boon reaches real weakness fallback without inventing a reserve', () => {
  const f = fresh();
  const outcome = {
    attackId: 'fallback',
    groupId: 'invented-group',
    instructionId: 'fixture.assets:50',
    instructionHash: hash('instruction'),
    recipientHeroId: f.heroes[0].heroId,
    cause: 'provocation',
    rootSource: 'root',
    directSource: 'base',
    returnTo: 'move',
    artifactFingerprint: hash('closure'),
    projectionFingerprint: hash('projection'),
    figureIds: ['figure'],
    offered: { damage: 1, fear: 0 },
    negated: { damage: 0, fear: 0 },
    prevented: { damage: 0, fear: 0 },
    suffered: { damage: 0, fear: 0 },
    childSources: [],
    sealed: false,
  };
  const before = f.context.preparation.weaknessDeck.length;
  openPhysical(
    f.p,
    source,
    f.program([
      {
        kind: 'enemy-attack',
        hero: 0,
        negate: 'might',
        outcome,
        addition: {
          key: 'consume',
          textHash: hash('text'),
          predicate: 'damage-positive',
          window: 'condition-known',
          effect: { op: 'lose-boon-or-weakness', boon: 'determined' },
        },
      },
    ]),
    f.context,
  );
  finish(f);
  assert.equal(f.p.snapshot.resolution.resources.preparation.weaknessDeck.length, before - 1);
  assert.deepEqual(f.p.snapshot.resolution.resources.boons, []);
});

test('enemy negate exposes each actual revealed card and symbols through the shared reader projection', () => {
  const f = fresh();
  const outcome = {
    attackId: 'negate-view',
    groupId: 'invented-group',
    instructionId: 'fixture.assets:50',
    instructionHash: hash('instruction'),
    recipientHeroId: f.heroes[0].heroId,
    cause: 'provocation',
    rootSource: 'root',
    directSource: 'base',
    returnTo: 'move',
    artifactFingerprint: hash('closure'),
    projectionFingerprint: hash('projection'),
    figureIds: ['figure'],
    offered: { damage: 1, fear: 0 },
    negated: { damage: 0, fear: 0 },
    prevented: { damage: 0, fear: 0 },
    suffered: { damage: 0, fear: 0 },
    childSources: [],
    sealed: false,
  };
  openPhysical(
    f.p,
    source,
    f.program([{ kind: 'enemy-attack', hero: 0, negate: 'might', outcome, addition: null }]),
    f.context,
  );
  const t = physicalView(f.p).sourceTest;
  assert.ok(t && t.cards.length);
  assert.equal(t.stat, 'might');
  assert.ok(t.cards.every((c) => typeof c.success === 'number' && typeof c.fate === 'number'));
});

test('a paid attack concession retains its source after discard and gives the recipient a separate test', () => {
  const f = fresh((f, c, clause) =>
    c.clauses.push(
      clause('role-1-skill-1', 'after-attack-after-counterattack', {
        op: 'granted-attack',
        inspiration: 1,
      }),
    ),
  );
  const clause = f.combat.clauses[0],
    copy = f.context.preparation.heroes[0].prepared.find((c) => c.startsWith('role-1-skill-1:'));
  const before = f.context.preparation.heroes[0].inspiration;
  openPhysical(
    f.p,
    source,
    f.program([
      { kind: 'pay-attack-grant', hero: 0, recipient: 1, copy, clauseHash: hash(clause) },
      {
        kind: 'attack-test',
        hero: 1,
        groupId: 'invented-target',
        stat: 'might',
        slots,
        replaceCopy: null,
      },
    ]),
    f.context,
  );
  assert.equal(f.p.snapshot.active.heroId, f.heroes[1].heroId);
  assert.ok(!f.p.snapshot.resolution.resources.preparation.heroes[0].prepared.includes(copy));
  assert.ok(f.p.snapshot.resolution.resources.preparation.heroes[0].discard.includes(copy));
  assert.equal(f.p.snapshot.resolution.resources.preparation.heroes[0].inspiration, before + 1);
  const restored = JSON.parse(JSON.stringify(f.p));
  assert.doesNotThrow(() => validatePhysical(restored));
  finish(f);
  assert.equal(f.p.snapshot.parents[0].returnCount, 1);
  assert.equal(f.p.runs[0].program.children[0].clauseHash, hash(clause));
});
