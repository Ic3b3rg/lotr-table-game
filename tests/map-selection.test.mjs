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
