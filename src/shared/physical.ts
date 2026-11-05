import { z } from 'zod';
import { NegatedSufferingSchema } from './negated-suffering';
import {
  AttackTestChildSchema,
  AttackTestViewSchema,
  AttackTestResultSchema,
  AttackOutcomeSchema,
  CombatAdditionSchema,
  CombatPhysicalContextSchema,
  BoonKindSchema,
} from './combat';
import { ContentIdSchema } from './catalog';
import { LastStandViewSchema } from './last-stand';
import { StatSchema } from './skill-tests';
import { ScenarioTitleGrantSchema } from './scenario-title';
import { ItemGrantSchema } from './item-inventory';
import { SearchRecoverySchema } from './search-recovery';

export const SourceTestViewSchema = z.strictObject({
  heroId: ContentIdSchema,
  stat: StatSchema,
  target: z.int().min(1).max(99).nullable(),
  successes: z.int().nonnegative(),
  fateRemaining: z.int().nonnegative(),
  cards: z
    .array(
      z.strictObject({
        skillId: ContentIdSchema,
        name: z.string().max(1000),
        success: z.int().nonnegative(),
        fate: z.int().nonnegative(),
      }),
    )
    .max(30),
});

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
  z.strictObject({ kind: z.literal('search-recovery'), hero: slot, effect: SearchRecoverySchema }),
  z.strictObject({ kind: z.literal('source-boon'), hero: slot, boon: BoonKindSchema }),
  z.strictObject({
    kind: z.literal('scenario-item'),
    hero: slot,
    grant: ItemGrantSchema,
    message: z.string().min(1).max(20000),
  }),
  z.strictObject({
    kind: z.literal('scenario-title'),
    hero: slot,
    grant: ScenarioTitleGrantSchema,
  }),
  AttackTestChildSchema,
  z.strictObject({
    kind: z.literal('last-stand-one'),
    hero: slot,
    family: PhysicalFamilySchema.nullable(),
  }),
  z.strictObject({
    kind: z.literal('combat-addition'),
    hero: slot,
    addition: CombatAdditionSchema,
    outcome: AttackOutcomeSchema,
  }),
  z.strictObject({
    kind: z.literal('pay-attack-grant'),
    hero: slot,
    recipient: slot,
    copy: z.string().max(120),
    clauseHash: z.string().regex(/^[a-f0-9]{64}$/),
  }),
  z.strictObject({
    kind: z.literal('enemy-attack'),
    hero: slot,
    negate: StatSchema,
    outcome: AttackOutcomeSchema,
    addition: CombatAdditionSchema.nullable(),
  }),
  NegatedSufferingSchema.extend({
    kind: z.literal('group-suffer'),
    hero: slot,
    heroes: z.array(slot).min(1).max(5),
  }),
  z.strictObject({
    kind: z.literal('group-test'),
    hero: slot,
    heroes: z.array(slot).min(1).max(5),
    stat: StatSchema,
    target: z.int().min(1).max(99),
    failure: z.strictObject({
      family: PhysicalFamilySchema,
      amount: z.int().min(1).max(56),
      face: z.enum(['faceup', 'facedown']),
    }),
  }),
  z.strictObject({
    kind: z.literal('darkness'),
    hero: slot,
    heroes: z.array(slot).min(1).max(5),
    amount: z.int().min(1).max(56),
    face: z.enum(['faceup', 'facedown']),
    negate: StatSchema,
  }),
  z.strictObject({ kind: z.literal('inspiration'), hero: slot, amount: z.literal(1) }),
  z.strictObject({
    kind: z.literal('test'),
    hero: slot,
    stat: StatSchema,
    target: z.int().min(1).max(99).nullable(),
  }),
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
  z.strictObject({ kind: z.literal('end-turn'), hero: slot }),
  z.strictObject({ kind: z.literal('rally-reset'), hero: slot }),
  z.strictObject({ kind: z.literal('rally-scout'), hero: slot, count: z.int().min(2).max(3) }),
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
  groupRules: z.literal('source-live-groups-v1').optional(),
  combat: CombatPhysicalContextSchema.optional(),
  deferFrontier: z.literal('combat-frontier-v1').optional(),
  children: z.array(FrontChildSchema).min(1).max(32),
  darknessHeroes: z.array(slot).max(5),
});
export const PhysicalProgramSchema = z.discriminatedUnion('profile', [
  LegacyPhysicalProgramSchema,
  FrontPhysicalProgramSchema,
]);
export const PhysicalInputSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('physical-continue-last-stand'),
    rules: z.literal('source-last-stand-v1'),
  }),
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
  purpose: z.enum(['group-order', 'negation']).optional(),
  scoutTopAllowed: z.boolean().optional(),
  scoutPrepareAllowed: z.literal(false).optional(),
  ...activeBase,
  kind: z.literal('decision'),
  cursor: z.string().regex(/^[a-f0-9]{64}$/),
  mode: z.enum(['choose', 'select', 'allocate', 'scout']),
  title: z.string().min(1).max(1000),
  options: z
    .array(
      z.strictObject({
        id: z.string().min(1).max(200),
        label: z.string().min(1).max(1000),
        unavailable: z.string().max(1000).optional(),
      }),
    )
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
      'boon-supply-empty',
      'adventure-loss-consumer-unavailable',
    ]),
    remaining: PhysicalCountsSchema,
    family: PhysicalFamilySchema.nullable(),
    capability: z.string().max(100).nullable(),
  }),
]);
export const PhysicalResultSchema = z.strictObject({
  attack: AttackTestResultSchema.optional(),
  enemyOutcome: AttackOutcomeSchema.optional(),
  child: z.int().min(0).max(31),
  kind: z.enum([
    'inspiration',
    'scenario-title',
    'scenario-item',
    'source-boon',
    'attack-test',
    'pay-attack-grant',
    'last-stand-one',
    'combat-addition',
    'enemy-attack',
    'test',
    'suffer',
    'discard',
    'flip',
    'turn-down',
    'scout',
    'search-recovery',
    'event',
    'end-turn',
    'rally-reset',
    'rally-scout',
    'darkness',
    'group-test',
    'group-suffer',
  ]),
  heroId: ContentIdSchema,
  successes: z.int().min(0).max(999).optional(),
  tests: z
    .array(
      z.strictObject({
        heroId: ContentIdSchema,
        successes: z.int().min(0).max(999),
        outcome: z.enum(['pass', 'fail']),
      }),
    )
    .max(5)
    .optional(),
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
  inventory: z
    .array(
      z.strictObject({
        copy: z.string().min(1).max(120),
        cardId: ContentIdSchema,
        heroId: ContentIdSchema.nullable(),
        remaining: z.int().nonnegative().nullable(),
        capacity: z.int().min(1).max(3),
      }),
    )
    .max(1)
    .optional(),
  nextShadow: z
    .strictObject({ enabled: z.boolean(), reason: z.string().max(2000).nullable() })
    .optional(),
  boons: z
    .strictObject({
      stock: z.enum(['unverified', 'verified', 'unavailable']),
      definitions: z
        .array(
          z.strictObject({
            kind: z.string().max(100),
            name: z.string().max(1000),
            text: z.string().max(16384),
            available: z.int().min(0).max(15).nullable(),
          }),
        )
        .max(3),
      held: z
        .array(
          z.strictObject({
            copyId: z.string().max(100),
            heroId: ContentIdSchema,
            kind: z.string().max(100),
            name: z.string().max(1000),
            text: z.string().max(16384),
            sourceLabel: z.string().max(1000),
          }),
        )
        .max(15),
    })
    .optional(),
  attackTest: AttackTestViewSchema.nullable().optional(),
  sourceTest: SourceTestViewSchema.nullable().optional(),
  lastStand: LastStandViewSchema.optional(),
  cycle: z
    .strictObject({
      pending: z
        .strictObject({
          runId: z.uuid(),
          pendingId: z.uuid(),
          sourceFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
          type: z.enum([
            'END_TURN',
            'START_RALLY_SCOUT',
            'CONFIRM_SHADOW_STEP',
            'BEGIN_SHADOW',
            'START_ATTACK',
          ]),
        })
        .nullable(),
      heroes: z
        .array(
          z.strictObject({
            heroId: ContentIdSchema,
            travelMoves: z.int().min(0).max(2),
            interactInspiration: z.int().nonnegative().optional(),
          }),
        )
        .max(5),
    })
    .optional(),
  synthetic: z.boolean(),
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
  parents: z.array(PhysicalParentSchema).max(1000),
});
export type PhysicalProgram = z.infer<typeof PhysicalProgramSchema>;
export type PhysicalInput = z.infer<typeof PhysicalInputSchema>;
export type PhysicalActive = z.infer<typeof PhysicalActiveSchema>;
export type PhysicalCounts = z.infer<typeof PhysicalCountsSchema>;
export type PhysicalView = z.infer<typeof PhysicalViewSchema>;
