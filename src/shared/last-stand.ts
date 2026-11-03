import { z } from 'zod';
import { ContentIdSchema } from './catalog';
import { HashSchema } from './generated-map';
import { StatSchema } from './skill-tests';
export const AdventureLossSchema = z.strictObject({
  kind: z.literal('adventure-loss'),
  timing: z.enum(['no-active-heroes', 'shadow-start']),
  runId: z.uuid(),
  heroId: ContentIdSchema,
  instructionHash: HashSchema,
  consumer: z.literal('original-adventure-loss-unavailable'),
});
export const LastStandSelectionSchema = z.strictObject({
  id: z.string().max(300),
  runId: z.uuid(),
  sourceFingerprint: HashSchema,
  heroId: ContentIdSchema,
  family: z.enum(['damage', 'fear']),
  instructionId: z.string().max(200),
  instructionHash: HashSchema,
  stat: StatSchema,
  difficulty: z.int().min(1).max(100001),
  successes: z.int().min(0).max(200).nullable(),
  forcedFailure: z.boolean().nullable(),
  outcome: z.enum(['pass', 'fail']).nullable(),
  returned: z.int().min(0).max(56),
  inspiration: z.int().min(0).max(1),
  titles: z.array(ContentIdSchema).max(2),
});
export const TitleOwnershipSchema = z.strictObject({
  heroId: ContentIdSchema,
  cardId: ContentIdSchema,
  copy: z.string().max(120),
  removed: z.boolean(),
  pending: z.boolean(),
  source: z.string().max(300),
});
export const LastStandSnapshotSchema = z.strictObject({
  version: z.literal(1),
  algorithm: z.literal('sha256-last-stand-counter-rejection-v1'),
  heroes: z
    .array(
      z.strictObject({
        heroId: ContentIdSchema,
        difficulty: z.int().min(1).max(100001),
        defeated: z.boolean(),
      }),
    )
    .min(1)
    .max(5),
  titles: z.array(TitleOwnershipSchema).max(21),
  selections: z.array(LastStandSelectionSchema).max(100000),
  random: z
    .array(
      z.strictObject({
        id: z.string().max(300),
        population: z.array(z.string().max(200)).length(5),
        index: z.int().min(0).max(4),
      }),
    )
    .max(100000),
  rngCursor: z
    .int()
    .min(0)
    .max(100000 * 128),
  lossDue: z
    .strictObject({ runId: z.uuid(), heroId: ContentIdSchema, instructionHash: HashSchema })
    .nullable(),
  terminal: AdventureLossSchema.nullable(),
});
export type LastStandSnapshot = z.infer<typeof LastStandSnapshotSchema>;
export type AdventureLoss = z.infer<typeof AdventureLossSchema>;
export const LastStandViewSchema = z.strictObject({
  heroes: LastStandSnapshotSchema.shape.heroes,
  selections: z
    .array(
      LastStandSelectionSchema.omit({
        id: true,
        sourceFingerprint: true,
        instructionId: true,
        instructionHash: true,
      }).extend({ instruction: z.string().max(16000) }),
    )
    .max(100000),
  titles: z
    .array(
      TitleOwnershipSchema.omit({ source: true }).extend({
        name: z.string().max(1000),
        text: z.string().max(16000),
        prepared: z.boolean(),
      }),
    )
    .max(21),
  lossAtNextShadow: z.boolean(),
  terminal: AdventureLossSchema.omit({ instructionHash: true }).nullable(),
});
