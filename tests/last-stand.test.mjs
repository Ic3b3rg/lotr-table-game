import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as physical from '../dist/physical-resolution-library.mjs';
import { lastStandFixture } from './fixtures/last-stand.mjs';
import { binding, evidence, hash } from './fixtures/physical-fronts.mjs';
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
test('last-stand compilation rejects unknown instruction sources, duplicate awards and unbound title fields', () => {
  const f = lastStandFixture();
  for (const edit of [
    (ir) => {
      ir.instructions[0].model.sourceId = 'not-a-frozen-source';
    },
    (ir) => {
      ir.awards[1].titleId = ir.awards[0].titleId;
    },
    (ir) => {
      ir.instructions[0].text += ' altered';
    },
    (ir) => {
      ir.titles[0].cardHash = '0'.repeat(64);
    },
    (ir) => {
      ir.titles[0].effects[0].op = 'ignored-unknown-opcode';
    },
  ]) {
    const changed = structuredClone(f.lastStandInput);
    edit(changed);
    assert.throws(() => physical.compileLastStand(f.raw, changed));
  }
});
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

test('last stand remains answerable after all 32 allowed source children complete', () => {
  for (const count of [31, 32]) {
    const f = freshLastStand();
    const children = [
      suffer(0, 5, 0),
      ...Array.from({ length: count - 1 }, () => ({
        kind: 'event',
        hero: 0,
        event: 'before-interact',
        threat: false,
        sufferedFear: 0,
      })),
    ];
    physical.openPhysical(f.p, source, f.program(children), f.context);
    assert.equal(f.p.snapshot.parents[0].completedChildren, count);
    assert.equal(f.p.snapshot.active.child, count);
    answer(f, { kind: 'physical-choice', option: 'reveal' });
    const restored = JSON.parse(JSON.stringify(f.p));
    physical.validatePhysical(restored);
    f.p = restored;
    answer(f, { kind: 'physical-choice', option: 'resolve' });
    assert.equal(f.p.snapshot.parents[0].returnCount, 1);
    assert.equal(f.p.snapshot.lastStand.selections[0].outcome, 'pass');
    assert.equal(f.p.snapshot.areas[0].damage.length, 0);
    assert.equal(f.p.snapshot.lastStand.heroes[0].difficulty, 2);
    physical.validatePhysical(f.p);
  }
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

test('the group can choose the next hero but only that owner chooses between both limits', () => {
  const f = freshLastStand();
  physical.openPhysical(f.p, source, f.program([suffer(0, 5, 0), suffer(1, 5, 5)]), f.context);
  const before = structuredClone(f.p);
  assert.equal(f.p.snapshot.active.actorPlayerId, f.heroes[0].playerId);
  assert.throws(() => answer(f, { kind: 'physical-choice', option: '1:fear' }));
  assert.deepEqual(f.p, before);
  answer(f, { kind: 'physical-choice', option: '1:choose-family' });
  assert.equal(f.p.snapshot.lastStand.selections.length, 0);
  assert.equal(f.p.snapshot.active.actorPlayerId, f.heroes[1].playerId);
  assert.deepEqual(
    f.p.snapshot.active.options.map((o) => o.id),
    ['1:damage', '1:fear'],
  );
  const q = f.p.snapshot.active;
  assert.throws(() =>
    physical.answerPhysical(
      f.p,
      q.runId,
      { kind: 'physical-choice', option: '1:fear' },
      evidence(1, f.heroes[0].playerId),
    ),
  );
  answer(f, { kind: 'physical-choice', option: '1:fear' });
  assert.equal(f.p.snapshot.lastStand.selections[0].heroId, f.heroes[1].heroId);
  assert.equal(f.p.snapshot.lastStand.selections[0].family, 'fear');
  assert.equal(f.p.snapshot.active.actorPlayerId, f.heroes[1].playerId);
  physical.validatePhysical(JSON.parse(JSON.stringify(f.p)));
});

test('a reaction that reaches the same limit again creates a new last stand before returning', () => {
  const f = freshLastStand(({ ir }) => {
    for (const d of ir.definitions) {
      d.body = [{ op: 'keep-faceup' }];
      if (d.cardId.includes('damage'))
        d.persistent = [
          {
            op: 'suffer',
            window: 'after-darkness-suffering-batch',
            hero: 'triggering-self-or-nearby',
            family: 'fear',
            n: 1,
            face: 'normal',
            condition: 'at-least-one-actually-suffered',
            source: 'this-card-not-darkness',
          },
        ];
    }
  });
  physical.openPhysical(
    f.p,
    source,
    f.program([
      { ...suffer(0, 1, 0), face: 'faceup' },
      { ...suffer(0, 0, 4), face: 'faceup' },
      suffer(0, 0, 1),
      {
        kind: 'event',
        hero: 0,
        event: 'after-darkness-suffering-batch',
        threat: false,
        sufferedFear: 1,
      },
    ]),
    f.context,
  );
  answer(f, { kind: 'physical-choice', option: '0:fear' });
  answer(f, { kind: 'physical-choice', option: 'reveal' });
  answer(f, { kind: 'physical-choice', option: 'resolve' });
  const checks = f.p.snapshot.lastStand.selections;
  assert.equal(checks.length, 2);
  assert.notEqual(checks[0].id, checks[1].id);
  assert.equal(checks[0].outcome, 'pass');
  assert.equal(checks[0].returned, 1);
  assert.equal(checks[1].difficulty, 2);
  assert.equal(checks[1].outcome, null);
  assert.equal(f.p.snapshot.active.options[0].id, 'reveal');
  assert.equal(f.p.snapshot.parents[0].returnCount, 0);
  physical.validatePhysical(JSON.parse(JSON.stringify(f.p)));
  answer(f, { kind: 'physical-choice', option: 'reveal' });
  answer(f, { kind: 'physical-choice', option: 'resolve' });
  assert.equal(f.p.snapshot.lastStand.selections[1].forcedFailure, true);
  assert.equal(f.p.snapshot.lastStand.selections[1].outcome, 'fail');
  assert.equal(f.p.snapshot.lastStand.heroes[0].defeated, true);
  assert.equal(f.p.snapshot.parents[0].returnCount, 1);
  assert.equal(f.p.snapshot.lastStand.random.length, 2);
  physical.validatePhysical(f.p);
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
  // The independent acquisition works even while boon quantities stay unresolved.
  physical.openPhysical(
    f.p,
    { ...source, effectId: 'title-rest-gate' },
    f.program([{ kind: 'end-turn', hero: 0 }]),
    structuredClone(f.p.snapshot.resolution.resources),
  );
  const rest = f.p.snapshot.active.options.find((o) => o.id.startsWith('title-rest:'));
  assert.ok(rest);
  const before = structuredClone(f.p.snapshot.resolution.resources);
  answer(f, { kind: 'physical-choice', option: rest.id });
  assert.equal(f.p.snapshot.active.reason, 'boon-quantity-unconfirmed');
  assert.deepEqual(f.p.snapshot.resolution.resources, before);
  assert.equal(f.p.snapshot.lastStand.titles[1].removed, false);
});

test('a newly acquired title helps only the next test, pays removal and keeps campaign ownership', () => {
  const f = freshLastStand(({ catalog, ir }) => {
    catalog.heroes[1].stats.fear = 1;
    catalog.heroes[2].stats.fear = 1;
    catalog.heroes[0].stats.spirit = 1;
    for (const d of ir.definitions) d.body = [{ op: 'keep-faceup' }];
  });
  for (const hero of [1, 2]) {
    physical.openPhysical(
      f.p,
      { ...source, effectId: `defeat-title-${hero}` },
      f.program([{ ...suffer(hero, 0, 1), face: 'faceup' }]),
      structuredClone(f.p.snapshot.resolution?.resources ?? f.context),
    );
    answer(f, { kind: 'physical-choice', option: 'reveal' });
    answer(f, { kind: 'physical-choice', option: 'resolve' });
  }
  physical.openPhysical(
    f.p,
    { ...source, effectId: 'two-title-tests' },
    f.program([suffer(0, 5, 5)]),
    structuredClone(f.p.snapshot.resolution.resources),
  );
  answer(f, { kind: 'physical-choice', option: '0:damage' });
  answer(f, { kind: 'physical-choice', option: 'reveal' });
  answer(f, { kind: 'physical-choice', option: 'resolve' });
  assert.equal(f.p.snapshot.lastStand.selections.at(-2).successes, 3);
  answer(f, { kind: 'physical-choice', option: 'reveal' });
  const help = f.p.snapshot.active.options.find((o) => o.id.startsWith('title-help:'));
  assert.ok(help);
  answer(f, { kind: 'physical-choice', option: help.id });
  const ownership = f.p.snapshot.lastStand.titles[0];
  assert.equal(ownership.removed, true);
  const h = f.p.snapshot.resolution.resources.preparation.heroes[0];
  assert.ok(![...h.prepared, ...h.deck, ...h.discard].includes(ownership.copy));
  assert.ok(!f.p.snapshot.active.options.some((o) => o.id === help.id));
  answer(f, { kind: 'physical-choice', option: 'resolve' });
  assert.equal(f.p.snapshot.lastStand.selections.at(-1).successes, 3);
  assert.equal(f.p.snapshot.lastStand.selections.at(-1).outcome, 'pass');
  assert.equal(f.p.snapshot.lastStand.titles.length, 1);
  assert.equal(f.p.snapshot.parents.at(-1).returnCount, 1);
});

test('the last active hero’s failure produces an immediate typed terminal boundary without returning the parent', () => {
  const f = freshLastStand(({ ir }) => {
    for (const d of ir.definitions) d.body = [{ op: 'keep-faceup' }];
  });
  physical.openPhysical(
    f.p,
    source,
    f.program([0, 1, 2].map((h) => ({ ...suffer(h, 5, 0), face: 'faceup' }))),
    f.context,
  );
  for (let hero = 0; hero < 3; hero++) {
    if (hero < 2) answer(f, { kind: 'physical-choice', option: `${hero}:damage` });
    answer(f, { kind: 'physical-choice', option: 'reveal' });
    answer(f, { kind: 'physical-choice', option: 'resolve' });
  }
  assert.equal(f.p.snapshot.active.reason, 'adventure-loss-consumer-unavailable');
  assert.equal(f.p.snapshot.active.heroId, 'hero-3');
  assert.equal(f.p.snapshot.lastStand.terminal.timing, 'no-active-heroes');
  assert.equal(f.p.snapshot.parents[0].returnCount, 0);
  assert.equal(
    f.p.snapshot.lastStand.heroes.every((h) => h.defeated),
    true,
  );
  assert.equal(
    f.p.snapshot.areas.reduce((n, h) => n + h.damage.length, 0),
    15,
  );
  const before = structuredClone(f.p);
  assert.throws(() => answer(f, { kind: 'physical-choice', option: 'resolve' }));
  assert.deepEqual(f.p, before);
});

test('a nearby title owner consents for the tested recipient and pays their own prepared copy', () => {
  const f = freshLastStand(({ lastStandInput }) => {
    const [help, rest] = lastStandInput.titles;
    lastStandInput.awards = [
      { ...lastStandInput.awards[1], titleId: help.cardId, minimum: 1 },
      { ...lastStandInput.awards[0], titleId: rest.cardId },
    ];
  });
  physical.openPhysical(f.p, source, f.program([suffer(0, 5, 0)]), f.context);
  answer(f, { kind: 'physical-choice', option: 'reveal' });
  answer(f, { kind: 'physical-choice', option: 'resolve' });
  physical.openPhysical(
    f.p,
    { ...source, effectId: 'nearby-title' },
    f.program([suffer(1, 5, 0)]),
    structuredClone(f.p.snapshot.resolution.resources),
  );
  answer(f, { kind: 'physical-choice', option: 'reveal' });
  const help = f.p.snapshot.active.options.find((o) => o.id.startsWith('title-help:'));
  answer(f, { kind: 'physical-choice', option: help.id });
  assert.equal(f.p.snapshot.active.actorHeroId, 'hero-1');
  assert.equal(f.p.snapshot.active.actorPlayerId, f.heroes[0].playerId);
  assert.equal(f.p.snapshot.active.heroId, 'hero-2');
  answer(f, { kind: 'physical-choice', option: 'use' });
  assert.equal(f.p.snapshot.lastStand.test.heroId, 'hero-2');
  assert.equal(f.p.snapshot.lastStand.test.successes, 5);
  assert.equal(f.p.snapshot.lastStand.titles[0].removed, true);
  answer(f, { kind: 'physical-choice', option: 'resolve' });
  assert.equal(f.p.snapshot.lastStand.selections.at(-1).successes, 5);
});

test('a legacy last-stand gate continues explicitly once without changing its paid prefix or physical RNG', () => {
  const f = freshLastStand();
  const enabled = f.p.lastStand;
  delete f.p.lastStand;
  delete f.p.lastStandActivation;
  physical.openPhysical(f.p, source, f.program([suffer(0, 5, 0)]), f.context);
  assert.equal(f.p.snapshot.active.reason, 'last-stand-unavailable');
  const legacy = structuredClone(f.p);
  physical.validatePhysical(f.p);
  assert.deepEqual(f.p, legacy);
  const q = f.p.snapshot.active;
  physical.answerPhysical(
    f.p,
    q.runId,
    { kind: 'physical-continue-last-stand', rules: 'source-last-stand-v1' },
    evidence(0, q.actorPlayerId),
    enabled,
  );
  assert.equal(f.p.snapshot.active.options[0].id, 'reveal');
  assert.deepEqual(f.p.snapshot.random, legacy.snapshot.random);
  assert.equal(f.p.snapshot.rngCursor, legacy.snapshot.rngCursor);
  assert.deepEqual(f.p.snapshot.decks, legacy.snapshot.decks);
  assert.deepEqual(f.p.snapshot.areas, legacy.snapshot.areas);
  assert.deepEqual(f.p.snapshot.resolution.resources, legacy.snapshot.resolution.resources);
  const selected = structuredClone(f.p.snapshot.lastStand.selections);
  physical.validatePhysical(f.p);
  assert.deepEqual(f.p.snapshot.lastStand.selections, selected);
  assert.equal(f.p.snapshot.resolution.history[0].active.kind, 'gate');
  assert.equal(f.p.runs[0].lastStandRules, undefined);
  answer(f, { kind: 'physical-choice', option: 'reveal' });
  answer(f, { kind: 'physical-choice', option: 'resolve' });
  assert.equal(f.p.snapshot.parents[0].returnCount, 1);
});

test('the frozen activation boundary prevents stripping P2 rules from a new run', () => {
  const f = freshLastStand();
  physical.openPhysical(f.p, source, f.program([suffer(0, 1, 0)]), f.context);
  delete f.p.runs[0].lastStandRules;
  delete f.p.snapshot.lastStand;
  assert.throws(() => physical.validatePhysical(f.p));
});

test('after-source reactions compete with last stands and live limits are rechecked after descendants', () => {
  for (const reactionFirst of [true, false]) {
    const f = freshLastStand(({ ir, catalog }) => {
      catalog.heroes[0].stats.damage = 1;
      for (const d of ir.definitions.filter((d) => d.cardId.includes('damage'))) {
        d.body = [{ op: 'keep-faceup' }];
        d.persistent = [
          {
            op: 'suffer',
            window: 'after-darkness-suffering-batch',
            hero: 'triggering-self-or-nearby',
            family: 'fear',
            n: 1,
            face: 'normal',
            condition: 'at-least-one-actually-suffered',
            source: 'this-card-not-darkness',
          },
        ];
      }
    });
    physical.openPhysical(
      f.p,
      source,
      f.program([
        { ...suffer(0, 1, 0), face: 'faceup' },
        {
          kind: 'event',
          hero: 0,
          event: 'after-darkness-suffering-batch',
          threat: false,
          sufferedFear: 1,
        },
      ]),
      f.context,
    );
    assert.equal(f.p.snapshot.areas[0].fear.length, 0);
    const options = f.p.snapshot.active.options;
    const reaction = options.find((o) => o.id.startsWith('reaction:'));
    assert.ok(reaction);
    assert.ok(options.some((o) => o.id === '0:damage'));
    answer(f, { kind: 'physical-choice', option: reactionFirst ? reaction.id : '0:damage' });
    if (reactionFirst) assert.equal(f.p.snapshot.areas[0].fear.length, 1);
    answer(f, { kind: 'physical-choice', option: 'reveal' });
    answer(f, { kind: 'physical-choice', option: 'resolve' });
    assert.equal(f.p.snapshot.lastStand.heroes[0].defeated, true);
    assert.equal(f.p.snapshot.areas[0].fear.length, reactionFirst ? 1 : 0);
    assert.equal(f.p.snapshot.parents[0].returnCount, 1);
  }
});

test('effective limit bonuses and final source discards precede the last-stand barrier', () => {
  const f = freshLastStand(({ ir, catalog }) => {
    const d = catalog.skills.find((s) => s.id === 'role-1-skill-1');
    ir.policies.push({
      id: d.id,
      kind: 'skill',
      definitionHash: hash(d),
      source: { sourceId: 'invented', locator: 'Limits!1' },
      effects: [{ op: 'limits', damage: 1, fear: 1 }],
    });
  });
  physical.openPhysical(
    f.p,
    source,
    f.program([
      suffer(0, 6, 0),
      { kind: 'discard', hero: 0, count: 1, mode: 'exact', families: ['damage'] },
    ]),
    f.context,
  );
  if (f.p.snapshot.active?.mode === 'select')
    answer(f, { kind: 'physical-select', ids: ['down:damage:0'] });
  assert.equal(f.p.snapshot.active, null);
  assert.equal(f.p.snapshot.areas[0].damage.length, 5);
  assert.equal(f.p.snapshot.lastStand.selections.length, 0);
});

test('a paid conversion Scout retains the parent cards and can remove the live forced-failure condition', () => {
  const f = freshLastStand(({ catalog, ir }) => {
    for (const c of catalog.skills) {
      c.success = 0;
      c.fate = 1;
    }
    for (const d of ir.definitions.filter((d) => d.cardId.includes('fear')))
      d.body = [{ op: 'keep-faceup' }];
    for (const [id, effects] of [
      ['role-1-skill-1', [{ op: 'convert-all', noPrintedSuccess: false, scout: 1 }]],
      ['basic-4', [{ op: 'after-prepare-flip-fear' }]],
    ]) {
      const d = catalog.skills.find((s) => s.id === id);
      ir.policies.push({
        id,
        kind: 'skill',
        definitionHash: hash(d),
        source: { sourceId: 'invented', locator: 'Conversion!last-stand' },
        effects,
      });
    }
  });
  physical.openPhysical(
    f.p,
    source,
    f.program([suffer(0, 5, 0), { ...suffer(0, 0, 5), face: 'faceup' }]),
    f.context,
  );
  answer(f, { kind: 'physical-choice', option: '0:damage' });
  answer(f, { kind: 'physical-choice', option: 'reveal' });
  const parentCards = structuredClone(f.p.snapshot.resolution.revealed[0].cards);
  assert.equal(f.p.snapshot.lastStand.test.forcedFailure, true);
  answer(f, { kind: 'physical-choice', option: 'role-1-skill-1:1' });
  assert.equal(f.p.snapshot.active.mode, 'scout');
  const child = f.p.snapshot.active.options[0].id;
  assert.equal(child, 'basic-4:1');
  assert.ok(!parentCards.includes(child));
  assert.deepEqual(f.p.snapshot.resolution.revealed[0].cards, parentCards);
  assert.equal(f.p.snapshot.lastStand.test.successes, 3);
  answer(f, { kind: 'physical-scout', prepare: child, discard: null, top: [], bottom: [] });
  assert.equal(f.p.snapshot.active.mode, 'select');
  answer(f, { kind: 'physical-select', ids: [f.p.snapshot.active.options[0].id] });
  assert.equal(f.p.snapshot.lastStand.test.forcedFailure, false);
  assert.deepEqual(f.p.snapshot.resolution.revealed[0].cards, parentCards);
  answer(f, { kind: 'physical-choice', option: 'resolve' });
  assert.equal(f.p.snapshot.lastStand.selections[0].outcome, 'pass');
  assert.equal(f.p.snapshot.lastStand.selections[0].forcedFailure, false);
  assert.equal(f.p.snapshot.lastStand.selections[1].difficulty, 2);
  physical.validatePhysical(f.p);
});

test('negate-only bonuses cannot pass last stand, and a capped success still advances once', () => {
  const failed = freshLastStand(({ catalog, context, ir }) => {
    for (const c of catalog.skills) {
      c.success = 0;
      c.fate = 0;
    }
    context.preparation.heroes[0].inspiration = 0;
    const d = catalog.skills.find((s) => s.id === 'role-1-skill-1');
    ir.policies.push({
      id: d.id,
      kind: 'skill',
      definitionHash: hash(d),
      source: { sourceId: 'invented', locator: 'Negate!only' },
      effects: [{ op: 'negate-bonus', n: 1 }],
    });
  });
  physical.openPhysical(failed.p, source, failed.program([suffer(0, 5, 0)]), failed.context);
  answer(failed, { kind: 'physical-choice', option: 'reveal' });
  answer(failed, { kind: 'physical-choice', option: 'resolve' });
  assert.equal(failed.p.snapshot.lastStand.selections[0].successes, 0);
  assert.equal(failed.p.snapshot.lastStand.selections[0].outcome, 'fail');
  const capped = freshLastStand(({ context }) => {
    context.preparation.heroes[0].inspiration = 4;
  });
  physical.openPhysical(capped.p, source, capped.program([suffer(0, 5, 0)]), capped.context);
  answer(capped, { kind: 'physical-choice', option: 'reveal' });
  answer(capped, { kind: 'physical-choice', option: 'resolve' });
  assert.equal(capped.p.snapshot.lastStand.selections[0].inspiration, 0);
  assert.equal(capped.p.snapshot.lastStand.heroes[0].difficulty, 2);
  assert.equal(capped.p.snapshot.parents[0].returnCount, 1);
  physical.validatePhysical(capped.p);
});
