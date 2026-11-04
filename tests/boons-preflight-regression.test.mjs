import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { compileCombatClosure, preflightCombatGroup } from '../dist/combat-library.mjs';
import { runtimeBoons, boonGrant } from './fixtures/boons.mjs';
import { closureFixture, groupFixture } from './fixtures/combat-closure.mjs';
import { hash } from './fixtures/physical-fronts.mjs';
import { inventedLastStand } from './fixtures/last-stand.mjs';
import { suffer } from './fixtures/physical-resolution.mjs';

const built = buildSync({
  stdin: {
    contents: "export { preflightCombatOperation } from './src/combat/preflight';",
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
});
const { preflightCombatOperation } = await import(
  `data:text/javascript;base64,${Buffer.from(built.outputFiles[0].contents).toString('base64')}`
);

test('marked combat excludes impossible positive grants from dependency checks without changing its population', () => {
  for (const family of ['damage', 'fear']) {
    const source = closureFixture();
    source.additions[0].effect = { op: 'gain-boon', boon: 'determined' };
    source.additions[0].predicate = `${family}-positive`;
    const activation = source.assets.find((a) => a.source === 'fixture.assets:51');
    activation.data.Damage.forEach((row) => {
      row.Physical = 0;
      row.Fear = 0;
    });
    activation.dataHash = hash(activation.data);
    const artifact = compileCombatClosure(source),
      group = groupFixture(),
      f = runtimeBoons(() => {}, false);
    group.bonuses = [];
    const supply = {
      boons: [],
      quantities: null,
      artifact: f.p.boons,
      custody: [],
      heroIds: ['hero-1'],
    };
    const before = structuredClone(artifact);
    assert.deepEqual(preflightCombatGroup(artifact, group, supply), []);
    assert.deepEqual(artifact, before);
    assert.equal(artifact.compiled.models[0].instructions.length, 2);
    const state = {
      physical: f.p,
      preparation: f.context.preparation,
      scenario: {
        enemies: { groups: [group] },
        spaceBindings: [{ id: 'ordinary-space', sourceId: 'invented-space' }],
        tiles: [{ source: 'invented-tile', visible: true, explored: true }],
      },
      journey: {
        heroes: f.heroes.map((h) => ({ heroId: h.heroId, spaceId: 'ordinary-space' })),
      },
    };
    const stateBefore = structuredClone(state);
    assert.deepEqual(preflightCombatOperation(state, artifact, group, 'hero-1', 'provocation'), []);
    assert.deepEqual(state, stateBefore);
    assert.deepEqual(preflightCombatGroup(artifact, group, { ...supply, artifact: undefined }), [
      'boon-quantities-57',
    ]);
    if (family === 'damage') {
      group.bonuses = ['fixture.assets:30'];
      assert.deepEqual(preflightCombatGroup(artifact, group, supply), ['boon-quantities-57']);
    }
  }
});

test('a certain end-turn return funds the next source grant with the same conserved copy', () => {
  function fixture() {
    const f = runtimeBoons((f) => {
      f.raw.cards
        .filter((c) => c.family === 'boon')
        .forEach((c, i) => {
          const n = [2, 1, 12][i];
          c.quantity.value = n;
          c.copies = Array.from({ length: n }, (_, j) => ({
            id: `${c.id}-copy-${j + 1}`,
            ordinal: j + 1,
          }));
          f.boonInput.definitions[i].cardHash = hash(c);
        });
    });
    f.p.version = 3;
    f.open([boonGrant(0, 'emboldened')]);
    return f;
  }
  const f = fixture(),
    spatial = { heroes: f.heroes, connections: [], enemies: [] },
    copy = f.p.snapshot.resolution.resources.boonCustody[0].copyId;
  f.open([{ kind: 'end-turn', hero: 0 }, boonGrant(1, 'emboldened')], spatial);
  assert.equal(f.p.snapshot.active, null);
  assert.deepEqual(
    f.p.snapshot.resolution.resources.boonCustody.map((b) => [b.copyId, b.heroId]),
    [[copy, 'hero-2']],
  );
  assert.deepEqual(
    f.p.snapshot.resolution.boonEvents.map((e) => e.operation),
    ['gain', 'discard', 'gain'],
  );
  assert.equal(f.p.snapshot.parents.at(-1).returnCount, 1);
  const near = fixture(),
    before = structuredClone(near.p);
  assert.throws(
    () =>
      near.open([{ kind: 'end-turn', hero: 0 }, boonGrant(1, 'emboldened')], {
        ...spatial,
        enemies: [{ id: 'invented-nearby', spaceId: 'invented-space' }],
      }),
    /boon-supply-exhaustion-rule/,
  );
  assert.deepEqual(near.p, before);
  const uncertain = fixture(),
    beforeUncertain = structuredClone(uncertain.p);
  assert.throws(
    () =>
      uncertain.open(
        [
          {
            kind: 'suffer',
            hero: 0,
            face: 'faceup',
            cards: [{ family: 'damage', amount: 1 }],
            prevention: [],
          },
          { kind: 'end-turn', hero: 0 },
          boonGrant(1, 'emboldened'),
        ],
        spatial,
      ),
    /boon-supply-exhaustion-rule/,
  );
  assert.deepEqual(uncertain.p, beforeUncertain);
});

test('optional title Rest preserves the stock needed by its mandatory source continuation before paying', () => {
  for (const quantity of [1, 2]) {
    const f = runtimeBoons((f) => {
      f.lastStandInput = inventedLastStand(f.raw);
      f.lastStandInput.awards[1].minimum = 1;
      f.catalog.heroes[0].stats.damage = 1;
      f.catalog.skills.forEach((s) => {
        s.success = 1;
        s.fate = 0;
      });
      f.raw.cards
        .filter((c) => c.family === 'boon')
        .forEach((c, i) => {
          const n = [quantity, 3 - quantity, 12][i];
          c.quantity.value = n;
          c.copies = Array.from({ length: n }, (_, j) => ({
            id: `${c.id}-copy-${j + 1}`,
            ordinal: j + 1,
          }));
          f.boonInput.definitions[i].cardHash = hash(c);
        });
    });
    f.p.version = 3;
    const spatial = { heroes: f.heroes, connections: [], enemies: [] };
    f.open([suffer(0, 1, 0)], spatial);
    f.answer('reveal');
    f.answer('resolve');
    const title = f.p.snapshot.lastStand.titles[0];
    assert.ok(title && !title.removed);
    f.open([{ kind: 'end-turn', hero: 0 }, boonGrant(1, 'determined')], spatial);
    const option = f.p.snapshot.active.options.find((o) => o.id.startsWith('title-rest:'));
    assert.ok(option);
    if (quantity === 1) {
      assert.ok(option.unavailable, 'the optional cost must reserve the mandatory later grant');
      const before = structuredClone(f.p);
      assert.throws(() => f.answer(option.id));
      assert.deepEqual(f.p, before);
      f.answer('close-rest');
    } else {
      assert.equal(option.unavailable, undefined);
      f.answer(option.id);
      for (let n = 0; f.p.snapshot.active?.kind === 'decision' && n < 10; n++) {
        const q = f.p.snapshot.active;
        f.answer(
          q.mode === 'select'
            ? { kind: 'physical-select', ids: q.options.slice(0, q.minimum).map((o) => o.id) }
            : (q.options.find((o) => o.id === 'close-rest')?.id ?? q.options[0].id),
        );
      }
    }
    assert.equal(f.p.snapshot.active, null);
    assert.equal(f.p.snapshot.lastStand.titles[0].removed, quantity === 2);
    const held = f.p.snapshot.resolution.resources.boonCustody;
    assert.equal(held.length, quantity);
    assert.equal(new Set(held.map((b) => b.copyId)).size, quantity);
    assert.ok(held.some((b) => b.heroId === 'hero-2'));
    assert.equal(f.p.snapshot.parents.at(-1).returnCount, 1);
  }
});
