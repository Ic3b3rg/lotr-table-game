import type { Cube } from '../map-geometry/model';
import {
  add,
  subtract,
  cubeKey,
  directionCube,
  normalizeDirection,
  edgeKey,
} from '../map-geometry/model';
import { rotate } from '../map-geometry/geometry';
import type { AssemblyInput, Shape, Vector, PhysicalEdge } from './model';
import { f, plus, minus, times, sqr, turn, transform } from './physical';

export type Boundary = {
  tileSource: string;
  hashId: number;
  hex: number;
  coords: Cube;
  direction: number;
};
export type Placement = {
  anchor: Boundary;
  target: Boundary;
  sectionId: number;
  targetSectionId: number;
  openEdgeCount: number;
  enumerationIndex: number;
};
export type TileState = {
  shape: Shape;
  rotation: number;
  globals: Cube[];
  localCoords: Cube[] | null;
  position: Vector;
  sectionId: number | null;
  parentSectionId: number | null;
  localEdges: Boundary[];
  edges: Map<string, PhysicalEdge>;
};
export type SectionState = {
  id: number;
  tiles: TileState[];
  available: TileState[];
  position: Vector;
  rotation: number;
  radius: number | null;
  localEdges: Boundary[];
  placements: Placement[];
  tilePlacements: Placement[];
  isFinished: boolean;
  lastAttachedTileId: number;
  spacesFromAvailableTiles: number;
  required: number[];
};
export type Hex = { tile: TileState; section: SectionState; index: number; coords: Cube };
export type World = {
  input: AssemblyInput;
  sections: SectionState[];
  tiles: Map<string, TileState>;
};
export const composite = (w: World, t: TileState) =>
  normalizeDirection(t.rotation + (t.sectionId === null ? 0 : w.sections[t.sectionId]!.rotation));
export function tilePoint(w: World, t: TileState, p: Vector): Vector {
  const local = plus(t.position, turn(p, t.rotation));
  if (t.parentSectionId === null) return local;
  const s = w.sections[t.parentSectionId]!;
  return plus(s.position, turn(local, s.rotation));
}
export function setTileWorld(w: World, t: TileState, p: Vector): void {
  t.position =
    t.parentSectionId === null
      ? p
      : turn(
          minus(p, w.sections[t.parentSectionId]!.position),
          -w.sections[t.parentSectionId]!.rotation,
        );
}
export const center = (w: World, t: TileState, h: number): Vector =>
  tilePoint(w, t, transform([0, 0, 0], t.shape.hexes[h]!.transform));
export function edgePosition(w: World, t: TileState, h: number, d: number): Vector {
  const hex = t.shape.hexes[h]!,
    r = hex.bounds.extents[1];
  const corner = (i: number) =>
    tilePoint(
      w,
      t,
      transform(
        [f(r * w.input.geometry.cornerCos[i]!), f(r * w.input.geometry.cornerSin[i]!), 0],
        hex.transform,
      ),
    );
  const a = corner(d),
    b = corner(normalizeDirection(d - 1));
  // Unity Vector3.Lerp(a,b,.5) evaluates a+(b-a)*.5.
  return plus(a, times(minus(b, a), 0.5));
}
export function getEdge(t: TileState, hex: number, direction: number): PhysicalEdge | undefined {
  return t.edges.get(edgeKey(hex, direction));
}
export const boundary = (t: TileState, h: number, d: number): Boundary => ({
  tileSource: t.shape.source,
  hashId: t.shape.hashId,
  hex: h,
  coords: [...t.shape.hexes[h]!.coords],
  direction: d,
});
export function localTileEdges(t: TileState): Boundary[] {
  const occupied = new Set(t.shape.hexes.map((h) => cubeKey(h.coords))),
    out: Boundary[] = [];
  t.shape.hexes.forEach((h, i) => {
    for (let d = 0; d < 6; d++)
      if (!occupied.has(cubeKey(add(h.coords, directionCube(d))))) out.push(boundary(t, i, d));
  });
  return out;
}
export function occupancy(sections: SectionState[]): Map<string, Hex> {
  const out = new Map<string, Hex>();
  for (const section of sections)
    for (const tile of section.tiles)
      tile.globals.forEach((coords, index) =>
        out.set(cubeKey(coords), { tile, section, index, coords }),
      );
  return out;
}
/** Section boundary deliberately includes sides contacting other map sections. */
export function sectionEdges(w: World, s: SectionState): Boundary[] {
  const occupied = occupancy([s]),
    out: Boundary[] = [];
  for (const t of s.tiles)
    t.globals.forEach((c, h) => {
      for (let d = 0; d < 6; d++)
        if (!occupied.has(cubeKey(add(c, directionCube(d)))))
          out.push(boundary(t, h, normalizeDirection(d - composite(w, t))));
    });
  return out;
}
export const mapEdges = (w: World, sections: SectionState[]) =>
  sections.flatMap((s) => sectionEdges(w, s));
export function resetTile(t: TileState): void {
  t.rotation = 0;
  t.sectionId = null;
  t.globals = t.shape.hexes.map((h) => [...h.coords]);
  // Source Reset retains Transform parent/position; localRotation is identity.
}
export function rotateTile(t: TileState, hex: number, intervals: number): void {
  if (intervals === 0) return;
  const pivot = t.globals[hex]!;
  t.rotation = normalizeDirection(t.rotation + intervals);
  t.globals = t.globals.map((c) =>
    add(pivot, rotate(subtract(c, pivot), normalizeDirection(intervals))),
  );
}
export function snapTile(w: World, t: TileState, p: Placement): void {
  const target = w.tiles.get(p.target.tileSource)!,
    d = normalizeDirection(p.target.direction + target.rotation),
    incoming = normalizeDirection(p.anchor.direction + t.rotation);
  rotateTile(t, p.anchor.hex, normalizeDirection(d + 3 - incoming));
  const to = edgePosition(w, target, p.target.hex, p.target.direction),
    from = edgePosition(w, t, p.anchor.hex, p.anchor.direction);
  const offset = subtract(
    add(target.globals[p.target.hex]!, directionCube(d)),
    t.globals[p.anchor.hex]!,
  );
  t.globals = t.globals.map((c) => add(c, offset));
  setTileWorld(w, t, plus(to, minus(tilePoint(w, t, [0, 0, 0]), from)));
}
export function attachTile(w: World, s: SectionState, t: TileState): void {
  const p = tilePoint(w, t, [0, 0, 0]);
  t.parentSectionId = s.id;
  setTileWorld(w, t, p);
  t.sectionId = s.id;
  s.tiles.push(t);
  s.radius = null;
}
export function snapSection(w: World, s: SectionState, p: Placement): void {
  const anchor = w.tiles.get(p.anchor.tileSource)!,
    target = w.tiles.get(p.target.tileSource)!;
  const d = normalizeDirection(p.target.direction + composite(w, target)),
    incoming = normalizeDirection(p.anchor.direction + composite(w, anchor));
  const intervals = normalizeDirection(d + 3 - incoming);
  if (intervals !== 0) {
    const pivot = anchor.globals[p.anchor.hex]!;
    s.rotation = normalizeDirection(s.rotation + intervals);
    for (const t of s.tiles)
      t.globals = t.globals.map((c) => add(pivot, rotate(subtract(c, pivot), intervals)));
  }
  const from = edgePosition(w, anchor, p.anchor.hex, p.anchor.direction),
    to = edgePosition(w, target, p.target.hex, p.target.direction);
  const offset = subtract(
    add(target.globals[p.target.hex]!, directionCube(d)),
    anchor.globals[p.anchor.hex]!,
  );
  for (const t of s.tiles) t.globals = t.globals.map((c) => add(c, offset));
  s.position = plus(s.position, minus(to, from));
}
export function recenter(
  w: World,
  s: SectionState,
): { mean: Vector; offset: Vector; hexCount: number } {
  let sum: Vector = [0, 0, 0],
    count = 0;
  for (const t of s.tiles)
    for (let h = 0; h < t.globals.length; h++) {
      sum = plus(sum, center(w, t, h));
      count++;
    }
  if (count === 0) throw new Error('Vector3 division: sezione senza esagoni.');
  const mean: Vector = [f(sum[0] / count), f(sum[1] / count), f(sum[2] / count)],
    offset = minus(mean, s.position);
  for (const t of s.tiles) t.position = minus(t.position, offset);
  return { mean, offset, hexCount: count };
}
export function sphere(w: World, s: SectionState) {
  if (s.radius === null) {
    let max = 0;
    for (const t of s.tiles)
      for (let h = 0; h < t.globals.length; h++)
        max = Math.max(max, sqr(minus(center(w, t, h), s.position)));
    s.radius = f(Math.sqrt(max));
  }
  return { position: s.position, radius: s.radius };
}
