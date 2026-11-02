import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { encountersFixture, addEncounter, fixed } from './fixtures/map-encounters.mjs';
import { digest } from './fixtures/map-assembly.mjs';
const cli = resolve('dist/map-encounters.mjs');
const place = async (f) =>
  (await import('../dist/map-encounters-library.mjs')).placeMapEncounters(f);
async function run(input, check, extra = []) {
  const dir = await mkdtemp(join(tmpdir(), 'lotr-encounters-'));
  try {
    const source = join(dir, 'input.json'),
      output = join(dir, 'output.json');
    const bytes = JSON.stringify(input) + '\n';
    await writeFile(source, bytes);
    const process = spawnSync(
      globalThis.process.execPath,
      [cli, '--input', source, '--output', output, ...extra],
      { encoding: 'utf8', timeout: 30000 },
    );
    let result;
    try {
      result = JSON.parse(await readFile(output, 'utf8'));
    } catch {}
    await check({ process, result, source, output, dir, bytes });
    assert.equal(await readFile(source, 'utf8'), bytes);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
test('encounters CLI recalculates raw assembly, shuffles builder spaces and places six invented fixed IDs', async () => {
  const f = encountersFixture();
  for (let i = 0; i < 6; i++) fixed(f, Math.floor(i / 2), i, addEncounter(f), i === 0 ? null : 0);
  await run(f, async ({ process, result: v, output, source, bytes }) => {
    assert.equal(process.status, 0, process.stderr);
    assert.equal(v.status, 'encounters-complete', JSON.stringify(v.failure));
    assert.equal(v.checkpoint, 'after-encounter-history-before-prefab-execution');
    assert.equal(v.scope, 'encounter-placement-only');
    assert.equal(v.inputFileFingerprint, digest(bytes));
    assert.equal(v.assignments.length, 6);
    assert.equal(new Set(v.assignments.map((a) => a.encounterId)).size, 6);
    assert.ok(
      v.assignments.every((a) => a.origin.stage === 'fixed-tile' && a.encounterId >= 100000),
    );
    assert.deepEqual(v.assembly.mapOrder, [1, 3, 2, 0]);
    assert.deepEqual(
      v.allSpacesBeforeShuffle,
      v.spaces.map((s) => s.id),
    );
    const { SourceRandom } = await import('../dist/map-primitives.mjs');
    const rng = SourceRandom.restore(v.assembly.rng),
      order = [...v.allSpacesBeforeShuffle];
    for (let i = 0; i < order.length; i++) {
      const j = rng.nextInt(0, order.length);
      [order[i], order[j]] = [order[j], order[i]];
    }
    assert.deepEqual(v.allSpaces, order);
    rng.nextInt(0, 2); // unspecified fixed space, even if a singleton
    rng.nextInt(0, 1); // one candidate group shuffle
    assert.deepEqual(v.rng, rng.snapshot());
    assert.deepEqual(
      v.spawnOrder.map((a) => a.spaceId),
      order.filter((id) => v.assignments.some((a) => a.spaceId === id)),
    );
    assert.deepEqual(
      v.history.result.usedEncounterIds,
      v.spawnOrder.map((a) => a.encounterId),
    );
    assert.deepEqual(v.history.incoming.usedEncounterIds, []);
    assert.equal(v.closure.status, 'pending-prefab-execution');
    const before = await readFile(output, 'utf8');
    const again = spawnSync(
      globalThis.process.execPath,
      [cli, '--input', source, '--output', output],
      { encoding: 'utf8' },
    );
    assert.equal(again.status, 1);
    assert.equal(await readFile(output, 'utf8'), before);
  });
});
test('encounter library clones input, freezes result and keeps assembly debug out of successful output', async () => {
  const f = encountersFixture(),
    before = structuredClone(f),
    v = await place(f);
  assert.deepEqual(f, before);
  assert.ok(Object.isFrozen(v));
  assert.ok(Object.isFrozen(v.spaces[0].connected));
  assert.equal(v.assembly.trace, undefined);
  assert.equal(v.assembly.input, undefined);
  assert.equal(v.sourceParity, 'not-certified');
});
for (const [name, edit, reason] of [
  [
    'duplicate',
    (f) => fixed(f, 0, 1, f.assembly.selection.encounters[0].source, 0),
    'fixed-duplicate',
  ],
  ['occupied', (f) => fixed(f, 0, 0, addEncounter(f), 0), 'fixed-occupied'],
  [
    'missing tile',
    (f) => (f.placement.sections[0].tileEncounters[0].tileId = -123),
    'fixed-tile-missing',
  ],
  [
    'bad index',
    (f) => (f.placement.sections[0].tileEncounters[0].spaceIndex = 20),
    'fixed-space-missing',
  ],
  [
    'missing all-model lookup',
    (f) => (f.assembly.selection.products[0].encounterSources = []),
    'fixed-model-missing',
  ],
])
  test(`fixed ${name} produces a source diagnostic, advanced RNG and no checkpoint`, async () => {
    const f = encountersFixture();
    fixed(f, 0, 0, addEncounter(f), 0);
    edit(f);
    await run(f, ({ process, result: v }) => {
      assert.equal(process.status, 2, process.stderr);
      assert.equal(v.status, 'source-failure');
      assert.equal(v.failure.reason, reason);
      assert.equal(v.failure.sourceErrorCode, 2);
      assert.equal(v.checkpoint, null);
      assert.equal(v.rng.samples, v.assembly.rng.samples + 16);
    });
  });
for (const [name, edit] of [
  ['checkpoint injection', (f) => (f.assembly.rng = { samples: 100 })],
  ['placement identity', (f) => f.placement.models[0].id++],
  ['provenance mismatch', (f) => (f.placement.provenance.files[0].sha256 = '0'.repeat(64))],
  ['fixed filter mismatch', (f) => (f.assembly.selection.sections[0].fixedEncounterSources = [])],
  ['prefab resource mismatch', (f) => (f.placement.models[0].prefab.resourceKey = 'wrong')],
  ['undeclared prefab file', (f) => (f.placement.models[0].prefab.source = 'unknown.assets:1')],
])
  test(`encounters CLI rejects ${name} without a result`, async () => {
    const f = encountersFixture();
    fixed(f, 0, 0, addEncounter(f));
    edit(f);
    await run(f, ({ process, result }) => {
      assert.equal(process.status, 1);
      assert.equal(result, undefined);
      assert.match(process.stderr, /Input/);
    });
  });
