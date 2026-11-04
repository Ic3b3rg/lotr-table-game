import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { compileCombatClosure } from '../dist/combat-library.mjs';
import { closureFixture, groupFixture } from './fixtures/combat-closure.mjs';

const built = buildSync({
  entryPoints: [fileURLToPath(new URL('../src/combat/preflight.ts', import.meta.url))],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  target: 'node24',
});
const { preflightCombatOperation } = await import(
  `data:text/javascript;base64,${Buffer.from(built.outputFiles[0].contents).toString('base64')}`
);

test('counter preflight requires boon supply only when a counter can execute, preserving the full pool', () => {
  const source = closureFixture();
  source.additions[0].effect = { op: 'gain-boon', boon: 'hidden' };
  const artifact = compileCombatClosure(source);
  for (const [label, exhausted, elite, sameSpace, gated] of [
    ['ready normal', false, false, true, true],
    ['exhausted normal', true, false, true, false],
    ['exhausted elite', true, true, true, true],
    ['normal outside counter range', false, false, false, false],
  ]) {
    const group = groupFixture();
    group.exhausted = exhausted;
    group.bonuses = elite ? group.bonuses : [];
    const heroSource = sameSpace ? group.spaceId : 'adjacent-source';
    const state = {
      physical: { snapshot: { resolution: { resources: { boons: [] } } } },
      journey: { heroes: [{ heroId: 'hero', spaceId: 'ordinary-hero-space' }] },
      scenario: {
        spaceBindings: [{ id: 'ordinary-hero-space', sourceId: heroSource }],
        enemies: { groups: [group] },
      },
      mapGeneration: {
        status: 'frozen',
        projection: { movementGraph: { edges: [{ a: heroSource, b: group.spaceId }] } },
      },
    };
    const before = structuredClone(state);
    assert.deepEqual(
      preflightCombatOperation(state, artifact, group, 'hero', 'counterattack'),
      gated ? ['boon-quantities-57'] : [],
      label,
    );
    assert.deepEqual(state, before);
    assert.equal(artifact.compiled.models[0].instructions.length, 2);
  }
});
