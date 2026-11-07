import { z } from 'zod';
import { AssetNameSchema, ContentIdSchema } from './catalog';
import type { Preparation } from './preparation';
import type { Round } from './rounds';

export const SpaceIdSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9:_-]+$/);
const PointSchema = z.strictObject({
  x: z.number().min(0).max(8192),
  y: z.number().min(0).max(8192),
});
export const JourneyDefinitionSchema = z
  .strictObject({
    id: ContentIdSchema,
    label: z.string().min(1).max(120),
    topology: z.literal('battle').optional(),
    walls: z
      .array(z.strictObject({ id: z.string().max(100), a: PointSchema, b: PointSchema }))
      .max(20)
      .optional(),
    source: z.strictObject({
      name: z.string().min(1).max(200),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
      reference: z.string().min(1).max(1500),
    }),
    width: z.int().min(64).max(8192),
    height: z.int().min(64).max(8192),
    image: AssetNameSchema.optional(),
    startSpaceId: SpaceIdSchema,
    spaces: z
      .array(
        z.strictObject({
          id: SpaceIdSchema,
          label: z.string().min(1).max(120),
          ...PointSchema.shape,
          hexes: z
            .array(
              z.strictObject({ ...PointSchema.shape, polygon: z.array(PointSchema).min(4).max(6) }),
            )
            .min(1)
            .max(32),
        }),
      )
      .min(1)
      .max(200),
    connections: z.array(z.tuple([SpaceIdSchema, SpaceIdSchema])).max(1000),
  })
  .superRefine((map, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
    const ids = new Set(map.spaces.map((space) => space.id));
    if (ids.size !== map.spaces.length || !ids.has(map.startSpaceId))
      fail('Caselle duplicate o partenza assente.');
    const edges = new Set<string>();
    for (const [a, b] of map.connections) {
      const key = JSON.stringify([a, b].sort());
      if (!ids.has(a) || !ids.has(b) || a === b || edges.has(key))
        fail('Collegamenti della mappa non validi.');
      edges.add(key);
    }
    for (const space of map.spaces) {
      if (space.hexes.some((h) => h.polygon.length !== (map.topology === 'battle' ? 4 : 6)))
        fail('Poligono diverso dalla topologia attestata.');
      const points = [space, ...space.hexes.flatMap((hex) => [hex, ...hex.polygon])];
      if (points.some((point) => point.x > map.width || point.y > map.height))
        fail('Geometria fuori dai limiti della mappa.');
    }
  });
export type JourneyDefinition = z.infer<typeof JourneyDefinitionSchema>;
export const JourneyPlanSchema = z.strictObject({
  definition: JourneyDefinitionSchema,
  hash: z.string().regex(/^[a-f0-9]{64}$/),
});
export type JourneyPlan = z.infer<typeof JourneyPlanSchema>;
export const JourneySchema = z.strictObject({
  id: z.uuid(),
  definition: JourneyDefinitionSchema,
  heroes: z
    .array(
      z.strictObject({
        heroId: ContentIdSchema,
        spaceId: SpaceIdSchema,
        removed: z.literal(true).optional(),
      }),
    )
    .min(2)
    .max(5),
  travel: z
    .strictObject({
      roundId: z.uuid(),
      turnId: z.uuid(),
      heroId: ContentIdSchema,
      remaining: z.int().min(0).max(4),
    })
    .nullable(),
});
export type Journey = z.infer<typeof JourneySchema>;

export function adjacent(map: JourneyDefinition, from: string, to: string): boolean {
  return map.connections.some(([a, b]) => (a === from && b === to) || (a === to && b === from));
}

export function journeyProblem(
  journey: Journey | null,
  preparation: Preparation | null,
  round: Round | null,
): string | null {
  if (!journey) return null;
  const ids = preparation?.heroes.map((hero) => hero.heroId) ?? [];
  if (
    preparation?.status !== 'prepared' ||
    journey.heroes.length !== ids.length ||
    new Set(journey.heroes.map((hero) => hero.heroId)).size !== ids.length ||
    journey.heroes.some(
      (hero) =>
        !ids.includes(hero.heroId) ||
        !journey.definition.spaces.some((space) => space.id === hero.spaceId),
    )
  )
    return 'Posizioni della compagnia non coerenti con la mappa.';
  const travel = journey.travel;
  if (
    travel &&
    (!round ||
      round.phase !== 'action' ||
      round.id !== travel.roundId ||
      round.turnId !== travel.turnId ||
      round.activeHeroId !== travel.heroId ||
      (round.heroes.find((hero) => hero.heroId === travel.heroId)?.actionsUsed ?? 0) < 1 ||
      travel.remaining >
        (round.heroes.find((hero) => hero.heroId === travel.heroId)?.actionsUsed ?? 0) * 2)
  )
    return 'Movimenti residui non coerenti con il turno.';
  return null;
}
