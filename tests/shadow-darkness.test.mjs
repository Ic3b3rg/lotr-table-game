import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { compileCombatClosure } from '../dist/combat-library.mjs';
import {
  compilePhysicalFronts,
  compileLastStand,
  freezePhysical,
} from '../dist/physical-resolution-library.mjs';
import { frontFixture, binding } from './fixtures/physical-fronts.mjs';
import { inventedLastStand } from './fixtures/last-stand.mjs';
import { closureFixture } from './fixtures/combat-closure.mjs';
import { attachActivationSource } from './fixtures/shadow-activations.mjs';
const built = buildSync({
  entryPoints: [fileURLToPath(new URL('../src/combat/controller.ts', import.meta.url))],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  target: 'node24',
});
const { openCombatPhysical } = await import(
  `data:text/javascript;base64,${Buffer.from(Buffer.from(built.outputFiles[0].contents).toString() + '\n//# sourceURL=shadow-darkness-controller.mjs').toString('base64')}`
);
function context(kind) {
  const f = frontFixture();
  f.catalog.heroes.forEach((h) => (h.maxHands = 2));
  const fronts = compilePhysicalFronts(f.raw, f.ir, f.catalog),
    ls = compileLastStand(f.raw, inventedLastStand(f.raw));
  const p = freezePhysical(
    f.raw,
    binding,
    f.heroes,
    '1'.repeat(64),
    undefined,
    { artifact: fronts, catalog: f.catalog },
    ls,
  );
  p.version = 3;
  const src = attachActivationSource(closureFixture());
  const heroes = f.context.preparation.heroes;
  return {
    physical: p,
    content: f.catalog,
    preparation: structuredClone(f.context.preparation),
    round: {
      id: '00000000-0000-4000-8000-000000000099',
      number: 3,
      heroes: heroes.map((h) => ({ heroId: h.heroId })),
    },
    journey: {
      heroes: heroes.map((h, n) => ({ heroId: h.heroId, spaceId: 'ordinary-' + n })),
      definition: { connections: [] },
    },
    mapGeneration: {
      status: 'frozen',
      projection: {
        spaces: heroes.map((h, n) => ({
          id: 'source-' + n,
          hasDarkness: kind === 'space' && n === 0,
        })),
      },
    },
    scenario: {
      globals: { night: kind === 'global', override: kind === 'override' ? 'unsupported' : '' },
      rounds: {},
      spaceBindings: heroes.map((h, n) => ({ id: 'ordinary-' + n, sourceId: 'source-' + n })),
      instances:
        kind === 'token'
          ? [{ visible: true, spaceId: 'source-0', prefab: 'fixture.assets:900' }]
          : [],
      pack: {
        manifest: {
          combat: compileCombatClosure(src),
          rounds: {
            configuration: { disableDarkness: kind === 'disabled' },
            bindings: { darkness: 'night', darknessOverride: 'override' },
            darkness: {
              tokenPrefabs: ['fixture.assets:900'],
              spaces: heroes.map((h, n) => ({
                id: 'source-' + n,
                hasDarkness: kind === 'space' && n === 0,
              })),
            },
          },
        },
      },
    },
  };
}
test('combat physical context shares space, global and token darkness with the authoritative phase', () => {
  for (const [kind, expected] of [
    ['space', [0]],
    ['global', [0, 1, 2]],
    ['token', [0]],
    ['disabled', []],
  ]) {
    const s = context(kind),
      attempt = {
        id: '00000000-0000-4000-8000-000000000098',
        stage: 'counterattack',
        heroId: s.preparation.heroes[0].heroId,
      };
    openCombatPhysical(s, attempt, [{ kind: 'inspiration', hero: 0, amount: 1 }]);
    assert.deepEqual(s.physical.runs.at(-1).program.darknessHeroes, expected, kind);
  }
  const s = context('override'),
    before = structuredClone(s);
  assert.throws(() =>
    openCombatPhysical(s, { id: 'x', stage: 'counterattack' }, [
      { kind: 'inspiration', hero: 0, amount: 1 },
    ]),
  );
  assert.deepEqual(s, before);
});
