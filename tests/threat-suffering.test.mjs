import test from 'node:test';
import assert from 'node:assert/strict';
import { lastStandFixture } from './fixtures/last-stand.mjs';
import { binding, evidence } from './fixtures/physical-fronts.mjs';
import { source } from './fixtures/physical-resolution.mjs';
import * as physical from '../dist/physical-resolution-library.mjs';

test('source group suffering lets the group choose hero order and negates per success before covered cards, with one parent return', () => {
  const f = lastStandFixture();
  const p = physical.freezePhysical(
    f.raw,
    binding,
    f.heroes,
    '1'.repeat(64),
    undefined,
    { artifact: physical.compilePhysicalFronts(f.raw, f.ir, f.catalog), catalog: f.catalog },
    physical.compileLastStand(f.raw, f.lastStandInput),
  );
  p.version = 3;
  const program = f.program([
    {
      kind: 'group-suffer',
      hero: 0,
      heroes: [0, 1, 2],
      family: 'fear',
      amount: 4,
      face: 'facedown',
      negate: 'wisdom',
    },
  ]);
  physical.openPhysical(
    p,
    source,
    program,
    f.context,
    { heroes: f.heroes, connections: [] },
    undefined,
    true,
  );
  const order = [],
    allocated = [];
  for (let n = 0; p.snapshot.active && n < 50; n++) {
    const q = p.snapshot.active;
    assert.equal(q.kind, 'decision');
    let input;
    if (q.mode === 'allocate') {
      assert.equal(q.maximum, 2, 'two successes can negate two of four, without a binary target');
      allocated.push(q.actorHeroId);
      input = { kind: 'physical-allocate', ability: null, damage: 0, fear: 2 };
    } else {
      const option =
        ['resolve', 'reveal', 'close'].find((id) => q.options.some((o) => o.id === id)) ??
        q.options.at(-1).id;
      if (q.options.length === 3) order.push(option);
      input = { kind: 'physical-choice', option };
    }
    physical.answerPhysical(p, q.runId, input, evidence(n, q.actorPlayerId));
  }
  assert.equal(p.snapshot.active, null);
  assert.equal(allocated.length, 3);
  assert.equal(new Set(allocated).size, 3);
  assert.ok(order.length > 0, 'hero order is offered by the existing ordered consumer');
  assert.deepEqual(
    p.snapshot.areas.map((a) => a.fear.length),
    [2, 2, 2],
  );
  assert.ok(
    p.snapshot.areas.every((a) =>
      a.fear.every((copy) => !p.snapshot.resolution.faceup.includes(copy)),
    ),
  );
  assert.equal(p.snapshot.parents[0].returnCount, 1);
  assert.equal(p.snapshot.parents[0].status, 'completed');
  physical.validatePhysical(structuredClone(p));
});

test('new source encounter and threshold consumers share global darkness without rewriting older packs', async () => {
  const { runtime } = await import('./threat-helper.mjs');
  const s = {
    preparation: { heroes: [{ heroId: 'hero-a' }, { heroId: 'hero-b' }] },
    physical: {
      heroes: [{ heroId: 'hero-a' }, { heroId: 'hero-b' }],
      snapshot: { lastStand: null },
    },
    journey: {
      heroes: [
        { heroId: 'hero-a', spaceId: 'a' },
        { heroId: 'hero-b', spaceId: 'b' },
      ],
    },
    mapGeneration: {
      status: 'frozen',
      projection: {
        spaces: [
          { id: 'sa', hasDarkness: false },
          { id: 'sb', hasDarkness: false },
        ],
      },
    },
    scenario: {
      globals: { night: true, override: '' },
      pack: {
        manifest: {
          threatContinuations: {},
          rounds: {
            configuration: { disableDarkness: false },
            bindings: { darkness: 'night', darknessOverride: 'override' },
            darkness: {
              tokenPrefabs: [],
              spaces: [
                { id: 'sa', hasDarkness: false },
                { id: 'sb', hasDarkness: false },
              ],
            },
          },
        },
      },
      play: { active: 'attempt', attempts: [{ id: 'attempt', heroId: 'hero-a' }] },
      instances: [],
      spaceBindings: [
        { id: 'a', sourceId: 'sa' },
        { id: 'b', sourceId: 'sb' },
      ],
    },
  };
  const a = { op: 'sourceTest', stat: 'wisdom', target: 1 };
  assert.deepEqual(runtime.encounterProgram(s, a).darknessHeroes, [0, 1]);
  assert.deepEqual(
    runtime.spawnPhysicalProgram(s, {
      suffering: { family: 'fear', amount: 2, face: 'facedown', negate: 'wisdom' },
    }).darknessHeroes,
    [0, 1],
  );
  delete s.scenario.pack.manifest.threatContinuations;
  assert.deepEqual(runtime.encounterProgram(s, a).darknessHeroes, []);
});
