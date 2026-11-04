import { z } from 'zod';
import { BoonCustodySchema } from '../shared/boons';
import { AttackTestViewSchema } from '../shared/combat';
import { CatalogSchema } from '../shared/catalog';
import { PreparationSchema } from '../shared/preparation';
import { PhysicalActiveSchema, SourceTestViewSchema } from '../shared/physical';
import { FrontArtifactSchema } from './front-program';
export const FrontResourcesSchema = z.strictObject({
  boonCustody: BoonCustodySchema.optional(),
  preparation: PreparationSchema,
  combatUses: z
    .array(
      z.strictObject({
        roundId: z.uuid(),
        heroId: z.string().max(100),
        effectId: z.string().max(350),
      }),
    )
    .max(1000)
    .optional(),
  depletion: z
    .array(z.strictObject({ copy: z.string().max(120), remaining: z.int().min(0).max(10) }))
    .max(15),
  boons: z
    .array(
      z.strictObject({
        heroId: z.string().max(100),
        kind: z.enum(['emboldened', 'hidden', 'determined']),
      }),
    )
    .max(15),
});
export const FrozenFrontsSchema = z.strictObject({
  artifact: FrontArtifactSchema,
  catalog: CatalogSchema,
});
export const FrontSnapshotSchema = z.strictObject({
  boonEvents: z
    .array(
      z.strictObject({
        operation: z.enum(['gain', 'duplicate', 'discard']),
        copyId: z.string().min(1).max(100),
        heroId: z.string().min(1).max(100),
        kind: z.enum(['emboldened', 'determined', 'hidden']),
        source: z.string().min(1).max(3000),
        reason: z.string().min(1).max(100),
      }),
    )
    .max(10000)
    .optional(),
  attackTest: AttackTestViewSchema.nullable().optional(),
  sourceTest: SourceTestViewSchema.nullable().optional(),
  resources: FrontResourcesSchema.nullable(),
  faceup: z.array(z.string().max(100)).max(56),
  frames: z
    .array(
      z.strictObject({
        path: z.string().max(3000),
        heroId: z.string().max(100),
        copy: z.string().max(100).nullable(),
        step: z.string().max(100),
        remaining: z.int().min(0).max(56),
      }),
    )
    .max(10000),
  revealed: z
    .array(
      z.strictObject({ heroId: z.string().max(100), cards: z.array(z.string().max(120)).max(56) }),
    )
    .max(5),
  history: z
    .array(
      z.strictObject({
        runId: z.uuid(),
        answer: z.int().nonnegative(),
        active: PhysicalActiveSchema,
      }),
    )
    .max(100000),
  operations: z.int().min(0).max(100000),
});
export type FrontResources = z.infer<typeof FrontResourcesSchema>;
export type FrontSnapshot = z.infer<typeof FrontSnapshotSchema>;
