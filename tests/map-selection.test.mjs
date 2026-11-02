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
