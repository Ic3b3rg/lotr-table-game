import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { searchRuntime } from './search-runtime-helper.mjs';
import { openPhysical, answerPhysical } from '../dist/physical-resolution-library.mjs';
import { hash, evidence } from './fixtures/physical-fronts.mjs';

function priorSuffering(f, family, face, count = 1) {
  const p = f.physical;
  openPhysical(
    p,
    {
      effectId: 'invented-antecedent-' + randomUUID(),
      instanceId: 'antecedent',
      state: 1,
      entry: 1,
      action: 0,
      parameterHash: hash('invented prior suffering'),
    },
    {
      profile: 'source-fronts-v1',
      initialCredits: f.heroes.map(() => 0),
      limits: f.heroes.map(() => ({ kind: 'requires-capability', capability: 'source-derived' })),
      darknessHeroes: [],
      children: [
        { kind: 'suffer', hero: 0, face, cards: [{ family, amount: count }], prevention: [] },
      ],
    },
    { preparation: structuredClone(f.state.preparation), depletion: [], boons: [] },
    { heroes: f.heroes, connections: [] },
  );
  for (let n = 0; p.snapshot.active && n < 20; n++) {
    const q = p.snapshot.active;
    answerPhysical(
      p,
      q.runId,
      q.mode === 'allocate'
        ? { kind: 'physical-allocate', ability: null, damage: 0, fear: 0 }
        : {
            kind: 'physical-choice',
            option:
              ['resolve', 'reveal', 'close'].find((id) => q.options.some((o) => o.id === id)) ??
              q.options[0].id,
          },
      evidence(n, q.actorPlayerId),
    );
  }
  assert.equal(p.snapshot.active, null);
  f.state.preparation = structuredClone(p.snapshot.resolution.resources.preparation);
  f.state.revision = 100;
  return p.snapshot.areas[0][family][0];
}

test('the search discards the real faceup or random facedown physical copy under its own deck', () => {
  for (const family of ['damage', 'fear'])
    for (const face of ['faceup', 'facedown']) {
      const f = searchRuntime({
          edit: (raw) => {
            for (const h of raw.catalog.heroes) Object.assign(h.stats, { damage: 20, fear: 20 });
          },
        }),
        copy = priorSuffering(f, family, face);
      assert.ok(copy);
      f.commit();
      f.answer({ kind: 'choice', event: 'RESTORE' });
      assert.equal(f.physical.snapshot.areas[0][family].length, 0);
      assert.equal(f.physical.snapshot.decks[family].at(-1), copy);
      assert.equal(f.physical.snapshot.parents.at(-1).results[0].returned[family], 1);
      assert.equal(f.i.stopped, false);
      f.answer({ kind: 'ack' });
      assert.equal(f.i.stopped, true);
    }
});
test('an active replacement turns the selected physical card down through the existing consumer', () => {
  const f = searchRuntime({
      edit: (raw) => {
        for (const h of raw.catalog.heroes) Object.assign(h.stats, { damage: 20, fear: 20 });
        for (const d of raw.ir.definitions.filter((d) => d.cardId.includes('fear')))
          d.persistent = [
            {
              op: 'replace-discard',
              window: 'would-discard',
              hero: 'self',
              family: 'fear',
              face: 'up',
              instead: 'flip-down',
            },
          ];
      },
    }),
    copy = priorSuffering(f, 'fear', 'faceup');
  f.commit();
  f.answer({ kind: 'choice', event: 'RESTORE' });
  assert.deepEqual(f.physical.snapshot.areas[0].fear, [copy]);
  assert.equal(f.physical.snapshot.resolution.faceup.includes(copy), false);
  assert.equal(f.physical.snapshot.parents.at(-1).results[0].returned.fear, 0);
  f.answer({ kind: 'ack' });
  assert.equal(f.i.stopped, true);
});
test('the upper fallback offers both real effects; preparing from discard enforces four and fires after-preparation once', () => {
  const f = searchRuntime({
    role: 'challenge',
    success: 1,
    fate: 0,
    inspiration: 0,
    edit: (raw) => {
      const h = raw.context.preparation.heroes[0];
      h.prepared = h.deck.splice(0, 4);
      for (const card of raw.catalog.skills)
        raw.ir.policies.push({
          id: card.id,
          kind: 'skill',
          definitionHash: hash(card),
          source: { sourceId: 'invented', locator: 'invented after-preparation' },
          effects: [{ op: 'after-prepare-inspiration' }],
        });
    },
  });
  f.commit();
  f.answer({ kind: 'physical-choice', option: 'reveal' });
  f.answer({ kind: 'physical-choice', option: 'resolve' });
  assert.equal(f.i.variables.tally, 2);
  assert.deepEqual(
    f.physical.snapshot.active.options.map((o) => o.id),
    ['scout', 'prepare-discard'],
  );
  f.answer({ kind: 'physical-choice', option: 'prepare-discard' });
  const copy = f.physical.snapshot.active.options[0].id;
  f.answer({ kind: 'physical-select', ids: [copy] });
  const limit = f.physical.snapshot.active;
  assert.equal(limit.options.length, 5);
  const discarded = limit.options.find((o) => o.id !== copy).id;
  f.answer({ kind: 'physical-select', ids: [discarded] });
  const h = f.state.preparation.heroes[0];
  assert.equal(h.prepared.length, 4);
  assert.ok(h.prepared.includes(copy));
  assert.ok(h.discard.includes(discarded));
  assert.equal(h.inspiration, 1);
  f.answer({ kind: 'ack' });
  assert.equal(f.state.preparation.heroes[0].inspiration, 1);
  assert.equal(f.sc.play.attempts[0].returned, true);
});
test('the alternate high outcome performs the existing Scout and higher real counts use the final fallback', () => {
  for (const wisdom of [3, 6]) {
    const f = searchRuntime({
      role: 'challenge',
      success: 1,
      fate: 0,
      edit: (raw) => {
        for (const h of raw.catalog.heroes) h.stats.wisdom = wisdom;
      },
    });
    f.commit();
    f.answer({ kind: 'physical-choice', option: 'reveal' });
    f.answer({ kind: 'physical-choice', option: 'resolve' });
    assert.equal(f.i.variables.tally, wisdom);
    assert.equal(f.sc.play.tests[0].total, wisdom);
    f.answer({ kind: 'physical-choice', option: 'scout' });
    const q = f.physical.snapshot.active;
    assert.equal(q.options.length, 2);
    const prepare = q.options[0].id;
    f.answer({
      kind: 'physical-scout',
      prepare,
      discard: null,
      top: [],
      bottom: [q.options[1].id],
    });
    assert.ok(f.state.preparation.heroes[0].prepared.includes(prepare));
    f.answer({ kind: 'ack' });
    assert.equal(f.i.stopped, true);
  }
});
test('discarding a prepared limit during the source reward runs real P2, preserves the parent count and removes a defeated actor without new choices', () => {
  let limitCopy;
  const f = searchRuntime({
    role: 'challenge',
    success: 1,
    fate: 0,
    edit: (raw) => {
      const h = raw.context.preparation.heroes[0];
      h.prepared = h.deck.splice(0, 4);
      limitCopy = h.prepared[0];
      for (const hero of raw.catalog.heroes) Object.assign(hero.stats, { fear: 6, damage: 20 });
      const id = limitCopy.slice(0, limitCopy.lastIndexOf(':'));
      raw.ir.policies.push({
        id,
        kind: 'skill',
        definitionHash: hash(raw.catalog.skills.find((c) => c.id === id)),
        source: { sourceId: 'invented', locator: 'invented prepared limit' },
        effects: [{ op: 'limits', damage: 0, fear: 1 }],
      });
    },
  });
  priorSuffering(f, 'fear', 'faceup', 6);
  assert.equal(f.physical.snapshot.lastStand.heroes[0].defeated, false);
  f.commit();
  f.answer({ kind: 'physical-choice', option: 'reveal' });
  f.answer({ kind: 'physical-choice', option: 'resolve' });
  assert.equal(f.i.variables.tally, 2);
  f.answer({ kind: 'physical-choice', option: 'prepare-discard' });
  f.answer({ kind: 'physical-select', ids: [f.physical.snapshot.active.options[0].id] });
  assert.ok(f.physical.snapshot.active.options.some((o) => o.id === limitCopy));
  f.answer({ kind: 'physical-select', ids: [limitCopy] });
  let steps = 0;
  while (f.sc.pending.kind === 'physical' && steps++ < 20) {
    const q = f.physical.snapshot.active;
    const option =
      ['force-fail', 'resolve', 'close', 'reveal'].find((id) =>
        q.options.some((o) => o.id === id),
      ) ?? q.options[0].id;
    f.answer({ kind: 'physical-choice', option });
  }
  assert.ok(steps > 0 && steps < 20);
  assert.equal(f.physical.snapshot.lastStand.heroes[0].defeated, true);
  assert.equal(f.state.journey.heroes[0].removed, true);
  assert.equal(f.sc.play.tests[0].total, 2);
  assert.equal(f.sc.conclusion, undefined);
  assert.equal(f.sc.pending.kind, 'message');
  f.answer({ kind: 'ack' });
  assert.equal(f.i.stopped, true);
  assert.equal(f.sc.play.attempts[0].returned, true);
  const before = structuredClone(f.state);
  assert.throws(() => f.commit());
  assert.deepEqual(f.state, before);
});
