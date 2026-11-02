import { z } from 'zod';
import { transform } from './physical';
import { parseSelectionInput } from '../map-selection/model';
import { add, cubeKey, DIRECTIONS, edgeKey } from '../map-geometry/model';

const ref = z
  .string()
  .max(160)
  .regex(/^[\w.-]+:-?[1-9][0-9]*$/);
const int32 = z.int().min(-2147483648).max(2147483647);
const f32 = z
  .number()
  .min(-1e6)
  .max(1e6)
  .refine((n) => Math.fround(n) === n, 'Richiesto float32.');
const vector = z.tuple([f32, f32, f32]);
const renderVector = z.tuple([
  z.number().min(-1e6).max(1e6),
  z.number().min(-1e6).max(1e6),
  z.number().min(-1e6).max(1e6),
]);
const coordinate = z.int().min(-512).max(512);
const cube = z
  .tuple([coordinate, coordinate, coordinate])
  .refine(([x, y, z]) => x + y + z === 0, 'Somma cubica diversa da zero.');
const frame = z.strictObject({
  source: ref,
  position: vector,
  rotation: z
    .tuple([f32, f32, f32, f32])
    .refine(
      (q) => Math.abs(q.reduce((s, v) => s + v * v, 0) - 1) < 1e-5,
      'Quaternion non unitario.',
    ),
  scale: vector.refine((s) => s.every((v) => v > 0 && v <= 100), 'Scala non valida.'),
});
const frames = z.array(frame).min(1).max(32);
export type Frame = z.infer<typeof frame>;
export type Vector = [number, number, number];
const pair = z.tuple([z.int().min(0).max(3), z.int().min(0).max(3)]);
const geometrySchema = z.strictObject({
  formatVersion: z.literal(1),
  algorithm: z.literal('source-map-geometry-pack-v1'),
  provenance: z.strictObject({
    sourceVersion: z.string().min(1).max(200),
    files: z
      .array(
        z.strictObject({
          file: z
            .string()
            .regex(/^[\w.-]+$/)
            .max(100),
          sha256: z.string().regex(/^[a-f0-9]{64}$/),
        }),
      )
      .min(1)
      .max(100),
  }),
  mapPosition: vector,
  cornerCos: z.array(f32.min(-1).max(1)).length(6),
  cornerSin: z.array(f32.min(-1).max(1)).length(6),
  sections: z
    .array(
      z.strictObject({
        id: z.int().min(0).max(3),
        source: ref,
        position: vector,
        tileClumpFactor: f32.min(0).max(1),
        sectionClumpFactor: f32.min(0).max(1),
        authoring: frames,
      }),
    )
    .length(4),
  invalidConnections: z.array(pair).max(100),
  tiles: z
    .array(
      z.strictObject({
        source: ref,
        modelSource: ref,
        hashId: int32,
        resetPosition: vector,
        authoring: frames,
        spaces: z
          .array(
            z.strictObject({
              source: ref,
              traits: int32,
              hasDarkness: z.boolean(),
              nodeAnchor: frames,
              serializedConnectedSpaces: z.array(z.int().min(0).max(31)).max(32),
            }),
          )
          .min(1)
          .max(32),
        hexes: z
          .array(
            z.strictObject({
              source: ref,
              coords: cube,
              space: z.int().min(0).max(31),
              transform: frames,
              meshSource: ref,
              bounds: z.strictObject({
                center: vector,
                extents: vector.refine((v) => v.every((n) => n >= 0), 'Bounds negativi.'),
              }),
              render: z.strictObject({
                polygon: z.array(renderVector).max(64),
                uv: z
                  .array(z.tuple([z.number().min(-100).max(100), z.number().min(-100).max(100)]))
                  .max(64),
              }),
            }),
          )
          .min(1)
          .max(32),
        edges: z
          .array(
            z.strictObject({
              source: ref,
              hex: z.int().min(0).max(31),
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
            }),
          )
          .min(1)
          .max(192),
        render: z.strictObject({
          imagePath: z.string().max(1500),
          uvAffine: z.array(z.array(z.number().min(-1e6).max(1e6)).length(3)).max(2),
        }),
      }),
    )
    .min(1)
    .max(240),
});
const contextSchema = z.strictObject({
  stage: z.string().min(1).max(80),
  site: z.string().min(1).max(80),
  operation: z.int().min(0).max(10000000),
  samples: z.int().min(0),
  depth: z.int().min(0).max(4),
});
export const ClockObservationSchema = contextSchema.extend({
  ordinal: z.int().min(0).max(200000),
  elapsedMilliseconds: z.number().min(0).max(86400000),
  timeout: z.boolean(),
});
export type ClockContext = z.infer<typeof contextSchema>;
export type ClockObservation = z.infer<typeof ClockObservationSchema>;
const timeout = z.number().min(1).max(86400000);
const clock = z.discriminatedUnion('policy', [
  z.strictObject({
    policy: z.literal('logical-clock-v1'),
    stepMilliseconds: z.number().min(0).max(100000),
    timeoutMilliseconds: timeout,
  }),
  z.strictObject({ policy: z.literal('monotonic-clock-v1'), timeoutMilliseconds: timeout }),
  z.strictObject({
    policy: z.literal('replay-clock-v1'),
    timeoutMilliseconds: timeout,
    observations: z.array(ClockObservationSchema).max(200000),
  }),
]);
const inputSchema = z.strictObject({
  formatVersion: z.literal(1),
  algorithm: z.literal('source-map-assembly-v1'),
  selection: z.unknown(),
  geometry: geometrySchema,
  execution: z.strictObject({
    clock,
    maxOperations: z.int().min(1).max(10000000),
    maxTraceEvents: z.int().min(1).max(200000),
  }),
});
export type GeometryPack = z.infer<typeof geometrySchema>;
export type Shape = GeometryPack['tiles'][number];
export type PhysicalEdge = Shape['edges'][number];
export class InputError extends Error {}

/** Clone, bound and validate every reference before any RNG or search is trusted. */
export function parseAssemblyInput(value: unknown) {
  const p = inputSchema.parse(value),
    selection = parseSelectionInput(p.selection),
    g = p.geometry;
  const fail = (s: string): never => {
    throw new InputError(`Input: ${s}`);
  };
  const unique = (values: unknown[], label: string) => {
    if (new Set(values).size !== values.length) fail(`Duplicato ${label}.`);
  };
  unique(
    g.provenance.files.map((f) => f.file),
    'file',
  );
  unique(
    g.tiles.map((t) => t.source),
    'prefab',
  );
  if (g.provenance.sourceVersion !== selection.provenance.sourceVersion)
    fail('Versione fonte incompatibile.');
  const files = new Map(g.provenance.files.map((f) => [f.file, f.sha256]));
  for (const f of selection.provenance.files)
    if (files.get(f.file) !== f.sha256) fail('Provenienza incompatibile con la selezione.');
  const checkRef = (r: string) => {
    if (!files.has(r.slice(0, r.lastIndexOf(':')))) fail(`File non dichiarato: ${r}.`);
  };
  const boundedPoint = (point: Vector) => {
    if (point.some((n) => !Number.isFinite(n) || Math.abs(n) > 1e6))
      fail('Composizione Transform fuori dai limiti numerici del port.');
  };
  const checkFrames = (fs: Frame[]) => {
    fs.forEach((f) => checkRef(f.source));
    for (const p of [
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ] satisfies Vector[])
      boundedPoint(transform(p, fs));
  };
  const models = new Map([...selection.standard, ...selection.custom].map((t) => [t.source, t]));
  const owned = new Set(
    selection.products
      .filter((p) => selection.context.ownedProductIds.includes(p.id))
      .flatMap((p) => p.tileCodes),
  );
  for (const t of models.values())
    if (owned.has(t.code) && !g.tiles.some((s) => s.source === t.source))
      fail(`Geometria posseduta assente: ${t.source}.`);
  g.sections.forEach((s, i) => {
    if (s.id !== i || s.source !== selection.sections[i]!.source)
      fail('Ordine/riferimento sezione incompatibile.');
    checkRef(s.source);
    checkFrames(s.authoring);
  });
  for (const t of g.tiles) {
    checkRef(t.source);
    checkRef(t.modelSource);
    checkFrames(t.authoring);
    if (t.authoring[0]!.scale.some((n) => n !== 1))
      fail('Scala root non supportata da portable-transform-f32-v1.');
    const m = models.get(t.source);
    if (
      !m ||
      m.hashId !== t.hashId ||
      m.modelSource !== t.modelSource ||
      m.spaces.length !== t.spaces.length
    )
      fail(`Identità forma incompatibile: ${t.source}.`);
    t.spaces.forEach((s, i) => {
      if (s.source !== m!.spaces[i]!.source || s.traits !== m!.spaces[i]!.traits)
        fail('Casella incompatibile.');
      checkRef(s.source);
      checkFrames(s.nodeAnchor);
      unique(s.serializedConnectedSpaces, 'link serializzato');
      if (s.serializedConnectedSpaces.some((n) => n >= t.spaces.length || n === i))
        fail('Link serializzato non risolto.');
    });
    unique(
      t.hexes.map((h) => h.source),
      'esagono',
    );
    unique(
      t.hexes.map((h) => cubeKey(h.coords)),
      'cubo',
    );
    if (!t.hexes.some((h) => cubeKey(h.coords) === '0,0,0')) fail('Origine forma assente.');
    if (t.hexes.some((h) => h.space >= t.spaces.length)) fail('Casella esagono non risolta.');
    const connected = (hexes: typeof t.hexes) => {
      if (!hexes.length) return false;
      const unseen = new Set(hexes.map((h) => cubeKey(h.coords))),
        stack = [hexes[0]!.coords];
      unseen.delete(cubeKey(stack[0]!));
      while (stack.length) {
        const c = stack.pop()!;
        for (const d of DIRECTIONS) {
          const n = add(c, d);
          if (unseen.delete(cubeKey(n))) stack.push(n);
        }
      }
      return unseen.size === 0;
    };
    if (
      !connected(t.hexes) ||
      t.spaces.some((_, i) => !connected(t.hexes.filter((h) => h.space === i)))
    )
      fail('Forma/casella non contigua.');
    const cubes = new Set(t.hexes.map((h) => cubeKey(h.coords))),
      edges = new Set<string>();
    unique(
      t.edges.map((e) => e.source),
      'bordo',
    );
    for (const e of t.edges) {
      checkRef(e.source);
      const k = edgeKey(e.hex, e.direction);
      if (e.hex >= t.hexes.length || edges.has(k)) fail('Bordo duplicato/non risolto.');
      edges.add(k);
    }
    t.hexes.forEach((h, i) => {
      checkRef(h.source);
      checkRef(h.meshSource);
      checkFrames(h.transform);
      for (let d = 0; d < 6; d++)
        boundedPoint(
          transform(
            [
              Math.fround(h.bounds.extents[1] * g.cornerCos[d]!),
              Math.fround(h.bounds.extents[1] * g.cornerSin[d]!),
              0,
            ],
            h.transform,
          ),
        );
      if (h.render.polygon.length !== h.render.uv.length)
        fail('Poligono/UV di rendering incompatibili.');
      for (let d = 0; d < 6; d++)
        if (!cubes.has(cubeKey(add(h.coords, DIRECTIONS[d]!))) && !edges.has(edgeKey(i, d)))
          fail('Bordo esterno assente.');
    });
  }
  return { ...p, selection };
}
export type AssemblyInput = ReturnType<typeof parseAssemblyInput>;
