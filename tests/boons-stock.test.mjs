import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runtimeBoons, boonGrant } from './fixtures/boons.mjs';
import { validatePhysical } from '../dist/physical-resolution-library.mjs';
import { compileCombatClosure, preflightCombatGroup } from '../dist/combat-library.mjs';
import { closureFixture, groupFixture } from './fixtures/combat-closure.mjs';

test('source acquisition keeps exact copies outside skill zones, rejects duplicates and returns the same copy', () => {
  const f = runtimeBoons();
  f.open([boonGrant(0), boonGrant(0), boonGrant(1)]);
  assert.equal(f.p.snapshot.active, null);
  const r = f.p.snapshot.resolution.resources;
  assert.deepEqual(
    r.boonCustody.map((b) => [b.copyId, b.heroId, b.face]),
    [
      ['invented-boon-1-copy-1', 'hero-1', 'faceup'],
      ['invented-boon-1-copy-2', 'hero-2', 'faceup'],
    ],
  );
  assert.deepEqual(r.preparation, f.context.preparation);
  const loss = boonGrant();
  loss.addition.effect = { op: 'lose-boon-or-weakness', boon: 'determined' };
  f.open([loss, boonGrant(2)]);
  assert.equal(
    f.p.snapshot.resolution.resources.boonCustody.find((b) => b.heroId === 'hero-3').copyId,
    'invented-boon-1-copy-1',
  );
  assert.equal(
    f.p.snapshot.resolution.resources.preparation.weaknessDeck.length,
    f.context.preparation.weaknessDeck.length,
  );
  assert.doesNotThrow(() => validatePhysical(JSON.parse(JSON.stringify(f.p))));
  const forged = structuredClone(f.p);
  forged.snapshot.resolution.resources.boonCustody[0].heroId = 'hero-3';
  assert.throws(() => validatePhysical(forged));
});

test('unknown stock remains distinct from exhausted verified stock and never creates a copy', () => {
  const unknown = runtimeBoons(() => {}, false);
  unknown.open([boonGrant()]);
  assert.equal(unknown.p.snapshot.active.reason, 'boon-quantity-unconfirmed');
  assert.deepEqual(unknown.p.snapshot.resolution.resources.boonCustody, []);
  const empty = runtimeBoons();
  empty.open([boonGrant(0), boonGrant(1), boonGrant(2)]);
  assert.equal(empty.p.snapshot.active.reason, 'boon-supply-empty');
  assert.equal(empty.p.snapshot.resolution.resources.boonCustody.length, 2);
});

test('choice belongs to the receiver and may only select a source-offered kind', () => {
  const f = runtimeBoons();
  f.open([boonGrant(2, null)]);
  const q = f.p.snapshot.active;
  assert.equal(q.actorPlayerId, f.heroes[2].playerId);
  assert.equal(q.options.length, 3);
  const before = structuredClone(f.p);
  assert.throws(() => f.answer('hidden', f.heroes[0].playerId));
  assert.deepEqual(f.p, before);
  assert.throws(() => f.answer('invented-forged'));
  assert.deepEqual(f.p, before);
  f.answer('hidden');
  assert.equal(f.p.snapshot.resolution.resources.boonCustody[0].heroId, 'hero-3');
  assert.equal(f.p.snapshot.parents[0].returnCount, 1);
  assert.equal(f.p.snapshot.resolution.boonEvents[0].operation, 'gain');
});

test('real group preflight accepts the frozen consumer without changing the complete instruction pool', () => {
  const src = closureFixture();
  src.additions[0].effect = { op: 'gain-boon', boon: 'determined' };
  const a = compileCombatClosure(src),
    f = runtimeBoons();
  const supply = {
    boons: [],
    quantities: null,
    artifact: f.p.boons,
    custody: [],
    heroIds: f.heroes.map((h) => h.heroId),
  };
  assert.deepEqual(preflightCombatGroup(a, groupFixture(), supply), []);
  assert.equal(a.compiled.models[0].instructions.length, 2);
  f.open([boonGrant(0), boonGrant(1)]);
  supply.custody = f.p.snapshot.resolution.resources.boonCustody;
  assert.deepEqual(preflightCombatGroup(a, groupFixture(), supply), [
    'boon-supply-exhaustion-rule',
  ]);
  supply.artifact = runtimeBoons(() => {}, false).p.boons;
  assert.deepEqual(preflightCombatGroup(a, groupFixture(), supply), ['boon-quantities-57']);
});
