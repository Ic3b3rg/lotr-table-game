import type { World } from './state';
import { spaceId, type calculateGraph } from './graph';

type MovementProvenance =
  | {
      kind: 'intra-tile-authoring';
      tileSource: string;
      spaceIndices: [number, number];
      spaceSources: [string, string];
    }
  | { kind: 'inter-tile-contact'; contactIndex: number };
type MovementEdge = { a: string; b: string; provenance: MovementProvenance[] };
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Validated, realized geometry only. Called after the source clock is finished. */
export function calculateMovementGraph(
  world: World,
  source: ReturnType<typeof calculateGraph>,
  geometryFingerprint: string,
) {
  const spaces = source.spaces.map(({ id, source, tileSource, sectionId, index }) => ({
    id,
    source,
    tileSource,
    sectionId,
    index,
    connected: [] as string[],
  }));
  const byId = new Map(spaces.map((s) => [s.id, s])),
    connections = new Map<string, MovementEdge>();
  const connect = (from: string, to: string, proof: MovementProvenance) => {
    const a = from < to ? from : to,
      b = from < to ? to : from;
    const key = JSON.stringify([a, b]);
    const existing = connections.get(key);
    if (existing) existing.provenance.push(proof);
    else connections.set(key, { a, b, provenance: [proof] });
  };
  for (const section of world.sections)
    for (const tile of section.tiles)
      tile.shape.spaces.forEach((space, index) => {
        // Reciprocity, range and uniqueness were checked before source selection.
        for (const neighbor of space.serializedConnectedSpaces)
          if (index < neighbor)
            connect(spaceId(tile, index), spaceId(tile, neighbor), {
              kind: 'intra-tile-authoring',
              tileSource: tile.shape.source,
              spaceIndices: [index, neighbor],
              spaceSources: [space.source, tile.shape.spaces[neighbor]!.source],
            });
      });
  source.contacts.forEach((contact, contactIndex) => {
    if (contact.traversable && contact.allowed)
      connect(contact.a.spaceId, contact.b.spaceId, {
        kind: 'inter-tile-contact',
        contactIndex,
      });
  });
  const edges = [...connections.values()].sort((x, y) => compare(x.a, y.a) || compare(x.b, y.b));
  for (const { a, b } of edges) {
    byId.get(a)!.connected.push(b);
    byId.get(b)!.connected.push(a);
  }
  for (const s of spaces) s.connected.sort(compare);
  const components: string[][] = [],
    visited = new Set<string>();
  for (const space of spaces) {
    if (visited.has(space.id)) continue;
    const queue = [space.id];
    visited.add(space.id);
    for (let i = 0; i < queue.length; i++)
      for (const neighbor of byId.get(queue[i]!)!.connected)
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
    components.push(queue);
  }
  return {
    formatVersion: 1 as const,
    algorithm: 'authoring-and-traversable-contacts-v1' as const,
    provenance: {
      sourceVersion: world.input.geometry.provenance.sourceVersion,
      geometryFingerprint,
    },
    runtimeReady: false as const,
    spaces,
    edges,
    components,
    wholeMapReachable: components.length === 1,
    connectionCount: edges.length,
  };
}
export type MovementGraph = ReturnType<typeof calculateMovementGraph>;
