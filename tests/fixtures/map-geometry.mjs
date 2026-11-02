const cube = [0, 0, 0];
export function tileGeometryFixture(id = 'tile-a', traits = 0, isPassageOpen = true) {
  return {
    id,
    source: 'Invented fixture; not an original tile.',
    spaces: [{ traits: 0, hasDarkness: false }],
    hexes: [{ coords: [...cube], space: 0 }],
    edges: Array.from({ length: 6 }, (_, direction) => ({
      hex: 0,
      direction,
      traits,
      isPassageOpen,
    })),
    links: [],
  };
}
export function geometryPackFixture() {
  return {
    formatVersion: 1,
    source: {
      name: 'Invented geometry fixture',
      sha256: 'a'.repeat(64),
      reference: 'No original adventure data.',
    },
    start: tileGeometryFixture(),
    attachment: tileGeometryFixture('tile-b'),
  };
}
