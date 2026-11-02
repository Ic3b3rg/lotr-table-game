// Invented geometry only. Authoring links and explicit interior edges are independent.
import { assemblyFixture } from './map-assembly.mjs';
const directions = [
  [1, -1, 0],
  [0, -1, 1],
  [-1, 0, 1],
  [-1, 1, 0],
  [0, 1, -1],
  [1, 0, -1],
];
export function movementFixture({ authoring = true, interiorEdges = false } = {}) {
  const input = assemblyFixture();
  for (const tile of input.geometry.tiles) {
    if (!authoring) tile.spaces.forEach((s) => (s.serializedConnectedSpaces = []));
    if (!interiorEdges) {
      const occupied = new Set(tile.hexes.map((h) => h.coords.join(',')));
      tile.edges = tile.edges.filter((edge) => {
        const c = tile.hexes[edge.hex].coords;
        return !occupied.has(c.map((n, i) => n + directions[edge.direction][i]).join(','));
      });
    }
  }
  return input;
}
