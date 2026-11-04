import { z } from 'zod';
import { HashSchema, SourceSchema } from './generated-map';
import { ContentIdSchema } from './catalog';
import { StatSchema } from './skill-tests';

const binding = z.string().min(1).max(150);
export const RoundSourceSchema = z.strictObject({
  version: z.literal('source-rounds-v1'),
  projectionFingerprint: HashSchema,
  evidenceHash: HashSchema,
  controller: z.strictObject({
    assemblyHash: HashSchema,
    method: z.string().regex(/^06[0-9a-f]{6}$/),
    bodyHash: HashSchema,
  }),
  configuration: z.strictObject({
    difficulty: z.literal('normal'),
    mapType: z.literal('journey'),
    disableDarkness: z.boolean(),
    initialEnemyGroups: z.array(SourceSchema).max(100),
  }),
  bindings: z.strictObject({
    round: binding,
    threat: binding,
    darkness: binding,
    darknessOverride: binding,
  }),
  events: z.strictObject({ end: binding, start: binding }),
  threat: z.strictObject({
    perHero: z.int().min(0).max(10),
    perToken: z.int().min(0).max(10),
    perUnexploredTile: z.int().min(0).max(10),
    limit: z.int().positive().max(999),
  }),
  darkness: z.strictObject({
    amount: z.int().min(1).max(56),
    negate: StatSchema,
    face: z.enum(['faceup', 'facedown']),
    tokenPrefabs: z.array(SourceSchema).max(100),
    spaces: z
      .array(
        z.strictObject({
          id: z.string().min(1).max(200),
          source: SourceSchema,
          hasDarkness: z.boolean(),
          evidenceHash: HashSchema,
        }),
      )
      .max(1000),
  }),
});
export type RoundSource = z.infer<typeof RoundSourceSchema>;
export const SourceRoundStateSchema = z.strictObject({
  version: z.literal('source-rounds-v1'),
  active: z.uuid().nullable(),
  frames: z
    .array(
      z.strictObject({
        id: z.uuid(),
        roundId: z.uuid(),
        number: z.int().positive(),
        stage: z.enum([
          'enemies',
          'darkness',
          'events',
          'threat',
          'thresholds',
          'reset',
          'rally',
          'complete',
        ]),
        activated: z.array(z.string().max(350)).max(100).optional(),
        refreshed: z.array(z.string().max(350)).max(100).optional(),
        dispatch: z
          .strictObject({
            targets: z.array(z.string().max(200)).max(600),
            event: z.string().max(100),
            index: z.int().nonnegative(),
            waiting: z.string().max(200).nullable(),
          })
          .nullable()
          .optional(),
        threshold: z.string().max(160).nullable().optional(),
        handled: z.array(z.string().max(160)).max(100).optional(),
        darknessHeroes: z.array(ContentIdSchema).max(5),
        threat: z
          .strictObject({
            before: z.int().nonnegative(),
            heroes: z.int().min(1).max(5),
            tokens: z.array(z.string().max(200)).max(600),
            tiles: z.array(SourceSchema).max(200),
            delta: z.int().nonnegative(),
            after: z.int().nonnegative(),
          })
          .nullable(),
      }),
    )
    .max(1000),
});
