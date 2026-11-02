import { createHash } from 'node:crypto';
import { add, subtract, cubeKey, edgeKey, directionCube, normalizeDirection } from './model';
import type { Cube, Edge, GeometryPack, TileGeometry } from './model';

// Source: HexCube.RotateCoords, Edge.CanMatch/IsConnection and Tile.SnapTo;
// method tokens and assembly fingerprint are recorded in the geometry spec.
export function rotate(cube: Cube, rotation: number): Cube {
  let result: Cube = [...cube];
  for (let i = 0; i < rotation; i++) result = [-result[2], -result[0], -result[1]];
  return result;
}
function assertRotation(rotation: number): void {
  if (!Number.isInteger(rotation) || rotation < 0 || rotation > 5)
    throw new Error('La rotazione deve essere un intero da 0 a 5.');
}
export const connectable = (edge: Edge): boolean => ![100, 200, 700].includes(edge.traits);
function passageMatches(a: Edge, b: Edge): boolean {
  if (a.traits === 300) return b.traits === 400;
  if (a.traits === 400) return b.traits === 300;
  if (a.traits === 600 && b.traits === 0) return a.isPassageOpen;
  if (a.traits === 0 && b.traits === 600) return b.isPassageOpen;
  return a.traits === b.traits;
}
export function canMatch(a: Edge, b: Edge): boolean {
  if (a.traits === 700 || b.traits === 700) return true;
  return connectable(a) && connectable(b) && passageMatches(a, b);
}
export function isConnection(a: Edge, b: Edge): boolean {
  return connectable(a) && connectable(b) && passageMatches(a, b);
}
function edgeIndex(tile: TileGeometry): Map<string, Edge> {
  return new Map(tile.edges.map((edge) => [edgeKey(edge.hex, edge.direction), edge]));
}
function requiredEdge(edges: Map<string, Edge>, hex: number, direction: number): Edge {
  const edge = edges.get(edgeKey(hex, direction));
  if (!edge) throw new Error('Bordo esterno assente: validare il pacchetto prima di comporre.');
  return edge;
}
function place(tile: TileGeometry, rotation: number, origin: Cube) {
  return {
    id: tile.id,
    rotation,
    origin,
    hexes: tile.hexes.map((hex) => ({
      coords: add(rotate(hex.coords, rotation), origin),
      space: hex.space,
    })),
  };
}
type PlacedTile = ReturnType<typeof place>;
type OutsideEdge = { edge: Edge; coords: Cube; globalDirection: number };

function outsideEdges(tile: TileGeometry, placed: PlacedTile, globalOrder: boolean): OutsideEdge[] {
  const occupied = new Set(placed.hexes.map((hex) => cubeKey(hex.coords)));
  const edges = edgeIndex(tile);
  const result: OutsideEdge[] = [];
  placed.hexes.forEach((hex, index) => {
    for (let step = 0; step < 6; step++) {
      // A Section scans global directions; an unattached Tile scans local ones.
      const globalDirection = globalOrder ? step : normalizeDirection(step + placed.rotation);
      if (occupied.has(cubeKey(add(hex.coords, directionCube(globalDirection))))) continue;
      const localDirection = normalizeDirection(globalDirection - placed.rotation);
      result.push({
        edge: requiredEdge(edges, index, localDirection),
        coords: hex.coords,
        globalDirection,
      });
    }
  });
  return result;
}
export type Attachment = {
  rotation: number;
  origin: Cube;
  target: { hex: number; direction: number };
  anchor: { hex: number; direction: number };
  openEdgeCount: number;
};

/** Accepts a GeometryPackSchema-validated pack; preserves source order and duplicate poses. */
export function enumerateAttachments(pack: GeometryPack, startRotation: number): Attachment[] {
  assertRotation(startRotation);
  const start = place(pack.start, startRotation, [0, 0, 0]);
  const occupied = new Map(start.hexes.map((hex, index) => [cubeKey(hex.coords), index]));
  const startEdges = edgeIndex(pack.start);
  const targets = outsideEdges(pack.start, start, true);
  const anchors = outsideEdges(pack.attachment, place(pack.attachment, 0, [0, 0, 0]), false);
  const candidates: Attachment[] = [];
  for (const target of targets) {
    for (const anchor of anchors) {
      if (!isConnection(target.edge, anchor.edge)) continue;
      const rotation = normalizeDirection(target.globalDirection + 3 - anchor.edge.direction);
      const origin = subtract(
        add(target.coords, directionCube(target.globalDirection)),
        rotate(anchor.coords, rotation),
      );
      const attachment = place(pack.attachment, rotation, origin);
      if (attachment.hexes.some((hex) => occupied.has(cubeKey(hex.coords)))) continue;
      let contacts = 0;
      let compatible = true;
      for (const border of anchors) {
        const coords = add(rotate(border.coords, rotation), origin);
        const direction = normalizeDirection(border.edge.direction + rotation);
        const neighbor = occupied.get(cubeKey(add(coords, directionCube(direction))));
        if (neighbor === undefined) continue;
        const other = requiredEdge(
          startEdges,
          neighbor,
          normalizeDirection(direction + 3 - startRotation),
        );
        if (!canMatch(other, border.edge)) {
          compatible = false;
          break;
        }
        contacts++;
      }
      if (compatible)
        candidates.push({
          rotation,
          origin,
          target: { hex: target.edge.hex, direction: target.edge.direction },
          anchor: { hex: anchor.edge.hex, direction: anchor.edge.direction },
          openEdgeCount: targets.length + anchors.length - 2 * contacts,
        });
    }
  }
  return candidates;
}

export function composeGeometry(pack: GeometryPack, startRotation: number, placementIndex: number) {
  if (!Number.isSafeInteger(placementIndex) || placementIndex < 0)
    throw new Error('Indice della giunzione non valido.');
  const candidate = enumerateAttachments(pack, startRotation)[placementIndex];
  if (!candidate) throw new Error('La giunzione selezionata non esiste.');
  const start = place(pack.start, startRotation, [0, 0, 0]);
  const attachment = place(pack.attachment, candidate.rotation, candidate.origin);
  const tiles = [start, attachment];
  const connections = new Map<string, [string, string]>();
  const connect = (a: string, b: string) => {
    const pair: [string, string] = a < b ? [a, b] : [b, a];
    connections.set(JSON.stringify(pair), pair);
  };
  for (const tile of [pack.start, pack.attachment])
    for (const [a, b] of tile.links) connect(`${tile.id}:${a}`, `${tile.id}:${b}`);
  const edgeIndices = [edgeIndex(pack.start), edgeIndex(pack.attachment)];
  const occupied = new Map(
    tiles.flatMap((tile, tileIndex) =>
      tile.hexes.map(
        (hex, index) =>
          [
            cubeKey(hex.coords),
            {
              ...hex,
              index,
              tileIndex,
              rotation: tile.rotation,
              spaceId: `${tile.id}:${hex.space}`,
            },
          ] as const,
      ),
    ),
  );
  // CalculateConnectedSpaces considers every neighboring casella, including
  // neighbors within one tile. Optional missing interior edges mean no passage.
  for (const hex of occupied.values()) {
    for (let direction = 0; direction < 6; direction++) {
      const neighbor = occupied.get(cubeKey(add(hex.coords, directionCube(direction))));
      if (!neighbor || hex.spaceId === neighbor.spaceId) continue;
      const a = edgeIndices[hex.tileIndex]!.get(
        edgeKey(hex.index, normalizeDirection(direction - hex.rotation)),
      );
      const b = edgeIndices[neighbor.tileIndex]!.get(
        edgeKey(neighbor.index, normalizeDirection(direction + 3 - neighbor.rotation)),
      );
      if (a && b && isConnection(a, b)) connect(hex.spaceId, neighbor.spaceId);
    }
  }
  const graph = [...connections.values()].sort(([a, b], [c, d]) =>
    a < c ? -1 : a > c ? 1 : b < d ? -1 : b > d ? 1 : 0,
  );
  const spaces = [pack.start, pack.attachment].flatMap((tile, tileIndex) =>
    tile.spaces.map((space, index) => {
      const id = `${tile.id}:${index}`;
      return {
        id,
        ...space,
        hexes: tiles[tileIndex]!.hexes.filter((hex) => hex.space === index).map(
          (hex) => hex.coords,
        ),
        connected: graph.flatMap(([a, b]) => (a === id ? [b] : b === id ? [a] : [])).sort(),
      };
    }),
  );
  return {
    formatVersion: 1,
    scope: 'geometry-only',
    pack,
    packHash: createHash('sha256').update(JSON.stringify(pack)).digest('hex'),
    placementIndex,
    tiles,
    spaces,
    connections: graph,
  };
}
