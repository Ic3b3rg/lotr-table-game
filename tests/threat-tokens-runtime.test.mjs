import test from 'node:test';
import assert from 'node:assert/strict';
import { threatTokenRuntime, finishThreatTest } from './threat-tokens-runtime-helper.mjs';

test('failed wisdom returns visibly and a new attempt pays a new action before a real converted success', () => {
  const f = threatTokenRuntime(),
    before = structuredClone(f.state.journey);
  f.commit();
  assert.equal(f.state.round.heroes[0].actionsUsed, 1);
  finishThreatTest(f);
  assert.equal(f.sc.pending.kind, 'message');
  f.answer({ kind: 'ack' });
  assert.equal(f.i.visible, true);
  assert.equal(f.i.settled, true);
  assert.equal(f.sc.play.active, null);
  assert.equal(f.sc.play.tests[0].successes, 0);
  assert.equal(f.sc.play.tests[0].stat, 'wisdom');
  f.commit();
  assert.equal(f.state.round.heroes[0].actionsUsed, 2);
  finishThreatTest(f, 2);
  assert.equal(f.sc.play.tests[1].successes, 2);
  assert.equal(f.sc.play.tests[1].target, 2);
  assert.equal(f.state.preparation.heroes[0].inspiration, 1);
  assert.equal(f.physical.snapshot.resolution.resources.boonCustody[0].kind, 'determined');
  assert.equal(f.sc.globals.inventedThreat, 5);
  f.answer({ kind: 'ack' });
  assert.equal(f.i.stopped, true);
  assert.equal(f.i.visible, false);
  assert.equal(f.sc.play.active, null);
  assert.deepEqual(f.state.journey, before);
  assert.equal(f.sc.play.attempts.length, 2);
  assert.ok(f.sc.play.attempts.every((a) => a.returned && a.cost === 1));
  assert.ok(f.physical.snapshot.parents.every((p) => p.returnCount === 1));
});
test('only the attested threat addition floors 0/1/3/4/9 while costs, reward and removal happen once', () => {
  for (const threat of [0, 1, 3, 4, 9]) {
    const f = threatTokenRuntime({ threat, success: 1, fate: 0 });
    f.commit();
    finishThreatTest(f);
    assert.equal(f.sc.globals.inventedThreat, Math.max(0, threat - 4));
    assert.equal(f.sc.globals.inventedChain, 7);
    const reward = structuredClone(f.physical.snapshot.resolution.resources.boonCustody);
    assert.equal(reward.length, 1);
    f.answer({ kind: 'ack' });
    assert.equal(f.state.round.heroes[0].actionsUsed, 1);
    assert.equal(f.sc.play.active, null);
    assert.deepEqual(f.physical.snapshot.resolution.resources.boonCustody, reward);
    assert.equal(f.i.stopped, true);
  }
});
test('spirit uses real cards: inspiration is capped; failure follows null ownership to a real fear card and cleanup', () => {
  for (const success of [false, true]) {
    const f = threatTokenRuntime({ role: 'null-product', success: success ? 1 : 0, fate: 0 }),
      before = f.physical.snapshot.decks.fear.length;
    f.commit();
    finishThreatTest(f);
    if (success) {
      assert.equal(f.state.preparation.heroes[0].inspiration, 3);
      assert.equal(f.sc.pending.kind, 'message');
      f.answer({ kind: 'ack' });
    } else {
      f.finishPhysical();
      assert.equal(f.sc.pending, null);
      assert.ok(f.physical.snapshot.parents.at(-1).results.some((r) => r.kind === 'suffer'));
    }
    assert.equal(f.sc.play.tests[0].stat, 'spirit');
    assert.equal(f.sc.play.tests[0].successes, success ? 2 : 0);
    assert.equal(f.physical.snapshot.decks.fear.length, before - (success ? 0 : 1));
    assert.equal(f.physical.snapshot.areas[0].fear.length, success ? 0 : 1);
    assert.equal(f.i.stopped, true);
    assert.equal(f.sc.play.active, null);
    assert.equal(f.state.round.heroes[0].actionsUsed, 1);
    assert.ok(f.sc.effects.every((e) => ![89, 90, 91].includes(e.state)));
  }
});
test('unknown stock gates the whole retry interaction before its failure or success can spend or draw', () => {
  const f = threatTokenRuntime({ verified: false }),
    before = structuredClone(f.state);
  assert.throws(
    () => f.commit(),
    (e) => e.code === 'SCENARIO_BOON_CAPABILITY',
  );
  assert.deepEqual(f.state, before);
});
