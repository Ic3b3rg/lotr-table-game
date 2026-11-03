import { z } from 'zod';
import { ContentIdSchema } from './catalog';

export const PhysicalFamilySchema = z.enum(['damage', 'fear']);
export const PhysicalCountsSchema = z.strictObject({
  damage: z.int().min(0).max(56),
  fear: z.int().min(0).max(56),
});
const slot = z.int().min(0).max(4);
const amount = z.int().min(0).max(56);
export const PhysicalProgramSchema = z.strictObject({
  profile: z.literal('synthetic-no-abilities-v1'),
  initialCredits: z.array(z.int().min(0).max(32)).min(1).max(5),
  limits: z
    .array(
      z.discriminatedUnion('kind', [
        z.strictObject({
          kind: z.literal('synthetic-fixed'),
          damage: z.int().min(1).max(56),
          fear: z.int().min(1).max(56),
        }),
        z.strictObject({
          kind: z.literal('requires-capability'),
          capability: z.string().min(1).max(100),
        }),
      ]),
    )
    .min(1)
    .max(5),
  children: z
    .array(
      z.discriminatedUnion('kind', [
        z.strictObject({
          kind: z.literal('suffer'),
          hero: slot,
          face: z.enum(['facedown', 'faceup']),
          cards: z
            .array(z.strictObject({ family: PhysicalFamilySchema, amount }))
            .min(1)
            .max(2),
          prevention: z
            .array(
              z.strictObject({
                id: z.string().min(1).max(100),
                actor: slot,
                budget: amount,
                creditCost: z.int().min(0).max(1),
                sameSpace: z.boolean(),
              }),
            )
            .max(5),
        }),
        z.strictObject({
          kind: z.literal('discard'),
          hero: slot,
          count: amount,
          mode: z.enum(['exact', 'upTo']),
          families: z.array(PhysicalFamilySchema).min(1).max(2),
        }),
      ]),
    )
    .min(1)
    .max(32),
});
export const PhysicalInputSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('physical-prevent'), ...PhysicalCountsSchema.shape }),
  z.strictObject({ kind: z.literal('physical-discard'), ...PhysicalCountsSchema.shape }),
]);
const activeBase = {
  runId: z.uuid(),
  child: z.int().min(0).max(32),
  heroId: ContentIdSchema,
  actorHeroId: ContentIdSchema,
  actorPlayerId: z.uuid(),
};
export const PhysicalActiveSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    ...activeBase,
    kind: z.literal('prevent'),
    grant: z.int().min(0).max(4),
    authorizationId: z.string().max(100),
    budget: amount,
    creditCost: z.int().min(0).max(1),
    remaining: PhysicalCountsSchema,
  }),
  z.strictObject({
    ...activeBase,
    kind: z.literal('discard'),
    count: amount,
    minimum: amount,
    available: PhysicalCountsSchema,
    families: z.array(PhysicalFamilySchema).min(1).max(2),
  }),
  z.strictObject({
    ...activeBase,
    kind: z.literal('gate'),
    reason: z.enum([
      'faceup-handler-unavailable',
      'effective-limits-unavailable',
      'last-stand-unavailable',
      'required-deck-empty',
    ]),
    remaining: PhysicalCountsSchema,
    family: PhysicalFamilySchema.nullable(),
    capability: z.string().max(100).nullable(),
  }),
]);
export const PhysicalResultSchema = z.strictObject({
  child: z.int().min(0).max(31),
  kind: z.enum(['suffer', 'discard']),
  heroId: ContentIdSchema,
  prevented: PhysicalCountsSchema,
  transferred: PhysicalCountsSchema,
  returned: PhysicalCountsSchema,
  costs: z
    .array(
      z.strictObject({
        actorHeroId: ContentIdSchema,
        authorizationId: z.string().max(100),
        credits: z.int().min(0).max(1),
      }),
    )
    .max(5),
});
export const PhysicalParentSchema = z.strictObject({
  id: z.uuid(),
  source: z.string().min(1).max(300),
  status: z.enum(['waiting', 'suspended', 'completed']),
  completedChildren: z.int().min(0).max(32),
  totalChildren: z.int().min(1).max(32),
  returnCount: z.int().min(0).max(1),
  results: z.array(PhysicalResultSchema).max(32),
});
export const PhysicalViewSchema = z.strictObject({
  synthetic: z.literal(true),
  decks: PhysicalCountsSchema,
  heroes: z
    .array(z.strictObject({ heroId: ContentIdSchema, facedown: PhysicalCountsSchema }))
    .min(1)
    .max(5),
  active: PhysicalActiveSchema.nullable(),
  parents: z.array(PhysicalParentSchema).max(32),
});
export type PhysicalProgram = z.infer<typeof PhysicalProgramSchema>;
export type PhysicalInput = z.infer<typeof PhysicalInputSchema>;
export type PhysicalActive = z.infer<typeof PhysicalActiveSchema>;
export type PhysicalCounts = z.infer<typeof PhysicalCountsSchema>;
export type PhysicalView = z.infer<typeof PhysicalViewSchema>;
