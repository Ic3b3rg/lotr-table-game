import test from 'node:test';
import assert from 'node:assert/strict';
import { lairRuntime, driver } from './lair-victory-runtime-helper.mjs';

test('real derived lair tests include the dynamic bound and persist progress for the next paid attempt, for two to five heroes', () => {
  for (let count = 2; count <= 5; count++) {
    const f = lairRuntime({ count }),
      { state: s, sc, i } = f;
    assert.equal(i.variables.difficulty, count + 2);
    f.commit();
    f.finishPhysical();
    assert.equal(sc.play.tests.at(-1).successes, count + 2);
    assert.equal(sc.play.tests.at(-1).total, count + 2);
    assert.equal(sc.conclusion, undefined, 'equality is still the first result pair');
    assert.equal(i.state, 103);
    f.answer({ kind: 'ack' });
    assert.equal(i.state, 107);
    assert.equal(sc.play.active, null);
    assert.equal(sc.play.attempts[0].returned, true);
    f.commit();
    f.finishPhysical();
    assert.equal(sc.play.tests.at(-1).total, 2 * (count + 2));
    assert.equal(i.state, 104, 'last pair also supplies the overflow fallback');
    assert.equal(s.round.heroes[0].actionsUsed, 2);
    f.answer({ kind: 'ack' }, f.heroes.at(-1).playerId);
    assert.equal(sc.conclusion.outcome, 'victory');
    assert.equal(sc.conclusion.stage, 'campaign-map');
    assert.equal(sc.conclusion.xp.length, count);
    assert.ok(sc.conclusion.xp.every((x) => x.amount === 6));
    assert.equal(sc.play.lore, 3);
    assert.equal(sc.globals.inventedWon, true);
    assert.equal(sc.play.active, null);
    assert.ok(sc.play.attempts.every((a) => a.returned));
    assert.equal(i.stopped, true);
    assert.equal(i.visible, false);
    assert.ok(sc.conclusion.cause.effectId);
    assert.equal(sc.conclusion.cause.attemptId, sc.play.attempts[1].id);
    assert.equal(sc.conclusion.cause.playerId, f.heroes[0].playerId);
    f.answer({ kind: 'ack' });
    f.answer({ kind: 'ack' });
    assert.equal(sc.conclusion.campEntryCount, 1);
    assert.equal(sc.conclusion.transitionCount, 1);
    assert.equal(sc.conclusion.stage, 'camp');
    assert.equal(sc.conclusion.campaign.next.status, 'requires-content');
    assert.ok(f.physical.snapshot.parents.every((p) => p.returnCount === 1));
    assert.equal(s.preparation.heroes.length, count);
  }
});

test('the value immediately after the bound wins without a final combat; a deferred loss is not polled early and every hero keeps XP/property', () => {
  const f = lairRuntime({
      count: 3,
      successes: 6,
      edit: (f) => {
        f.catalog.heroes[2].stats.fear = 1;
      },
    }),
    { state: s, sc } = f;
  f.defeat(2);
  const preserved = structuredClone(s.preparation.heroes[2]);
  f.commit();
  f.finishPhysical();
  assert.equal(sc.play.tests[0].total, 6);
  assert.equal(sc.conclusion, undefined);
  f.answer({ kind: 'ack' });
  assert.equal(sc.conclusion.outcome, 'victory');
  assert.equal(sc.conclusion.xp.length, 3);
  assert.deepEqual(s.preparation.heroes[2], preserved);
  assert.equal(sc.globals.inventedPartySize, 3);
  assert.equal(
    driver.beginHeroFailure(s, 'shadow-start', 'invented-late-loss-request-00000'),
    false,
  );
});

test('the complete victory continuation is checked before any cost, physical draw or RNG', () => {
  const f = lairRuntime({ successes: 6 });
  f.sc.pack.manifest.failure.partyBonus.skills = [];
  const before = structuredClone(f.state);
  assert.throws(() => f.commit(), /seguito|capacità/i);
  assert.deepEqual(f.state, before);
});
