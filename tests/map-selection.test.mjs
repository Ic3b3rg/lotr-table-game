import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const cli = resolve('dist/map-selection.mjs');
const ref = (n) => `invented.assets:${n}`;
const digest = (s) => createHash('sha256').update(s).digest('hex');

function fixture() {
  const standard = Array.from({ length: 120 }, (_, index) => ({
    index,
    source: ref(1000 + index),
    modelSource: ref(2000 + index),
    code: `invented-${index}`,
    hashId: 10000 + index,
    oppositeHashId: 10000 + (index ^ 1),
    set: 1,
    spaces: [{ index: 0, source: ref(3000 + index), traits: 1 }],
  }));
  return {
    formatVersion: 1,
    algorithm: 'source-selection-v1',
    provenance: {
      sourceVersion: 'invented-public-fixture-v1',
      files: [{ file: 'invented.assets', sha256: digest('invented') }],
    },
    context: {
      adventureId: 1,
      seed: 1,
      heroCount: 1,
      language: 'Italian',
      ownedProductIds: [0],
      groupItemIds: [],
      heroes: [{ id: 1, source: ref(4000), itemIds: [] }],
      usedEncounterIds: [],
      usedGroupIds: [],
      unlockedChainIds: [],
    },
    products: [
      {
        index: 0,
        source: ref(1),
        id: 0,
        tileCodes: standard.map((t) => t.code),
        encounterSources: [],
        groupSources: [],
        itemQuantities: [],
      },
    ],
    items: [],
    encounters: [],
    groups: [],
    standard,
    custom: [],
    sections: Array.from({ length: 4 }, (_, index) => ({
      index,
      source: ref(5000 + index),
      allowedTileSets: 1,
      minimumSpaces: 0,
      maximumSpaces: 0,
      ignorePlayerScaling: index === 0,
      relativeSizeFactor: -1,
      start: null,
      required: [],
      traitRequirements: [],
      fixedEncounterSources: [],
    })),
    requiredConnections: [],
    adventureEncounterSources: [],
    encounterTraitsFilter: { mustHaveAny: 0, mustHaveAll: 0, excludeIfAny: 0 },
    incoming: { randomEncounterPool: [], itemEncounterPool: [], percentNormal: Math.fround(0.4) },
    budget: { policy: 'selection-operations-v1', maxOperations: 100000 },
  };
}

async function run(input, check, extra = []) {
  const dir = await mkdtemp(join(tmpdir(), 'lotr-selection-'));
  try {
    const source = join(dir, 'input.json'),
      output = join(dir, 'output.json');
    const bytes = `${JSON.stringify(input)}\n`;
    await writeFile(source, bytes);
    const process = spawnSync(
      globalThis.process.execPath,
      [cli, '--input', source, '--output', output, ...extra],
      { encoding: 'utf8' },
    );
    let result;
    try {
      result = JSON.parse(await readFile(output, 'utf8'));
    } catch {}
    await check({ process, result, source, output, dir, bytes });
    assert.equal(await readFile(source, 'utf8'), bytes, 'CLI must preserve input bytes');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function selected({ process, result }) {
  assert.equal(process.status, 0, process.stderr);
  assert.equal(result.scope, 'selection-only');
  assert.equal(result.status, 'selected');
  assert.equal(result.checkpoint, 'after-optional-before-local-edges');
  return result;
}

test('selection CLI builds a deterministic versioned selection and exclusive output', async () => {
  await run(fixture(), async (r) => {
    const v = selected(r);
    assert.equal(v.inputFileFingerprint, digest(r.bytes));
    assert.equal(v.inputFingerprint, digest(JSON.stringify(v.input)));
    assert.equal(v.sections.length, 4);
    assert.deepEqual(
      v.sections.map((s) => s.availableTiles),
      [[], [], [], []],
    );
    assert.equal(v.checkpoints.find((c) => c.stage === 'coroutine-entry').rng.samples, 120);
    assert.equal(v.rng.samples, 124);
    const first = await readFile(r.output, 'utf8');
    const replay = join(r.dir, 'replay.json');
    const p = spawnSync(
      globalThis.process.execPath,
      [cli, '--input', r.source, '--output', replay],
      { encoding: 'utf8' },
    );
    assert.equal(p.status, 0, p.stderr);
    assert.equal(await readFile(replay, 'utf8'), first);
    const collision = spawnSync(
      globalThis.process.execPath,
      [cli, '--input', r.source, '--output', r.output],
      { encoding: 'utf8' },
    );
    assert.equal(collision.status, 1);
    assert.equal(await readFile(r.output, 'utf8'), first);
    assert.deepEqual((await readdir(r.dir)).sort(), ['input.json', 'output.json', 'replay.json']);
  });
});

for (const [name, edit] of [
  [
    'missing explicit company',
    (f) => {
      delete f.context.heroes;
    },
  ],
  ['missing standard entry', (f) => f.standard.pop()],
  [
    'wrong original index',
    (f) => {
      f.standard[1].index = 7;
    },
  ],
  ['unresolved encounter', (f) => f.products[0].encounterSources.push(ref(999))],
  [
    'unproven source file',
    (f) => {
      f.standard[0].source = 'missing.assets:1';
    },
  ],
  [
    'duplicate HashId inside a bucket',
    (f) => {
      f.standard[1].hashId = f.standard[0].hashId;
    },
  ],
  [
    'unknown original model reference',
    (f) => {
      f.sections[0].start = { isStandard: true, modelSource: ref(999) };
    },
  ],
]) {
  test(`selection CLI rejects ${name} without publishing`, async () => {
    const f = fixture();
    edit(f);
    await run(f, ({ process, result }) => {
      assert.equal(process.status, 1);
      assert.equal(result, undefined);
      assert.match(process.stderr, /Input/);
    });
  });
}

test('selection CLI bounds the input file and rejects duplicate options', async () => {
  await run(fixture(), async ({ source, output, dir }) => {
    const tooLarge = join(dir, 'large.json');
    await writeFile(tooLarge, Buffer.alloc(8 * 1024 * 1024 + 1, 32));
    for (const args of [
      ['--input', tooLarge, '--output', output],
      ['--input', source, '--input', source, '--output', output],
    ]) {
      const p = spawnSync(globalThis.process.execPath, [cli, ...args], { encoding: 'utf8' });
      assert.equal(p.status, 1);
      assert.match(p.stderr, /massimo|duplicate/);
    }
  });
});

function encounter(f, id, type = 0, extra = {}) {
  const e = {
    index: f.encounters.length,
    source: ref(6000 + id),
    id,
    type,
    traits: 1,
    isRepeatable: false,
    unsupportedLanguages: [],
    itemSources: [],
    ...extra,
  };
  f.encounters.push(e);
  f.products[0].encounterSources.push(e.source);
  return e.source;
}
function item(f, id, quantity = 1, upgradeSources = []) {
  const i = { index: f.items.length, source: ref(7000 + id), id, upgradeSources };
  f.items.push(i);
  f.products[0].itemQuantities.push({ itemSource: i.source, quantity });
  return i.source;
}

test('pool filters keep source order, language first, fixed normal exclusions and unlocked chains', async () => {
  const f = fixture();
  const normal = encounter(f, 1),
    unsupported = encounter(f, 2, 0, { unsupportedLanguages: ['Italian'] });
  encounter(f, 3, 0, { traits: 2 });
  encounter(f, 4);
  const repeatable = encounter(f, 5, 0, { isRepeatable: true }),
    fixed = encounter(f, 6);
  encounter(f, 7, 1);
  encounter(f, 8, 2);
  const chain = encounter(f, 9, 2, { traits: 2 });
  encounter(f, 10, 2, { unsupportedLanguages: ['Italian'] });
  encounter(f, 11, 2);
  encounter(f, 12, 3);
  f.context.usedEncounterIds = [4, 5, 8];
  f.context.unlockedChainIds = [8, 9, 10];
  f.encounterTraitsFilter = { mustHaveAny: 1, mustHaveAll: 1, excludeIfAny: 2 };
  f.sections[1].fixedEncounterSources = [fixed];
  f.adventureEncounterSources = [unsupported];
  await run(f, (r) => {
    const v = selected(r);
    assert.deepEqual(v.pools.normalEligible, [normal, repeatable]);
    assert.deepEqual(v.pools.chainEligible, [chain]);
    assert.deepEqual(v.pools.itemEligible, []);
    assert.deepEqual(new Set(v.pools.randomEncounterPool), new Set([normal, repeatable, chain]));
    assert.equal(v.checkpoints.find((c) => c.stage === 'normal-shuffle').rng.samples, 122);
    assert.equal(v.checkpoints.find((c) => c.stage === 'chain-shuffle').rng.samples, 123);
  });
});

test('item capacity counts exact group occurrences and each hero once, with separate recursive group upgrade exclusion', async () => {
  const f = fixture();
  const a = item(f, 1, 2),
    b = item(f, 2),
    c = item(f, 3),
    d = item(f, 4);
  const e = item(f, 5, 0),
    upgrade = item(f, 6),
    middle = item(f, 7, 1, [upgrade]);
  f.items.find((i) => i.id === 2).upgradeSources = [middle];
  f.context.heroes[0].itemIds = [1, 1, 1];
  f.context.groupItemIds = [6, 3, 3];
  const available = encounter(f, 1, 4, { itemSources: [a] });
  encounter(f, 2, 4, { itemSources: [b] }); // recursive reach to group item 6
  encounter(f, 3, 4, { itemSources: [c] }); // duplicate group occurrence
  encounter(f, 4, 4, { itemSources: [d, null] });
  encounter(f, 5, 4, { itemSources: [null] });
  encounter(f, 6, 4, { itemSources: [e] });
  const noHistoryFilter = encounter(f, 7, 4, { itemSources: [d], traits: 2 });
  f.context.usedEncounterIds = [7];
  f.encounterTraitsFilter.excludeIfAny = 2;
  await run(f, (r) => {
    const v = selected(r);
    assert.deepEqual(v.pools.itemEligible, [available, noHistoryFilter]);
    assert.deepEqual(
      v.pools.itemCapacity.find((c) => c.id === 1),
      { id: 1, owned: 2, held: 1 },
    );
    assert.deepEqual(
      v.pools.itemCapacity.find((c) => c.id === 3),
      { id: 3, owned: 1, held: 2 },
    );
    assert.equal(v.checkpoints.find((c) => c.stage === 'coroutine-entry').rng.samples, 122);
  });
  f.context.heroCount = 2;
  f.context.heroes.push({ id: 2, source: ref(4001), itemIds: [1] });
  f.sections.forEach((s) => {
    s.maximumSpaces = 1;
  });
  await run(f, (r) => {
    const v = selected(r);
    assert.deepEqual(v.pools.itemEligible, [noHistoryFilter]);
  });
});

test('retry retains ordered pools and duplicates then reshuffles all retained items', async () => {
  const f = fixture(),
    a = item(f, 1),
    normal = encounter(f, 1);
  const reward = encounter(f, 2, 4, { itemSources: [a] });
  f.incoming.randomEncounterPool = [normal, normal];
  f.incoming.itemEncounterPool = [reward, reward];
  await run(f, (r) => {
    const v = selected(r);
    assert.deepEqual(v.pools.randomEncounterPool, [normal, normal, normal]);
    assert.deepEqual(v.pools.itemEncounterPool, [reward, reward, reward]);
    assert.equal(v.checkpoints.find((c) => c.stage === 'item-shuffle').rng.samples, 124);
    assert.equal(v.pools.percentNormal, Math.fround(0.4));
  });
});

for (const [percentNormal, first, after] of [
  [1.5, 'normal', 0.75],
  [-0.5, 'chain', -1],
  ['Infinity', 'normal', 'Infinity'],
]) {
  test(`source mixture preserves ${percentNormal} without clamping`, async () => {
    const f = fixture();
    encounter(f, 1);
    encounter(f, 2, 2);
    f.context.unlockedChainIds = [2];
    f.incoming.percentNormal = percentNormal;
    await run(f, (r) => {
      const v = selected(r),
        merge = v.trace.filter((t) => t.operation === 'merge');
      assert.equal(merge.length, 2);
      assert.equal(merge[0].pool, first);
      assert.equal(merge[0].percentNormal, after);
      assert.equal(merge[0].samples, 123);
      assert.equal(merge[1].samples, 123);
    });
  });
}

test('H3 scales a shuffled copy of all four builders once into a permutation of 2,1,1', async () => {
  const f = fixture();
  f.context.heroCount = 3;
  f.context.heroes.push(
    { id: 2, source: ref(4001), itemIds: [] },
    { id: 3, source: ref(4002), itemIds: [] },
  );
  await run(f, (r) => {
    const v = selected(r);
    assert.equal(v.sections[0].extraSpaces, 0);
    assert.deepEqual(
      v.sections
        .slice(1)
        .map((s) => s.extraSpaces)
        .sort(),
      [1, 1, 2],
    );
    assert.deepEqual([...v.scalingOrder].sort(), [0, 1, 2, 3]);
    assert.equal(v.checkpoints.find((c) => c.stage === 'scaling').rng.samples, 124);
  });
});

function reserve(tile, isStandard = true) {
  return { isStandard, modelSource: tile.modelSource };
}
function active(f, id, min = 1, max = min) {
  Object.assign(f.sections[id], { minimumSpaces: min, maximumSpaces: max });
}
function onlyTiles(f, indices) {
  for (const t of f.standard) t.set = indices.includes(t.index) ? 1 : 4;
}

test('all starts precede all required, explicit references bypass generic restrictions and ignore IsStandard', async () => {
  const f = fixture();
  f.sections[0].required = [reserve(f.standard[0], false)];
  f.sections[3].start = reserve(f.standard[2], false);
  f.requiredConnections = [
    [0, 1],
    [2, 3],
    [3, 1],
    [2, 1],
  ];
  await run(f, (r) => {
    const v = selected(r),
      seeds = v.trace.filter((t) => t.operation === 'seed');
    assert.deepEqual(
      seeds.map((t) => [t.stage, t.sectionId, t.tileSource]),
      [
        ['starts', 3, ref(1002)],
        ['required', 0, ref(1000)],
      ],
    );
    assert.deepEqual(
      v.sections.map((s) => s.spacesFromAvailableTiles),
      [1, 0, 0, 1],
    );
    assert.deepEqual(
      v.sections.map((s) => s.requiredConnectedSectionIds),
      [[1], [0, 3, 2], [3, 1], [2, 1]],
    );
    assert.equal(v.buckets.standard.find((t) => t.source === ref(1000)).used, true);
    assert.equal(v.buckets.standard.find((t) => t.source === ref(1001)).used, false);
  });
});

test('custom prefab shadows standard by HashId even when IsStandard is true', async () => {
  const f = fixture();
  f.custom.push({
    ...structuredClone(f.standard[0]),
    index: 0,
    source: ref(9000),
    spaces: [{ index: 0, source: ref(9001), traits: 2 }],
  });
  f.sections[0].start = reserve(f.standard[0]);
  await run(f, (r) => {
    const v = selected(r);
    assert.deepEqual(v.sections[0].availableTiles, [ref(9000)]);
    assert.equal(v.buckets.custom[0].used, true);
    assert.equal(v.buckets.standard[0].used, false);
  });
  f.sections[1].required = [reserve(f.standard[0])];
  await run(f, ({ process, result }) => {
    assert.equal(process.status, 2);
    assert.equal(result.status, 'source-failure');
    assert.equal(result.failure.sourceErrorCode, 2);
    assert.equal(result.failure.stage, 'required');
    assert.equal(result.checkpoint, null);
    assert.equal(
      result.buckets.standard[0].used,
      false,
      'used custom must never fall back to standard',
    );
  });
});

test('unowned explicit seed is source success with used flag and no AvailableTiles geometry', async () => {
  const f = fixture();
  f.products[0].tileCodes = f.products[0].tileCodes.filter((c) => c !== f.standard[0].code);
  f.sections[0].start = reserve(f.standard[0]);
  await run(f, (r) => {
    const v = selected(r);
    assert.deepEqual(v.sections[0].availableTiles, []);
    const event = v.trace.find((t) => t.operation === 'seed');
    assert.equal(event.added, false);
    assert.equal(event.reason, 'unowned-phantom');
    assert.equal(v.buckets.standard[0].used, true);
    assert.equal(v.buckets.standard[0].owned, false);
  });
});

test('generic scan preserves phantom successes without new RNG draws, then finds owned capacity', async () => {
  const f = fixture();
  onlyTiles(f, [87, 16]);
  active(f, 0);
  f.products[0].tileCodes = [f.standard[16].code];
  await run(f, (r) => {
    const v = selected(r),
      seeds = v.trace.filter((t) => t.operation === 'seed');
    assert.deepEqual(
      seeds.map((t) => [t.hashId, t.added, t.samples]),
      [
        [10087, false, 120],
        [10016, true, 120],
      ],
    );
    assert.deepEqual(v.sections[0].availableTiles, [ref(1016)]);
    assert.equal(v.buckets.standard[87].used, true);
  });
});

test('one multi-trait space cannot cover two distinct requirements even when independent counts suffice', async () => {
  const f = fixture();
  f.standard[87].spaces[0].traits = 3;
  f.sections[0].start = reserve(f.standard[87]);
  active(f, 0, 1, 2);
  f.sections[0].traitRequirements = [
    { trait: 1, count: 1 },
    { trait: 2, count: 1 },
  ];
  await run(f, ({ process, result }) => {
    assert.equal(process.status, 2);
    assert.equal(result.status, 'source-failure');
    assert.equal(result.failure.stage, 'traits');
    assert.equal(result.failure.sourceErrorCode, 2);
    assert.equal(result.sections[0].traitsMet, false);
    assert.equal(result.checkpoint, null);
    assert.equal(result.rng.samples, 120);
  });
});

test('trait matching backtracks its space reservation to fit a later narrow requirement', async () => {
  const f = fixture();
  f.standard[0].spaces[0].traits = 3;
  f.sections[0].start = reserve(f.standard[0]);
  f.sections[0].required = [reserve(f.standard[2])];
  f.sections[0].traitRequirements = [
    { trait: 1, count: 1 },
    { trait: 2, count: 1 },
  ];
  await run(f, (r) => {
    const v = selected(r);
    assert.equal(v.sections[0].traitsMet, true);
    assert.deepEqual(
      v.sections[0].traitMatching.map((s) => [s.tileSource, s.spaceIndex]),
      [
        [ref(1002), 0],
        [ref(1000), 0],
      ],
    );
  });
});

for (const phase of ['traits', 'minimum']) {
  test(`${phase} backtracks a genuine dead end with prefix pruning and returns only the removed face`, async () => {
    const f = fixture();
    onlyTiles(f, [87, 16]);
    f.standard[87].set = 2;
    f.sections[0].allowedTileSets = 3;
    f.sections[1].allowedTileSets = 2;
    active(f, 0);
    active(f, 1);
    if (phase === 'traits')
      for (const s of f.sections.slice(0, 2)) s.traitRequirements = [{ trait: 1, count: 1 }];
    await run(f, (r) => {
      const v = selected(r),
        rollbacks = v.trace.filter((t) => t.operation === 'rollback');
      assert.deepEqual(
        v.sections.slice(0, 2).map((s) => s.availableTiles),
        [[ref(1016)], [ref(1087)]],
      );
      assert.equal(rollbacks.length, 1);
      assert.equal(rollbacks[0].stage, phase);
      assert.deepEqual(rollbacks[0].failedSequence, [10087]);
      assert.equal(rollbacks[0].invalidCount, 1);
      assert.equal(rollbacks[0].samples, 120);
      assert.deepEqual(v.search, {
        sequence: [],
        history: [],
        invalidSequences: [],
        invalidCount: 0,
      });
      assert.equal(v.buckets.standard[86].used, false);
      assert.equal(v.rng.samples, 124);
    });
  });
}

test('generic eligibility honors other reservations, opposite AvailableTiles, full set mask and max space count', async () => {
  const f = fixture();
  onlyTiles(f, [87, 16, 56, 93, 78]);
  active(f, 0, 1, 1);
  f.standard[87].set = 3; // one forbidden bit rejects entire tile
  f.standard[16].spaces.push({ index: 1, source: ref(9901), traits: 1 }); // too big
  f.sections[1].required = [reserve(f.standard[57])]; // opposite of 56
  f.sections[2].required = [reserve(f.standard[93])]; // reservation
  await run(f, (r) => {
    const v = selected(r);
    assert.deepEqual(v.sections[0].availableTiles, [ref(1078)]);
    assert.equal(v.buckets.standard[87].used, false);
    assert.equal(v.buckets.standard[16].used, false);
    assert.equal(v.buckets.standard[56].used, false);
    assert.equal(v.buckets.standard[93].used, true);
  });
});

test('optional selection cycles with draws, stops on strict greater-than, and never adds history or rolls back', async () => {
  const f = fixture();
  onlyTiles(f, [87, 16, 56]);
  active(f, 0, 0, 2);
  f.sections[0].relativeSizeFactor = 1;
  await run(f, (r) => {
    const v = selected(r);
    assert.deepEqual(v.sections[0].availableTiles, [ref(1087), ref(1016)]);
    assert.equal(v.sections[0].spacesFromAvailableTiles, 2);
    assert.equal(v.rng.samples, 126); // s0 three draws; other sections one each
    assert.equal(v.trace.filter((t) => t.operation === 'rollback').length, 0);
    assert.deepEqual(v.search.sequence, []);
    assert.equal(v.checkpoints.at(-1).stage, 'selection-boundary');
  });
});

test('administrative operation exhaustion is diagnostic, never source Timeout or selected output', async () => {
  const f = fixture();
  f.budget.maxOperations = 1;
  active(f, 0);
  await run(f, ({ process, result }) => {
    assert.equal(process.status, 2);
    assert.equal(result.status, 'administrative-stop');
    assert.equal(result.failure.policy, 'selection-operations-v1');
    assert.equal(result.failure.sourceErrorCode, undefined);
    assert.equal(result.checkpoint, null);
    assert.ok(result.trace.some((t) => t.operation === 'failure'));
  });
});

test('library preserves a deeply frozen input and deterministic RNG state', async () => {
  const { selectMapTiles } = await import('../dist/map-selection-library.mjs');
  const f = fixture();
  active(f, 0);
  const before = JSON.stringify(f);
  function freeze(o) {
    if (o && typeof o === 'object') {
      Object.values(o).forEach(freeze);
      Object.freeze(o);
    }
    return o;
  }
  const result = selectMapTiles(freeze(f));
  assert.equal(result.status, 'selected');
  assert.equal(JSON.stringify(f), before);
  assert.deepEqual(selectMapTiles(f), result);
});

test('mixture equality chooses chain at the exact portable float32 boundary', async () => {
  const f = fixture();
  const n = encounter(f, 1),
    c = encounter(f, 2, 2);
  f.context.unlockedChainIds = [2];
  f.incoming.percentNormal = 0.6880244016647339; // independently pinned seed1 sample123
  await run(f, (r) => {
    const v = selected(r);
    assert.deepEqual(v.pools.randomEncounterPool, [c, n]);
    assert.equal(v.pools.percentNormal, 1.3760488033294678);
  });
});

test('item quantities sum across owned products, while hero upgrades do not exclude a lower item', async () => {
  const f = fixture(),
    a = item(f, 1, 1),
    upgrade = item(f, 2);
  f.items[0].upgradeSources = [upgrade];
  f.context.heroes[0].itemIds = [1, 2];
  f.products.push({
    index: 1,
    source: ref(2),
    id: 1,
    tileCodes: [],
    encounterSources: [],
    groupSources: [],
    itemQuantities: [{ itemSource: a, quantity: 1 }],
  });
  f.context.ownedProductIds.push(1);
  const e = encounter(f, 1, 4, { itemSources: [a] });
  await run(f, (r) => {
    const v = selected(r);
    assert.deepEqual(v.pools.itemEligible, [e]);
    assert.deepEqual(v.pools.itemCapacity[0], { id: 1, owned: 2, held: 1 });
  });
});

test('administrative stop during filtering retains already appended retry items and has no fabricated RNG', async () => {
  const f = fixture(),
    a = item(f, 1),
    e = encounter(f, 1, 4, { itemSources: [a] });
  encounter(f, 2);
  f.incoming.itemEncounterPool = [e];
  f.budget.maxOperations = 2;
  await run(f, ({ process, result }) => {
    assert.equal(process.status, 2);
    assert.equal(result.status, 'administrative-stop');
    assert.deepEqual(result.pools.itemEncounterPool, [e, e]);
    assert.equal(result.rng, null);
  });
});

test('heuristic trait counts use HasAny while satisfaction requires every bit of a compound mask', async () => {
  const f = fixture();
  onlyTiles(f, [87]);
  active(f, 0, 0, 1);
  f.standard[87].spaces[0].traits = 1;
  f.sections[0].traitRequirements = [{ trait: 3, count: 1 }];
  await run(f, ({ process, result }) => {
    assert.equal(process.status, 2);
    assert.equal(result.status, 'source-failure');
    assert.ok(
      result.trace.some(
        (t) => t.stage === 'traits' && t.operation === 'seed' && t.hashId === 10087,
      ),
    );
    assert.ok(result.trace.some((t) => t.operation === 'rollback' && t.hashId === 10087));
    assert.equal(result.search.invalidCount, 1);
  });
});
