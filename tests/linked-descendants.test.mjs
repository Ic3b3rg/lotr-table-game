import test from 'node:test';
import assert from 'node:assert/strict';
import { linkedRuntime, leaveFirst } from './linked-runtime-helper.mjs';
import { action } from './fixtures/scenario.mjs';

test('a failed physical branch can defeat its actor in a descendant and still return the resource before another hero awards the title', () => {
  const f = linkedRuntime({
    edit: (raw, pack) => {
      for (const s of raw.catalog.skills) {
        s.success = 0;
        s.fate = 0;
      }
      raw.catalog.heroes[1].stats.fear = 1;
      for (const d of raw.ir.definitions.filter((d) => d.cardId.includes('damage')))
        d.body = [
          { op: 'suffer', hero: 'self', family: 'fear', n: 1, face: 'normal' },
          { op: 'keep-faceup' },
        ];
    },
  });
  leaveFirst(f);
  f.commit(1, 1);
  f.finishPhysical();
  f.answer({ kind: 'choice', event: 'CLIMB' });
  f.finishPhysical();
  assert.equal(f.sc.play.tests[0].successes, 0);
  assert.equal(f.physical.snapshot.lastStand.heroes[1].defeated, true);
  assert.equal(f.state.journey.heroes[1].removed, true);
  assert.equal(f.nodes[0].variables.supplied, true);
  assert.equal(f.nodes[1].stopped, true);
  assert.equal(f.sc.play.active, null);
  const saved = structuredClone(f.state.preparation.heroes[1]);
  f.commit(0, 0, 'DELIVER');
  f.finishPhysical();
  f.answer({ kind: 'ack' });
  assert.equal(f.sc.pending.options.length, 3);
  f.answer({ kind: 'choose-hero', heroId: f.heroes[1].heroId });
  f.finishPhysical();
  const title = f.physical.snapshot.lastStand.titles[0];
  assert.equal(
    title.heroId,
    f.heroes[1].heroId,
    'the source includes every hero in the recipient selector',
  );
  assert.ok(f.state.preparation.heroes[1].prepared.includes(title.copy));
  assert.equal(f.state.preparation.heroes[1].deck.length, saved.deck.length);
  assert.deepEqual(f.state.preparation.heroes[1].itemCopies, saved.itemCopies);
  assert.equal(f.sc.globals.inventedPartySize, 3);
  assert.equal(f.state.preparation.heroes.length, 3);
  assert.equal(f.sc.conclusion, undefined, 'deferred loss is not polled during the return');
  assert.ok(f.physical.snapshot.parents.every((p) => p.returnCount === 1));
});

test('duplicate resource broadcasts are idempotent assignments, and threat flooring preserves a legitimate negative counter', () => {
  const f = linkedRuntime({
    edit: (_, pack) => {
      pack.globals.find((v) => v.name === 'remaining').value = -1;
      const resource = pack.definitions.find(
        (d) =>
          d.source ===
          pack.manifest.prefabs.find((p) => p.source === pack.manifest.linked.encounters[1].prefab)
            .fsmSource,
      );
      resource.states
        .find((s) => s.index === 40)
        .actions.push(action(1, 'broadcast', { event: pack.manifest.linked.events.returned }));
    },
  });
  leaveFirst(f);
  f.commit(1, 1);
  f.finishPhysical();
  f.answer({ kind: 'choice', event: 'CLIMB' });
  f.finishPhysical();
  f.answer({ kind: 'ack' });
  assert.equal(f.sc.events.filter((e) => e.event === 'INVENTED_SUPPLIED').length, 2);
  assert.equal(f.nodes[0].variables.supplied, true);
  f.commit(0, 2, 'DELIVER');
  f.finishPhysical();
  f.answer({ kind: 'ack' });
  f.answer({ kind: 'choose-hero', heroId: f.heroes[0].heroId });
  f.finishPhysical();
  assert.equal(f.sc.globals.remaining, -1);
  assert.equal(f.physical.snapshot.lastStand.titles.length, 1);
});

test('the recipient owns the immediate prepared-limit choice, which may discard the newly gained title without losing ownership', () => {
  const f = linkedRuntime({
    edit: (raw) => {
      const hero = raw.context.preparation.heroes[0];
      hero.prepared.push(...hero.deck.splice(0, 4));
    },
  });
  leaveFirst(f);
  f.commit(1, 1);
  f.finishPhysical();
  f.answer({ kind: 'choice', event: 'SOLVE' });
  f.finishPhysical();
  f.answer({ kind: 'ack' });
  f.commit(0, 2, 'DELIVER');
  f.finishPhysical();
  f.answer({ kind: 'ack' });
  f.answer({ kind: 'choose-hero', heroId: f.heroes[0].heroId });
  const p = f.physical,
    q = p.snapshot.active,
    title = p.snapshot.lastStand.titles[0];
  assert.equal(q.mode, 'select');
  assert.equal(q.actorPlayerId, f.heroes[0].playerId);
  assert.equal(title.pending, true);
  assert.equal(q.minimum, 1);
  f.answer({ kind: 'physical-select', ids: [title.copy] });
  assert.equal(p.snapshot.lastStand.titles[0].pending, false);
  assert.equal(p.snapshot.lastStand.titles[0].removed, false);
  assert.ok(f.state.preparation.heroes[0].discard.includes(title.copy));
  assert.equal(f.state.preparation.heroes[0].prepared.length, 4);
  assert.equal(f.sc.play.active, null);
});
