import { digest } from '../map-freeze/hash';
import {
  bounded,
  check,
  unique,
  sourceSchema,
  type Vec3,
  type Transform,
  type BattleMapSource,
} from './model';

/** Source bits survive JSON's loss of negative zero. No normalisation or rounding. */
export function float32(value: { value: number; float32le: string }): number {
  const decoded = Buffer.from(value.float32le, 'hex').readFloatLE();
  check(Number.isFinite(decoded) && decoded === value.value, 'Float32 bits/value mismatch.');
  return decoded;
}
export const position = (t: Transform): Vec3 => t.position.map(float32) as Vec3;
export function rotate(t: Transform, point: Vec3, translate: boolean): Vec3 {
  const [x, y, z, w] = t.rotation.map(float32) as [number, number, number, number];
  const scale = t.scale.map(float32);
  const v = point.map((n, i) => n * scale[i]!);
  const matrix = [
    [1 - 2 * y * y - 2 * z * z, 2 * x * y - 2 * z * w, 2 * x * z + 2 * y * w],
    [2 * x * y + 2 * z * w, 1 - 2 * x * x - 2 * z * z, 2 * y * z - 2 * x * w],
    [2 * x * z - 2 * y * w, 2 * y * z + 2 * x * w, 1 - 2 * x * x - 2 * y * y],
  ];
  return matrix.map(
    (row, i) =>
      row.reduce((n, a, j) => n + a * v[j]!, 0) + (translate ? float32(t.position[i]!) : 0),
  ) as Vec3;
}
export function parseSource(raw: unknown) {
  bounded(raw);
  const s = sourceSchema.parse(raw);
  unique(
    s.files.map((f) => f.id),
    'Files',
  );
  unique(
    s.records.map((r) => r.id),
    'Records',
  );
  unique(
    s.records.map((r) => `${r.file}\0${r.locator}`),
    'Record locators',
  );
  const files = new Map(s.files.map((f) => [f.id, f]));
  const records = new Map(s.records.map((r) => [r.id, r]));
  const record = (id: string, kind: BattleMapSource['records'][number]['kind']) => {
    const r = records.get(id);
    check(r?.kind === kind, `Missing/wrong ${kind} record: ${id}.`);
    return r;
  };
  for (const r of s.records) check(files.has(r.file), 'Record file missing.');
  for (const [rows, kind] of [
    [s.transforms, 'transform'],
    [s.meshes, 'mesh'],
    [s.materials, 'material'],
    [s.textures, 'texture'],
  ] as const) {
    unique(
      rows.map((r) => r.record),
      kind,
    );
    rows.forEach((r) => record(r.record, kind));
  }
  record(s.resourceManager.record, 'resource-manager');
  record(s.prefab.record, 'prefab');
  record(s.adventure.record, 'adventure');
  record(s.model.record, 'model');
  record(s.buildSettings.record, 'build-settings');
  unique(
    s.resourceManager.entries.map((e) => e.key),
    'Resource keys',
  );
  check(
    s.resourceManager.entries.find((e) => e.key === s.adventure.resourceKey)?.target ===
      s.prefab.record,
    'Resource/prefab binding mismatch.',
  );
  check(s.prefab.adventure === s.adventure.record, 'Prefab/Adventure component binding mismatch.');
  unique(
    s.mechanics.map((m) => m.capability),
    'Mechanical evidence',
  );
  for (const m of s.mechanics) check(files.has(m.file), 'Mechanical evidence file missing.');
  check(
    s.resourceManager.entries.find((e) => e.key === s.model.resourceKey)?.target ===
      s.model.record && s.adventure.model === s.model.record,
    'Resource/model binding mismatch.',
  );
  for (const e of s.resourceManager.entries)
    check(records.has(e.target), 'Resource target missing.');
  unique(
    s.model.boards.map((b) => b.id),
    'Model boards',
  );
  unique(
    s.materials.map((m) => m.skin),
    'Skins',
  );
  unique(
    s.policy.faces.map((f) => f.texture),
    'Face policies',
  );
  check(digest(s.policy) === s.policyFingerprint, 'Reviewed policy fingerprint mismatch.');
  for (const e of s.policy.evidence) check(files.has(e.file), 'Policy evidence file missing.');
  const textures = new Map(s.textures.map((t) => [t.record, t]));
  for (const t of s.textures) {
    const f = files.get(t.stream.file);
    check(f && t.stream.offset <= f.bytes - t.stream.bytes, 'Texture stream outside source file.');
    check(
      s.policy.faces.some((p) => p.texture === t.record),
      'Texture without reviewed face.',
    );
  }
  for (const m of s.materials) check(textures.has(m.texture), 'Material texture missing.');
  for (const f of s.policy.faces) {
    check(textures.has(f.texture), 'Policy texture missing.');
    unique(
      f.regions.map((r) => r.id),
      'Face regions',
    );
    unique(
      f.regions.flatMap((r) => r.patches),
      'Region membership',
    );
  }
  const transforms = new Map(s.transforms.map((t) => [t.record, t]));
  const transform = (id: string) => {
    const t = transforms.get(id);
    check(t, `Transform missing: ${id}.`);
    return t;
  };
  for (const t of s.transforms) {
    [...t.position, ...t.rotation, ...t.scale].forEach(float32);
    check(
      t.scale.every((n) => Math.abs(float32(n)) > 1e-12),
      'Zero Transform scale.',
    );
    check(
      Math.abs(t.rotation.reduce((n, v) => n + float32(v) ** 2, 0) - 1) < 0.0001,
      'Nonunit source quaternion.',
    );
    let p: Transform | undefined = t;
    const seen = new Set<string>();
    while (p) {
      check(!seen.has(p.record) && seen.size < 24, 'Transform cycle/depth.');
      seen.add(p.record);
      p = p.parent === null ? undefined : transform(p.parent);
    }
  }
  const world = (id: string, local: Vec3): Vec3 => {
    let p: Transform | undefined = transform(id);
    let point: Vec3 = [...local];
    while (p) {
      point = rotate(p, point, true);
      p = p.parent === null ? undefined : transform(p.parent);
    }
    check(point.every(Number.isFinite), 'Nonfinite world coordinates.');
    return point;
  };
  const descendsFrom = (child: string, parent: string) => {
    let t: Transform | undefined = transform(child);
    while (t) {
      if (t.record === parent) return true;
      t = t.parent === null ? undefined : transform(t.parent);
    }
    return false;
  };
  const meshes = new Map(s.meshes.map((m) => [m.record, m]));
  for (const m of s.meshes) {
    unique(
      m.vertices.map((v) => v.index),
      'Mesh vertex indices',
    );
    unique(
      m.submeshes.map((v) => v.index),
      'Submesh indices',
    );
    for (const v of m.vertices) {
      if (m.codec === 'float32') {
        check(
          v.positionBits !== null && (v.uv === null ? v.uvBits === null : v.uvBits !== null),
          'Missing native vertex bits.',
        );
        v.positionBits.forEach((bits, i) => float32({ value: v.position[i]!, float32le: bits }));
        v.uvBits?.forEach((bits, i) => float32({ value: v.uv![i]!, float32le: bits }));
      } else
        check(
          v.positionBits === null && v.uvBits === null,
          'Packed projection is not native float32.',
        );
    }
    for (const sub of m.submeshes) {
      unique(sub.vertices, 'Submesh corners');
      check(
        sub.vertices.every((i) => m.vertices.some((v) => v.index === i)),
        'Missing submesh corner.',
      );
    }
  }
  const corners = (id: string, submesh: number) => {
    const m = meshes.get(id),
      sub = m?.submeshes.find((s) => s.index === submesh);
    check(m && sub, 'Mesh/submesh missing.');
    return sub.vertices.map((i) => m.vertices.find((v) => v.index === i)!);
  };
  unique(
    s.alternatives.map((a) => a.id),
    'Merge alternatives',
  );
  unique(
    s.alternatives.map((a) => a.manager),
    'Merge managers',
  );
  unique(
    s.alternatives.map((a) => a.root),
    'Merge roots',
  );
  check(
    s.alternatives.some((a) => a.id === s.selectedAlternative),
    'Selected merge alternative missing.',
  );
  unique(
    s.buildSettings.scenes.map((v) => v.key),
    'Build scenes',
  );
  unique(
    s.buildSettings.scenes.map((v) => v.index),
    'Build scene indices',
  );
  for (const a of s.alternatives) {
    record(a.manager, 'manager');
    transform(a.root);
    check(
      s.buildSettings.scenes.find((b) => b.key === a.scene)?.manager === a.manager,
      'BuildSettings/manager binding mismatch.',
    );
    check(
      a.boards.length === s.model.boards.length &&
        a.boards.every((b, i) => b.id === s.model.boards[i]!.id),
      'Model/manager board order mismatch.',
    );
    unique(
      a.boards.map((b) => b.record),
      'Native boards',
    );
    unique(
      a.boards.flatMap((b) => b.patches.map((p) => p.record)),
      'Render patches',
    );
    check(a.boards.reduce((n, b) => n + b.patches.length, 0) <= 128, 'Layout patch budget.');
    for (const b of a.boards) {
      record(b.record, 'board');
      transform(b.transform);
      check(descendsFrom(b.transform, a.root), 'Board/root hierarchy mismatch.');
      const m = s.materials.find((m) => m.skin === s.model.boards.find((x) => x.id === b.id)!.skin);
      check(m, 'Board skin has no material.');
      const policy = s.policy.faces.find((p) => p.texture === m.texture)!;
      const indices = policy.regions.flatMap((r) => r.patches);
      check(
        indices.length === b.patches.length && indices.every((i) => i < b.patches.length),
        'Face policy coverage incomplete.',
      );
      for (const p of b.patches) {
        record(p.record, 'patch');
        transform(p.transform);
        check(descendsFrom(p.transform, b.transform), 'Patch/board hierarchy mismatch.');
        corners(p.mesh, p.submesh);
      }
    }
  }
  unique(
    s.anchors.map((a) => a.id),
    'Anchor IDs',
  );
  unique(
    s.anchors.map((a) => a.transform),
    'Anchor Transforms',
  );
  const orders = s.anchors
    .filter((a) => a.kind === 'spawn')
    .map((a) => a.order)
    .sort((a, b) => a! - b!);
  check(
    orders.every((n, i) => n === i),
    'Spawn source order must be unique and contiguous.',
  );
  for (const a of s.anchors) {
    transform(a.transform);
    if (a.record !== null) record(a.record, 'anchor');
    check(a.kind === 'hero' || a.record !== null, 'Anchor component provenance missing.');
    check((a.kind === 'spawn') === (a.order !== null), 'Only spawn anchors have source order.');
    check((a.kind === 'wall') === (a.wall !== null), 'Wall evidence missing/unexpected.');
    if (a.wall) {
      corners(a.wall.mesh, a.wall.submesh);
      let parent = a.transform;
      for (const child of a.wall.children) {
        check(transform(child).parent === parent, 'Wall child hierarchy mismatch.');
        parent = child;
      }
    }
  }
  return { s, record, transform, world, corners };
}
export type SourceContext = ReturnType<typeof parseSource>;
