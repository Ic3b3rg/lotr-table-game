import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runtimeBoons, boonGrant } from './fixtures/boons.mjs';
import { validatePhysical, physicalView } from '../dist/physical-resolution-library.mjs';
import { compileCombatClosure, preflightCombatGroup } from '../dist/combat-library.mjs';
import { closureFixture, groupFixture } from './fixtures/combat-closure.mjs';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';
const built = buildSync({
  stdin: {
    contents: "export { preflightCombatOperation } from './src/combat/preflight';",
    resolveDir: fileURLToPath(new URL('../', import.meta.url)),
    loader: 'ts',
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  target: 'node24',
});
const { preflightCombatOperation } = await import(
  `data:text/javascript;base64,${Buffer.from(built.outputFiles[0].contents).toString('base64')}`
);

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
  const beforeUnknown = structuredClone(unknown.p);
  assert.throws(() => unknown.open([boonGrant()]), /boon-quantities-57/);
  assert.deepEqual(unknown.p, beforeUnknown);
  const empty = runtimeBoons();
  empty.open([boonGrant(0), boonGrant(1)]);
  const beforeEmpty = structuredClone(empty.p);
  assert.throws(() => empty.open([boonGrant(2)]), /boon-supply-exhaustion-rule/);
  assert.deepEqual(empty.p, beforeEmpty);
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

test('mandatory continuation finds unknown or exhaustible stock before any previous child can draw or spend', () => {
  for (const verified of [false, true]) {
    const f = runtimeBoons(() => {}, verified),
      before = structuredClone(f.p);
    const draw = {
      kind: 'suffer',
      hero: 0,
      face: 'facedown',
      cards: [{ family: 'fear', amount: 1 }],
      prevention: [],
    };
    assert.throws(
      () => f.open([draw, boonGrant(0), boonGrant(1), boonGrant(2)]),
      verified ? /boon-supply-exhaustion-rule/ : /boon-quantities-57/,
    );
    assert.deepEqual(f.p, before);
  }
});

test('public boon reader shows faceup custody and stock without programs, original fields or fabricated quantities', () => {
  const f = runtimeBoons();
  f.open([boonGrant(0)]);
  const view = physicalView(f.p).boons;
  assert.equal(view.stock, 'verified');
  assert.equal(view.definitions.find((d) => d.kind === 'determined').available, 1);
  assert.equal(view.held[0].name, 'Favore sintetico 1');
  assert.equal(view.held[0].heroId, 'hero-1');
  assert.ok(view.held[0].sourceLabel);
  const encoded = JSON.stringify(view);
  assert.ok(
    !encoded.includes('originalHash') &&
      !encoded.includes('valueIndex') &&
      !encoded.includes('exchange-test-cards'),
  );
});

test('combat continuation checks its actual receiver when an exhausted type is already held', () => {
  const f = runtimeBoons();
  f.open([boonGrant(0), boonGrant(1)]);
  const src = closureFixture();
  src.additions[0].effect = { op: 'gain-boon', boon: 'determined' };
  const a = compileCombatClosure(src),
    g = groupFixture();
  const state = {
    physical: f.p,
    preparation: f.context.preparation,
    scenario: {
      enemies: { groups: [g] },
      spaceBindings: [{ id: 'ordinary-space', sourceId: 'invented-space' }],
      tiles: [{ source: 'invented-tile', visible: true, explored: true }],
    },
    journey: { heroes: f.heroes.map((h) => ({ heroId: h.heroId, spaceId: 'ordinary-space' })) },
    mapGeneration: {
      status: 'frozen',
      projection: {
        spaces: [{ id: 'invented-space', tileSource: 'invented-tile' }],
        movementGraph: { edges: [] },
      },
    },
  };
  assert.deepEqual(preflightCombatOperation(state, a, g, 'hero-1', 'counterattack'), []);
  assert.deepEqual(preflightCombatOperation(state, a, g, 'hero-3', 'counterattack'), [
    'boon-supply-exhaustion-rule',
  ]);
});
