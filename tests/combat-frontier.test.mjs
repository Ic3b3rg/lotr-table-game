import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compilePhysicalFronts,
  compileLastStand,
  freezePhysical,
  openPhysical,
  answerPhysical,
  validatePhysical,
} from '../dist/physical-resolution-library.mjs';
import { frontFixture, binding, evidence, hash } from './fixtures/physical-fronts.mjs';
import { inventedLastStand } from './fixtures/last-stand.mjs';
import { source } from './fixtures/physical-resolution.mjs';

test('a controller frontier preserves a sealed base outcome and defers P2 until one selected obligation completes', () => {
  const f = frontFixture();
  f.catalog.heroes.forEach((h) => (h.maxHands = 2));
  f.catalog.heroes[0].stats.damage = 1;
  const artifact = compilePhysicalFronts(f.raw, f.ir, f.catalog),
    ls = compileLastStand(f.raw, inventedLastStand(f.raw));
  const p = freezePhysical(
    f.raw,
    binding,
    f.heroes,
    '1'.repeat(64),
    undefined,
    { artifact, catalog: f.catalog },
    ls,
  );
  const combat = {
    version: 'combat-windows-v1',
    roundId: '00000000-0000-4000-8000-000000000099',
    artifactFingerprint: hash('closure'),
    clauses: [],
    heroes: [],
  };
  const outcome = {
    attackId: 'frontier',
    groupId: 'group',
    instructionId: 'fixture.assets:50',
    instructionHash: hash('instruction'),
    recipientHeroId: f.heroes[0].heroId,
    cause: 'counterattack',
    rootSource: 'root',
    directSource: 'base',
    returnTo: 'return',
    artifactFingerprint: hash('closure'),
    projectionFingerprint: hash('projection'),
    figureIds: ['figure'],
    offered: { damage: 1, fear: 0 },
    negated: { damage: 0, fear: 0 },
    prevented: { damage: 0, fear: 0 },
    suffered: { damage: 0, fear: 0 },
    childSources: [],
    sealed: false,
  };
  const program = {
    ...f.program([{ kind: 'enemy-attack', hero: 0, negate: 'might', outcome, addition: null }]),
    combat,
    deferFrontier: 'combat-frontier-v1',
  };
  const id = openPhysical(p, source, program, f.context);
  for (let n = 0; p.snapshot.active && n < 10; n++) {
    const q = p.snapshot.active;
    const input =
      q.mode === 'allocate'
        ? { kind: 'physical-allocate', ability: null, damage: 0, fear: 0 }
        : { kind: 'physical-choice', option: 'resolve' };
    answerPhysical(p, id, input, evidence(n, q.actorPlayerId));
  }
  assert.equal(p.snapshot.active, null);
  assert.equal(p.snapshot.lastStand?.selections.length ?? 0, 0);
  assert.equal(p.snapshot.parents[0].results[0].enemyOutcome.sealed, true);
  const run = openPhysical(
    p,
    { ...source, effectId: 'selected-last-stand' },
    {
      ...f.program([{ kind: 'last-stand-one', hero: 0, family: 'damage' }]),
      combat,
      deferFrontier: 'combat-frontier-v1',
    },
    p.snapshot.resolution.resources,
  );
  assert.ok(p.snapshot.active);
  assert.equal(p.snapshot.active.runId, run);
  assert.equal(p.snapshot.lastStand.selections.length, 1);
  const sealed = structuredClone(p.snapshot.parents[0].results[0].enemyOutcome),
    offset = p.runs.reduce((n, r) => n + r.answers.length, 0);
  for (let n = 0; p.snapshot.active && n < 50; n++) {
    assert.doesNotThrow(() => validatePhysical(JSON.parse(JSON.stringify(p))));
    const q = p.snapshot.active;
    assert.equal(q.kind, 'decision');
    const input =
      q.mode === 'choose'
        ? {
            kind: 'physical-choice',
            option:
              ['reveal', 'resolve', 'close', 'keep'].find((id) =>
                q.options.some((o) => o.id === id),
              ) ?? q.options[0].id,
          }
        : q.mode === 'allocate'
          ? { kind: 'physical-allocate', ability: q.options[0]?.id ?? null, damage: 0, fear: 0 }
          : q.mode === 'select'
            ? { kind: 'physical-select', ids: q.options.slice(0, q.minimum).map((o) => o.id) }
            : {
                kind: 'physical-scout',
                prepare: null,
                discard: null,
                top: q.options.map((o) => o.id),
                bottom: [],
              };
    answerPhysical(p, run, input, evidence(offset + n, q.actorPlayerId));
  }
  assert.equal(p.snapshot.active, null);
  assert.deepEqual(p.snapshot.parents[0].results[0].enemyOutcome, sealed);
});
