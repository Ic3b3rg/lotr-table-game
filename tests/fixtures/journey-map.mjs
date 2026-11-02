export function journeyMapFixture() {
  const space = (id, x, y) => ({
    id,
    label: `Casella ${id.toUpperCase()}`,
    x,
    y,
    hexes: [
      {
        x,
        y,
        polygon: [
          { x: x - 60, y },
          { x: x - 30, y: y - 50 },
          { x: x + 30, y: y - 50 },
          { x: x + 60, y },
          { x: x + 30, y: y + 50 },
          { x: x - 30, y: y + 50 },
        ],
      },
    ],
  });
  return {
    id: 'invented-journey',
    label: 'Tratto inventato per le prove',
    source: {
      name: 'Invented fixture',
      sha256: 'a'.repeat(64),
      reference: 'Geometria inventata; nessuno scenario originale.',
    },
    width: 1000,
    height: 800,
    startSpaceId: 'a',
    spaces: [
      space('a', 200, 400),
      space('b', 500, 300),
      space('c', 800, 400),
      space('d', 250, 150),
    ],
    connections: [
      ['a', 'b'],
      ['b', 'c'],
    ],
  };
}
