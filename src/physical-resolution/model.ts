import { z } from 'zod';
import { ContentIdSchema } from '../shared/catalog';
import { HashSchema } from '../shared/generated-map';
import {
  PhysicalActiveSchema,
  PhysicalParentSchema,
  PhysicalProgramSchema,
  PhysicalInputSchema,
} from '../shared/physical';

export const PhysicalBindingSchema = z.strictObject({
  scenarioId: z.uuid(),
  packFingerprint: HashSchema,
  projectionFingerprint: HashSchema,
});
export const PhysicalHeroSchema = z.strictObject({
  heroId: ContentIdSchema,
  playerId: z.uuid(),
  spaceId: z.string().min(1).max(200),
});
export const PhysicalSourceSchema = z.strictObject({
  effectId: z.string().min(1).max(300),
  instanceId: z.string().min(1).max(200),
  state: z.int().nonnegative(),
  entry: z.int().nonnegative(),
  action: z.int().nonnegative(),
  parameterHash: HashSchema,
});
export const PhysicalEvidenceSchema = z.strictObject({
  playerId: z.uuid(),
  requestId: z.string().min(24).max(80),
  pendingId: z.uuid(),
  sourceFingerprint: HashSchema,
  revision: z.int().nonnegative(),
});
const copies = z.array(z.string().min(1).max(100)).max(28);
// Two initial shuffles, then at most two family selections per child of 32 × 32.
const maxRandomRecords = 2 + 32 * 32 * 2;
// Each 28-copy shuffle needs 27 indices, with at most 128 words per index.
const maxRandomWords = maxRandomRecords * 27 * 128;
export const PhysicalSnapshotSchema = z.strictObject({
  decks: z.strictObject({ damage: copies, fear: copies }),
  areas: z
    .array(z.strictObject({ heroId: ContentIdSchema, damage: copies, fear: copies }))
    .min(1)
    .max(5),
  credits: z.array(z.int().min(0).max(32)).max(5),
  rngCursor: z.int().min(0).max(maxRandomWords),
  random: z
    .array(
      z.strictObject({
        id: z.string().max(300),
        population: copies,
        indices: z.array(z.int().min(0).max(27)).max(28),
      }),
    )
    .max(maxRandomRecords),
  parents: z.array(PhysicalParentSchema).max(32),
  active: PhysicalActiveSchema.nullable(),
});
export const PhysicalStateSchema = z.strictObject({
  version: z.literal(1),
  algorithm: z.literal('sha256-counter-rejection-fisher-yates-v1'),
  raw: z.unknown(),
  rawSha256: HashSchema,
  contentFingerprint: HashSchema,
  binding: PhysicalBindingSchema,
  heroes: z.array(PhysicalHeroSchema).min(1).max(5),
  entropy: HashSchema,
  runs: z
    .array(
      z.strictObject({
        id: z.uuid(),
        source: PhysicalSourceSchema,
        program: PhysicalProgramSchema,
        answers: z
          .array(
            z.strictObject({
              child: z.int().min(0).max(31),
              grant: z.int().min(0).max(4).nullable(),
              input: PhysicalInputSchema,
              evidence: PhysicalEvidenceSchema,
            }),
          )
          .max(192),
      }),
    )
    .max(32),
  snapshot: PhysicalSnapshotSchema,
});
export type PhysicalState = z.infer<typeof PhysicalStateSchema>;
export type PhysicalSource = z.infer<typeof PhysicalSourceSchema>;
export type PhysicalSnapshot = z.infer<typeof PhysicalSnapshotSchema>;
export type PhysicalEvidence = z.infer<typeof PhysicalEvidenceSchema>;
export type PhysicalHero = z.infer<typeof PhysicalHeroSchema>;
