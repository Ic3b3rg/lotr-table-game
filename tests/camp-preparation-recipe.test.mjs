import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { preparationCompilation } from './fixtures/camp-preparation.mjs';
import { campItemCatalog } from './fixtures/camp-items.mjs';
import { diagnosticRaw } from './fixtures/physical-fronts.mjs';
const built = buildSync({
  stdin: {
    contents: "export {campRecipe} from './src/scenario/camp-preparation';",
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const { campRecipe } = await import(
  'data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].contents).toString('base64')
);

test('identity recipe retains purchases of former roles and a removed campaign title, excluding old free roles and weaknesses without changing the archive', () => {
  // A pure, declared invented projection fixture; no operational session is edited.
  const pack = preparationCompilation().pack,
    catalog = campItemCatalog(),
    raw = diagnosticRaw(),
    title = raw.cards.find((c) => c.family === 'title');
  const purchased = [
      pack.manifest.campSkills.roles[0].upgrades[0],
      pack.manifest.campSkills.roles[4].upgrades[1],
    ],
    titleCopy = `${title.id}:1`;
  const oldCopies = [
    ...catalog.basicSkills,
    ...catalog.heroes[0].skills,
    ...catalog.roles[0].skills,
    'weak-1',
  ].map((id) => id + ':1');
  const hero = {
    heroId: 'hero-1',
    roleId: 'role-4',
    status: 'active',
    lastStandDifficulty: 1,
    itemCopies: ['advanced:1', 'armor:1'],
    titleCopies: [titleCopy],
    skillCopies: [...oldCopies, ...purchased.map((o) => o.copy), titleCopy],
  };
  const state = {
    content: catalog,
    preparation: {
      heroes: [{ heroId: 'hero-1', roleId: 'role-1', deck: oldCopies, prepared: [], discard: [] }],
    },
    physical: {
      raw,
      snapshot: {
        lastStand: {
          heroes: [{ heroId: 'hero-1', defeated: true }],
          titles: [
            { heroId: 'hero-1', cardId: title.id, copy: titleCopy, removed: true, pending: false },
          ],
        },
      },
    },
    scenario: {
      pack,
      conclusion: {
        campaign: {
          heroes: [hero],
          inventory: [],
          training: {
            balances: [
              { heroId: 'hero-1', roleId: 'role-1', availableXP: 4 },
              { heroId: 'hero-1', roleId: 'role-5', availableXP: 2 },
            ],
          },
        },
      },
    },
  };
  const before = structuredClone(state),
    recipe = campRecipe(state, 'hero-1', null);
  assert.deepEqual(
    recipe.cards.filter((c) => c.kind === 'purchased').map((c) => c.copy),
    purchased.map((o) => o.copy),
  );
  assert.deepEqual(
    recipe.cards.filter((c) => c.kind === 'title'),
    [{ kind: 'title', cardId: title.id, copy: titleCopy }],
  );
  assert.deepEqual(
    recipe.cards.filter((c) => c.kind === 'role').map((c) => c.cardId),
    catalog.roles[3].skills,
  );
  assert.equal(recipe.cards.length, 17);
  assert.equal(recipe.futurePrepared, catalog.roles[3].skills[0]);
  assert.deepEqual(recipe.weakness, { count: 1, source: 'future-common-draw' });
  assert.ok(recipe.cards.every((c) => !catalog.weaknessCards.includes(c.cardId)));
  assert.deepEqual(recipe.itemCopies, hero.itemCopies);
  assert.deepEqual(recipe.balances, [
    { roleId: 'role-1', availableXP: 4 },
    { roleId: 'role-5', availableXP: 2 },
  ]);
  assert.equal(recipe.gate, null);
  assert.deepEqual(state, before);
});
