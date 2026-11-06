// Entirely invented technical evidence. No original board, coordinates, asset IDs or text.
import { createHash } from 'node:crypto';
export const canonical = (v) =>
  Array.isArray(v)
    ? `[${v.map(canonical).join(',')}]`
    : v && typeof v === 'object'
      ? `{${Object.entries(v)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([k, x]) => `${JSON.stringify(k)}:${canonical(x)}`)
          .join(',')}}`
      : JSON.stringify(v);
export const hash = (v) => createHash('sha256').update(canonical(v)).digest('hex');
const sha = (s) => createHash('sha256').update(s).digest('hex');
export const f32 = (n) => {
  const b = Buffer.alloc(4);
  b.writeFloatLE(n);
  return { value: b.readFloatLE(), float32le: b.toString('hex') };
};
export function battleSource() {
  const records = [];
  const record = (id, kind) => {
    records.push({ id, kind, file: 'invented', locator: `object/${id}`, sha256: sha(id) });
    return id;
  };
  const transforms = [];
  const transform = (
    id,
    position = [0, 0, 0],
    rotation = [0, 0, 0, 1],
    scale = [1, 1, 1],
    parent = null,
  ) => {
    transforms.push({
      record: record(id, 'transform'),
      parent,
      position: position.map(f32),
      rotation: rotation.map(f32),
      scale: scale.map(f32),
    });
    return id;
  };
  const meshes = [];
  const mesh = (id, x, y, width, height, wall = false) => {
    const positions = [
      [x, y, 0],
      [x + width, y, 0],
      [x + width, y + height, 0],
      [x, y + height, 0],
    ];
    meshes.push({
      record: record(id, 'mesh'),
      codec: 'float32',
      vertices: positions.map((p, i) => ({
        index: i,
        position: p,
        positionBits: p.map((n) => f32(n).float32le),
        uv: wall
          ? null
          : [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 1],
            ][i],
        uvBits: wall
          ? null
          : [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 1],
            ][i].map((n) => f32(n).float32le),
      })),
      submeshes: [{ index: 0, vertices: [0, 1, 2, 3] }],
    });
    return id;
  };
  const texture = record('ink', 'texture');
  const materials = [{ record: record('paper', 'material'), skin: 7, texture }];
  const alternatives = ['amber', 'violet'].map((id) => ({
    id,
    scene: `scene-${id}`,
    manager: record(`manager-${id}`, 'manager'),
    root: transform(`root-${id}`),
    boards: ['west', 'east'].map((board, bi) => ({
      id: board,
      record: record(`board-${id}-${board}`, 'board'),
      transform: transform(
        `board-transform-${id}-${board}`,
        [37, 19, 0],
        [0, 0, 0, 1],
        [1, 1, 1],
        `root-${id}`,
      ),
      patches: Array.from({ length: 4 }, (_, i) => ({
        record: record(`patch-${id}-${board}-${i}`, 'patch'),
        mesh: mesh(`mesh-${id}-${board}-${i}`, bi * 4 + (i % 2) * 2, Math.floor(i / 2) * 2, 2, 2),
        submesh: 0,
        transform: transform(
          `patch-transform-${id}-${board}-${i}`,
          [0, 0, 0],
          [0, 0, 0, 1],
          [1, 1, 1],
          `board-transform-${id}-${board}`,
        ),
        staticBatched: true,
      })),
    })),
  }));
  const wallMesh = mesh('strip', -0.1, -0.6, 0.2, 1.2, true);
  // Numeric float32 coordinates and their source bits agree, including signed zero.
  for (const m of meshes) for (const v of m.vertices) v.position = v.position.map(Math.fround);
  const anchors = [
    {
      id: 'guide',
      kind: 'hero',
      order: null,
      transform: transform('guide-t', [0.5, 0.6, -0], [1e-9, 0, 0, 1]),
      record: null,
      wall: null,
    },
    {
      id: 'arrival-a',
      kind: 'spawn',
      order: 0,
      transform: transform('arrival-a-t', [6.5, 2.5, 0]),
      record: record('arrival-a-node', 'anchor'),
      wall: null,
    },
    {
      id: 'arrival-b',
      kind: 'spawn',
      order: 1,
      transform: transform('arrival-b-t', [0.5, 3, 0]),
      record: record('arrival-b-node', 'anchor'),
      wall: null,
    },
    {
      id: 'marker',
      kind: 'terrain',
      order: null,
      transform: transform('marker-t', [2, 1, 0]),
      record: record('marker-node', 'anchor'),
      wall: null,
    },
    {
      id: 'partition',
      kind: 'wall',
      order: null,
      transform: transform('partition-t', [4.04, 1, 0]),
      record: record('partition-node', 'anchor'),
      wall: { mesh: wallMesh, submesh: 0, children: [] },
    },
  ];
  const policy = {
    id: 'invented-review',
    revision: 2,
    evidence: [{ file: 'art', locator: 'drawing/page-1', sha256: sha('drawing') }],
    assumptions: ['Invented rectilinear drawing; no editorial authority.'],
    faces: [
      {
        texture,
        regions: [
          { id: 'floor', patches: [0, 1] },
          { id: 'alcove', patches: [2] },
          { id: 'ledge', patches: [3] },
        ],
      },
    ],
  };
  // A second invented face gives the east board a different partition.
  const otherTexture = record('other-ink', 'texture');
  materials.push({ record: record('other-paper', 'material'), skin: 9, texture: otherTexture });
  policy.faces.push({
    texture: otherTexture,
    regions: [
      { id: 'gallery', patches: [0, 2] },
      { id: 'court', patches: [1, 3] },
    ],
  });
  const source = {
    format: 'battle-map-source-v1',
    algorithm: 'rectilinear-patches-v1',
    files: [
      { id: 'invented', bytes: 8500, sha256: sha('invented bytes') },
      { id: 'art', bytes: 123, sha256: sha('invented drawing file') },
    ],
    records,
    resourceManager: {
      record: record('catalog', 'resource-manager'),
      entries: [
        { key: 'demo-prefab', target: 'prefab' },
        { key: 'demo-model', target: 'model' },
      ],
    },
    prefab: { record: record('prefab', 'prefab'), adventure: 'adventure' },
    mechanics: ['resource-loading', 'board-initialization', 'skin-material', 'root-merge'].map(
      (capability) => ({
        capability,
        file: 'invented',
        locator: `method/${capability}`,
        sha256: sha(capability),
      }),
    ),
    adventure: {
      record: record('adventure', 'adventure'),
      resourceKey: 'demo-prefab',
      model: 'model',
    },
    model: {
      record: record('model', 'model'),
      resourceKey: 'demo-model',
      type: 'battle',
      boards: [
        { id: 'west', skin: 7 },
        { id: 'east', skin: 9 },
      ],
    },
    buildSettings: {
      record: record('build', 'build-settings'),
      scenes: alternatives.map((a, i) => ({ index: 11 + i, key: a.scene, manager: a.manager })),
    },
    materials,
    textures: [texture, otherTexture].map((r) => ({
      record: r,
      width: 64,
      height: 64,
      stream: { file: 'art', offset: 0, bytes: 123, sha256: sha('stream') },
    })),
    transforms,
    meshes,
    alternatives,
    selectedAlternative: 'amber',
    anchors,
    policy,
    policyFingerprint: hash(policy),
    tolerances: { geometry: 0.00001, uv: 0.00001, wallDistance: 0.08, wallAlignment: 0.00001 },
  };
  return source;
}
