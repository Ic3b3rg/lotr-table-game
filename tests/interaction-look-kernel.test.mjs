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
import { lookInput } from './interaction-look-helper.mjs';
import { runtime } from './interaction-look-runtime.mjs';

function fresh(edit = () => {}) {
  const f = frontFixture();
  for (const h of f.catalog.heroes) {
    h.stats.inspiration = 6;
    h.maxHands = 2;
  }
  for (const s of f.catalog.skills) s.fate = 1;
  f.ir = lookInput(f.raw, f.catalog);
  edit(f);
  // Edits to definitions are deliberately reattested in this invented fixture.
  f.ir.interactionLook.heroes.forEach(
    (entry) => (entry.definitionHash = hash(f.catalog.heroes.find((h) => h.id === entry.heroId))),
  );
  f.ir.policies.forEach(
    (p) => (p.definitionHash = hash(f.catalog.heroes.find((h) => h.id === p.id))),
  );
  const artifact = compilePhysicalFronts(f.raw, f.ir, f.catalog);
  f.p = freezePhysical(f.raw, binding, f.heroes, '1'.repeat(64), undefined, {
    artifact,
    catalog: f.catalog,
  });
  return f;
}
function begin(f, children = []) {
  return openPhysical(
    f.p,
    source,
    {
      ...f.program([
        ...children,
        { kind: 'event', hero: 0, event: 'before-interact', threat: true, sufferedFear: 0 },
      ]),
      interactionLookRules: 'source-interaction-look-v1',
    },
    f.context,
  );
}
function answer(f, id, option, n = 0) {
  answerPhysical(f.p, id, { kind: 'physical-choice', option }, evidence(n, f.heroes[0].playerId));
}
function drain(f, id, preference = 'look') {
  for (let n = 0; n < 20 && f.p.snapshot.active; n++) {
    const q = f.p.snapshot.active;
    const window = f.p.snapshot.resolution.interactionWindow;
    const preferred = window.remaining.find((e) => e.kind === preference);
    const option =
      q.purpose === 'interaction-look'
        ? 'continue'
        : (q.options.find((o) => o.id === preferred?.id && !o.unavailable)?.id ??
          q.options.find((o) => !o.unavailable).id);
    answer(f, id, option, n);
  }
  assert.equal(f.p.snapshot.active, null);
  validatePhysical(f.p);
}

for (const fate of [0, 1, 2])
  for (const inspiration of [0, 5, 6])
    test(`look fate=${fate}, inspiration=${inspiration}: exact reward, copy, zones, order and no RNG`, () => {
      const f = fresh(({ catalog, context }) => {
        for (const s of catalog.skills) s.fate = fate;
        context.preparation.heroes[0].inspiration = inspiration;
      });
      const original = structuredClone(f.context.preparation.heroes[0]);
      const initialRandom = structuredClone(f.p.snapshot.random),
        cursor = f.p.snapshot.rngCursor;
      const id = begin(f),
        r = f.p.snapshot.resolution;
      assert.equal(f.p.snapshot.active.purpose, 'interaction-look');
      assert.deepEqual(r.resources.preparation.heroes[0].deck, original.deck);
      assert.deepEqual(r.resources.preparation.heroes[0].discard, original.discard);
      assert.deepEqual(r.resources.preparation.heroes[0].prepared, original.prepared);
      assert.equal(r.privateLooks[0].copy, original.deck[0]);
      assert.equal(r.privateLooks[0].reward, fate && inspiration < 6 ? 1 : 0);
      assert.equal(
        r.resources.preparation.heroes[0].inspiration,
        Math.min(6, inspiration + (fate ? 1 : 0)),
      );
      assert.deepEqual(f.p.snapshot.random, initialRandom);
      assert.equal(f.p.snapshot.rngCursor, cursor);
      const publicView = physicalView(f.p);
      assert.equal(publicView.active.options[0].id, 'continue');
      assert.equal(JSON.stringify(publicView).includes('privateLooks'), false);
      drain(f, id);
      assert.equal(f.p.snapshot.parents[0].returnCount, 1);
    });

test('last nonempty card never resets; actual empty resets discard exactly once', () => {
  for (const empty of [false, true]) {
    const f = fresh(({ context }) => {
      const h = context.preparation.heroes[0];
      h.discard = h.deck.splice(empty ? 0 : 1);
    });
    const original = structuredClone(f.context.preparation.heroes[0]);
    const id = begin(f);
    assert.equal(
      f.p.snapshot.random.filter((r) => r.id.endsWith('/look-reset')).length,
      empty ? 1 : 0,
    );
    const looked = f.p.snapshot.resolution.privateLooks[0].copy;
    assert.equal(f.p.snapshot.resolution.resources.preparation.heroes[0].deck[0], looked);
    if (!empty)
      assert.deepEqual(
        f.p.snapshot.resolution.resources.preparation.heroes[0].discard,
        original.discard,
      );
    const pending = structuredClone(f.p);
    validatePhysical(f.p);
    assert.deepEqual(f.p, pending);
    drain(f, id);
    assert.equal(
      f.p.snapshot.random.filter((r) => r.id.endsWith('/look-reset')).length,
      empty ? 1 : 0,
    );
  }
});

for (const first of ['look', 'spend'])
  test(`material cap order ${first} first preserves the chosen result`, () => {
    const f = fresh(({ ir, context }) => {
      context.preparation.heroes[0].inspiration = 6;
      for (const d of ir.definitions.filter((d) => d.cardId.includes('damage'))) {
        d.body = [{ op: 'keep-faceup' }];
        d.persistent = [
          {
            op: 'mandatory-spend',
            window: 'before-interact',
            token: 'threat',
            resource: 'inspiration',
            n: 1,
          },
        ];
      }
    });
    const id = begin(f, [
      {
        kind: 'suffer',
        hero: 0,
        face: 'faceup',
        cards: [{ family: 'damage', amount: 1 }],
        prevention: [],
      },
    ]);
    assert.equal(f.p.snapshot.active.purpose, 'interaction-order');
    drain(f, id, first);
    assert.equal(
      f.p.snapshot.resolution.resources.preparation.heroes[0].inspiration,
      first === 'look' ? 5 : 6,
    );
  });

test('multiple damage obligations are included and guaranteed resources make a safe order possible', () => {
  const f = fresh(({ ir, context }) => {
    context.preparation.heroes[0].inspiration = 1;
    ir.policies[0].effects.push({ op: 'before-interact-inspiration', amount: 1 });
    for (const d of ir.definitions.filter((d) => d.cardId.includes('damage'))) {
      d.body = [{ op: 'keep-faceup' }];
      d.persistent = [
        {
          op: 'mandatory-spend',
          window: 'before-interact',
          token: 'threat',
          resource: 'inspiration',
          n: 1,
        },
      ];
    }
  });
  const id = begin(f, [
    {
      kind: 'suffer',
      hero: 0,
      face: 'faceup',
      cards: [{ family: 'damage', amount: 2 }],
      prevention: [],
    },
  ]);
  assert.equal(
    f.p.snapshot.resolution.interactionWindow.remaining.filter((e) => e.kind === 'spend').length,
    2,
  );
  drain(f, id, 'inspiration');
  assert.equal(f.p.snapshot.resolution.resources.preparation.heroes[0].inspiration, 1);
});

test('public pending cursor is independent of the hidden top identity/fate', () => {
  const a = fresh(({ catalog }) => {
      catalog.skills.find((c) => c.id === 'basic-1').fate = 0;
    }),
    b = fresh(({ context, catalog }) => {
      catalog.skills.find((c) => c.id === 'basic-1').fate = 0;
      context.preparation.heroes[0].deck.reverse();
    });
  // Same source parent id, independent of private card population.
  const id = '00000000-0000-4000-8000-000000000099';
  const program = (f) => ({
    ...f.program([
      { kind: 'event', hero: 0, event: 'before-interact', threat: false, sufferedFear: 0 },
    ]),
    interactionLookRules: 'source-interaction-look-v1',
  });
  openPhysical(a.p, source, program(a), a.context, undefined, id);
  openPhysical(b.p, source, program(b), b.context, undefined, id);
  assert.notEqual(
    a.p.snapshot.resolution.privateLooks[0].copy,
    b.p.snapshot.resolution.privateLooks[0].copy,
  );
  assert.notEqual(
    a.p.snapshot.resolution.privateLooks[0].fate,
    b.p.snapshot.resolution.privateLooks[0].fate,
  );
  assert.deepEqual(a.p.snapshot.active, b.p.snapshot.active);
  assert.deepEqual(physicalView(a.p), physicalView(b.p));
});

test('old definition hash, missing look coverage, unknown policy and client programs fail closed', () => {
  const f = fresh();
  for (const mutate of [
    (ir) => {
      ir.policies[0].definitionHash =
        '80a487fccf0a7f63fac54e176d6a51bdd504d859dc00146c2420cf7ec4316741';
    },
    (ir) => {
      ir.policies = [];
    },
    (ir) => {
      ir.policies[0].effects[0].op = 'before-interact-unknown';
    },
    (ir) => {
      delete ir.interactionLook;
    },
  ]) {
    const ir = structuredClone(f.ir);
    mutate(ir);
    assert.throws(() => compilePhysicalFronts(f.raw, ir, f.catalog));
  }
});

test('hidden-dependent funding and true cardless preflight have uniform gates and full-state equality', () => {
  const f = fresh();
  const p = f.p;
  p.cycle = { interactionLookRules: 'source-interaction-look-v1' };
  p.snapshot.resolution.resources = structuredClone(f.context);
  const s = {
    physical: p,
    content: f.catalog,
    preparation: p.snapshot.resolution.resources.preparation,
  };
  for (const fate of [0, 1]) {
    for (const c of f.catalog.skills) c.fate = fate;
    p.fronts.catalog = structuredClone(f.catalog);
    // Catalog and its frozen copy remain the same object in this pure preflight fixture.
    s.preparation.heroes[0].inspiration = 0;
    const copy = p.snapshot.decks.damage[0],
      card = f.raw.cards.find((c) => c.copies.some((x) => x.id === copy));
    p.snapshot.areas[0].damage = [copy];
    p.snapshot.resolution.faceup = [copy];
    p.fronts.artifact.definitions.find((d) => d.cardId === card.id).persistent = [
      {
        op: 'mandatory-spend',
        window: 'before-interact',
        token: 'threat',
        resource: 'inspiration',
        n: 1,
      },
    ];
    const before = structuredClone(s);
    assert.throws(
      () => runtime.requireBeforeInteraction(s, 'hero-1', true),
      (e) => e.status === 409 && e.code === 'INTERACTION_HIDDEN_FUNDING',
    );
    assert.deepEqual(s, before);
  }
  p.snapshot.areas[0].damage = [];
  p.snapshot.resolution.faceup = [];
  s.preparation.heroes[0].deck = [];
  s.preparation.heroes[0].discard = [];
  const before = structuredClone(s);
  assert.throws(
    () => runtime.requireBeforeInteraction(s, 'hero-1', false),
    (e) => e.code === 'INTERACTION_CARDLESS',
  );
  assert.deepEqual(s, before);
  assert.ok(s.preparation.heroes[0].prepared.length, 'prepared cards were not borrowed');
});
