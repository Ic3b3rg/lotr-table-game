import { z } from 'zod';
import { CatalogSchema } from '../shared/catalog';
import { PreparationSchema } from '../shared/preparation';
import { PhysicalDecisionSchema } from '../shared/physical';
import { FrontArtifactSchema } from './front-program';
export const FrontResourcesSchema = z.strictObject({
  preparation: PreparationSchema,
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
    .max(100000),
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
        active: PhysicalDecisionSchema,
      }),
    )
    .max(10000),
  operations: z.int().min(0).max(100000),
});
export type FrontResources = z.infer<typeof FrontResourcesSchema>;
export type FrontSnapshot = z.infer<typeof FrontSnapshotSchema>;
