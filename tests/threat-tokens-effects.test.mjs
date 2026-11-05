import test from 'node:test';
import assert from 'node:assert/strict';
import { threatTokenRuntime, finishThreatTest } from './threat-tokens-runtime-helper.mjs';

test('real fear P1/P2 defeats the source actor, retains the parent result and returns cleanup without new personal choices or loss polling', () => {
  const f = threatTokenRuntime({
    role: 'null-product',
    success: 0,
    fate: 0,
    edit: (raw) => {
      raw.catalog.heroes[0].stats.fear = 1;
    },
  });
  f.commit();
  finishThreatTest(f);
  const tests = structuredClone(f.sc.play.tests),
    initialCount = f.state.preparation.heroes.length;
  let steps = 0;
  while (f.sc.pending?.kind === 'physical' && steps++ < 40) {
    const q = f.physical.snapshot.active;
    assert.equal(q.kind, 'decision');
    const option =
      ['force-fail', 'resolve', 'close', 'reveal'].find((id) =>
        q.options.some((o) => o.id === id),
      ) ?? q.options[0].id;
    f.answer({ kind: 'physical-choice', option });
  }
  assert.ok(steps > 0 && steps < 40);
  assert.equal(f.physical.snapshot.lastStand.heroes[0].defeated, true);
  assert.equal(f.state.journey.heroes[0].removed, true);
  assert.deepEqual(f.sc.play.tests, tests);
  assert.equal(tests[0].successes, 0);
  assert.equal(f.state.preparation.heroes.length, initialCount);
  assert.equal(f.sc.globals.inventedPartySize, 3);
  assert.equal(f.sc.play.attempts[0].returned, true);
  assert.equal(f.i.stopped, true);
  assert.equal(f.sc.pending, null);
  assert.equal(f.sc.conclusion, undefined);
  const before = structuredClone(f.state);
  assert.throws(() => f.commit());
  assert.deepEqual(f.state, before);
});
test('both source tests reset the genuinely exhausted skill deck including a zero-result failure and preserve every copy', () => {
  for (const role of ['retry', 'null-product'])
    for (const success of [0, 1]) {
      const f = threatTokenRuntime({
          role,
          success,
          fate: 0,
          edit: (raw) => {
            raw.catalog.heroes[0].stats[role === 'retry' ? 'wisdom' : 'spirit'] =
              raw.context.preparation.heroes[0].deck.length;
          },
        }),
        copies = [...f.state.preparation.heroes[0].deck];
      f.commit();
      finishThreatTest(f);
      f.finishPhysical();
      const h = f.state.preparation.heroes[0];
      assert.deepEqual(h.discard, []);
      assert.deepEqual([...h.deck].sort(), [...copies].sort());
      assert.equal(
        f.physical.runs.find((r) => r.program.children.some((c) => c.kind === 'test')).program
          .immediateSkillReset,
        true,
      );
      assert.deepEqual(
        f.physical.snapshot.random.findLast((r) => r.population.length === copies.length)
          .population,
        copies,
      );
      if (f.sc.pending) f.answer({ kind: 'ack' });
      assert.equal(f.sc.play.active, null);
      assert.equal(f.i.visible, role === 'retry' && !success);
    }
});
test('all future preparation candidates are checked, including another owner and an unselected discarded card', () => {
  for (const heroIndex of [0, 1]) {
    const f = threatTokenRuntime({
        edit: (raw, pack) => {
          const h = raw.context.preparation.heroes[heroIndex],
            copy = h.deck.pop();
          h.discard.push(copy);
          pack.preparedEffects = [
            {
              skillId: copy.slice(0, copy.lastIndexOf(':')),
              cardHash: 'a'.repeat(64),
              effect: 'requires-capability',
              capability: 'invented-late-dependency',
            },
          ];
        },
      }),
      before = structuredClone(f.state);
    assert.throws(
      () => f.commit(),
      (e) => e.code === 'SCENARIO_PHYSICAL_CAPABILITY',
    );
    assert.deepEqual(f.state, before);
  }
});
