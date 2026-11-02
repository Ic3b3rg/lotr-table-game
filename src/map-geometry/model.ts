import { z } from 'zod';
import { ContentIdSchema } from '../shared/catalog';

export type Cube = [number, number, number];
export const DIRECTIONS: readonly Cube[] = [
  [1, -1, 0],
  [0, -1, 1],
  [-1, 0, 1],
  [-1, 1, 0],
  [0, 1, -1],
  [1, 0, -1],
];
export const cubeKey = (cube: Cube): string => cube.join(',');
export const add = (a: Cube, b: Cube): Cube => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const subtract = (a: Cube, b: Cube): Cube => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const normalizeDirection = (value: number): number => ((value % 6) + 6) % 6;
export function directionCube(direction: number): Cube {
  const cube = DIRECTIONS[direction];
  if (!cube) throw new Error('Direzione del bordo non valida.');
  return cube;
}

const coordinate = z.int().min(-512).max(512);
const CubeSchema = z
  .tuple([coordinate, coordinate, coordinate])
  .refine(([x, y, z]) => x + y + z === 0, 'Le coordinate cubiche devono avere somma zero.');
const EdgeSchema = z.strictObject({
  hex: z.int().min(0),
  direction: z.int().min(0).max(5),
  traits: z.union([
    z.literal(0),
    z.literal(100),
    z.literal(200),
    z.literal(300),
    z.literal(400),
    z.literal(500),
    z.literal(550),
    z.literal(600),
    z.literal(700),
  ]),
  isPassageOpen: z.boolean(),
});
export type Edge = z.infer<typeof EdgeSchema>;
export const edgeKey = (hex: number, direction: number): string => `${hex}:${direction}`;

export const TileGeometrySchema = z
  .strictObject({
    id: ContentIdSchema,
    source: z.string().min(1).max(1500),
    spaces: z
      .array(z.strictObject({ traits: z.int(), hasDarkness: z.boolean() }))
      .min(1)
      .max(32),
    hexes: z
      .array(z.strictObject({ coords: CubeSchema, space: z.int().min(0) }))
      .min(1)
      .max(32),
    edges: z.array(EdgeSchema).min(1).max(192),
    links: z.array(z.tuple([z.int().min(0), z.int().min(0)])).max(496),
  })
  .superRefine((tile, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
    const hexes = new Set(tile.hexes.map((hex) => cubeKey(hex.coords)));
    if (hexes.size !== tile.hexes.length || !hexes.has('0,0,0'))
      fail('Esagoni duplicati o origine assente.');
    const spaces = new Set(tile.hexes.map((hex) => hex.space));
    if (
      spaces.size !== tile.spaces.length ||
      tile.hexes.some((hex) => hex.space >= tile.spaces.length)
    )
      fail('Appartenenza degli esagoni alle caselle non valida.');
    const edges = new Set<string>();
    for (const edge of tile.edges) {
      const key = edgeKey(edge.hex, edge.direction);
      if (edge.hex >= tile.hexes.length || edges.has(key))
        fail('Bordi duplicati o indici non validi.');
      edges.add(key);
    }
    tile.hexes.forEach((hex, index) => {
      DIRECTIONS.forEach((offset, direction) => {
        if (!hexes.has(cubeKey(add(hex.coords, offset))) && !edges.has(edgeKey(index, direction)))
          fail('Bordo esterno non dichiarato.');
      });
    });
    const links = new Set<string>();
    for (const [a, b] of tile.links) {
      const key = JSON.stringify(a < b ? [a, b] : [b, a]);
      if (a === b || a >= tile.spaces.length || b >= tile.spaces.length || links.has(key))
        fail('Collegamenti interni non validi.');
      links.add(key);
    }
  });
export type TileGeometry = z.infer<typeof TileGeometrySchema>;
export const GeometryPackSchema = z
  .strictObject({
    formatVersion: z.literal(1),
    source: z.strictObject({
      name: z.string().min(1).max(200),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
      reference: z.string().min(1).max(1500),
    }),
    start: TileGeometrySchema,
    attachment: TileGeometrySchema,
  })
  .refine(
    (pack) => pack.start.id !== pack.attachment.id,
    'Le forme devono avere identità distinte.',
  );
export type GeometryPack = z.infer<typeof GeometryPackSchema>;
