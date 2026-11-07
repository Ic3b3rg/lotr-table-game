import { TitleOwnershipSchema } from '../shared/last-stand';
import { FrozenFrontsSchema, FrontResourcesSchema, FrontSnapshotSchema } from './front-state';
import { z } from 'zod';
import { BoonArtifactSchema } from '../shared/boons';
import { LastStandArtifactSchema } from './last-stand-program';
import { LastStandSnapshotSchema } from '../shared/last-stand';
import { CycleStateSchema } from '../shared/physical-cycle';
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
const copies = z.array(z.string().min(1).max(120)).max(201);
// Two initial shuffles, then at most two family selections per child of 32 × 32.
const maxRandomRecords = 2 + 32 * 32 * 2 + 100000;
// Each 28-copy shuffle needs 27 indices, with at most 128 words per index.
const maxRandomWords = maxRandomRecords * 55 * 128;
export const PhysicalSnapshotSchema = z.strictObject({
  lastStand: LastStandSnapshotSchema.optional(),
  resolution: FrontSnapshotSchema.optional(),
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
        indices: z.array(z.int().min(0).max(200)).max(201),
      }),
    )
    .max(maxRandomRecords),
  parents: z.array(PhysicalParentSchema).max(1000),
  active: PhysicalActiveSchema.nullable(),
});
export const PhysicalStateSchema = z.strictObject({
  episode: z
    .strictObject({
      version: z.literal('camp-departure-v1'),
      titles: z.array(TitleOwnershipSchema).max(21),
    })
    .optional(),
  version: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  cycle: CycleStateSchema.optional(),
  fronts: FrozenFrontsSchema.optional(),
  boons: BoonArtifactSchema.optional(),
  lastStand: LastStandArtifactSchema.optional(),
  lastStandActivation: z
    .discriminatedUnion('kind', [
      z.strictObject({ kind: z.literal('initial-freeze') }),
      z.strictObject({ kind: z.literal('legacy-continuation'), runId: z.uuid() }),
    ])
    .optional(),
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
        executionRules: z.literal('retained-paid-effects-v1').optional(),
        boonRules: HashSchema.optional(),
        lastStandRules: z
          .strictObject({
            version: z.literal('source-last-stand-v1'),
            artifactFingerprint: HashSchema,
          })
          .optional(),
        context: FrontResourcesSchema.optional(),
        spatial: z
          .strictObject({
            heroes: z.array(PhysicalHeroSchema).min(1).max(5),
            connections: z.array(z.tuple([z.string().max(200), z.string().max(200)])).max(1000),
            enemies: z
              .array(
                z.strictObject({
                  id: z.string().min(1).max(350),
                  spaceId: z.string().min(1).max(200),
                }),
              )
              .max(100)
              .optional(),
          })
          .optional(),
        answers: z
          .array(
            z.strictObject({
              cursor: z
                .string()
                .regex(/^[a-f0-9]{64}$/)
                .optional(),
              child: z.int().min(0).max(32),
              grant: z.int().min(0).max(4).nullable(),
              input: PhysicalInputSchema,
              evidence: PhysicalEvidenceSchema,
            }),
          )
          .max(100000),
      }),
    )
    .max(1000),
  snapshot: PhysicalSnapshotSchema,
});
export type PhysicalState = z.infer<typeof PhysicalStateSchema>;
export type PhysicalSource = z.infer<typeof PhysicalSourceSchema>;
export type PhysicalSnapshot = z.infer<typeof PhysicalSnapshotSchema>;
export type PhysicalEvidence = z.infer<typeof PhysicalEvidenceSchema>;
export type PhysicalHero = z.infer<typeof PhysicalHeroSchema>;
