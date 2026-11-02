import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { assembleMap } from '../dist/map-assembly-library.mjs';
import { movementFixture } from './fixtures/map-movement.mjs';
import { digest } from './fixtures/map-assembly.mjs';

async function runCLI(input, check) {
  const dir = await mkdtemp(join(tmpdir(), 'lotr-movement-'));
  try {
    const source = join(dir, 'input.json'),
      output = join(dir, 'output.json'),
      bytes = JSON.stringify(input) + '\n';
    await writeFile(source, bytes);
    const process = spawnSync(
      globalThis.process.execPath,
      [resolve('dist/map-assembly.mjs'), '--input', source, '--output', output],
      { encoding: 'utf8', timeout: 30000 },
    );
    let result;
    try {
      result = JSON.parse(await readFile(output, 'utf8'));
    } catch {}
    await check({ process, result });
    assert.equal(await readFile(source, 'utf8'), bytes);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

for (const [name, edit] of [
  ['asymmetric authoring', (t) => (t.spaces[1].serializedConnectedSpaces = [])],
  ['out-of-range reference', (t) => (t.spaces[0].serializedConnectedSpaces = [2])],
  ['negative index', (t) => (t.spaces[0].serializedConnectedSpaces = [-1])],
  ['fractional index', (t) => (t.spaces[0].serializedConnectedSpaces = [0.5])],
  ['self-link', (t) => (t.spaces[0].serializedConnectedSpaces = [0])],
  ['duplicate authoring', (t) => (t.spaces[0].serializedConnectedSpaces = [1, 1])],
  ['unknown source file', (t) => (t.spaces[0].source = 'absent.assets:1')],
  ['wrong space reference', (t) => (t.spaces[0].source = t.spaces[1].source)],
]) {
  test(`movement input rejects ${name} through library and CLI without repairing input`, async () => {
    const input = movementFixture();
    edit(input.geometry.tiles[0]);
    const before = structuredClone(input);
    assert.throws(() => assembleMap(input));
    assert.deepEqual(input, before);
    await runCLI(input, ({ process, result }) => {
      assert.equal(process.status, 1, process.stderr);
      assert.equal(result, undefined);
      assert.match(process.stderr, /Input/);
    });
  });
}

const id = (tile, index) => `${tile.source}/space/${index}`;
function neighbors(result, spaceId) {
  return result.movementGraph.spaces.find((s) => s.id === spaceId).connected;
}
function sourceOnly(result) {
  const { movementGraph, ...source } = result;
  return source;
}

test('library derives reciprocal authoring movement without interior Edges and preserves every source field', () => {
  const input = movementFixture(),
    before = structuredClone(input),
    result = assembleMap(input),
    movement = result.movementGraph;
  assert.equal(result.status, 'geometry-complete');
  assert.ok(movement, 'complete geometry must expose the separate movement graph');
  assert.equal(movement.formatVersion, 1);
  assert.equal(movement.algorithm, 'authoring-and-traversable-contacts-v1');
  assert.equal(movement.provenance.sourceVersion, 'invented-v1');
  assert.equal(movement.provenance.geometryFingerprint, result.geometryFingerprint);
  assert.equal(movement.runtimeReady, false);
  assert.equal(movement.spaces.length, 16);
  assert.equal(movement.wholeMapReachable, true);
  assert.equal(movement.components.length, 1);
  for (const tile of input.geometry.tiles) {
    const a = id(tile, 0),
      b = id(tile, 1);
    assert.ok(neighbors(result, a).includes(b));
    assert.ok(neighbors(result, b).includes(a));
    assert.ok(!result.spaces.find((s) => s.id === a).connected.includes(b));
    assert.deepEqual(movement.edges.find((e) => e.a === a && e.b === b).provenance, [
      {
        kind: 'intra-tile-authoring',
        tileSource: tile.source,
        spaceIndices: [0, 1],
        spaceSources: tile.spaces.map((s) => s.source),
      },
    ]);
  }
  assert.deepEqual(input, before);
  // Recorded from the base commit, before the movement implementation.
  assert.equal(
    digest(JSON.stringify(sourceOnly(result))),
    '30e9034d08ec15cd8e1321689843fff0e363270aba31651c6bc392f9788f21e2',
  );
});

test('CLI publishes the same movement graph as the library without changing source graphs', async () => {
  const input = movementFixture();
  const library = assembleMap(input);
  await runCLI(input, ({ process, result }) => {
    assert.equal(process.status, 0, process.stderr);
    assert.ok(result.movementGraph);
    const { inputFileFingerprint, ...body } = result;
    assert.deepEqual(body, JSON.parse(JSON.stringify(library)));
    assert.equal(inputFileFingerprint.length, 64);
  });
});

test('neighboring spaces with explicit source Edges gain no intratile movement without authoring', () => {
  const input = movementFixture({ authoring: false, interiorEdges: true }),
    result = assembleMap(input);
  assert.equal(result.status, 'geometry-complete');
  assert.ok(result.movementGraph);
  for (const tile of input.geometry.tiles) {
    const a = id(tile, 0),
      b = id(tile, 1);
    assert.ok(result.spaces.find((s) => s.id === a).connected.includes(b));
    assert.ok(!neighbors(result, a).includes(b));
    assert.ok(!neighbors(result, b).includes(a));
  }
  assert.ok(
    result.movementGraph.edges.every((e) =>
      e.provenance.every((p) => p.kind === 'inter-tile-contact'),
    ),
  );
});

test('multiple intertile contacts deduplicate reciprocal movement but retain all contact references', () => {
  const result = assembleMap(movementFixture()),
    movement = result.movementGraph;
  assert.ok(movement);
  const edges = movement.edges;
  assert.ok(
    edges.some((e) => e.provenance.filter((p) => p.kind === 'inter-tile-contact').length > 1),
  );
  assert.equal(new Set(edges.map((e) => `${e.a}|${e.b}`)).size, edges.length);
  const keys = edges.map((e) => `${e.a}|${e.b}`);
  assert.deepEqual(keys, [...keys].sort());
  assert.equal(movement.connectionCount, edges.length);
  for (const e of edges) {
    assert.ok(e.a < e.b);
    assert.ok(neighbors(result, e.a).includes(e.b));
    assert.ok(neighbors(result, e.b).includes(e.a));
    for (const proof of e.provenance.filter((p) => p.kind === 'inter-tile-contact')) {
      const contact = result.contacts[proof.contactIndex];
      assert.ok(contact.traversable && contact.allowed);
      assert.deepEqual([contact.a.spaceId, contact.b.spaceId].sort(), [e.a, e.b]);
    }
  }
  for (const s of movement.spaces) {
    assert.equal(new Set(s.connected).size, s.connected.length);
    assert.deepEqual(s.connected, [...s.connected].sort());
    const original = result.spaces.find((v) => v.id === s.id);
    assert.equal(s.source, original.source);
    assert.equal(s.tileSource, original.tileSource);
    assert.equal(s.sectionId, original.sectionId);
    assert.equal(s.index, original.index);
  }
});

test('disconnected movement preserves isolated spaces without changing source success or runtime readiness', () => {
  const input = movementFixture({ authoring: false });
  for (const tile of input.geometry.tiles)
    for (const edge of tile.edges) if (tile.hexes[edge.hex].space === 1) edge.traits = 700;
  const result = assembleMap(input),
    movement = result.movementGraph;
  assert.equal(result.status, 'geometry-complete');
  assert.equal(result.failure, null);
  assert.ok(movement);
  assert.equal(result.checkpoint, 'after-graph-before-all-spaces-shuffle');
  assert.equal(movement.runtimeReady, false);
  assert.equal(movement.wholeMapReachable, false);
  assert.deepEqual(
    movement.components.map((c) => c.length),
    [8, 1, 1, 1, 1, 1, 1, 1, 1],
  );
  for (const tile of input.geometry.tiles) {
    assert.deepEqual(neighbors(result, id(tile, 1)), []);
    assert.ok(movement.components.some((c) => c.length === 1 && c[0] === id(tile, 1)));
  }
});

test('movement output is deeply frozen with new neighbor arrays and no caller mutation', () => {
  const input = movementFixture(),
    before = structuredClone(input);
  const freeze = (v) => {
    if (v && typeof v === 'object') {
      Object.freeze(v);
      Object.values(v).forEach(freeze);
    }
  };
  freeze(input);
  const result = assembleMap(input),
    movement = result.movementGraph;
  assert.ok(movement);
  const visit = (v) => {
    if (v && typeof v === 'object') {
      assert.ok(Object.isFrozen(v));
      Object.values(v).forEach(visit);
    }
  };
  visit(movement);
  assert.notEqual(movement.spaces[0].connected, result.spaces[0].connected);
  assert.throws(() => movement.spaces[0].connected.push('invented.assets:999/space/0'), TypeError);
  assert.throws(() => (movement.edges[0].provenance[0].kind = 'changed'), TypeError);
  assert.deepEqual(input, before);
});

for (const [name, edit, status] of [
  ['selection stop', (i) => (i.selection.budget.maxOperations = 1), 'administrative-stop'],
  ['search stop', (i) => (i.execution.maxOperations = 1), 'administrative-stop'],
  ['source failure', (i) => (i.geometry.invalidConnections = [[1, 3]]), 'source-failure'],
  [
    'source operation exception',
    (i) => i.geometry.tiles[1].edges.forEach((e) => (e.traits = 700)),
    'source-operation-exception',
  ],
]) {
  test(`${name} exposes no valid movement graph in library or CLI`, async () => {
    const input = movementFixture();
    edit(input);
    const result = assembleMap(input);
    assert.equal(result.status, status);
    assert.equal(result.checkpoint, null);
    assert.equal(result.movementGraph, null);
    await runCLI(input, ({ process, result: output }) => {
      assert.equal(process.status, 2, process.stderr);
      assert.equal(output.status, status);
      assert.equal(output.movementGraph, null);
    });
  });
}

test('clock stop after source graph completion still withholds movement in library and CLI', async () => {
  const input = movementFixture(),
    complete = assembleMap(input),
    observations = structuredClone(complete.clock.observations);
  assert.equal(observations.at(-1).site, 'geometry-boundary');
  observations.at(-1).elapsedMilliseconds = 30001;
  observations.at(-1).timeout = true;
  input.execution.clock = { policy: 'replay-clock-v1', timeoutMilliseconds: 30000, observations };
  const stopped = assembleMap(input);
  assert.equal(stopped.status, 'administrative-stop');
  assert.equal(stopped.failure.reason, 'clock-budget');
  assert.deepEqual(stopped.graph, complete.graph);
  assert.equal(stopped.checkpoint, null);
  assert.equal(stopped.movementGraph, null);
  await runCLI(input, ({ process, result }) => {
    assert.equal(process.status, 2, process.stderr);
    assert.equal(result.movementGraph, null);
  });
});

test('compatible blocked contacts never provide movement provenance', () => {
  const input = movementFixture();
  for (const tile of input.geometry.tiles)
    for (const edge of tile.edges) if (tile.hexes[edge.hex].space === 1) edge.traits = 700;
  const result = assembleMap(input);
  assert.equal(result.status, 'geometry-complete');
  const excluded = result.contacts.flatMap((c, index) => (!c.traversable ? [index] : []));
  assert.equal(excluded.length, 31);
  const used = new Set(
    result.movementGraph.edges.flatMap((e) =>
      e.provenance.flatMap((p) => (p.kind === 'inter-tile-contact' ? [p.contactIndex] : [])),
    ),
  );
  for (const index of excluded) {
    assert.equal(result.contacts[index].compatible, true);
    assert.ok(!used.has(index));
  }
  assert.equal(used.size, 11);
});

for (const kind of ['open passage', 'complementary river']) {
  test(`movement accepts actual ${kind} contacts through library and CLI`, async () => {
    const input = movementFixture();
    if (kind === 'open passage')
      input.geometry.tiles[0].edges.forEach((e) =>
        Object.assign(e, { traits: 600, isPassageOpen: true }),
      );
    else
      input.geometry.tiles.forEach((t, i) =>
        t.edges.forEach((e) => (e.traits = i % 2 ? 400 : 300)),
      );
    const result = assembleMap(input);
    assert.equal(result.status, 'geometry-complete');
    const special = result.contacts.flatMap((c, index) =>
      c.edges.some((e) => e.traits === (kind === 'open passage' ? 600 : 300)) ? [index] : [],
    );
    assert.equal(special.length, kind === 'open passage' ? 6 : 30);
    for (const index of special) {
      const c = result.contacts[index];
      assert.equal(c.traversable, true);
      assert.ok(neighbors(result, c.a.spaceId).includes(c.b.spaceId));
      assert.ok(
        result.movementGraph.edges.some((e) => e.provenance.some((p) => p.contactIndex === index)),
      );
    }
    await runCLI(input, ({ process, result: output }) => {
      assert.equal(process.status, 0, process.stderr);
      assert.deepEqual(output.movementGraph, result.movementGraph);
    });
  });
}

for (const [name, traits] of [
  ['black boundary', 700],
  ['bank 100', 100],
  ['bank 200', 200],
  ['unpaired river', 300],
  ['closed passage to ordinary boundary', 600],
]) {
  test(`${name} cannot become a movement join by cube proximity`, async () => {
    const input = movementFixture();
    input.geometry.tiles[0].edges.forEach((e) =>
      Object.assign(e, { traits, isPassageOpen: false }),
    );
    const result = assembleMap(input);
    assert.equal(result.status, 'source-operation-exception');
    assert.equal(result.failure.reason, 'empty-tile-placement-index');
    assert.equal(result.movementGraph, null);
    await runCLI(input, ({ process, result: output }) => {
      assert.equal(process.status, 2, process.stderr);
      assert.equal(output.movementGraph, null);
    });
  });
}

test('unselected catalog tiles contribute neither movement spaces nor authoring proofs', () => {
  const input = movementFixture(),
    unused = input.selection.standard[8],
    shape = structuredClone(input.geometry.tiles[0]);
  shape.source = unused.source;
  shape.modelSource = unused.modelSource;
  shape.hashId = unused.hashId;
  shape.spaces.forEach((s, i) => (s.source = unused.spaces[i].source));
  input.geometry.tiles.push(shape);
  input.selection.products[0].tileCodes.push(unused.code);
  const result = assembleMap(input);
  assert.equal(result.status, 'geometry-complete');
  assert.equal(result.movementGraph.spaces.length, 16);
  assert.ok(!result.movementGraph.spaces.some((s) => s.tileSource === unused.source));
  assert.ok(
    result.movementGraph.edges.every((e) =>
      e.provenance.every((p) => p.tileSource !== unused.source),
    ),
  );
});

test('movement derivation consumes no replay observations or source RNG and is deterministic', () => {
  const input = movementFixture(),
    first = assembleMap(input);
  input.execution.clock = {
    policy: 'replay-clock-v1',
    timeoutMilliseconds: 30000,
    observations: structuredClone(first.clock.observations),
  };
  const replay = assembleMap(input);
  assert.equal(replay.status, 'geometry-complete');
  assert.deepEqual(replay.clock.observations, first.clock.observations);
  assert.equal(replay.clock.cursor, 40442);
  assert.deepEqual(replay.rng, first.rng);
  assert.equal(replay.rng.samples, 132);
  assert.deepEqual(replay.movementGraph, first.movementGraph);
  for (const key of ['sections', 'tileStates', 'spaces', 'contacts', 'graph', 'search', 'trace'])
    assert.deepEqual(replay[key], first[key], key);
  assert.deepEqual(assembleMap(input), replay);
});
