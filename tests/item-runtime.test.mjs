import test from 'node:test';
import assert from 'node:assert/strict';
import { itemRuntime } from './item-runtime-helper.mjs';
test('one paid test converts cards, awards one equipped copy and returns only after the item callback', () => {
  const f = itemRuntime();
  f.commit();
  assert.equal(f.state.round.heroes[0].actionsUsed, 1);
  assert.equal(
    f.physical.runs.filter((r) => r.program.children.some((c) => c.kind === 'test')).length,
    1,
  );
  f.answer({ kind: 'physical-choice', option: 'reveal' });
  f.answer({ kind: 'physical-choice', option: 'inspiration' });
  f.answer({ kind: 'physical-choice', option: 'inspiration' });
  f.answer({ kind: 'physical-choice', option: 'resolve' });
  assert.equal(f.sc.play.tests.length, 1);
  assert.equal(f.sc.play.tests[0].successes, 2);
  assert.equal(f.sc.pending.kind, 'message');
  assert.equal(f.physical.snapshot.resolution.resources.itemCustody, undefined);
  f.answer({ kind: 'ack' });
  const r = f.physical.snapshot.resolution.resources;
  assert.equal(r.itemCustody.length, 1);
  assert.equal(r.itemCustody[0].copy, 'trinket:1');
  assert.equal(r.depletion[0].remaining, 2);
  assert.equal(f.i.visible, true);
  assert.equal(f.sc.play.attempts[0].returned, false);
  assert.deepEqual(
    f.physical.snapshot.active.options.map((o) => o.id),
    f.heroes.map((h) => h.heroId),
  );
  f.answer({ kind: 'physical-choice', option: f.heroes[1].heroId });
  assert.equal(f.physical.snapshot.resolution.resources.itemCustody[0].heroId, f.heroes[1].heroId);
  assert.equal(f.i.visible, false);
  assert.equal(f.i.stopped, true);
  assert.equal(f.sc.play.active, null);
  assert.equal(f.state.journey.travel.remaining, 1);
  assert.equal(f.sc.play.lore, 0);
  assert.equal(f.physical.snapshot.lastStand.titles.length, 0);
  assert.ok(f.physical.snapshot.parents.every((p) => p.returnCount === 1));
});
test('failure returns to the source wait; a new attempt pays again and keeps the item absent', () => {
  const f = itemRuntime();
  for (let n = 0; n < 2; n++) {
    f.commit();
    f.finishPhysical();
    assert.equal(f.sc.pending.kind, 'message');
    f.answer({ kind: 'ack' });
    assert.equal(f.i.state, 12);
    assert.equal(f.i.visible, true);
    assert.equal(f.i.stopped, false);
    assert.equal(f.sc.play.active, null);
    assert.equal(f.sc.play.tests.length, n + 1);
    assert.equal(f.physical.snapshot.resolution.resources.itemCustody, undefined);
  }
  assert.equal(f.state.round.heroes[0].actionsUsed, 2);
  const before = structuredClone(f.state);
  assert.throws(() => f.commit());
  assert.deepEqual(f.state, before);
});
test('uncompiled upgrade, wrong product, card and policy fail before cost, cards or RNG', () => {
  for (const edit of [
    (f) => (f.sc.play.lore = 26),
    (f) => f.state.mapGeneration.projection.context.ownedProductIds.push(5),
    (f) => (f.state.content.items.find((c) => c.id === 'trinket').quantity = 2),
    (f) => (f.physical.fronts.artifact.policies[0].effects[0].op = 'fear-facedown'),
  ]) {
    const f = itemRuntime();
    edit(f);
    const before = structuredClone(f.state);
    assert.throws(() => f.commit());
    assert.deepEqual(f.state, before);
  }
});
