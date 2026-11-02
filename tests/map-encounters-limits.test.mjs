import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm, truncate } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { placeMapEncounters as place } from '../dist/map-encounters-library.mjs';
import { encountersFixture, addEncounter, fixed, synchronize } from './fixtures/map-encounters.mjs';
import { ref } from './fixtures/map-assembly.mjs';
test('operation budget halts within shuffle with advanced RNG and no source error/checkpoint', () => {
  const f = encountersFixture();
  f.execution.maxOperations = 1;
  const v = place(f);
  assert.equal(v.status, 'administrative-stop');
  assert.equal(v.failure.reason, 'operation-budget');
  assert.equal(v.failure.sourceErrorCode, null);
  assert.equal(v.checkpoint, null);
  assert.equal(v.rng.samples, v.assembly.rng.samples + 1);
  assert.equal(v.search.operations, 1);
  assert.equal(v.trace.at(-1).operation, 'failure');
});
test('trace budget retains consumed draw even if the shuffle swap has not completed', () => {
  const f = encountersFixture();
  f.execution.maxTraceEvents = 1;
  const v = place(f);
  assert.equal(v.status, 'administrative-stop');
  assert.ok(['trace-budget', 'clock-trace-budget'].includes(v.failure.reason));
  assert.equal(v.failure.sourceErrorCode, null);
  assert.equal(v.checkpoint, null);
  assert.ok(v.rng.samples > v.assembly.rng.samples);
});
test('logical clock budget is administrative, and clock replay consumes the exact contexts and RNG ordinals', () => {
  const f = encountersFixture();
  f.execution.clock.stepMilliseconds = 10;
  f.execution.clock.timeoutMilliseconds = 1;
  const v = place(f);
  assert.equal(v.status, 'administrative-stop');
  assert.equal(v.failure.reason, 'clock-budget');
  assert.equal(v.failure.sourceErrorCode, null);
  assert.equal(v.clock.observations.at(-1).timeout, true);
  const good = encountersFixture();
  fixed(good, 0, 0, addEncounter(good));
  const original = place(good);
  good.execution.clock = {
    policy: 'replay-clock-v1',
    timeoutMilliseconds: 30000,
    observations: structuredClone(original.clock.observations),
  };
  const replay = place(good);
  assert.equal(replay.status, 'encounters-complete');
  assert.deepEqual(replay.assignments, original.assignments);
  assert.deepEqual(replay.trace, original.trace);
  assert.deepEqual(replay.rng, original.rng);
  assert.equal(replay.clock.cursor, good.execution.clock.observations.length);
  good.execution.clock.observations[0].samples++;
  assert.throws(() => place(good), /replay clock/);
});
test('replay rejects missing and residual observations without turning them into source failures', () => {
  const f = encountersFixture(),
    v = place(f);
  for (const observations of [
    v.clock.observations.slice(1),
    [...v.clock.observations, { ...v.clock.observations.at(-1) }],
  ]) {
    f.execution.clock = { policy: 'replay-clock-v1', timeoutMilliseconds: 30000, observations };
    assert.throws(() => place(f), /replay clock/);
  }
});

test('encounter replay supports sequence depth beyond the four geometric sections', () => {
  const f = encountersFixture();
  const ids = Array.from({ length: 6 }, () => addEncounter(f));
  f.assembly.selection.groups[0].requiredSources = ids;
  const v = place(f);
  assert.equal(v.status, 'encounters-complete');
  assert.ok(v.clock.observations.some((o) => o.depth > 4));
  f.execution.clock = {
    policy: 'replay-clock-v1',
    timeoutMilliseconds: 30000,
    observations: structuredClone(v.clock.observations),
  };
  assert.deepEqual(place(f).rng, v.rng);
});

test('float32 fill threshold overflow is serialized explicitly, never as JSON null', () => {
  const f = encountersFixture();
  f.placement.sections[0].randomFillPercent = Math.fround(3e38);
  const v = place(f);
  assert.equal(v.status, 'encounters-complete');
  assert.equal(v.trace.find((e) => e.operation === 'fill-section').threshold, 'Infinity');
});
test('upstream assembly stop keeps its diagnostic and RNG without performing encounter draws', () => {
  const f = encountersFixture();
  f.assembly.execution.maxOperations = 1;
  const v = place(f);
  assert.equal(v.status, 'administrative-stop');
  assert.equal(v.failure.reason, 'assembly-failed');
  assert.equal(v.checkpoint, null);
  assert.deepEqual(v.allSpaces, []);
  assert.deepEqual(v.rng, v.upstreamDiagnostic.rng);
  assert.equal(v.trace.length, 1);
});
test('unowned selected model distinguishes source failure from the unchecked section-index exception in source logging', () => {
  for (const shuffledIndex of [0, 8]) {
    const f = encountersFixture(),
      initial = place(f),
      space = initial.spaces.find((s) => s.id === initial.allSpaces[shuffledIndex]);
    const tileIndex = f.assembly.selection.standard.findIndex((t) => t.source === space.tileSource);
    const e = addEncounter(f);
    fixed(f, space.sectionId, tileIndex, e, space.index);
    f.assembly.selection.products[0].encounterSources = [];
    f.assembly.selection.products.push({
      index: 1,
      source: ref(60000),
      id: 1,
      tileCodes: [],
      encounterSources: [e],
      groupSources: [],
      itemQuantities: [],
    });
    const v = place(f);
    assert.equal(v.checkpoint, null);
    assert.equal(v.status, shuffledIndex < 4 ? 'source-failure' : 'source-operation-exception');
    assert.equal(
      v.failure.reason,
      shuffledIndex < 4 ? 'spawn-model-not-owned' : 'spawn-log-section-index',
    );
    assert.equal(v.failure.sourceErrorCode, shuffledIndex < 4 ? 2 : null);
    assert.deepEqual(v.history.result.usedEncounterIds, []);
    assert.deepEqual(v.history.result.usedGroupIds, []);
    assert.equal(v.assignments.length, 1);
  }
});
test('fixed unspecified singleton consumes a draw and full IDs survive history and output', () => {
  const f = encountersFixture();
  for (let i = 0; i < 8; i++) {
    f.assembly.selection.standard[i].spaces.splice(1);
    f.assembly.geometry.tiles[i].spaces.splice(1);
    f.assembly.geometry.tiles[i].spaces[0].serializedConnectedSpaces = [];
    f.assembly.geometry.tiles[i].hexes.forEach((h) => (h.space = 0));
  }
  f.assembly.selection.sections.forEach((s) => {
    s.minimumSpaces = 2;
    s.maximumSpaces = 2;
  });
  fixed(f, 0, 0, addEncounter(f, { id: 2147483647 }), null);
  const v = place(f);
  assert.equal(v.status, 'encounters-complete');
  const draw = v.trace.find((e) => e.operation === 'draw' && e.site === 'fixed-space');
  assert.equal(draw.max, 1);
  assert.equal(v.rng.samples, v.assembly.rng.samples + 8 + 1 + 1);
  assert.deepEqual(v.history.result.usedEncounterIds, [2147483647]);
});
test('SpecificTile compares model identity even when custom and standard share the numeric hash', () => {
  const f = encountersFixture(),
    standard = f.assembly.selection.standard[0];
  const custom = {
    ...structuredClone(standard),
    index: 0,
    source: ref(61000),
    modelSource: ref(61001),
  };
  f.assembly.selection.custom = [custom];
  const shape = {
    ...structuredClone(f.assembly.geometry.tiles[0]),
    source: custom.source,
    modelSource: custom.modelSource,
  };
  f.assembly.geometry.tiles.push(shape);
  const e = addEncounter(
    f,
    {},
    { specificTileModelSource: standard.modelSource, specificSpaceIndex: 0 },
  );
  f.placement.sections[0].sectionEncounterSources = [e];
  synchronize(f);
  const v = place(f);
  assert.equal(v.status, 'source-failure');
  assert.equal(v.failure.reason, 'section-requirement');
});
test('CLI preserves process diagnostics for budgets, refuses duplicate flags and bounded/nonfile input, and never overwrites input', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lotr-encounters-io-'));
  try {
    const input = join(dir, 'input.json'),
      output = join(dir, 'out.json'),
      cli = resolve('dist/map-encounters.mjs');
    const f = encountersFixture();
    f.execution.maxOperations = 1;
    const bytes = JSON.stringify(f);
    await writeFile(input, bytes);
    const run = (args) =>
      spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', timeout: 30000 });
    const p = run(['--input', input, '--output', output]);
    assert.equal(p.status, 2, p.stderr);
    assert.equal(JSON.parse(await readFile(output)).status, 'administrative-stop');
    assert.equal(run(['--input', input, '--output', input]).status, 1);
    assert.equal(await readFile(input, 'utf8'), bytes);
    assert.equal(
      run(['--input', input, '--input', input, '--output', join(dir, 'never.json')]).status,
      1,
    );
    assert.equal(run(['--input', dir, '--output', join(dir, 'never.json')]).status, 1);
    await truncate(input, 64 * 1024 * 1024 + 1);
    assert.equal(run(['--input', input, '--output', join(dir, 'never.json')]).status, 1);
    await assert.rejects(readFile(join(dir, 'never.json')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
