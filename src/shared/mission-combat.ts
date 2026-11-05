import { z } from 'zod';
import { HashSchema, SourceSchema } from './generated-map';
import { ContentIdSchema } from './catalog';

const event = z.string().min(1).max(100);
export const FirstCombatCapabilitySchema = z.strictObject({
  version: z.literal('source-first-combat-v1'),
  prefab: SourceSchema,
  prefabHash: HashSchema,
  projectionFingerprint: HashSchema,
  evidenceHash: HashSchema,
  definitions: z
    .array(
      z.strictObject({
        role: z.enum(['person', 'principal', 'timer', 'logic']),
        source: SourceSchema,
        definitionHash: HashSchema,
        objectHash: HashSchema,
        lifecycleHash: HashSchema,
        certificateHash: HashSchema,
      }),
    )
    .length(4),
  model: z.strictObject({ source: SourceSchema, objectHash: HashSchema }),
  pose: z.strictObject({
    gameObject: SourceSchema,
    tileSource: SourceSchema,
    tileModel: SourceSchema,
    tileHash: z.int(),
    spaceSource: SourceSchema,
    spaceId: z.string().min(1).max(200),
    index: z.literal(0),
    evidenceHash: HashSchema,
  }),
  configuration: z.strictObject({
    ownedProductIds: z.tuple([z.literal(0)]),
    difficulty: z.literal('normal'),
    mapType: z.literal('journey'),
    initialPending: z.array(z.never()).length(0),
    initialReserved: z.array(z.never()).length(0),
    physicalInventoryPerType: z.null(),
  }),
  events: z.strictObject(
    Object.fromEntries(
      ['normal', 'variant', 'arm', 'revealed', 'defeated', 'escape', 'hide'].map((k) => [k, event]),
    ) as Record<
      'normal' | 'variant' | 'arm' | 'revealed' | 'defeated' | 'escape' | 'hide',
      typeof event
    >,
  ),
  bindings: z.strictObject({ timerValue: event, armed: event, revealed: event, running: event }),
  combatFingerprint: HashSchema,
  followupFingerprint: HashSchema,
  roundsFingerprint: HashSchema,
  failureFingerprint: HashSchema,
});
export type FirstCombatCapability = z.infer<typeof FirstCombatCapabilitySchema>;

export const FirstCombatStateSchema = z.strictObject({
  version: z.literal('source-first-combat-v1'),
  spawns: z
    .array(
      z.strictObject({
        id: z.uuid(),
        effectId: z.string().min(1).max(300),
        actorHeroId: ContentIdSchema,
        playerId: z.uuid(),
        logicInstanceId: z.string().min(1).max(200),
        groupId: z.string().min(1).max(300).nullable(),
        outcome: z.enum(['spawned', 'unavailable', 'unaffordable']),
        budgetBefore: z.int().nonnegative(),
        budgetAfter: z.int().nonnegative(),
        availableBefore: z.int().nonnegative(),
        availableAfter: z.int().nonnegative(),
        grant: z.enum(['none', 'offered', 'used', 'declined', 'ineligible']),
        attackId: z.uuid().nullable(),
        returned: z.boolean(),
      }),
    )
    .max(1),
  callbacks: z
    .array(
      z.strictObject({
        id: z.string().min(1).max(350),
        cause: z.enum(['defeated', 'timer']),
        groupId: z.string().min(1).max(300).nullable(),
        logicInstanceId: z.string().min(1).max(200),
        returned: z.boolean(),
      }),
    )
    .max(1),
});
export type FirstCombatState = z.infer<typeof FirstCombatStateSchema>;
