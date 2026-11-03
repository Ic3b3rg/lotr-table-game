import { z } from 'zod';
import { ContentIdSchema } from './catalog';

export const PhysicalFamilySchema = z.enum(['damage', 'fear']);
export const PhysicalCountsSchema = z.strictObject({
  damage: z.int().min(0).max(56),
  fear: z.int().min(0).max(56),
});
const slot = z.int().min(0).max(4);
const amount = z.int().min(0).max(56);
const LegacyPhysicalProgramSchema = z.strictObject({
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
const FrontChildSchema = z.discriminatedUnion('kind', [
  LegacyPhysicalProgramSchema.shape.children.element.options[0].extend({
    negate: z.enum(['might', 'wisdom', 'agility', 'spirit', 'wit']).optional(),
  }),
  LegacyPhysicalProgramSchema.shape.children.element.options[1],
  z.strictObject({
    kind: z.literal('flip'),
    hero: slot,
    family: PhysicalFamilySchema,
    count: amount,
  }),
  z.strictObject({
    kind: z.literal('turn-down'),
    hero: slot,
    family: PhysicalFamilySchema,
    count: amount,
  }),
  z.strictObject({ kind: z.literal('scout'), hero: slot, count: z.int().min(1).max(5) }),
  z.strictObject({
    kind: z.literal('event'),
    hero: slot,
    event: z.enum([
      'end-own-turn',
      'after-rest',
      'rally-scout',
      'before-interact',
      'during-own-turn',
      'after-darkness-suffering-batch',
    ]),
    threat: z.boolean(),
    sufferedFear: amount,
  }),
]);
export const FrontPhysicalProgramSchema = LegacyPhysicalProgramSchema.extend({
  profile: z.literal('source-fronts-v1'),
  children: z.array(FrontChildSchema).min(1).max(32),
  darknessHeroes: z.array(slot).max(5),
});
export const PhysicalProgramSchema = z.discriminatedUnion('profile', [
  LegacyPhysicalProgramSchema,
  FrontPhysicalProgramSchema,
]);
export const PhysicalInputSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('physical-choice'), option: z.string().min(1).max(200) }),
  z.strictObject({
    kind: z.literal('physical-select'),
    ids: z.array(z.string().min(1).max(200)).max(56),
  }),
  z.strictObject({
    kind: z.literal('physical-allocate'),
    ability: z.string().max(200).nullable(),
    ...PhysicalCountsSchema.shape,
  }),
  z.strictObject({
    kind: z.literal('physical-scout'),
    prepare: z.string().max(120).nullable(),
    discard: z.string().max(120).nullable(),
    top: z.array(z.string().max(120)).max(56),
    bottom: z.array(z.string().max(120)).max(56),
  }),
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
export const PhysicalDecisionSchema = z.strictObject({
  ...activeBase,
  kind: z.literal('decision'),
  cursor: z.string().regex(/^[a-f0-9]{64}$/),
  mode: z.enum(['choose', 'select', 'allocate', 'scout']),
  title: z.string().min(1).max(1000),
  options: z
    .array(z.strictObject({ id: z.string().min(1).max(200), label: z.string().min(1).max(1000) }))
    .max(100),
  minimum: z.int().min(0).max(56),
  maximum: z.int().min(0).max(56),
  remaining: PhysicalCountsSchema,
});
export const PhysicalActiveSchema = z.discriminatedUnion('kind', [
  PhysicalDecisionSchema,
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
      'weakness-deck-empty',
      'boon-quantity-unconfirmed',
    ]),
    remaining: PhysicalCountsSchema,
    family: PhysicalFamilySchema.nullable(),
    capability: z.string().max(100).nullable(),
  }),
]);
export const PhysicalResultSchema = z.strictObject({
  child: z.int().min(0).max(31),
  kind: z.enum(['suffer', 'discard', 'flip', 'turn-down', 'scout', 'event']),
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
  fronts: z
    .array(
      z.strictObject({
        token: z.string().max(100),
        heroId: ContentIdSchema,
        family: PhysicalFamilySchema,
        name: z.string().max(1000),
        text: z.string().max(20000),
        persistent: z.array(z.string().max(1000)).max(8),
      }),
    )
    .max(56)
    .optional(),
  current: z
    .strictObject({
      heroId: ContentIdSchema,
      family: PhysicalFamilySchema,
      name: z.string().max(1000),
      text: z.string().max(20000),
      step: z.string().max(1000),
    })
    .nullable()
    .optional(),
  parents: z.array(PhysicalParentSchema).max(32),
});
export type PhysicalProgram = z.infer<typeof PhysicalProgramSchema>;
export type PhysicalInput = z.infer<typeof PhysicalInputSchema>;
export type PhysicalActive = z.infer<typeof PhysicalActiveSchema>;
export type PhysicalCounts = z.infer<typeof PhysicalCountsSchema>;
export type PhysicalView = z.infer<typeof PhysicalViewSchema>;
