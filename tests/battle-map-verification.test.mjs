import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compileBattleMapSource,
  verifyBattleMapArtifact,
  battleMapCapability,
} from '../dist/battle-map-library.mjs';
import { battleSource, hash, f32 } from './fixtures/battle-map.mjs';
const resign = (a) => {
  const { artifactFingerprint, ...body } = a;
  a.artifactFingerprint = hash(body);
  return a;
};

test('artifact roundtrip verifies whole output with expected pins and independent copies', () => {
  const s = battleSource(),
    a = compileBattleMapSource(s),
    json = JSON.parse(JSON.stringify(a));
  const expected = {
    sourceFingerprint: a.sourceFingerprint,
    artifactFingerprint: a.artifactFingerprint,
  };
  const restored = verifyBattleMapArtifact(json, expected);
  assert.equal(hash(restored), hash(a));
  assert.equal(
    Object.is(
      restored.compiled.layouts[0].placements.find((p) => p.id === 'guide').position[2],
      -0,
    ),
    true,
  );
  const other = compileBattleMapSource(s);
  a.source.transforms[0].position[0].value = 42;
  a.compiled.layouts[0].placements[0].position[0] = 42;
  assert.equal(hash(verifyBattleMapArtifact(other)), hash(json));
  assert.equal(s.transforms[0].position[0].value, 0);
  assert.notEqual(
    a.compiled.layouts[0].placements[0].position[0],
    a.compiled.layouts[1].placements[0].position[0],
  );
});

test('compiler rejects complete artifacts above the shared input budget', () => {
  const source = battleSource();
  const meshes = source.meshes.slice(0, 12);
  for (const mesh of meshes)
    while (mesh.vertices.length < 499)
      mesh.vertices.push({
        ...structuredClone(mesh.vertices[0]),
        index: mesh.vertices.length,
      });

  const artifact = compileBattleMapSource(source);
  verifyBattleMapArtifact(JSON.parse(JSON.stringify(artifact)), {
    sourceFingerprint: artifact.sourceFingerprint,
    artifactFingerprint: artifact.artifactFingerprint,
  });

  // Unused vertices leave the geometry intact but grow the embedded evidence.
  for (const mesh of meshes)
    mesh.vertices.push({ ...structuredClone(mesh.vertices[0]), index: mesh.vertices.length });
  assert.throws(() => compileBattleMapSource(source), /Limite nodi\/profondità/);
});

test('rehashing any derived section cannot defeat full recompilation', () => {
  const original = compileBattleMapSource(battleSource());
  for (const mutate of [
    (a) => {
      a.compiled.layouts[0].patches[0].bounds[0][0] += 0.1;
    },
    (a) => {
      a.compiled.layouts[0].patches[0].uv[0][0] += 0.1;
    },
    (a) => {
      a.compiled.layouts[0].boards[0].texture = 'other-ink';
    },
    (a) => {
      a.compiled.layouts[0].cells[0].patches.pop();
    },
    (a) => {
      a.compiled.layouts[0].contacts[0].span[0] += 0.1;
    },
    (a) => {
      a.compiled.layouts[0].geometricEdges.pop();
    },
    (a) => {
      a.compiled.layouts[0].walkableEdges.pop();
    },
    (a) => {
      a.compiled.layouts[0].walls[0].cells.reverse();
    },
    (a) => {
      a.compiled.layouts[0].placements[0].position[0] += 0.1;
    },
    (a) => {
      a.compiled.layouts[0].placements[0].positionBits[0] = f32(8).float32le;
    },
    (a) => {
      a.compiled.layouts[0].spawnOrder.reverse();
    },
    (a) => {
      a.runtimeReady = true;
    },
    (a) => {
      a.gates.boonQuantities = [5, 5, 5];
    },
    (a) => {
      a.gates.requirements.pop();
    },
    (a) => {
      a.algorithm = 'other-v1';
    },
  ]) {
    const a = structuredClone(original);
    mutate(a);
    assert.throws(() => verifyBattleMapArtifact(resign(a)));
  }
});

test('a coherent new invented source is valid unpinned and rejected by original trusted pins', () => {
  const s = battleSource(),
    original = compileBattleMapSource(s);
  s.transforms.find((t) => t.record === 'guide-t').position[0] = f32(0.75);
  const forged = compileBattleMapSource(s);
  assert.deepEqual(verifyBattleMapArtifact(forged), forged);
  assert.throws(() =>
    verifyBattleMapArtifact(forged, { sourceFingerprint: original.sourceFingerprint }),
  );
  assert.throws(() =>
    verifyBattleMapArtifact(forged, { artifactFingerprint: original.artifactFingerprint }),
  );
  assert.throws(() => verifyBattleMapArtifact(original, { sourceFingerprint: 'bad' }));
  assert.throws(() => verifyBattleMapArtifact(original, { unknown: true }));
  assert.throws(() => verifyBattleMapArtifact(original, null));
  const editorialChange = structuredClone(original);
  editorialChange.source.policy.assumptions[0] += ' changed';
  editorialChange.source.policyFingerprint = hash(editorialChange.source.policy);
  editorialChange.sourceFingerprint = hash(editorialChange.source);
  resign(editorialChange);
  assert.equal(
    verifyBattleMapArtifact(editorialChange).sourceFingerprint,
    editorialChange.sourceFingerprint,
  );
  assert.throws(() =>
    verifyBattleMapArtifact(editorialChange, { sourceFingerprint: original.sourceFingerprint }),
  );
});

test('JSON guards reject hostile trees without invoking accessors at each API boundary', () => {
  const cycle = {};
  cycle.child = cycle;
  const sparse = new Array(2);
  const hidden = {};
  Object.defineProperty(hidden, 'value', { value: 1 });
  let called = 0;
  const getter = {};
  Object.defineProperty(getter, 'value', {
    enumerable: true,
    get() {
      called++;
      throw new Error('must never execute');
    },
  });
  const symbol = { [Symbol('value')]: 1 };
  for (const bad of [
    cycle,
    sparse,
    hidden,
    getter,
    symbol,
    new Date(),
    new Map(),
    NaN,
    Infinity,
    undefined,
    () => 1,
    { x: 'x'.repeat(16385) },
  ]) {
    assert.throws(() => compileBattleMapSource(bad));
    assert.throws(() => verifyBattleMapArtifact(bad));
    assert.throws(() => battleMapCapability(bad, { kind: 'geometry' }));
    assert.throws(() => battleMapCapability({}, bad));
  }
  assert.equal(called, 0);
  let deep = {};
  for (let i = 0; i < 26; i++) deep = { child: deep };
  assert.throws(() => compileBattleMapSource(deep), /Limite nodi/);
  assert.throws(() => compileBattleMapSource(new Array(100001)), /Limite array/);
  assert.throws(() => verifyBattleMapArtifact({}, new Date()));
  assert.throws(() => compileBattleMapSource({ ...battleSource(), seed: 123 }));
});

test('capability verifies geometry but keeps adventure start unconditionally gated', () => {
  const a = compileBattleMapSource(battleSource()),
    before = structuredClone(a);
  const geometry = battleMapCapability(a, {
    kind: 'geometry',
    expected: { sourceFingerprint: a.sourceFingerprint },
  });
  assert.equal(geometry.enabled, true);
  assert.equal(geometry.runtimeReady, false);
  const start = battleMapCapability(a, { kind: 'adventure-start' });
  assert.equal(start.enabled, false);
  assert.equal(start.runtimeReady, false);
  assert.deepEqual(start.gates.boonQuantities, [null, null, null]);
  assert.equal(start.gates.boonStatus, 'unverified');
  assert.equal(start.gates.original156, 'static-gated');
  assert.equal(start.gates.requirements.includes('transactional-startup-integration'), true);
  assert.deepEqual(a, before);
  assert.throws(() => battleMapCapability(a, { kind: 'adventure-start', heroes: 3 }));
  assert.throws(() =>
    battleMapCapability(a, { kind: 'geometry', expected: { artifactFingerprint: '0'.repeat(64) } }),
  );
  a.compiled.layouts[0].walkableEdges.pop();
  resign(a);
  assert.throws(() => battleMapCapability(a, { kind: 'geometry' }));
});
