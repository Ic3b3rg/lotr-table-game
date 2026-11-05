import test from 'node:test';
import assert from 'node:assert/strict';
import { searchRuntime } from './search-runtime-helper.mjs';

test('the paid binary choice keeps both source effects and never charges a second action', () => {
  for (const event of ['RESTORE', 'STUDY']) {
    const f = searchRuntime(),
      before = structuredClone(f.state.journey);
    f.commit();
    assert.equal(f.state.round.heroes[0].actionsUsed, 1);
    assert.equal(f.sc.pending.kind, 'choice');
    assert.deepEqual(
      f.sc.pending.options.map((o) => o.event),
      ['RESTORE', 'STUDY'],
    );
    f.answer({ kind: 'choice', event });
    const q = f.physical.snapshot.active;
    if (event === 'RESTORE') {
      assert.equal(f.sc.pending.kind, 'message');
      assert.equal(f.physical.snapshot.parents.at(-1).results[0].kind, 'search-recovery');
      assert.deepEqual(f.physical.snapshot.parents.at(-1).results[0].returned, {
        damage: 0,
        fear: 0,
      });
    } else {
      assert.equal(q.mode, 'scout');
      assert.equal(q.options.length, 2);
      f.answer({
        kind: 'physical-scout',
        prepare: q.options[0].id,
        top: [q.options[1].id],
        bottom: [],
        discard: null,
      });
    }
    assert.equal(f.i.stopped, false);
    f.answer({ kind: 'ack' });
    assert.equal(f.state.round.heroes[0].actionsUsed, 1);
    assert.equal(f.i.stopped, true);
    assert.equal(f.i.visible, false);
    assert.equal(f.sc.play.active, null);
    assert.deepEqual(f.state.journey, before);
    assert.ok(f.physical.snapshot.parents.every((p) => p.returnCount === 1));
  }
});
test('all three count outcomes use real cards, local result and paid conversions', () => {
  for (const converted of [0, 1, 2]) {
    const f = searchRuntime({ role: 'challenge' }),
      h = f.state.preparation.heroes[0];
    f.commit();
    f.answer({ kind: 'physical-choice', option: 'reveal' });
    for (let n = 0; n < converted; n++)
      f.answer({ kind: 'physical-choice', option: 'inspiration' });
    f.answer({ kind: 'physical-choice', option: 'resolve' });
    assert.equal(f.i.variables.tally, converted);
    assert.equal(f.sc.play.tests[0].successes, converted);
    assert.equal(f.sc.play.tests[0].heroId, h.heroId);
    if (!converted) assert.equal(f.sc.pending.kind, 'message');
    else if (converted === 1) {
      const q = f.physical.snapshot.active;
      assert.equal(q.scoutPrepareAllowed, false);
      assert.equal(q.options.length, 2);
      f.answer({
        kind: 'physical-scout',
        prepare: null,
        discard: null,
        top: q.options.map((o) => o.id).reverse(),
        bottom: [],
      });
    } else {
      const q = f.physical.snapshot.active;
      assert.deepEqual(
        q.options.map((o) => o.id),
        ['scout', 'prepare-discard'],
      );
      f.answer({ kind: 'physical-choice', option: 'prepare-discard' });
      const cards = f.physical.snapshot.active;
      assert.equal(cards.minimum, 1);
      assert.equal(cards.options.length, 2);
      f.answer({ kind: 'physical-select', ids: [cards.options[0].id] });
      assert.ok(f.state.preparation.heroes[0].prepared.includes(cards.options[0].id));
    }
    f.answer({ kind: 'ack' });
    assert.equal(f.i.stopped, true);
    assert.equal(f.sc.play.active, null);
    assert.equal(f.state.round.heroes[0].actionsUsed, 1);
    assert.equal(f.state.journey.travel.remaining, 1);
  }
});
test('the complete continuation rejects an unavailable future preparation before action or random draws', () => {
  const f = searchRuntime({
    role: 'challenge',
    edit: (raw, pack) => {
      pack.preparedEffects = [
        {
          skillId: raw.context.preparation.heroes[0].deck[0].split(':')[0],
          cardHash: 'a'.repeat(64),
          effect: 'requires-capability',
          capability: 'invented-unavailable-preparation',
        },
      ];
    },
  });
  const before = structuredClone(f.state);
  assert.throws(() => f.commit(), /capacità|preparazione/i);
  assert.deepEqual(f.state, before);
});
