import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as physical from '../dist/physical-resolution-library.mjs';
import { lastStandFixture } from './fixtures/last-stand.mjs';
import { binding, evidence } from './fixtures/physical-fronts.mjs';
import { source, suffer } from './fixtures/physical-resolution.mjs';

export function freshLastStand(edit = () => {}) {
  const f = lastStandFixture();
  edit(f);
  const artifact = physical.compilePhysicalFronts(f.raw, f.ir, f.catalog);
  const lastStand = physical.compileLastStand(f.raw, f.lastStandInput);
  const p = physical.freezePhysical(
    f.raw,
    binding,
    f.heroes,
    '1'.repeat(64),
    undefined,
    { artifact, catalog: f.catalog },
    lastStand,
  );
  return { ...f, p };
}
export function answer(f, input) {
  const active = f.p.snapshot.active;
  const n = f.p.runs.reduce((n, r) => n + r.answers.length, 0);
  physical.answerPhysical(f.p, active.runId, input, evidence(n, active.actorPlayerId));
}
test('last stand crosses the entire source, persists its instruction and returns covered cards once', () => {
  const f = freshLastStand();
  physical.openPhysical(f.p, source, f.program([suffer(0, 3, 0), suffer(0, 2, 1)]), f.context);
  assert.equal(f.p.snapshot.areas[0].damage.length, 5);
  assert.equal(f.p.snapshot.parents[0].completedChildren, 2);
  assert.equal(f.p.snapshot.active.kind, 'decision');
  assert.equal(f.p.snapshot.active.options[0].id, 'reveal');
  const selected = structuredClone(f.p.snapshot.lastStand.selections[0]);
  assert.equal(selected.difficulty, 1);
  assert.equal(selected.family, 'damage');
  assert.equal(selected.stat, 'might');
  assert.equal(f.p.snapshot.resolution.revealed.length, 0);
  answer(f, { kind: 'physical-choice', option: 'reveal' });
  assert.equal(f.p.snapshot.active.options[0].id, 'resolve');
  assert.equal(f.p.snapshot.resolution.revealed[0].cards.length, 3);
  answer(f, { kind: 'physical-choice', option: 'resolve' });
  assert.equal(f.p.snapshot.active, null);
  assert.equal(f.p.snapshot.parents[0].returnCount, 1);
  assert.deepEqual(f.p.snapshot.lastStand.selections[0], {
    ...selected,
    successes: 3,
    forcedFailure: false,
    outcome: 'pass',
    returned: 5,
    inspiration: 1,
    titles: [],
  });
  assert.equal(f.p.snapshot.areas[0].damage.length, 0);
  assert.equal(f.p.snapshot.areas[0].fear.length, 1);
  assert.equal(f.p.snapshot.lastStand.heroes[0].difficulty, 2);
  assert.equal(f.p.snapshot.lastStand.heroes[1].difficulty, 1);
  assert.equal(f.p.snapshot.resolution.resources.preparation.heroes[0].inspiration, 3);
  physical.validatePhysical(JSON.parse(JSON.stringify(f.p)));
  const encoded = JSON.stringify(physical.physicalView(f.p));
  assert.ok(!encoded.includes('invented-damage-01'));
  assert.ok(!encoded.includes('rngCursor'));
});

test('both limits allow either order and share one difficulty per hero', () => {
  for (const first of ['damage', 'fear']) {
    const f = freshLastStand();
    physical.openPhysical(f.p, source, f.program([suffer(0, 5, 5), suffer(1, 5, 0)]), f.context);
    const q = f.p.snapshot.active;
    assert.equal(q.options.filter((o) => o.id.startsWith('0:')).length, 2);
    answer(f, { kind: 'physical-choice', option: `0:${first}` });
    for (let i = 0; i < 2; i++) {
      answer(f, { kind: 'physical-choice', option: 'reveal' });
      answer(f, { kind: 'physical-choice', option: 'resolve' });
      if (i === 0) {
        const second = first === 'damage' ? 'fear' : 'damage';
        answer(f, { kind: 'physical-choice', option: `0:${second}` });
      }
    }
    answer(f, { kind: 'physical-choice', option: 'reveal' });
    answer(f, { kind: 'physical-choice', option: 'resolve' });
    const ls = f.p.snapshot.lastStand;
    assert.deepEqual(
      ls.selections.map((s) => [s.heroId, s.family, s.difficulty, s.outcome]),
      [
        ['hero-1', first, 1, 'pass'],
        ['hero-1', first === 'damage' ? 'fear' : 'damage', 2, 'pass'],
        ['hero-2', 'damage', 1, 'pass'],
      ],
    );
    assert.equal(ls.heroes[0].difficulty, 3);
    assert.equal(ls.heroes[1].difficulty, 2);
    assert.equal(f.p.snapshot.parents[0].returnCount, 1);
    physical.validatePhysical(f.p);
  }
});

test('faceup limit of the other type forces failure and cancels the defeated hero’s second test', () => {
  const f = freshLastStand(({ ir }) => {
    for (const d of ir.definitions.filter((d) => d.cardId.includes('damage')))
      d.body = [{ op: 'keep-faceup' }];
  });
  physical.openPhysical(
    f.p,
    source,
    f.program([{ ...suffer(0, 5, 0), face: 'faceup' }, suffer(0, 0, 5)]),
    f.context,
  );
  answer(f, { kind: 'physical-choice', option: '0:fear' });
  answer(f, { kind: 'physical-choice', option: 'reveal' });
  const stable = structuredClone(f.p);
  assert.throws(() => answer(f, { kind: 'physical-choice', option: 'pass' }));
  assert.deepEqual(f.p, stable);
  answer(f, { kind: 'physical-choice', option: 'resolve' });
  const ls = f.p.snapshot.lastStand;
  assert.equal(ls.selections[0].successes, 2);
  assert.equal(ls.selections[0].forcedFailure, true);
  assert.equal(ls.selections[0].outcome, 'fail');
  assert.equal(ls.selections.length, 1);
  assert.equal(ls.heroes[0].defeated, true);
  assert.equal(ls.heroes[0].difficulty, 1);
  assert.equal(ls.terminal, null);
  assert.equal(ls.lossDue.heroId, 'hero-1');
  assert.deepEqual(f.p.snapshot.areas[0].damage, stable.snapshot.areas[0].damage);
  assert.deepEqual(f.p.snapshot.areas[0].fear, stable.snapshot.areas[0].fear);
  assert.equal(f.p.snapshot.parents[0].returnCount, 1);
});

test('independent title conditions award and prepare both, retaining ownership when discarded for the limit', () => {
  const f = freshLastStand(({ catalog, ir, context }) => {
    catalog.heroes[1].stats.damage = 1;
    catalog.heroes[2].stats.damage = 1;
    catalog.heroes[0].stats.spirit = 3;
    for (const d of ir.definitions.filter((d) => d.cardId.includes('damage')))
      d.body = [{ op: 'keep-faceup' }];
    const h = context.preparation.heroes[0];
    h.prepared.push(...h.deck.splice(0, 3));
  });
  const run = (id, child) =>
    physical.openPhysical(
      f.p,
      { ...source, effectId: id },
      f.program([child]),
      structuredClone(f.p.snapshot.resolution?.resources ?? f.context),
    );
  for (let n = 0; n < 2; n++) {
    run(`early-${n}`, suffer(0, 0, 5));
    answer(f, { kind: 'physical-choice', option: 'reveal' });
    answer(f, { kind: 'physical-choice', option: 'resolve' });
  }
  assert.equal(f.p.snapshot.lastStand.titles.length, 0);
  // Genuine forced failures remove the other heroes, preserving their components.
  for (let hero = 1; hero <= 2; hero++) {
    run(`defeat-${hero}`, { ...suffer(hero, 1, 0), face: 'faceup' });
    answer(f, { kind: 'physical-choice', option: 'reveal' });
    answer(f, { kind: 'physical-choice', option: 'resolve' });
  }
  run('two-awards', suffer(0, 0, 5));
  answer(f, { kind: 'physical-choice', option: 'reveal' });
  answer(f, { kind: 'physical-choice', option: 'resolve' });
  assert.equal(f.p.snapshot.active.mode, 'select');
  answer(f, { kind: 'physical-select', ids: ['role-1-skill-1:1'] });
  assert.equal(f.p.snapshot.active.mode, 'select');
  const [first, second] = f.lastStandInput.titles.map((t) => t.cardId);
  answer(f, { kind: 'physical-select', ids: [`${first}:1`] });
  const ls = f.p.snapshot.lastStand;
  assert.deepEqual(ls.selections.at(-1).titles, [first, second]);
  assert.equal(ls.heroes[0].difficulty, 4);
  assert.equal(ls.titles.length, 2);
  const h = f.p.snapshot.resolution.resources.preparation.heroes[0];
  assert.equal(h.prepared.length, 4);
  assert.ok(h.prepared.includes(`${second}:1`));
  assert.ok(h.discard.includes(`${first}:1`));
  assert.equal(ls.titles[0].removed, false);
  assert.equal(f.p.snapshot.parents.at(-1).returnCount, 1);
  physical.validatePhysical(f.p);
});
