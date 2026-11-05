import test from 'node:test';
import assert from 'node:assert/strict';
import { baseRuntime } from './base-products-runtime-helper.mjs';

test('cards and paid conversions produce success, a capped reward and cleanup without touching the chain or title', () => {
  for (const inspiration of [2, 3]) {
    const f = baseRuntime({ inspiration });
    f.commit();
    assert.equal(f.state.round.heroes[0].actionsUsed, 1);
    assert.equal(f.physical.snapshot.active.options[0].id, 'reveal');
    assert.throws(
      () => f.answer({ kind: 'choice', event: 'SOLVED' }),
      /operazione|richiesta|fisic/i,
    );
    f.answer({ kind: 'physical-choice', option: 'reveal' });
    f.answer({ kind: 'physical-choice', option: 'inspiration' });
    f.answer({ kind: 'physical-choice', option: 'inspiration' });
    assert.equal(f.state.preparation.heroes[0].inspiration, inspiration - 2);
    f.answer({ kind: 'physical-choice', option: 'resolve' });
    assert.equal(f.sc.play.tests[0].successes, 2);
    assert.equal(f.sc.pending.kind, 'message');
    assert.equal(f.state.preparation.heroes[0].inspiration, inspiration - 1);
    f.answer({ kind: 'ack' });
    assert.equal(f.sc.globals.inventedChain, 7);
    assert.equal(f.physical.snapshot.lastStand.titles.length, 0);
    assert.equal(f.i.visible, false);
    assert.equal(f.i.stopped, true);
    assert.equal(f.sc.play.active, null);
    assert.equal(f.sc.play.attempts[0].returned, true);
    assert.equal(f.state.journey.travel.remaining, 1);
    assert.ok(f.physical.snapshot.parents.every((p) => p.returnCount === 1));
  }
  const f = baseRuntime({ success: 1, fate: 0, inspiration: 3 });
  f.commit();
  f.finishPhysical();
  assert.equal(f.state.preparation.heroes[0].inspiration, 3);
  f.answer({ kind: 'ack' });
  assert.equal(f.sc.globals.inventedChain, 7);
});

test('a failed paid test offers its one sprint, including a genuine free decline, then removes and returns', () => {
  for (const destinationSpaceId of [null, 'invented-next']) {
    const f = baseRuntime();
    f.commit();
    f.finishPhysical();
    assert.equal(f.sc.play.tests[0].successes, 0);
    assert.equal(f.sc.pending.kind, 'sprint');
    assert.equal(f.sc.pending.heroId, f.heroes[0].heroId);
    assert.equal(f.sc.pending.actorPlayerId, f.heroes[0].playerId);
    const before = structuredClone(f.state);
    assert.throws(() => f.answer({ kind: 'choice', event: 'LEAVE' }), /operazione|richiesta/i);
    // The direct helper increments revision for a rejected command; gameplay must remain untouched.
    assert.deepEqual({ ...f.state, revision: before.revision }, before);
    f.answer({ kind: 'source-sprint', destinationSpaceId });
    assert.equal(f.state.journey.heroes[0].spaceId, destinationSpaceId ?? 'invented-space');
    assert.equal(f.state.round.heroes[0].actionsUsed, 1);
    assert.equal(f.state.journey.travel.remaining, 1);
    assert.equal(f.i.visible, false);
    assert.equal(f.i.stopped, true);
    assert.equal(f.sc.play.active, null);
    assert.equal(f.sc.globals.inventedChain, 7);
  }
});

test('the base continuation preflights every admitted branch before cost and rejects unverified product input', () => {
  for (const edit of [
    (f) => f.state.mapGeneration.projection.context.ownedProductIds.push(5),
    (f) => f.state.mapGeneration.projection.context.ownedProductIds.push(987),
    (f) => f.sc.pack.manifest.baseProducts.ownedProductIds.push(5),
    (f) => f.sc.pack.manifest.baseProducts.ownedProductIds.push(987),
    (f) => delete f.sc.pack.manifest.baseProducts.ownedProductIds,
    (f) => {
      const d = f.sc.pack.definitions.find((d) => d.source === f.i.definition);
      d.states.find((s) => s.index === 91).actions[0].products = ['example.assets:9999'];
    },
  ]) {
    const f = baseRuntime();
    edit(f);
    const before = structuredClone(f.state);
    assert.throws(() => f.commit(), /prodott|capacità|seguito|attestat/i);
    assert.deepEqual(f.state, before);
  }
});
