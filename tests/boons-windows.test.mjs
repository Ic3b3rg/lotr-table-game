import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runtimeBoons, boonGrant, inventedOutcome } from './fixtures/boons.mjs';
import { validatePhysical } from '../dist/physical-resolution-library.mjs';
import { suffer } from './fixtures/physical-resolution.mjs';
import { inventedLastStand } from './fixtures/last-stand.mjs';

const attack = {
  kind: 'attack-test',
  hero: 0,
  stat: 'might',
  groupId: 'invented-group',
  slots: [],
  replaceCopy: null,
};
function finish(f) {
  for (let n = 0; f.p.snapshot.active && n < 80; n++) {
    const q = f.p.snapshot.active;
    assert.equal(q.kind, 'decision');
    f.answer(
      q.mode === 'allocate'
        ? { kind: 'physical-allocate', ability: q.options[0]?.id ?? null, damage: 0, fear: 0 }
        : q.mode === 'select'
          ? { kind: 'physical-select', ids: q.options.slice(0, q.minimum).map((o) => o.id) }
          : (['resolve', 'close', 'close-rest'].find((id) => q.options.some((o) => o.id === id)) ??
            q.options[0].id),
    );
  }
  assert.equal(f.p.snapshot.active, null);
}

test('attested passive hits apply once at zero successes and the optional success costs exactly its boon', () => {
  const f = runtimeBoons((f) => {
    f.catalog.skills.forEach((s) => {
      s.success = 0;
      s.fate = 0;
    });
  });
  f.open([boonGrant(0, 'hidden'), boonGrant(0, 'emboldened'), attack]);
  let v = f.p.snapshot.resolution.attackTest;
  assert.equal(v.successes, 0);
  assert.equal(v.addedHits, 4);
  const option = f.p.snapshot.active.options.find((o) => o.id.includes('add-success'));
  assert.ok(option);
  f.answer(option.id);
  v = f.p.snapshot.resolution.attackTest;
  assert.equal(v.successes, 5);
  assert.equal(v.addedHits, 4);
  assert.ok(!f.p.snapshot.active.options.some((o) => o.id.includes('add-success')));
  finish(f);
  const result = f.p.snapshot.parents[0].results.at(-1).attack;
  assert.equal(result.hits, 4);
  assert.equal(result.successes, 5);
  assert.equal(f.p.snapshot.resolution.resources.boonCustody.length, 1);
  assert.equal(
    f.p.snapshot.resolution.boonEvents.filter((e) => e.operation === 'discard').length,
    1,
  );
});

test('mandatory defense discards before testing even when a cannot effect prevents damage prevention', () => {
  for (const blocked of [false, true]) {
    const f = runtimeBoons((f) => {
      f.catalog.heroes.forEach((h) => {
        h.stats.damage = 12;
        h.stats.fear = 12;
      });
      f.catalog.skills.forEach((s) => {
        s.success = 0;
        s.fate = 0;
      });
      if (blocked)
        for (const d of f.ir.definitions.filter((d) => d.cardId.includes('damage'))) {
          d.body = [{ op: 'keep-faceup' }];
          d.persistent = [
            { op: 'prohibit', window: 'continuous', operation: 'prevent-damage-including-negate' },
          ];
        }
    });
    const outcome = inventedOutcome('hero-1', { damage: 3, fear: 1 });
    outcome.sealed = false;
    f.open([
      ...(blocked ? [{ ...suffer(0, 1, 0), face: 'faceup' }] : []),
      boonGrant(0, 'hidden'),
      { kind: 'enemy-attack', hero: 0, negate: 'might', outcome, addition: null },
    ]);
    assert.ok(f.p.snapshot.resolution.sourceTest, 'the negate test is still performed');
    assert.equal(f.p.snapshot.resolution.resources.boonCustody.length, 0);
    assert.equal(f.p.snapshot.resolution.boonEvents.at(-1).reason, 'before-attacked-test');
    assert.equal(
      f.p.snapshot.parents[0].results.at(-1).enemyOutcome.prevented.damage,
      blocked ? 0 : 3,
    );
    finish(f);
    const result = f.p.snapshot.parents[0].results.at(-1).enemyOutcome;
    assert.equal(result.suffered.damage, blocked ? 3 : 0);
    assert.equal(result.suffered.fear, 1);
    assert.doesNotThrow(() => validatePhysical(JSON.parse(JSON.stringify(f.p))));
  }
});

test('mandatory discard uses actual suffering and actual nearby living enemies at end of turn', () => {
  for (const near of [false, true]) {
    const f = runtimeBoons();
    f.p.version = 3;
    const spatial = {
      heroes: f.heroes,
      connections: [['invented-space', 'invented-adjacent']],
      enemies: [{ id: 'invented-enemy', spaceId: near ? 'invented-adjacent' : 'invented-far' }],
    };
    f.open([boonGrant(0, 'emboldened'), { kind: 'end-turn', hero: 0 }], spatial);
    finish(f);
    assert.equal(f.p.snapshot.resolution.resources.boonCustody.length, near ? 1 : 0);
    if (near) {
      f.open([{ ...suffer(0, 0, 1), face: 'facedown' }], spatial);
      finish(f);
      assert.equal(f.p.snapshot.resolution.resources.boonCustody.length, 0);
      assert.equal(f.p.snapshot.resolution.boonEvents.at(-1).reason, 'actually-suffered');
    }
  }
});

test('exchange removes the selected converted symbols, preserves paid resources and off-card successes', () => {
  const f = runtimeBoons((f) => {
    f.catalog.heroes[0].stats.might = 2;
    f.catalog.skills.forEach((s) => {
      s.success = 0;
      s.fate = 0;
    });
    f.catalog.skills.find((s) => s.id === 'basic-1').fate = 1;
    f.catalog.skills.find((s) => s.id === 'basic-2').success = 1;
  });
  f.open([boonGrant(0, 'determined'), boonGrant(0, 'hidden'), attack]);
  f.answer(f.p.snapshot.active.options.find((o) => o.id.includes('add-success')).id);
  f.answer('inspiration');
  assert.equal(f.p.snapshot.resolution.attackTest.successes, 7);
  assert.equal(f.p.snapshot.resolution.resources.preparation.heroes[0].inspiration, 1);
  f.answer(f.p.snapshot.active.options.find((o) => o.id.includes('exchange-test-cards')).id);
  const q = f.p.snapshot.active;
  assert.equal(q.mode, 'select');
  assert.equal(q.minimum, 0);
  assert.equal(q.maximum, 2);
  assert.ok(q.options.some((o) => o.id === 'basic-1:1'));
  f.answer({ kind: 'physical-select', ids: ['basic-1:1'] });
  assert.equal(f.p.snapshot.resolution.attackTest.successes, 6);
  assert.equal(f.p.snapshot.resolution.resources.preparation.heroes[0].inspiration, 1);
  assert.deepEqual(f.p.snapshot.resolution.revealed[0].cards, ['basic-2:1', 'basic-3:1']);
  assert.ok(!f.p.snapshot.active.options.some((o) => o.id.includes('exchange-test-cards')));
  finish(f);
  const h = f.p.snapshot.resolution.resources.preparation.heroes[0];
  assert.equal(new Set([...h.deck, ...h.discard, ...h.prepared]).size, 15);
  assert.doesNotThrow(() => validatePhysical(JSON.parse(JSON.stringify(f.p))));
});

test('reachable title Rest checks its boon continuation before the prepared cost, then returns through the same consumer', () => {
  for (const verified of [false, true]) {
    const f = runtimeBoons((f) => {
      f.lastStandInput = inventedLastStand(f.raw);
      f.lastStandInput.awards[1].minimum = 1;
      f.catalog.heroes[0].stats.damage = 1;
      f.catalog.skills.forEach((s) => {
        s.success = 1;
        s.fate = 0;
      });
    }, verified);
    f.p.version = 3;
    const spatial = { heroes: f.heroes, connections: [], enemies: [] };
    f.open([suffer(0, 1, 0)], spatial);
    f.answer('reveal');
    f.answer('resolve');
    assert.equal(f.p.snapshot.active, null);
    const title = f.p.snapshot.lastStand.titles[0];
    assert.ok(title && !title.removed);
    f.open([{ kind: 'end-turn', hero: 0 }], spatial);
    const option = f.p.snapshot.active.options.find((o) => o.id.startsWith('title-rest:'));
    assert.ok(option);
    if (verified) {
      assert.equal(option.unavailable, undefined);
      f.answer(option.id);
      finish(f);
      assert.equal(f.p.snapshot.lastStand.titles[0].removed, true);
      assert.equal(f.p.snapshot.resolution.resources.boonCustody[0].kind, 'determined');
      assert.ok(
        !f.p.snapshot.resolution.resources.preparation.heroes[0].discard.includes(title.copy),
      );
    } else {
      assert.match(option.unavailable, /riserva/i);
      const before = structuredClone(f.p);
      assert.throws(() => f.answer(option.id));
      assert.deepEqual(f.p, before);
      assert.ok(
        f.p.snapshot.resolution.resources.preparation.heroes[0].prepared.includes(title.copy),
      );
      f.answer('close-rest');
      assert.equal(f.p.snapshot.lastStand.titles[0].removed, false);
    }
    assert.doesNotThrow(() => validatePhysical(f.p));
  }
});

test('exchange recycles only discarded cards and keeps every revealed and prepared identity conserved', () => {
  const f = runtimeBoons((f) => {
    f.catalog.heroes[0].stats.might = 14;
    f.catalog.skills.forEach((s) => {
      s.success = 0;
      s.fate = 0;
    });
  });
  f.open([boonGrant(0), attack]);
  assert.equal(f.p.snapshot.resolution.revealed[0].cards.length, 14);
  f.answer(f.p.snapshot.active.options.find((o) => o.id.includes('exchange-test-cards')).id);
  const selected = f.p.snapshot.active.options.map((o) => o.id);
  f.answer({ kind: 'physical-select', ids: selected });
  const held = f.p.snapshot.resolution.revealed[0].cards;
  assert.deepEqual(new Set(held), new Set(selected));
  assert.equal(new Set(held).size, 14);
  assert.ok(!held.includes(f.context.preparation.heroes[0].prepared[0]));
  finish(f);
  const h = f.p.snapshot.resolution.resources.preparation.heroes[0];
  assert.equal(h.deck.length, 14);
  assert.equal(h.discard.length, 0);
  assert.equal(new Set([...h.deck, ...h.prepared]).size, 15);
  assert.doesNotThrow(() => validatePhysical(f.p));
});

test('conditional acquisition reads direct suffering even when a front returns the card and a child suffers separately', () => {
  const f = runtimeBoons((f) => {
    f.catalog.skills.forEach((s) => {
      s.success = 0;
      s.fate = 0;
    });
    for (const d of f.ir.definitions.filter((d) => d.cardId.includes('damage')))
      d.body = [
        { op: 'suffer', hero: 'self', family: 'fear', n: 1, face: 'down' },
        { op: 'discard-self' },
      ];
  });
  const outcome = inventedOutcome('hero-1', { damage: 1, fear: 0 });
  outcome.sealed = false;
  const addition = boonGrant(0, 'hidden').addition;
  addition.predicate = 'zero-damage-and-fear';
  f.open([
    boonGrant(0, 'emboldened'),
    { kind: 'enemy-attack', hero: 0, negate: 'might', outcome, addition },
  ]);
  finish(f);
  const result = f.p.snapshot.parents[0].results.at(-1).enemyOutcome;
  assert.equal(result.suffered.damage, 1);
  assert.equal(result.suffered.fear, 0);
  assert.equal(result.childSources[0].family, 'fear');
  assert.equal(f.p.snapshot.areas[0].damage.length, 0);
  assert.equal(f.p.snapshot.areas[0].fear.length, 1);
  assert.equal(f.p.snapshot.resolution.resources.boonCustody.length, 0);
  const grant = boonGrant(0, 'hidden');
  grant.addition.predicate = 'zero-damage-and-fear';
  grant.outcome.childSources = [
    { source: 'invented-child', recipientHeroId: 'hero-1', family: 'fear', amount: 1 },
  ];
  f.open([grant]);
  assert.equal(f.p.snapshot.resolution.resources.boonCustody[0].kind, 'hidden');
});

test('a zero direct packet does not require stock for an impossible positive-suffering acquisition', () => {
  const f = runtimeBoons(() => {}, false),
    outcome = inventedOutcome();
  outcome.sealed = false;
  const addition = boonGrant(0, 'hidden').addition;
  addition.predicate = 'damage-positive';
  f.open([{ kind: 'enemy-attack', hero: 0, negate: 'might', outcome, addition }]);
  assert.equal(f.p.snapshot.active.kind, 'decision');
  finish(f);
  assert.deepEqual(f.p.snapshot.parents[0].results[0].enemyOutcome.suffered, {
    damage: 0,
    fear: 0,
  });
  assert.deepEqual(f.p.snapshot.resolution.resources.boonCustody, []);
});
