import { canonical } from '../map-freeze/hash';
import { check, sorted, type Alternative, type Anchor, type Vec2, type Vec3 } from './model';
import { float32, position, rotate, type SourceContext } from './source';

type Bounds = [[number, number], [number, number], [number, number]];
const bounds = (points: number[][]): Bounds =>
  [0, 1, 2].map((i) => [
    Math.min(...points.map((p) => p[i]!)),
    Math.max(...points.map((p) => p[i]!)),
  ]) as Bounds;
export type Patch = {
  id: string;
  board: string;
  index: number;
  source: string;
  mesh: string;
  submesh: number;
  cell: string;
  vertices: Vec3[];
  uv: Vec2[];
  bounds: Bounds;
  uvOrientation: string;
};
export type Contact = {
  patches: [string, string];
  axis: 'x' | 'y';
  span: [number, number];
  sides: [number, number];
  gap: number;
  kind: 'internal' | 'seam';
};
export type Edge = { cells: [string, string]; contacts: Contact[] };
const pair = (a: string, b: string): [string, string] => (a < b ? [a, b] : [b, a]);
const key = (cells: [string, string]) => cells.join('|');

function makePatch(ctx: SourceContext, board: Alternative['boards'][number], index: number): Patch {
  const { s } = ctx,
    p = board.patches[index]!,
    eps = s.tolerances.geometry;
  const material = s.materials.find(
    (m) => m.skin === s.model.boards.find((b) => b.id === board.id)!.skin,
  )!;
  const face = s.policy.faces.find((f) => f.texture === material.texture)!;
  const cell = `${board.id}/${face.regions.find((r) => r.patches.includes(index))!.id}`;
  const corners = ctx.corners(p.mesh, p.submesh);
  check(
    corners.every((c) => c.uv !== null),
    'Render projection missing UV.',
  );
  // UV order gives a stable corner order, independent of vertex/storage order.
  const ordered = [...corners].sort((a, b) => a.uv![0] - b.uv![0] || a.uv![1] - b.uv![1]);
  const uv: Vec2[] = ordered.map((c) => [...c.uv!]);
  const vertices: Vec3[] = ordered.map((c) =>
    p.staticBatched ? [...c.position] : ctx.world(p.transform, c.position),
  );
  const bb = bounds(vertices),
    ub = bounds(uv.map((v) => [...v, 0]));
  check(
    bb[0][1] - bb[0][0] > 4 * eps && bb[1][1] - bb[1][0] > 4 * eps && bb[2][1] - bb[2][0] <= eps,
    'Degenerate/nonplanar patch projection.',
  );
  check(
    ub[0][1] - ub[0][0] > 4 * s.tolerances.uv && ub[1][1] - ub[1][0] > 4 * s.tolerances.uv,
    'Degenerate UV rectangle.',
  );
  const quadrant = (p: number[], b: Bounds, tolerance: number) =>
    [0, 1]
      .map((i) => {
        const low = Math.abs(p[i]! - b[i]![0]) <= tolerance,
          high = Math.abs(p[i]! - b[i]![1]) <= tolerance;
        check(low !== high, 'Projection corners must be rectilinear.');
        return low ? '0' : '1';
      })
      .join('');
  const qu = uv.map((v) => quadrant(v, ub, s.tolerances.uv));
  const qw = vertices.map((v) => quadrant(v, bb, eps));
  check(new Set(qu).size === 4 && new Set(qw).size === 4, 'Incomplete rectangle projection.');
  const orientation = qu.map((u, i) => [u, qw[i]!] as const).sort(([a], [b]) => (a < b ? -1 : 1));
  // UV neighbours must remain world neighbours (no folded/bow-tie projection).
  for (let i = 0; i < 4; i++)
    for (let j = i + 1; j < 4; j++) {
      const [ui, wi] = orientation[i]!,
        [uj, wj] = orientation[j]!;
      check(
        (ui[0] === uj[0] || ui[1] === uj[1]) === (wi[0] === wj[0] || wi[1] === wj[1]),
        'Folded UV projection.',
      );
    }
  return {
    id: `${board.id}#${index}`,
    board: board.id,
    index,
    source: p.record,
    mesh: p.mesh,
    submesh: p.submesh,
    cell,
    vertices,
    uv,
    bounds: bb,
    uvOrientation: orientation.map(([u, w]) => `${u}:${w}`).join('|'),
  };
}

function contact(a: Patch, b: Patch, eps: number): Contact | null {
  const overlap = [0, 1].map(
    (i) => Math.min(a.bounds[i]![1], b.bounds[i]![1]) - Math.max(a.bounds[i]![0], b.bounds[i]![0]),
  );
  check(!(overlap[0]! > eps && overlap[1]! > eps), 'Overlapping patch interiors.');
  const hits: Contact[] = [];
  for (const axis of [0, 1] as const) {
    const along = axis === 0 ? 1 : 0;
    if (overlap[along]! <= eps) continue; // A corner is never an adjacency.
    for (const [sa, sb] of [
      [1, 0],
      [0, 1],
    ] as const) {
      const aa = a.bounds[axis][sa],
        bb = b.bounds[axis][sb];
      if (Math.abs(aa - bb) <= eps)
        hits.push({
          patches: [a.id, b.id],
          axis: axis === 0 ? 'x' : 'y',
          span: [
            Math.max(a.bounds[along][0], b.bounds[along][0]),
            Math.min(a.bounds[along][1], b.bounds[along][1]),
          ],
          sides: [aa, bb],
          gap: Math.abs(aa - bb),
          kind: a.board === b.board ? 'internal' : 'seam',
        });
    }
  }
  check(hits.length <= 1, 'Ambiguous patch contact.');
  return hits[0] ?? null;
}

function wallDirection(ctx: SourceContext, a: Anchor): Vec3 {
  const w = a.wall!;
  const bb = bounds(ctx.corners(w.mesh, w.submesh).map((v) => v.position));
  const axes = bb
    .map(([low, high], i) => ({ i, size: high - low }))
    .sort((a, b) => b.size - a.size);
  check(
    axes[0]!.size > 0 && axes[0]!.size > 2 * axes[1]!.size,
    'Wall mesh has no unique long axis.',
  );
  let direction: Vec3 = [0, 0, 0];
  direction[axes[0]!.i] = 1;
  for (const child of [...w.children].reverse())
    direction = rotate(ctx.transform(child), direction, false);
  direction = rotate(ctx.transform(a.transform), direction, false);
  const length = Math.hypot(...direction);
  check(
    length > 1e-12 && Math.abs(direction[2]) / length <= ctx.s.tolerances.wallAlignment,
    'Wall axis outside layout plane.',
  );
  return direction;
}

export function deriveLayout(ctx: SourceContext, alternative: Alternative) {
  const { s } = ctx,
    eps = s.tolerances.geometry;
  const patches = sorted(
    alternative.boards.flatMap((b) => b.patches.map((_, i) => makePatch(ctx, b, i))),
  );
  check(
    Math.max(...patches.map((p) => p.bounds[2][1])) -
      Math.min(...patches.map((p) => p.bounds[2][0])) <=
      eps,
    'Layout patches are not coplanar.',
  );
  for (const board of alternative.boards) {
    const members = patches.filter((p) => p.board === board.id),
      bb = bounds(members.flatMap((p) => p.vertices));
    const area = members.reduce(
      (n, p) => n + (p.bounds[0][1] - p.bounds[0][0]) * (p.bounds[1][1] - p.bounds[1][0]),
      0,
    );
    const width = bb[0][1] - bb[0][0],
      height = bb[1][1] - bb[1][0];
    check(
      Math.abs(area - width * height) <= eps * (width + height) * members.length,
      'Incomplete board surface.',
    );
  }
  for (const b of alternative.boards)
    check(
      new Set(patches.filter((p) => p.board === b.id).map((p) => p.uvOrientation)).size === 1,
      'Inconsistent face UV orientation.',
    );
  const contacts: Contact[] = [];
  for (let i = 0; i < patches.length; i++)
    for (let j = i + 1; j < patches.length; j++) {
      const c = contact(patches[i]!, patches[j]!, eps);
      if (c) contacts.push(c);
    }
  const byId = new Map(patches.map((p) => [p.id, p]));
  const cells = [...new Set(patches.map((p) => p.cell))].sort().map((id) => {
    const members = patches.filter((p) => p.cell === id),
      seen = new Set([members[0]!.id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const c of contacts)
        if (
          byId.get(c.patches[0])!.cell === id &&
          byId.get(c.patches[1])!.cell === id &&
          c.patches.some((p) => seen.has(p))
        )
          for (const p of c.patches)
            if (!seen.has(p)) {
              seen.add(p);
              changed = true;
            }
    }
    check(seen.size === members.length, 'Disconnected physical region.');
    return { id, board: members[0]!.board, patches: members.map((p) => p.id) };
  });
  const edges = new Map<string, Edge>();
  for (const c of contacts) {
    const ca = byId.get(c.patches[0])!.cell,
      cb = byId.get(c.patches[1])!.cell;
    if (ca === cb) continue;
    const cells = pair(ca, cb),
      k = key(cells);
    if (!edges.has(k)) edges.set(k, { cells, contacts: [] });
    edges.get(k)!.contacts.push(c);
  }
  const geometricEdges = [...edges.values()].sort((a, b) => (key(a.cells) < key(b.cells) ? -1 : 1));
  const interior = (point: Vec3) => {
    const matching = patches.filter((p) =>
      [0, 1].every((i) => point[i]! >= p.bounds[i]![0] - eps && point[i]! <= p.bounds[i]![1] + eps),
    );
    const candidates = new Set(matching.map((p) => p.cell));
    check(candidates.size === 1, 'Anchor outside map or on ambiguous physical boundary.');
    const cell = matching[0]!.cell;
    for (const p of matching)
      for (const axis of [0, 1] as const)
        for (const side of [0, 1] as const) {
          if (Math.abs(point[axis] - p.bounds[axis][side]) > eps) continue;
          const along = axis === 0 ? 1 : 0;
          const joined = contacts.some(
            (c) =>
              c.axis === (axis === 0 ? 'x' : 'y') &&
              c.patches.includes(p.id) &&
              c.patches.every((id) => byId.get(id)!.cell === cell) &&
              point[along] >= c.span[0] - eps &&
              point[along] <= c.span[1] + eps,
          );
          check(joined, 'Anchor on outer physical boundary.');
        }
    return cell;
  };
  const walls: {
    id: string;
    cells: [string, string];
    direction: Vec3;
    distance: number;
    alignment: number;
  }[] = [];
  const placements = sorted(s.anchors).map((a) => {
    const t = ctx.transform(a.transform),
      point = position(t);
    let cell: string | null = null,
      border: [string, string] | null = null;
    if (a.wall) {
      const direction = wallDirection(ctx, a),
        length = Math.hypot(direction[0], direction[1]);
      check(length > 1e-12, 'Wall has no planar axis.');
      const hits = geometricEdges.flatMap((edge) => {
        const distances = edge.contacts.flatMap((c) => {
          const axis = c.axis === 'x' ? 0 : 1,
            along = axis === 0 ? 1 : 0;
          if (point[along] < c.span[0] - eps || point[along] > c.span[1] + eps) return [];
          const distance = Math.max(...c.sides.map((side) => Math.abs(point[axis] - side)));
          // Match location first: a wrong orientation cannot silently select a nearby border.
          return distance <= s.tolerances.wallDistance
            ? [{ distance, alignment: Math.abs(direction[axis]) / length }]
            : [];
        });
        return distances.length
          ? [
              {
                cells: edge.cells,
                distance: Math.min(...distances.map((d) => d.distance)),
                alignment: Math.max(...distances.map((d) => d.alignment)),
              },
            ]
          : [];
      });
      check(
        hits.length === 1 && hits[0]!.alignment <= s.tolerances.wallAlignment,
        'Wall border/orientation ambiguous or incomplete.',
      );
      const hit = hits[0]!;
      border = [...hit.cells];
      check(!walls.some((w) => key(w.cells) === key(hit.cells)), 'Duplicate wall on a border.');
      walls.push({ id: a.id, ...hit, direction });
    } else cell = interior(point);
    return {
      id: a.id,
      kind: a.kind,
      order: a.order,
      record: a.record,
      transform: a.transform,
      position: point,
      positionBits: t.position.map((n) => n.float32le),
      rotation: t.rotation.map(float32),
      rotationBits: t.rotation.map((n) => n.float32le),
      cell,
      border,
    };
  });
  const blocked = new Set(walls.map((w) => key(w.cells)));
  return {
    id: alternative.id,
    scene: alternative.scene,
    manager: alternative.manager,
    root: alternative.root,
    boards: alternative.boards.map((b) => {
      const skin = s.model.boards.find((m) => m.id === b.id)!.skin,
        material = s.materials.find((m) => m.skin === skin)!;
      return {
        id: b.id,
        source: b.record,
        transform: b.transform,
        skin,
        material: material.record,
        texture: material.texture,
      };
    }),
    patches,
    cells,
    contacts,
    geometricEdges,
    walkableEdges: geometricEdges
      .filter((e) => !blocked.has(key(e.cells)))
      .map((e) => [...e.cells] as [string, string]),
    walls,
    placements,
    spawnOrder: s.anchors
      .filter((a) => a.kind === 'spawn')
      .sort((a, b) => a.order! - b.order!)
      .map((a) => a.id),
  };
}
export type Layout = ReturnType<typeof deriveLayout>;
export function assertEquivalent(layouts: Layout[], eps: number, uvEps: number): void {
  const logical = (l: Layout) => ({
    boards: l.boards.map(({ id, skin, texture }) => ({ id, skin, texture })),
    cells: l.cells,
    patches: l.patches.map(({ id, cell, uvOrientation }) => ({ id, cell, uvOrientation })),
    edges: l.geometricEdges.map((e) => ({
      cells: e.cells,
      contacts: e.contacts.map(({ patches, axis, kind }) => ({ patches, axis, kind })),
    })),
    walkable: l.walkableEdges,
    walls: l.walls.map(({ id, cells }) => ({ id, cells })),
    placements: l.placements,
    spawns: l.spawnOrder,
  });
  const first = layouts[0]!;
  for (const next of layouts.slice(1)) {
    check(
      canonical(logical(first)) === canonical(logical(next)),
      'Merge alternatives disagree on logical geometry.',
    );
    for (let i = 0; i < first.patches.length; i++) {
      const a = first.patches[i]!,
        b = next.patches[i]!;
      check(
        a.bounds.every((r, axis) =>
          r.every((v, side) => Math.abs(v - b.bounds[axis]![side]!) <= eps),
        ),
        'Merge alternatives disagree on patch geometry.',
      );
      check(
        a.uv.every((u, j) => u.every((v, axis) => Math.abs(v - b.uv[j]![axis]!) <= uvEps)),
        'Merge alternatives disagree on patch UV.',
      );
    }
  }
}
