import { z } from 'zod';
import { HashSchema, SourceSchema, VectorSchema } from './generated-map';

const count = z.int().min(0).max(10000);
export const DeploymentSourceSchema = z.strictObject({
  version: z.literal('source-deployment-v1'),
  files: z
    .array(z.strictObject({ file: z.string().max(150), sha256: HashSchema }))
    .min(1)
    .max(10),
  products: z.array(SourceSchema).min(1).max(10),
  adventure: SourceSchema,
  language: z.literal('Italian'),
  mechanics: z.strictObject({
    assemblyHash: HashSchema,
    method: z.string().regex(/^06[0-9a-f]{6}$/),
    bodyHash: HashSchema,
    maxBonusCount: count.max(10),
    normalBanners: z.array(count).max(32),
    eliteBanners: z.array(count).max(32),
  }),
  assets: z
    .array(
      z.strictObject({
        source: SourceSchema,
        cls: z.enum(['ProductModel', 'AdventureModel', 'EnemyModel', 'EnemyBonusModel']),
        objectHash: HashSchema,
        dataHash: HashSchema,
        data: z.record(z.string(), z.json()),
      }),
    )
    .min(1)
    .max(128),
  texts: z.record(z.string().max(200), z.string().max(10000)),
});
export type DeploymentSource = z.infer<typeof DeploymentSourceSchema>;

export const DeployedGroupSchema = z.strictObject({
  id: z.string().min(1).max(300),
  source: SourceSchema,
  bonuses: z.array(SourceSchema).max(10),
  tokenId: z.int().min(-1).max(100),
  exhausted: z.boolean(),
  attackReduction: count.optional(),
  logic: SourceSchema.nullable(),
  placed: z.boolean(),
  removed: z.literal('timer').optional(),
  spaceId: z.string().max(200),
  tileSource: SourceSchema,
  position: VectorSchema,
  figures: z
    .array(
      z.strictObject({
        id: z.string().max(350),
        health: count,
        armor: count,
        sorcery: count,
      }),
    )
    .min(1)
    .max(3),
});
export type DeployedGroup = z.infer<typeof DeployedGroupSchema>;

export const DeploymentStateSchema = z.strictObject({
  entropy: HashSchema.nullable(),
  cursor: count,
  groups: z.array(DeployedGroupSchema).max(100),
  attempts: z
    .array(
      z.strictObject({
        effectId: z.string().max(300),
        groups: z.array(z.string().max(300)).max(100),
        remaining: count,
        reason: z.enum(['no-budget', 'no-space', 'no-eligible-model']).nullable(),
        draws: z
          .array(
            z.strictObject({
              kind: z.string().max(30),
              population: z.array(z.string().max(300)).max(1000),
              value: z.number().finite(),
              cursor: count,
            }),
          )
          .max(2000),
      }),
    )
    .max(100),
});
