import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { frontFixture } from './fixtures/physical-fronts.mjs';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const { outputFiles } = await build({
  stdin: {
    contents: `export * from './src/shared/skill-tests.ts';
      export * from './src/shared/scouting.ts';
      export * from './src/shared/preparation.ts';`,
    resolveDir: process.cwd(),
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
});
const temporary = await mkdtemp(join(tmpdir(), 'lotr-owned-skills-'));
const modulePath = join(temporary, 'library.mjs');
await writeFile(modulePath, outputFiles[0].contents);
const lib = await import(pathToFileURL(modulePath).href);
await rm(temporary, { recursive: true });

test('ordinary test symbols and card counts include genuine owned title copies without extending the catalog', () => {
  const f = frontFixture(),
    hero = f.context.preparation.heroes[0];
  for (const card of f.catalog.skills) {
    card.success = 0;
    card.fate = 0;
  }
  const title = {
    ...structuredClone(f.catalog.skills[0]),
    id: 'invented-owned-title',
    kind: 'title',
    success: 1,
    fate: 1,
    number: 1,
  };
  const revealed = [title.id + ':1', ...hero.deck.splice(0, 2)];
  hero.deck.push(...f.context.preparation.weaknessDeck.splice(0, 3));
  const test = {
    id: '00000000-0000-4000-8000-000000000019',
    heroId: hero.heroId,
    stat: 'might',
    modifier: 0,
    availableCount: hero.deck.length + hero.discard.length + revealed.length,
    target: 1,
    revealed,
    converted: 0,
    status: 'converting',
  };
  const view = lib.skillTestView(f.catalog, test, [title]);
  assert.equal(view.successes, 1);
  assert.equal(view.fateRemaining, 1);
  assert.equal(
    lib.skillTestProblem(f.catalog, f.context.preparation, test, null, [], [title]),
    null,
  );
  assert.equal(f.catalog.skills.length, 74);
  assert.ok(!f.catalog.skills.some((s) => s.id === title.id));
  assert.equal(test.availableCount, 18);
  assert.ok(lib.SkillTestSchema.safeParse(test).success);
  assert.ok(!lib.SkillTestSchema.safeParse({ ...test, availableCount: 31 }).success);
  assert.equal(
    lib.preparationProblem(
      f.catalog,
      f.heroes.map((h) => h.playerId),
      f.context.preparation,
      test,
      null,
      {
        held: [],
        titles: [{ heroId: hero.heroId, copy: title.id + ':1', removed: false, pending: false }],
      },
    ),
    null,
  );
  assert.ok(
    lib.skillTestProblem(
      f.catalog,
      f.context.preparation,
      { ...test, availableCount: test.availableCount + 1 },
      null,
      [],
      [title],
    ),
  );
  assert.ok(lib.skillTestProblem(f.catalog, f.context.preparation, test));
  assert.ok(
    lib.skillTestProblem(
      f.catalog,
      f.context.preparation,
      { ...test, converted: 2 },
      null,
      [],
      [title],
    ),
  );
});

test('ordinary Scout validates the actual available zones after title acquisition', () => {
  const f = frontFixture(),
    hero = f.context.preparation.heroes[0];
  const revealed = [
    ...hero.deck.splice(0, 13),
    'invented-owned-title:1',
    'invented-second-title:1',
  ];
  const scout = {
    id: '00000000-0000-4000-8000-000000000020',
    heroId: hero.heroId,
    roundId: null,
    count: 15,
    resetBefore: false,
    revealed,
  };
  assert.equal(lib.scoutingProblem(f.catalog, f.context.preparation, scout), null);
  assert.ok(
    lib.scoutingProblem(f.catalog, f.context.preparation, {
      ...scout,
      revealed: revealed.slice(1),
    }),
  );
});
