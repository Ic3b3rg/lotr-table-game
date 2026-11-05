import test from 'node:test';
import assert from 'node:assert/strict';
import * as physical from '../dist/physical-resolution-library.mjs';
import { runtime } from './threat-helper.mjs';
import { lastStandFixture } from './fixtures/last-stand.mjs';
import { binding, evidence } from './fixtures/physical-fronts.mjs';
import { source, suffer } from './fixtures/physical-resolution.mjs';
import { threatCompilation } from './fixtures/threat-continuations.mjs';
import { attachLiveGroups } from './fixtures/live-groups.mjs';

function fixture(edit = () => {}, marked = true) {
  const f = lastStandFixture();
  for (const h of f.catalog.heroes) h.stats.damage = h.stats.fear = 20;
  for (const d of f.ir.definitions) d.body = [{ op: 'keep-faceup' }];
  edit(f);
  const pack = threatCompilation().pack;
  if (marked) attachLiveGroups(pack);
  const action = structuredClone(
    pack.definitions.find((d) => d.source === 'example.assets:811').states[1].actions[1],
  );
  action.trial = {
    stat: 'wisdom',
    target: 99,
    failure: { family: 'damage', amount: 1, face: 'faceup' },
  };
  const p = physical.freezePhysical(
    f.raw,
    binding,
    f.heroes,
    '1'.repeat(64),
    undefined,
    { artifact: physical.compilePhysicalFronts(f.raw, f.ir, f.catalog), catalog: f.catalog },
    physical.compileLastStand(f.raw, f.lastStandInput),
  );
  p.version = 3;
  const state = { physical: p, preparation: f.context.preparation, scenario: { pack } };
  const program = () => runtime.spawnPhysicalProgram(state, action);
  const spatial = { heroes: f.heroes, connections: [] };
  let revision = 0;
  const answer = (input) => {
    const q = p.snapshot.active;
    physical.answerPhysical(p, q.runId, input, evidence(revision++, q.actorPlayerId));
  };
  const drain = (observe = () => {}, preferred = ['0', '1', '2']) => {
    for (let n = 0; p.snapshot.active && n < 150; n++) {
      const q = p.snapshot.active;
      if (q.kind === 'gate') break;
      observe(q);
      answer(
        q.mode === 'allocate'
          ? { kind: 'physical-allocate', ability: null, damage: 0, fear: 0 }
          : {
              kind: 'physical-choice',
              option:
                [...preferred, 'resolve', 'reveal', 'close'].find((id) =>
                  q.options.some((o) => o.id === id),
                ) ?? q.options.at(-1).id,
            },
      );
    }
  };
  const open = (program, effectId) =>
    physical.openPhysical(
      p,
      { ...source, effectId },
      program,
      structuredClone(p.snapshot.resolution?.resources ?? f.context),
      spatial,
    );
  return { f, p, state, action, program, open, drain, answer };
}

test('the actual scenario group-trial program reaches both survivors after slot0 or another slot was defeated', () => {
  for (const defeated of [0, 1]) {
    const x = fixture((f) => {
      f.catalog.heroes[defeated].stats.fear = 1;
    });
    const { f, p } = x;
    x.open(f.program([{ ...suffer(defeated, 0, 1), face: 'faceup' }]), 'invented-prior-defeat');
    x.drain();
    assert.equal(p.snapshot.lastStand.heroes[defeated].defeated, true);
    const retained = structuredClone(p.snapshot.resolution.resources.preparation.heroes[defeated]);
    x.open(x.program(), 'invented-scenario-trial');
    assert.ok(p.snapshot.active, 'survivors still owe the scenario trial');
    assert.equal(x.program().groupRules, 'source-live-groups-v1');
    const tested = [];
    x.drain(
      (q) => {
        assert.notEqual(q.actorHeroId, f.heroes[defeated].heroId);
        assert.ok(q.options.every((o) => o.id !== String(defeated)));
        if (q.title.includes('difficoltà 99')) tested.push(q.actorHeroId);
      },
      ['2', '1', '0'],
    );
    assert.deepEqual(
      tested,
      f.heroes
        .filter((_, n) => n !== defeated)
        .map((h) => h.heroId)
        .reverse(),
    );
    assert.deepEqual(p.snapshot.resolution.resources.preparation.heroes[defeated], retained);
    assert.deepEqual(
      p.snapshot.areas.map((a) => a.damage.length),
      defeated === 0 ? [0, 1, 1] : [1, 0, 1],
    );
    assert.equal(p.snapshot.parents.at(-1).returnCount, 1);
    assert.equal(p.heroes.length, 3);
    assert.equal(p.snapshot.lastStand.lossDue.heroId, f.heroes[defeated].heroId);
    physical.validatePhysical(structuredClone(p));
  }
});

test('a group trial settles a whole source before the next choice and reassigns a defeated chooser', () => {
  const x = fixture((f) => {
    f.catalog.heroes[0].stats.damage = 1;
  });
  x.open(x.program(), 'invented-defeat-during-trial');
  const tested = [],
    chooserAfter = [];
  x.drain((q) => {
    if (x.p.snapshot.lastStand?.heroes[0]?.defeated) {
      assert.notEqual(q.actorHeroId, 'hero-1');
      chooserAfter.push(q.actorHeroId);
    }
    if (q.title.includes('difficoltà 99')) tested.push(q.actorHeroId);
  });
  assert.ok(chooserAfter.length, 'remaining trials happen after the defeat is recorded');
  assert.deepEqual(tested, ['hero-1', 'hero-2', 'hero-3']);
  assert.equal(x.p.snapshot.parents.at(-1).returnCount, 1);
  physical.validatePhysical(structuredClone(x.p));
});

test('a descendant defeats a future recipient before it can receive its group trial', () => {
  const x = fixture((f) => {
    f.catalog.heroes[1].stats.fear = 1;
    for (const d of f.ir.definitions.filter((d) => d.cardId.includes('damage')))
      d.body = [
        {
          op: 'suffer',
          hero: 'each-other-hero-any-distance',
          family: 'fear',
          n: 1,
          face: 'normal',
        },
        { op: 'keep-faceup' },
      ];
  });
  x.open(x.program(), 'invented-descendant-defeats-future-recipient');
  const trials = [];
  x.drain((q) => {
    if (q.title.includes('difficoltà 99')) trials.push(q.actorHeroId);
  });
  assert.deepEqual(trials, ['hero-1', 'hero-3']);
  assert.equal(x.p.snapshot.lastStand.heroes[1].defeated, true);
  assert.equal(x.p.snapshot.areas[1].damage.length, 0);
  assert.equal(x.p.snapshot.parents.at(-1).returnCount, 1);
  physical.validatePhysical(structuredClone(x.p));
});

test('the last survivor suspends the collective parent without a return and historical programs keep their published shape', () => {
  for (const marked of [true, false]) {
    const x = fixture((f) => {
      for (const h of f.catalog.heroes) h.stats.damage = 1;
    }, marked);
    const program = x.program();
    if (!marked) assert.equal(Object.hasOwn(program, 'groupRules'), false);
    x.open(program, 'invented-last-survivor');
    x.drain();
    assert.equal(x.p.snapshot.active.kind, 'gate');
    assert.ok(x.p.snapshot.lastStand.heroes.every((h) => h.defeated));
    assert.equal(x.p.snapshot.parents.at(-1).status, 'suspended');
    assert.equal(x.p.snapshot.parents.at(-1).returnCount, 0);
    physical.validatePhysical(structuredClone(x.p));
  }
});

test('versioned suffering and darkness settle deaths before handing the next negation to a survivor', () => {
  for (const kind of ['group-suffer', 'darkness']) {
    const x = fixture((f) => {
      f.catalog.heroes[0].stats.fear = 1;
    });
    const program = {
      ...x.program(),
      darknessHeroes: [0, 1, 2],
      children: [
        {
          kind,
          hero: 0,
          heroes: [0, 1, 2],
          family: 'fear',
          amount: 2,
          face: 'faceup',
          negate: 'wisdom',
        },
      ],
    };
    if (kind === 'darkness') delete program.children[0].family;
    x.open(program, 'invented-collective-negation-' + kind);
    const recipients = [],
      after = [];
    x.drain((q) => {
      if (q.purpose === 'group-order') assert.ok(q.options.every((o) => /^[012]$/.test(o.id)));
      if (q.mode === 'allocate') {
        assert.equal(q.purpose, 'negation');
        recipients.push(q.actorHeroId);
      }
      if (x.p.snapshot.lastStand?.heroes[0]?.defeated) {
        assert.notEqual(q.actorHeroId, 'hero-1');
        after.push(q.actorHeroId);
      }
    });
    assert.ok(after.length);
    assert.deepEqual(recipients, ['hero-1', 'hero-2', 'hero-3']);
    assert.deepEqual(
      x.p.snapshot.areas.map((a) => a.fear.length),
      [2, 2, 2],
    );
    assert.equal(x.p.snapshot.parents.at(-1).returnCount, 1);
    physical.validatePhysical(structuredClone(x.p));
  }
});

test('one survivor receives one trial, while an unmarked historical program still replays the frozen skip', () => {
  for (const marked of [true, false]) {
    const x = fixture((f) => {
      f.catalog.heroes[0].stats.fear = f.catalog.heroes[1].stats.fear = 1;
    }, marked);
    x.open(
      x.f.program([
        { ...suffer(0, 0, 1), face: 'faceup' },
        { ...suffer(1, 0, 1), face: 'faceup' },
      ]),
      'invented-two-prior-defeats',
    );
    x.drain();
    assert.deepEqual(
      x.p.snapshot.lastStand.heroes.map((h) => h.defeated),
      [true, true, false],
    );
    x.open(x.program(), 'invented-one-survivor');
    const tested = [];
    x.drain((q) => {
      if (q.title.includes('difficoltà 99')) tested.push(q.actorHeroId);
    });
    assert.deepEqual(tested, marked ? ['hero-3'] : []);
    assert.equal(x.p.snapshot.parents.at(-1).returnCount, 1);
    physical.validatePhysical(structuredClone(x.p));
  }
});
