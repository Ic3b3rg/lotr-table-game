import { z } from 'zod';
import { ContentIdSchema } from './catalog';
import { HashSchema } from './generated-map';

export const InteractionRulesSchema = z.literal('source-interaction-look-v1');
export const InteractionCoverageSchema = z.strictObject({
  version: InteractionRulesSchema,
  heroes: z
    .array(
      z.strictObject({
        heroId: ContentIdSchema,
        definitionHash: HashSchema,
        capability: z.enum(['look', 'none']),
      }),
    )
    .min(1)
    .max(6),
});
export const BeforeEffectSchema = z.strictObject({
  id: z.string().min(1).max(200),
  kind: z.enum(['look', 'spend', 'inspiration']),
  label: z.string().min(1).max(1000),
});
export const InteractionWindowSchema = z.strictObject({
  runId: z.uuid(),
  child: z.int().min(0).max(31),
  heroId: ContentIdSchema,
  remaining: z.array(BeforeEffectSchema).max(100),
  completed: z.array(z.string().max(200)).max(100),
  activeEffect: z.string().max(200).nullable(),
});
export const PrivateLookResultSchema = z.strictObject({
  runId: z.uuid(),
  child: z.int().min(0).max(31),
  heroId: ContentIdSchema,
  copy: z.string().min(1).max(120),
  skillId: ContentIdSchema,
  fate: z.int().nonnegative(),
  reward: z.int().min(0).max(1),
});
export const PrivateLookViewSchema = z.strictObject({
  pendingId: z.uuid(),
  generation: z.uuid(),
  heroId: ContentIdSchema,
  card: z.strictObject({
    name: z.string().min(1).max(1000),
    text: z.string().max(20000),
    success: z.int().nonnegative(),
    fate: z.int().nonnegative(),
  }),
  reward: z.int().min(0).max(1),
});
export type BeforeEffect = z.infer<typeof BeforeEffectSchema>;
export type PrivateLookView = z.infer<typeof PrivateLookViewSchema>;
