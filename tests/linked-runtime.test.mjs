import test from 'node:test';
import assert from 'node:assert/strict';
import { linkedRuntime, leaveFirst } from './linked-runtime-helper.mjs';

test('first paid visit can be left, passed or failed and updates before the ordered broadcasts', () => {
  for (const [outcome, capped] of ['leave', 'pass', 'fail'].flatMap((outcome) =>
    [false, true].map((capped) => [outcome, capped]),
  )) {
    let initialInspiration;
    const f = linkedRuntime({
        wisdom: outcome === 'fail' ? 1 : 2,
        edit: (raw) => {
          const cap = raw.catalog.heroes[0].stats.inspiration;
          initialInspiration = capped ? cap : cap - 1;
          raw.context.preparation.heroes[0].inspiration = initialInspiration;
          if (outcome === 'fail')
            for (const c of raw.catalog.skills) {
              c.success = 0;
              c.fate = 0;
            }
        },
      }),
      [visit, listener] = f.nodes;
    f.commit();
    f.finishPhysical();
    assert.equal(f.sc.pending.kind, 'choice');
    f.answer({ kind: 'choice', event: outcome === 'leave' ? 'LEAVE' : 'STUDY' });
    if (outcome !== 'leave') {
      f.finishPhysical();
      assert.equal(f.sc.play.tests.at(-1).stat, 'wisdom');
      assert.equal(f.sc.play.tests.at(-1).target, 1);
      assert.equal(f.sc.play.tests.at(-1).successes > 0, outcome === 'pass');
      f.answer({ kind: 'ack' });
    }
    assert.equal(visit.variables.seen, true);
    assert.deepEqual(
      f.sc.events.slice(-2).map((e) => e.event),
      ['INVENTED_VISITED', 'INVENTED_REVEAL'],
    );
    assert.deepEqual(f.sc.events.at(-2).receivers, []);
    assert.deepEqual(f.sc.events.at(-1).receivers, [listener.id]);
    assert.equal(listener.visible, true);
    assert.equal(f.sc.pending.kind, 'message');
    f.answer({ kind: 'ack' });
    assert.equal(f.sc.play.active, null);
    assert.equal(f.sc.play.attempts[0].returned, true);
    assert.equal(f.state.round.heroes[0].actionsUsed, 1);
    assert.equal(
      f.state.preparation.heroes[0].inspiration,
      Math.min(
        f.state.content.heroes[0].stats.inspiration,
        initialInspiration + (outcome === 'pass' ? 1 : 0),
      ),
    );
  }
});

test('the full linked continuation is preflighted before any cost, cards or RNG', () => {
  const f = linkedRuntime();
  const d = f.sc.pack.definitions.find((d) => d.source === f.nodes[1].definition);
  d.deferredHandlers.INVENTED_REVEAL = 'invented missing hidden listener';
  delete d.handlers.INVENTED_REVEAL;
  const before = structuredClone(f.state);
  assert.throws(() => f.commit(), /seguito|capacità/i);
  assert.deepEqual(f.state, before);
});

test('Agility failure still returns the resource and hides; Wit failure waits without resource', () => {
  for (const branch of ['CLIMB', 'SOLVE']) {
    const f = linkedRuntime({
      edit: (raw) => {
        for (const c of raw.catalog.skills) {
          c.success = 0;
          c.fate = 0;
        }
      },
    });
    leaveFirst(f);
    f.commit(1, 1);
    f.finishPhysical();
    f.answer({ kind: 'choice', event: branch });
    f.finishPhysical();
    assert.equal(f.sc.play.tests[0].successes, 0);
    if (branch === 'SOLVE') {
      assert.equal(f.sc.pending.kind, 'message');
      f.answer({ kind: 'ack' });
    } else assert.equal(f.sc.pending, null);
    f.finishPhysical();
    if (branch === 'CLIMB') {
      assert.equal(f.nodes[0].variables.supplied, true);
      assert.equal(f.nodes[1].visible, false);
      assert.equal(f.nodes[1].stopped, true);
      assert.equal(f.physical.snapshot.areas[1].damage.length, 1);
    } else {
      assert.equal(f.nodes[0].variables.supplied, false);
      assert.equal(f.nodes[1].visible, true);
      assert.equal(f.nodes[1].stopped, false);
    }
    assert.equal(f.sc.play.active, null);
    assert.ok(f.sc.play.attempts.every((a) => a.returned));
  }
});

test('the return spends only its committed option and floors its own threat before awarding to another hero', () => {
  for (const threat of [0, 1, 3, 4, 9]) {
    const f = linkedRuntime({
      edit: (_, pack) => {
        pack.globals.find((v) => v.name === 'inventedThreat').value = threat;
      },
    });
    leaveFirst(f);
    f.commit(1, 1);
    f.finishPhysical();
    f.answer({ kind: 'choice', event: 'SOLVE' });
    f.finishPhysical();
    f.answer({ kind: 'ack' });
    assert.equal(f.nodes[0].variables.supplied, true);
    assert.equal(f.nodes[1].visible, false);
    f.commit(0, 2, 'DELIVER');
    f.finishPhysical();
    assert.equal(f.sc.globals.inventedThreat, Math.max(0, threat - 4));
    assert.equal(f.sc.globals.remaining, 3);
    f.answer({ kind: 'ack' });
    assert.equal(f.sc.pending.kind, 'hero-choice');
    assert.equal(f.sc.pending.actorPlayerId, f.heroes[2].playerId);
    assert.equal(f.sc.pending.options.length, 3);
    f.answer({ kind: 'choose-hero', heroId: f.heroes[0].heroId });
    f.finishPhysical();
    const owned = f.physical.snapshot.lastStand.titles;
    assert.equal(owned.length, 1);
    assert.equal(owned[0].heroId, f.heroes[0].heroId);
    assert.equal(owned[0].cardId, f.sc.pack.manifest.linked.title.cardId);
    assert.match(owned[0].source, /scenario-title/);
    assert.ok(f.state.preparation.heroes[0].prepared.includes(owned[0].copy));
    assert.equal(f.nodes[0].stopped, true);
    assert.equal(f.nodes[0].visible, false);
    assert.deepEqual(
      f.state.round.heroes.map((h) => h.actionsUsed),
      [1, 1, 1],
    );
    assert.ok(f.sc.play.attempts.every((a) => a.returned));
    assert.ok(f.physical.snapshot.parents.every((p) => p.returnCount === 1));
    assert.equal(f.physical.snapshot.lastStand.selections.length, 0, 'no fictitious last stand');
  }
});

test('late resource-return and physical-pool dependencies gate the whole real continuation before its action', () => {
  for (const kind of ['return-owner', 'damage-pool']) {
    const f = linkedRuntime();
    leaveFirst(f);
    if (kind === 'return-owner') {
      const d = f.sc.pack.definitions.find((d) => d.source === f.nodes[0].definition);
      delete d.handlers.INVENTED_SUPPLIED;
      d.deferredHandlers.INVENTED_SUPPLIED = 'invented missing return owner';
    } else {
      // Entire finite damage pool already resides below a hero limit in this invented precondition.
      f.physical.snapshot.areas[0].damage.push(...f.physical.snapshot.decks.damage.splice(0));
    }
    f.state.round.activeHeroId = f.heroes[1].heroId;
    const before = structuredClone(f.state);
    assert.throws(() => f.commit(1, 1), /seguito|capacità|mazzo|carte/i);
    assert.deepEqual(f.state, before);
  }
});
