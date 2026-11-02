import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { assemblyFixture, digest } from './fixtures/map-assembly.mjs';
const cli = resolve('dist/map-assembly.mjs');
async function run(input, check, extra = []) {
  const dir = await mkdtemp(join(tmpdir(), 'lotr-assembly-'));
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
function complete({ process, result }) {
  assert.equal(process.status, 0, process.stderr);
  assert.equal(result.status, 'geometry-complete', JSON.stringify(result.failure));
  assert.equal(result.scope, 'geometry-only');
  assert.equal(result.checkpoint, 'after-graph-before-all-spaces-shuffle');
  return result;
}
test('assembly CLI completes all four multi-tile sections before encounters with advanced source RNG', async () => {
  await run(assemblyFixture(), async (r) => {
    const v = complete(r);
    assert.equal(v.inputFileFingerprint, digest(r.bytes));
    assert.equal(v.sections.length, 4);
    assert.deepEqual(
      v.sections.map((s) => s.tiles.length),
      [2, 2, 2, 2],
    );
    assert.deepEqual(v.builderOrder, [0, 1, 2, 3]);
    assert.deepEqual(v.firstSortOrder, [1, 2, 3, 0]);
    assert.deepEqual(v.sortedBuilderOrder, [1, 3, 2, 0]);
    assert.deepEqual(v.mapOrder, [1, 3, 2, 0]);
    assert.equal(v.spaces.length, 16);
    assert.equal(v.counts.hexes, 56);
    assert.equal(v.graph.requiredJoins.length, 4);
    assert.ok(v.graph.requiredJoins.every((j) => j.connected));
    assert.equal(v.rng.samples, v.selection.rng.samples + 8);
    assert.ok(v.spaces.every((s) => s.encounterId === -1));
    assert.deepEqual(
      v.sections.map((s) => s.availableTiles),
      [[], [], [], []],
    );
    assert.deepEqual(
      v.sections.map((s) => s.spacesFromAvailableTiles),
      [4, 4, 4, 4],
    );
    const bytes = await readFile(r.output, 'utf8');
    const p = spawnSync(
      globalThis.process.execPath,
      [cli, '--input', r.source, '--output', r.output],
      { encoding: 'utf8' },
    );
    assert.equal(p.status, 1);
    assert.equal(await readFile(r.output, 'utf8'), bytes);
  });
});
for (const [name, edit] of [
  ['duplicate prefab', (f) => f.geometry.tiles.push(structuredClone(f.geometry.tiles[0]))],
  ['shape space mismatch', (f) => (f.geometry.tiles[0].spaces[0].traits = 32)],
  ['missing shape', (f) => f.geometry.tiles.pop()],
  ['nonzero cube sum', (f) => (f.geometry.tiles[0].hexes[0].coords = [1, 0, 0])],
  ['missing external edge', (f) => f.geometry.tiles[0].edges.splice(6, 1)],
  ['altered checkpoint', (f) => (f.selection.rng = { samples: 10 })],
  ['nonfinite-like clock', (f) => (f.execution.clock.stepMilliseconds = 'Infinity')],
])
  test(`assembly CLI refuses ${name} without output`, async () => {
    const f = assemblyFixture();
    edit(f);
    await run(f, ({ process, result }) => {
      assert.equal(process.status, 1, process.stderr);
      assert.equal(result, undefined);
      assert.match(process.stderr, /Input/);
    });
  });

test('global tile rollback preserves the compiled active-section reference while rewinding its cursor', async () => {
  const f = assemblyFixture();
  const empty = f.selection.sections[3];
  empty.start = null;
  empty.required = [];
  empty.minimumSpaces = 0;
  empty.maximumSpaces = 0;
  await run(f, ({ process, result: v }) => {
    assert.equal(process.status, 2);
    assert.equal(v.status, 'source-failure');
    assert.equal(v.failure.reason, 'tile-attach-history-exhausted');
    const rollbacks = v.trace.filter((e) => e.operation === 'tile-rollback');
    assert.equal(rollbacks.length, 6);
    assert.deepEqual(
      rollbacks.map((e) => e.failedSectionId),
      [3, 3, 3, 3, 3, 3],
    );
    assert.equal(v.rng.samples, v.selection.rng.samples + 6);
    assert.deepEqual(
      v.sections.map((s) => s.tiles.length),
      [0, 0, 0, 0],
    );
    assert.deepEqual(
      v.sections.map((s) => s.availableTiles.length),
      [2, 2, 2, 0],
    );
    assert.equal(v.search.local.history.length, 0);
    assert.equal(v.checkpoint, null);
  });
});

test('compiled valid-next Comparison sort runs after a global rollback without rewinding RNG', async () => {
  const f = assemblyFixture();
  f.selection.standard[2].hashId = -50;
  f.selection.standard[3].oppositeHashId = -50;
  f.geometry.tiles[2].hashId = -50;
  await run(f, ({ process, result: v }) => {
    assert.equal(process.status, 2);
    assert.equal(v.status, 'source-operation-exception');
    assert.equal(v.failure.reason, 'rollback-tile-index');
    const sort = v.trace.find((e) => e.operation === 'valid-next-sort');
    assert.ok(sort);
    assert.equal(sort.sectionId, 1);
    assert.equal(sort.lastValid, 0);
    assert.deepEqual(sort.before, [f.selection.standard[3].source]);
    assert.deepEqual(sort.after, sort.before);
    assert.equal(v.rng.samples, v.selection.rng.samples + 4);
  });
});

test('intrinsic, section-local and global cube frames survive recenter and composite rotations', async () => {
  const f = assemblyFixture();
  // Different hex counts make a tile-weighted average observably wrong.
  f.geometry.tiles[1].hexes.length = 4;
  f.geometry.tiles[1].edges = f.geometry.tiles[1].edges.filter((e) => e.hex < 4);
  await run(f, (r) => {
    const v = complete(r),
      dirs = (c) => c;
    const rotate = (c, n) => {
      let r = [...c];
      for (let i = 0; i < n; i++) r = [-r[2], -r[0], -r[1]];
      return r;
    };
    for (const s of v.sections) {
      const centers = s.tiles.flatMap((t) => t.hexes.map((h) => h.worldCenter));
      const mean = [0, 1, 2].map((j) => centers.reduce((n, c) => n + c[j], 0) / centers.length);
      mean.forEach((n, j) => assert.ok(Math.abs(n - s.displayPosition[j]) < 0.00002));
      for (const t of s.tiles)
        for (const h of t.hexes) {
          assert.equal(
            h.sectionCoords.reduce((n, c) => n + c, 0),
            0,
          );
          assert.deepEqual(
            h.globalCoords,
            rotate(h.sectionCoords, s.localRotations).map((c, i) => c + s.cubeOrigin[i]),
          );
          assert.deepEqual(
            h.tileCoords,
            f.geometry.tiles.find((x) => x.source === t.source).hexes[h.index].coords,
          );
        }
    }
    assert.equal(v.trace.find((e) => e.operation === 'recenter' && e.sectionId === 0).hexCount, 11);
    assert.ok(v.sections.some((s) => s.localRotations !== 0));
  });
});

const directions = [
  [1, -1, 0],
  [0, -1, 1],
  [-1, 0, 1],
  [-1, 1, 0],
  [0, 1, -1],
  [1, 0, -1],
];
const ckey = (c) => c.join(',');
const neighbor = (c, d) => c.map((x, i) => x + directions[d][i]);

for (const missing of [false, true])
  test(`graph reset derives internal movement from actual edges (${missing ? 'missing' : 'blocked'} interiors)`, async () => {
    const f = assemblyFixture();
    for (const t of f.geometry.tiles) {
      const byCube = new Map(t.hexes.map((h) => [ckey(h.coords), h]));
      t.edges = t.edges.filter((e) => {
        const h = t.hexes[e.hex],
          n = byCube.get(ckey(neighbor(h.coords, e.direction)));
        if (n && n.space !== h.space) {
          if (missing) return false;
          e.traits = 700;
        }
        return true;
      });
    }
    await run(f, (r) => {
      const v = complete(r);
      for (const t of f.geometry.tiles) {
        const [a, b] = v.spaces.filter((s) => s.tileSource === t.source);
        assert.ok(!a.connected.includes(b.id));
        assert.ok(!b.connected.includes(a.id));
      }
      assert.ok(v.graph.sourceSectionCheck.every((s) => s.connected));
      const ids = new Set(v.spaces.map((s) => s.id));
      assert.equal(v.graph.components.flat().length, ids.size);
      assert.equal(new Set(v.graph.components.flat()).size, ids.size);
    });
  });

test('all contact checks reject incompatible incidental edges and occupied hexes, preserving multiplicity and clump ties', async () => {
  const f = assemblyFixture();
  // One blocked external edge excludes poses that otherwise have legal anchors.
  f.geometry.tiles[1].edges.find((e) => e.hex === 1 && e.direction === 0).traits = 100;
  f.geometry.sections[0].tileClumpFactor = 0.5;
  await run(f, (r) => {
    const v = complete(r),
      scan = v.trace.find((e) => e.operation === 'tile-candidates' && e.sectionId === 0);
    assert.ok(scan.rejected.contact > 0);
    assert.ok(scan.rejected.overlap > 0);
    assert.equal(
      scan.index,
      Math.trunc(Math.fround(Math.fround(scan.count - 1) * Math.fround(1 - 0.5))),
    );
    assert.ok(
      scan.candidates.every((c, i, a) => i === 0 || a[i - 1].openEdgeCount <= c.openEdgeCount),
    );
    const equivalent = new Set(
      scan.candidates.map(
        (c) => `${c.target.hex}:${c.target.direction}:${c.anchor.hex}:${c.anchor.direction}`,
      ),
    );
    assert.equal(equivalent.size, scan.count);
    const occupied = v.sections.flatMap((s) =>
      s.tiles.flatMap((t) => t.hexes.map((h) => ckey(h.globalCoords))),
    );
    assert.equal(new Set(occupied).size, occupied.length);
    assert.ok(v.contacts.every((c) => c.compatible && c.allowed));
    const choice = v.trace.find((e) => e.operation === 'tile-attach' && e.sectionId === 0);
    assert.deepEqual(choice.chosen, scan.candidates[scan.index]);
  });
});

test('section boundary count includes existing inter-section contact sides before narrowing to the later tied required neighbor', async () => {
  await run(assemblyFixture(), (r) => {
    const v = complete(r),
      events = v.trace.filter((e) => e.operation === 'section-candidates');
    assert.equal(events.length, 3);
    for (const e of events) {
      assert.equal(e.fullCombinedCount, e.fullMapBoundaryCount + e.incomingBoundaryCount);
      assert.ok(e.candidates.every((c) => c.openEdgeCount <= e.fullCombinedCount));
    }
    const final = events[2];
    assert.equal(final.mapOrder.length, 3);
    const tileBy = new Map(v.sections.flatMap((s) => s.tiles).map((t) => [t.source, t]));
    const mapOccupied = new Map(
      v.sections
        .filter((s) => final.mapOrder.includes(s.id))
        .flatMap((s) => s.tiles.flatMap((t) => t.hexes.map((h) => [ckey(h.globalCoords), s.id]))),
    );
    const unionBoundary = [...mapOccupied].reduce(
      (count, [key]) =>
        count +
        directions.filter((_, d) => !mapOccupied.has(ckey(neighbor(key.split(',').map(Number), d))))
          .length,
      0,
    );
    assert.ok(final.fullMapBoundaryCount > unionBoundary);
    // Equal required boundaries for section2 are visited [3,1]; the later one wins.
    const e = events.find((e) => e.sectionId === 2);
    assert.deepEqual(e.requiredAttached, [3, 1]);
    assert.equal(e.targetSectionId, 1);
    for (const a of v.trace.filter((e) => e.operation === 'section-attach')) {
      assert.equal(a.remainingCandidates, a.count - 1);
      const attached = a.mapOrder
        .slice(0, -1)
        .map((id) => v.input.geometry.sections[id].sectionClumpFactor);
      let sum = 0;
      for (const id of [...a.mapOrder.slice(0, -1)].sort())
        sum = Math.fround(sum + v.input.geometry.sections[id].sectionClumpFactor);
      const average = Math.fround(sum / attached.length);
      assert.equal(a.average, average);
      assert.equal(
        a.factor,
        Math.fround(
          Math.fround(average + v.input.geometry.sections[a.sectionId].sectionClumpFactor) * 0.5,
        ),
      );
    }
  });
});

test('source GetConnectionRequirementCount counts serialized duplicate pairs independently of unique neighbors', async () => {
  const f = assemblyFixture();
  f.selection.requiredConnections.push([0, 1], [0, 1], [0, 1]);
  await run(f, (r) => {
    const v = complete(r);
    assert.deepEqual(v.firstSortOrder, [1, 0, 2, 3]);
    assert.equal(v.sortedBuilderOrder[0], 1);
    assert.deepEqual(v.selection.sections[0].requiredConnectedSectionIds, [1]);
  });
});

test('empty tile candidate indexing is a source operation exception and never a valid partial map', async () => {
  const f = assemblyFixture();
  f.geometry.tiles[1].edges.forEach((e) => {
    e.traits = 700;
  });
  await run(f, ({ process, result: v }) => {
    assert.equal(process.status, 2);
    assert.equal(v.status, 'source-operation-exception');
    assert.equal(v.failure.reason, 'empty-tile-placement-index');
    assert.equal(v.failure.sourceErrorCode, null);
    assert.equal(v.checkpoint, null);
    assert.equal(v.graph, null);
    assert.equal(v.counts.tiles, 1);
    assert.equal(v.search.local.tileToAttach, f.geometry.tiles[1].source);
    assert.equal(v.trace.find((e) => e.operation === 'tile-candidates').count, 0);
    assert.equal(v.rng.samples, v.selection.rng.samples + 2);
  });
});

test('forbidden required section removes the root and emits InvalidParameters without a fallback', async () => {
  const f = assemblyFixture();
  f.geometry.invalidConnections = [[1, 3]];
  await run(f, ({ process, result: v }) => {
    assert.equal(process.status, 2);
    assert.equal(v.status, 'source-failure');
    assert.equal(v.failure.reason, 'section-root-exhausted');
    assert.equal(v.failure.sourceErrorCode, 2);
    assert.deepEqual(v.mapOrder, []);
    assert.equal(v.checkpoint, null);
    const e = v.trace.find((e) => e.operation === 'section-candidates');
    assert.ok(e.rejected.forbidden > 0);
    assert.equal(e.count, 0);
    assert.ok(v.trace.some((e) => e.operation === 'section-remove' && e.sectionId === 1));
  });
});

test('section rollback reuses residual candidates, clears passed lists and retains advanced RNG', async () => {
  const f = assemblyFixture();
  f.geometry.invalidConnections = [[2, 3]];
  f.execution.maxOperations = 150000;
  f.execution.maxTraceEvents = 200000;
  await run(f, ({ process, result: v }) => {
    assert.equal(process.status, 2);
    assert.notEqual(v.status, 'geometry-complete');
    assert.equal(v.checkpoint, null);
    const removed = v.trace.filter((e) => e.operation === 'section-remove');
    assert.ok(removed.length > 0);
    assert.ok(removed.some((e) => e.remainingCandidates > 0));
    const attaches = v.trace.filter((e) => e.operation === 'section-attach' && e.sectionId === 3);
    assert.ok(attaches.length > 1);
    assert.equal(attaches[1].count, attaches[0].count - 1);
    assert.notDeepEqual(attaches[1].chosen, attaches[0].chosen);
    assert.equal(attaches[1].samples, attaches[0].samples);
  });
});

for (const [name, edit, reason] of [
  [
    'operations',
    (f) => {
      f.execution.maxOperations = 1;
    },
    'operation-budget',
  ],
  [
    'clock',
    (f) => {
      f.execution.clock.stepMilliseconds = 100;
      f.execution.clock.timeoutMilliseconds = 50;
    },
    'clock-budget',
  ],
  [
    'trace',
    (f) => {
      f.execution.maxTraceEvents = 1;
    },
    'clock-trace-budget',
  ],
])
  test(`administrative ${name} stop is distinct from source failure and publishes diagnostics only`, async () => {
    const f = assemblyFixture();
    edit(f);
    await run(f, ({ process, result: v }) => {
      assert.equal(process.status, 2);
      assert.equal(v.status, 'administrative-stop');
      assert.equal(v.failure.reason, reason);
      assert.equal(v.failure.sourceErrorCode, null);
      assert.equal(v.checkpoint, null);
      assert.equal(v.scope, 'geometry-only');
    });
  });

test('clock recording replays all observations, rejects altered cursors/context/decisions and unused tails', async () => {
  const f = assemblyFixture();
  await run(f, async (r) => {
    const v = complete(r),
      p = structuredClone(f);
    p.execution.clock = {
      policy: 'replay-clock-v1',
      timeoutMilliseconds: 30000,
      observations: v.clock.observations,
    };
    await run(p, (rr) => {
      const replay = complete(rr);
      assert.deepEqual(replay.sections, v.sections);
      assert.deepEqual(replay.graph, v.graph);
      assert.deepEqual(replay.rng, v.rng);
      assert.deepEqual(replay.clock.observations, v.clock.observations);
    });
    for (const change of [
      (p) => {
        p.execution.clock.observations[1].ordinal = 2;
      },
      (p) => {
        p.execution.clock.observations[1].samples++;
      },
      (p) => {
        p.execution.clock.observations[1].site = 'wrong-site';
      },
      (p) => {
        p.execution.clock.observations[1].timeout = true;
      },
      (p) => {
        p.execution.clock.observations.pop();
      },
      (p) => {
        p.execution.clock.observations.push(structuredClone(p.execution.clock.observations.at(-1)));
      },
    ]) {
      const bad = structuredClone(p);
      change(bad);
      await run(bad, ({ process, result }) => {
        assert.equal(process.status, 1);
        assert.equal(result, undefined);
        assert.match(process.stderr, /replay clock/);
      });
    }
  });
});

test('unspecified first choices, first rotations and all subsequent draws consume the continued RNG in source order', async () => {
  const f = assemblyFixture();
  for (const s of f.selection.sections.slice(1)) {
    s.required.unshift(s.start);
    s.start = null;
  }
  await run(f, async (r) => {
    const v = complete(r),
      { SourceRandom } = await import('../dist/map-primitives.mjs'),
      rng = SourceRandom.restore(v.selection.rng);
    const draws = v.trace.filter((e) =>
      ['first-tile-draw', 'first-tile', 'next-tile-draw'].includes(e.operation),
    );
    assert.equal(draws.length, 11);
    for (const e of draws) {
      const expected = rng.nextInt(e.min, e.max);
      assert.equal(e.operation === 'first-tile' ? e.rotation : e.index, expected);
      assert.equal(e.samples, rng.snapshot().samples);
    }
    assert.deepEqual(v.rng, rng.snapshot());
    assert.equal(draws.filter((e) => e.operation === 'first-tile-draw').length, 3);
  });
});

test('strict tangent-sphere rejection is retained even when every integer contact would match', async () => {
  const f = assemblyFixture();
  // Deliberately degenerate physical negative fixture. Positive fixtures have area.
  for (const t of f.geometry.tiles)
    for (const h of t.hexes) {
      h.transform[0].position = [0, 0, 0];
      h.bounds.extents = [0, 0, 0];
    }
  await run(f, ({ process, result: v }) => {
    assert.equal(process.status, 2);
    assert.equal(v.failure.reason, 'section-root-exhausted');
    const e = v.trace.find((e) => e.operation === 'section-candidates');
    assert.equal(e.count, 0);
    assert.ok(e.rejected.sphere > 0);
    assert.equal(e.rejected.anchor, 0);
    assert.equal(v.sections[1].boundingSphere.radius, 0);
    assert.equal(v.sections[3].boundingSphere.radius, 0);
  });
});

test('recorded five-second jumps clear passed placement lists and resume the retained farther target', async () => {
  const f = assemblyFixture();
  f.geometry.invalidConnections = [[0, 1]];
  f.execution.clock.stepMilliseconds = 2;
  f.execution.clock.timeoutMilliseconds = 1000000;
  f.execution.maxOperations = 100000;
  f.execution.maxTraceEvents = 200000;
  await run(f, ({ process, result: v }) => {
    assert.equal(process.status, 2);
    assert.equal(v.checkpoint, null);
    const decision = v.trace.find((e) => e.operation === 'five-second-decision' && e.jump);
    assert.ok(decision);
    assert.equal(decision.sectionId, 0);
    assert.equal(decision.mapOrder[1], 3);
    const at = v.trace.indexOf(decision),
      tail = v.trace.slice(at + 1);
    assert.deepEqual(
      tail
        .filter((e) => e.operation === 'section-remove')
        .slice(0, 2)
        .map((e) => [e.sectionId, e.target]),
      [
        [2, 3],
        [3, 3],
      ],
    );
    assert.ok(tail.some((e) => e.operation === 'clear-section-candidates' && e.sectionId === 2));
    const resets = v.trace.filter((e) => e.operation === 'section-rollback-resume');
    assert.ok(resets.length > 0);
    assert.equal(resets[0].nextSortedIndex, 1);
    assert.equal(resets[0].localMin, 1);
    const samples = v.trace.filter((e) => e.stage === 'inter-section').map((e) => e.samples);
    assert.equal(new Set(samples).size, 1);
  });
});

test('versioned library freezes result and clock decisions without mutating the caller input', async () => {
  const { assembleMap } = await import('../dist/map-assembly-library.mjs'),
    input = assemblyFixture(),
    before = structuredClone(input);
  const r = assembleMap(input);
  assert.equal(r.status, 'geometry-complete');
  assert.deepEqual(input, before);
  assert.ok(Object.isFrozen(r));
  assert.ok(Object.isFrozen(r.clock.observations));
  assert.ok(Object.isFrozen(r.clock.observations[0]));
  assert.ok(Object.isFrozen(r.sections[0].tiles[0].hexes[0].tileCoords));
  input.geometry.tiles[0].hexes[0].coords[0] = 10;
  assert.equal(r.input.geometry.tiles[0].hexes[0].coords[0], 0);
  assert.throws(() => {
    r.clock.observations[0].timeout = true;
  }, TypeError);
});

test('selection failure cannot ignore replay decisions or produce a geometric checkpoint', async () => {
  const f = assemblyFixture();
  f.selection.budget.maxOperations = 1;
  f.execution.clock = {
    policy: 'replay-clock-v1',
    timeoutMilliseconds: 30000,
    observations: [
      {
        ordinal: 0,
        stage: 'selection-boundary',
        site: 'assembly-start',
        operation: 0,
        samples: 124,
        depth: 0,
        elapsedMilliseconds: 0,
        timeout: false,
      },
    ],
  };
  await run(f, ({ process, result }) => {
    assert.equal(process.status, 1);
    assert.equal(result, undefined);
    assert.match(process.stderr, /replay clock/);
  });
});

for (const [name, edit] of [
  [
    'unmatched rendering polygon/UV arrays',
    (f) => {
      f.geometry.tiles[0].hexes[0].render.uv = [[0, 0]];
    },
  ],
  [
    'unsupported root scale',
    (f) => {
      f.geometry.tiles[0].authoring[0].scale = [2, 1, 1];
    },
  ],
  [
    'unresolved frame source',
    (f) => {
      f.geometry.tiles[0].hexes[0].transform[0].source = 'other.assets:1';
    },
  ],
  [
    'noncontiguous space',
    (f) => {
      f.geometry.tiles[0].hexes[0].space = 1;
      f.geometry.tiles[0].hexes[4].space = 0;
    },
  ],
  [
    'geometry provenance mismatch',
    (f) => {
      f.geometry.provenance.files[0].sha256 = 'b'.repeat(64);
    },
  ],
  [
    'serialized edge alias',
    (f) => {
      f.geometry.tiles[0].edges[1].source = f.geometry.tiles[0].edges[0].source;
    },
  ],
  [
    'infinite operation policy',
    (f) => {
      f.execution.maxOperations = 'Infinity';
    },
  ],
])
  test(`geometric validation rejects ${name}`, async () => {
    const f = assemblyFixture();
    edit(f);
    await run(f, ({ process, result }) => {
      assert.equal(process.status, 1);
      assert.equal(result, undefined);
      assert.match(process.stderr, /Input/);
    });
  });
