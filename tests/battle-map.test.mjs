import test from 'node:test';
import assert from 'node:assert/strict';
import { compileBattleMapSource } from '../dist/battle-map-library.mjs';
import { battleSource, hash, f32 } from './fixtures/battle-map.mjs';
const pairs = (layout) => layout.geometricEdges.map((e) => e.cells.join('|'));

test('invented faces derive merged spaces, a seam, wall borders and ordered anchors', () => {
  const source = battleSource();
  const before = structuredClone(source);
  const a = compileBattleMapSource(source);
  assert.deepEqual(source, before);
  assert.equal(a.runtimeReady, false);
  const l = a.compiled.layouts[0];
  assert.equal(l.cells.length, 5);
  assert.equal(l.patches.length, 8);
  assert.deepEqual(pairs(l), [
    'east/court|east/gallery',
    'east/gallery|west/floor',
    'east/gallery|west/ledge',
    'west/alcove|west/floor',
    'west/alcove|west/ledge',
    'west/floor|west/ledge',
  ]);
  assert.equal(l.geometricEdges[0].contacts.length, 2);
  assert.equal(l.walkableEdges.length, 5);
  assert.deepEqual(l.walls[0].cells, ['east/gallery', 'west/floor']);
  assert.deepEqual(l.spawnOrder, ['arrival-a', 'arrival-b']);
  assert.equal(l.placements.find((p) => p.id === 'marker').cell, 'west/floor');
  assert.equal(l.placements.find((p) => p.id === 'guide').positionBits[2], '00000080');
  assert.equal(
    a.source.transforms.find((t) => t.record === 'guide-t').rotation[0].float32le,
    f32(1e-9).float32le,
  );
  assert.deepEqual(a.compiled.layouts[0].cells, a.compiled.layouts[1].cells);
});

test('source binding, float bits, projection and visual completeness are enforced', () => {
  for (const mutate of [
    (s) => {
      s.resourceManager.entries[0].target = 'model';
    },
    (s) => {
      s.prefab.adventure = 'model';
    },
    (s) => {
      s.mechanics[0].file = 'absent';
    },
    (s) => {
      s.buildSettings.scenes[0].index = s.buildSettings.scenes[1].index;
    },
    (s) => {
      s.model.boards[0].skin = 100;
    },
    (s) => {
      s.meshes[0].vertices[0].position[0] += 1;
    },
    (s) => {
      s.transforms[0].position[0].value = 12;
    },
    (s) => {
      s.transforms[0].parent = s.transforms[0].record;
    },
    (s) => {
      s.policy.faces[0].regions[0].patches = [0];
      s.policyFingerprint = hash(s.policy);
    },
    (s) => {
      s.policy.faces[0].regions[0].patches = [0, 3];
      s.policy.faces[0].regions[2].patches = [1];
      s.policyFingerprint = hash(s.policy);
    },
  ]) {
    const s = battleSource();
    mutate(s);
    assert.throws(() => compileBattleMapSource(s));
  }
});

test('physical boundary anchors and misoriented or distant walls are rejected', () => {
  for (const [id, field, value] of [
    ['guide-t', 'position', [1, 2, 0]],
    ['guide-t', 'position', [20, 2, 0]],
    ['partition-t', 'position', [4, 2, 0]],
    ['partition-t', 'position', [4.3, 1, 0]],
    ['partition-t', 'rotation', [0, 0, Math.SQRT1_2, Math.SQRT1_2]],
  ]) {
    const s = battleSource();
    s.transforms.find((t) => t.record === id)[field] = value.map(f32);
    assert.throws(() => compileBattleMapSource(s));
  }
});

test('alternative disagreement rejects the source and source array reorder preserves layouts', () => {
  const s = battleSource();
  const normal = compileBattleMapSource(s);
  s.alternatives.reverse();
  s.transforms.reverse();
  s.meshes.reverse();
  s.records.reverse();
  s.files.reverse();
  s.materials.reverse();
  s.textures.reverse();
  const reordered = compileBattleMapSource(s);
  assert.deepEqual(normal.compiled, reordered.compiled);
  assert.notEqual(normal.sourceFingerprint, reordered.sourceFingerprint);
  s.alternatives[0].boards[0].patches.pop();
  assert.throws(() => compileBattleMapSource(s));
});

test('nonbatched corners compose hierarchy while static batching avoids double TRS', () => {
  const s = battleSource(),
    expected = compileBattleMapSource(s);
  for (const a of s.alternatives) {
    s.transforms.find((t) => t.record === `board-transform-${a.id}-east`).position = [4, 0, 0].map(
      f32,
    );
    for (const p of a.boards[1].patches) {
      p.staticBatched = false;
      for (const v of s.meshes.find((m) => m.record === p.mesh).vertices) {
        v.position[0] -= 4;
        v.positionBits = v.position.map((n) => f32(n).float32le);
      }
    }
  }
  const got = compileBattleMapSource(s);
  assert.deepEqual(got.compiled, expected.compiled);
});

test('hierarchy, global plane, overlap and UV orientation cannot be asserted independently', () => {
  for (const mutate of [
    (s) => {
      s.transforms.find((t) => t.record === 'patch-transform-amber-west-0').parent = null;
    },
    (s) => {
      for (const v of s.meshes.find((m) => m.record === 'mesh-amber-west-0').vertices) {
        v.position[2] = 2;
        v.positionBits = v.position.map((n) => f32(n).float32le);
      }
    },
    (s) => {
      const m = s.meshes[0];
      for (const v of m.vertices) {
        v.position[0] += 1;
        v.positionBits = v.position.map((n) => f32(n).float32le);
      }
    },
    (s) => {
      for (const v of s.meshes[0].vertices) {
        v.uv[0] = 1 - v.uv[0];
        v.uvBits = v.uv.map((n) => f32(n).float32le);
      }
    },
  ]) {
    const s = battleSource();
    mutate(s);
    assert.throws(() => compileBattleMapSource(s));
  }
});

test('corner-only contact creates no diagonal adjacency', () => {
  const s = battleSource();
  s.anchors = s.anchors.filter((a) => a.kind !== 'wall');
  s.transforms.find((t) => t.record === 'arrival-a-t').position[1] = f32(6.5);
  for (const a of s.alternatives)
    for (const p of a.boards[1].patches)
      for (const v of s.meshes.find((m) => m.record === p.mesh).vertices) {
        v.position[1] += 4;
        v.positionBits = v.position.map((n) => f32(n).float32le);
      }
  const a = compileBattleMapSource(s);
  assert.equal(
    a.compiled.layouts[0].geometricEdges.some((e) => e.contacts.some((c) => c.kind === 'seam')),
    false,
  );
});

test('native wall child chains, distinct merge roots and component provenance are required', () => {
  for (const mutate of [
    (s) => {
      s.anchors.find((a) => a.kind === 'wall').wall.children = ['guide-t'];
    },
    (s) => {
      s.alternatives[1].manager = s.alternatives[0].manager;
      s.alternatives[1].scene = s.alternatives[0].scene;
    },
    (s) => {
      s.anchors.find((a) => a.kind === 'spawn').record = null;
    },
  ]) {
    const s = battleSource();
    mutate(s);
    assert.throws(() => compileBattleMapSource(s));
  }
});

test('merge comparison applies UV tolerance separately from world geometry tolerance', () => {
  const s = battleSource();
  s.tolerances.geometry = 1e-8;
  s.tolerances.uv = 0.0001;
  for (const m of s.meshes.filter((m) => m.record.startsWith('mesh-violet-')))
    for (const v of m.vertices) {
      v.uv[0] = Math.fround(v.uv[0] + 0.00005);
      v.uvBits = v.uv.map((n) => f32(n).float32le);
    }
  assert.equal(compileBattleMapSource(s).compiled.layouts.length, 2);
});
