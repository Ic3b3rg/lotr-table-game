import { add, cubeKey, directionCube, normalizeDirection } from '../map-geometry/model';
import { canMatch, isConnection } from '../map-geometry/geometry';
import type { World, Hex, TileState } from './state';
import { composite, getEdge, occupancy, tilePoint } from './state';
import { transform } from './physical';
import type { Observe } from './execution';
import { allowed } from './section-layout';

export const spaceId = (tile: TileState, index: number) => `${tile.shape.source}/space/${index}`;
export function calculateGraph(w: World, o: Observe) {
  const spaces = w.sections.flatMap((s) =>
    s.tiles.flatMap((tile) =>
      tile.shape.spaces.map((space, index) => ({
        id: spaceId(tile, index),
        source: space.source,
        sectionId: s.id,
        tileSource: tile.shape.source,
        index,
        traits: space.traits,
        hasDarkness: space.hasDarkness,
        encounterId: -1 as const,
        hexes: tile.shape.hexes.flatMap((h, i) => (h.space === index ? [tile.globals[i]!] : [])),
        nodePosition: tilePoint(w, tile, transform([0, 0, 0], space.nodeAnchor)),
        connected: [] as string[],
      })),
    ),
  );
  const byId = new Map(spaces.map((s) => [s.id, s])),
    occupied = occupancy(w.sections);
  const endpoint = (h: Hex, direction: number) => ({
    sectionId: h.section.id,
    tileSource: h.tile.shape.source,
    hashId: h.tile.shape.hashId,
    hex: h.index,
    coords: h.coords,
    tileCoords: h.tile.shape.hexes[h.index]!.coords,
    direction,
    intrinsicDirection: normalizeDirection(direction - composite(w, h.tile)),
    spaceId: spaceId(h.tile, h.tile.shape.hexes[h.index]!.space),
  });
  const contacts: {
    a: ReturnType<typeof endpoint>;
    b: ReturnType<typeof endpoint>;
    edges: [ReturnType<typeof getEdge> | null, ReturnType<typeof getEdge> | null];
    compatible: boolean;
    traversable: boolean;
    allowed: boolean;
  }[] = [];
  const seen = new Set<string>();
  for (const hex of occupied.values())
    for (let direction = 0; direction < 6; direction++) {
      o.tick('graph-neighbor');
      const neighbor = occupied.get(cubeKey(add(hex.coords, directionCube(direction))));
      if (!neighbor) continue;
      const a = endpoint(hex, direction),
        b = endpoint(neighbor, normalizeDirection(direction + 3));
      const ours = getEdge(hex.tile, hex.index, a.intrinsicDirection),
        other = getEdge(neighbor.tile, neighbor.index, b.intrinsicDirection);
      const traversal = !!ours && !!other && isConnection(ours, other);
      if (hex.tile !== neighbor.tile) {
        const key = [`${a.tileSource}:${a.hex}`, `${b.tileSource}:${b.hex}`].sort().join('|');
        if (!seen.has(key)) {
          seen.add(key);
          contacts.push({
            a,
            b,
            edges: [ours ?? null, other ?? null],
            compatible: !!ours && !!other && canMatch(ours, other),
            traversable: traversal,
            allowed: a.sectionId === b.sectionId || allowed(w, a.sectionId, b.sectionId),
          });
        }
      }
      if (a.spaceId === b.spaceId) continue;
      const as = byId.get(a.spaceId)!,
        bs = byId.get(b.spaceId)!;
      if (as.connected.includes(bs.id) && bs.connected.includes(as.id)) continue;
      if (traversal) {
        if (!as.connected.includes(bs.id)) as.connected.push(bs.id);
        if (!bs.connected.includes(as.id)) bs.connected.push(as.id);
      }
    }
  const components: string[][] = [],
    visited = new Set<string>();
  for (const space of spaces)
    if (!visited.has(space.id)) {
      const component: string[] = [],
        queue = [space.id];
      visited.add(space.id);
      for (let i = 0; i < queue.length; i++) {
        const id = queue[i]!;
        component.push(id);
        for (const n of byId.get(id)!.connected)
          if (!visited.has(n)) {
            visited.add(n);
            queue.push(n);
          }
      }
      components.push(component);
    }
  const sourceSectionCheck = w.sections.map((s) => ({
    sectionId: s.id,
    connected: spaces.some((space) => space.sectionId === s.id && space.connected.length > 0),
  }));
  const requiredJoins = w.input.selection.requiredConnections.map(([a, b], index) => ({
    index,
    sections: [a, b],
    connected: contacts.some(
      (c) =>
        c.traversable &&
        ((c.a.sectionId === a && c.b.sectionId === b) ||
          (c.a.sectionId === b && c.b.sectionId === a)),
    ),
  }));
  const joins = contacts.filter((c) => c.traversable);
  return {
    spaces,
    contacts,
    graph: {
      sourceSectionCheck,
      requiredJoins,
      joins,
      components,
      wholeMapReachable: components.length === 1,
      reachableFromFirstSpace: components[0] ?? [],
      connectionCount: spaces.reduce((n, s) => n + s.connected.length, 0) / 2,
    },
  };
}
