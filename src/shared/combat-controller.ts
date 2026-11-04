import { z } from 'zod';
import { ContentIdSchema } from './catalog';
import { HashSchema } from './generated-map';
import { CopyIdSchema } from './preparation';
import { StatSchema } from './skill-tests';
import {
  AttackOutcomeSchema,
  AttackTestResultSchema,
  CombatStreamsSchema,
  InstructionSelectionSchema,
  SuccessSlotSchema,
  AttackModifierSchema,
  ActivationHeroSelectionSchema,
} from './combat';
const id = z.string().min(1).max(350);
const binding = { expectedRevision: z.int().nonnegative() };
export const CombatIntentSchema = z.discriminatedUnion('type', [
  z.strictObject({
    ...binding,
    type: z.literal('START_ATTACK'),
    roundId: z.uuid(),
    turnId: z.uuid(),
    heroId: ContentIdSchema,
    groupId: id,
    itemCopies: z.array(CopyIdSchema).min(1).max(3),
    stat: StatSchema,
    replaceCopy: CopyIdSchema.nullable(),
    grantId: z.uuid().nullable(),
  }),
  z.strictObject({
    ...binding,
    type: z.literal('COMBAT_INPUT'),
    combatId: z.uuid(),
    pendingId: z.uuid(),
    sourceFingerprint: HashSchema,
    choice: z.string().min(1).max(350),
  }),
]);
export type CombatIntent = z.infer<typeof CombatIntentSchema>;
const movement = {
  heroId: ContentIdSchema,
  mapId: z.uuid(),
  roundId: z.uuid(),
  turnId: z.uuid(),
  fromSpaceId: z.string().max(200),
  destinationSpaceId: z.string().max(200),
};
const source = {
  scenarioId: z.uuid(),
  packFingerprint: HashSchema,
  projectionFingerprint: HashSchema,
  sourceFingerprint: HashSchema,
};
export const CombatOperationSchema = z.strictObject({
  id: z.uuid(),
  playerId: z.uuid(),
  requestId: z.string().max(80),
  provoked: z.array(id).max(100),
  origin: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('movement'), ...movement }),
    z.strictObject({ kind: z.literal('exploration'), ...movement, ...source, entropy: HashSchema }),
    z.strictObject({
      kind: z.literal('interaction'),
      ...source,
      heroId: ContentIdSchema,
      roundId: z.uuid(),
      turnId: z.uuid(),
      instanceId: id,
    }),
  ]),
  status: z.enum(['provoking', 'returned', 'cancelled']),
  reason: z.string().max(1000).nullable(),
});
export type CombatOperation = z.infer<typeof CombatOperationSchema>;
export const CombatAttemptSchema = z.strictObject({
  id: z.uuid(),
  parentId: z.uuid().nullable(),
  operationId: z.uuid().nullable(),
  kind: z.enum(['hero-attack', 'provocation', 'activation']),
  heroId: ContentIdSchema,
  playerId: z.uuid(),
  groupId: id,
  itemCopies: z.array(CopyIdSchema).max(3),
  stat: StatSchema.nullable(),
  cost: z.enum(['action', 'grant', 'none']),
  grantId: z.uuid().nullable(),
  stage: z.enum([
    'activation-choice',
    'attack-test',
    'counterattack',
    'enemy-frontier',
    'movement',
    'reward',
    'after-attack',
    'await-grant',
    'completed',
  ]),
  runId: z.uuid().nullable(),
  result: AttackTestResultSchema.nullable(),
  applied: z
    .strictObject({
      hits: z.int().min(0).max(10000),
      removed: z.array(id).max(3),
      unusedHits: z.int().min(0).max(10000),
      defeated: z.boolean(),
      modifiers: z.array(AttackModifierSchema).max(6),
      suppressed: z.array(AttackModifierSchema).max(6),
    })
    .nullable(),
  selection: InstructionSelectionSchema.nullable(),
  packet: z
    .strictObject({
      damage: z.int().min(0).max(56),
      fear: z.int().min(0).max(56),
      executed: z.boolean(),
      reductions: z
        .array(
          z.strictObject({
            family: z.enum(['damage', 'fear']),
            cursorBefore: z.int().nonnegative(),
            cursorAfter: z.int().nonnegative(),
          }),
        )
        .max(10000),
    })
    .nullable(),
  outcome: AttackOutcomeSchema.nullable(),
  frontier: z
    .strictObject({
      addition: z.enum(['pending', 'resolving', 'completed', 'not-due']),
      physicalRole: z.enum(['addition', 'last-stand']).nullable(),
    })
    .nullable(),
  movement: z
    .strictObject({
      done: z.array(z.enum(['hero', 'group'])).max(2),
      selected: z
        .strictObject({
          actor: z.enum(['hero', 'group']),
          from: z.string().max(200),
          destination: z.string().max(200),
          targetId: id,
        })
        .nullable(),
      provoked: z.array(id).max(100),
      exploring: z.boolean(),
    })
    .nullable(),
  reward: z.strictObject({ heroId: ContentIdSchema, amount: z.int().min(0).max(1) }).nullable(),
  activation: z
    .strictObject({
      frameId: z.uuid(),
      target: ActivationHeroSelectionSchema.nullable(),
      branch: z.enum(['primary', 'alternative']).nullable(),
      recipient: ContentIdSchema.nullable(),
      movesRemaining: z.int().min(0).max(8),
      stop: z.int().min(0).max(1),
      interrupted: z.boolean(),
      positions: z.array(z.string().max(200)).max(100),
    })
    .optional(),
  returned: z.boolean(),
});
export type CombatAttempt = z.infer<typeof CombatAttemptSchema>;
export const CombatStateSchema = z.strictObject({
  version: z.literal('combat-controller-v1'),
  artifactFingerprint: HashSchema,
  entropy: HashSchema,
  streams: CombatStreamsSchema,
  active: z.uuid().nullable(),
  attempts: z.array(CombatAttemptSchema).max(1000),
  operation: CombatOperationSchema.nullable(),
  operations: z.array(CombatOperationSchema).max(1000),
  grants: z
    .array(
      z.strictObject({
        id: z.uuid(),
        parentId: z.uuid(),
        ownerHeroId: ContentIdSchema,
        recipientHeroId: ContentIdSchema,
        copy: CopyIdSchema,
        clauseHash: HashSchema,
        status: z.enum(['offered', 'used', 'declined']),
      }),
    )
    .max(1000),
});
export type CombatState = z.infer<typeof CombatStateSchema>;
export const CombatAttackOfferSchema = z.strictObject({
  heroId: ContentIdSchema,
  groupId: id,
  name: z.string().max(1000),
  figures: z.int().min(1).max(3),
  itemCopies: z.array(CopyIdSchema).min(1).max(3),
  stat: StatSchema,
  slots: z.array(SuccessSlotSchema).max(32),
  reason: z.string().max(1000).nullable(),
});
export type CombatAttackOffer = z.infer<typeof CombatAttackOfferSchema>;
export const CombatViewSchema = z.strictObject({
  artifactFingerprint: HashSchema,
  attacks: z.array(CombatAttackOfferSchema).max(400),
  replacements: z
    .array(
      z.strictObject({
        heroId: ContentIdSchema,
        copy: CopyIdSchema,
        stat: StatSchema,
        inspiration: z.int().min(0).max(56),
      }),
    )
    .max(20),
  current: z
    .strictObject({
      id: z.uuid(),
      heroId: ContentIdSchema,
      kind: CombatAttemptSchema.shape.kind,
      groupId: id,
      name: z.string().max(1000),
      stage: CombatAttemptSchema.shape.stage,
      cost: CombatAttemptSchema.shape.cost,
      returnLabel: z.string().max(1000),
      instruction: z.string().max(20000).nullable(),
      packet: CombatAttemptSchema.shape.packet,
      result: CombatAttemptSchema.shape.result,
      applied: CombatAttemptSchema.shape.applied,
      activation: z
        .strictObject({
          initialHeroId: ContentIdSchema.nullable(),
          recipientHeroId: ContentIdSchema.nullable(),
          branch: z.enum(['primary', 'alternative']).nullable(),
          movesRemaining: z.int().min(0).max(8),
        })
        .optional(),
    })
    .nullable(),
  pending: z
    .strictObject({
      id: z.uuid(),
      combatId: z.uuid(),
      sourceFingerprint: HashSchema,
      actorPlayerId: z.uuid(),
      heroId: ContentIdSchema,
      title: z.string().max(1000),
      options: z
        .array(
          z.strictObject({
            id: z.string().max(350),
            label: z.string().max(1000),
            unavailable: z.string().max(1000).optional(),
          }),
        )
        .max(100),
    })
    .nullable(),
  grant: z.strictObject({ id: z.uuid(), heroId: ContentIdSchema, parentId: z.uuid() }).nullable(),
  last: z
    .strictObject({
      heroId: ContentIdSchema,
      name: z.string().max(1000),
      kind: CombatAttemptSchema.shape.kind,
      hits: z.int().min(0).max(10000).nullable(),
      returnLabel: z.string().max(1000),
    })
    .nullable(),
});
export type CombatView = z.infer<typeof CombatViewSchema>;
export const ResumedJourneySchema = z.strictObject({
  mapId: z.uuid(),
  roundId: z.uuid(),
  turnId: z.uuid(),
  heroId: ContentIdSchema,
  spaceId: z.string().max(200),
  movesRemaining: z.int().min(0).max(4),
});
