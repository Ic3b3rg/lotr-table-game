import { z } from 'zod';
import { CatalogSummarySchema, ContentIdSchema } from './catalog';
import { CopyIdSchema, PreparationViewSchema } from './preparation';
import { SkillTestViewSchema, StatSchema } from './skill-tests';
import { ScoutingSchema } from './scouting';
import { RoundSchema, ShadowStepSchema } from './rounds';
import { JourneySchema, SpaceIdSchema } from './journey-map';
import { GroupSchema } from './group';

export const NameSchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .regex(/^[^\u0000-\u001f\u007f]+$/);
export const IntentIdSchema = z
  .string()
  .min(24)
  .max(80)
  .regex(/^[A-Za-z0-9_-]+$/);
export const RecoveryCodeSchema = z
  .string()
  .max(64)
  .transform((value) => value.replace(/[\s-]/g, '').toUpperCase())
  .pipe(z.string().regex(/^[A-F0-9]{24}$/));
export const JoinSchema = z.strictObject({
  name: NameSchema,
  requestId: IntentIdSchema,
  recoveryCode: RecoveryCodeSchema,
  generation: z.uuid(),
});
export const RecoverSchema = z.strictObject({
  recoveryCode: RecoveryCodeSchema,
  generation: z.uuid(),
});
export const PlayerSchema = z.strictObject({ id: z.uuid(), name: NameSchema });
export const DemoSchema = z.strictObject({
  id: z.uuid(),
  choice: z.enum(['A', 'B']).nullable(),
  resolvedBy: z.uuid().nullable(),
});
export const SessionSchema = z.strictObject({
  schemaVersion: z.literal(7),
  id: z.uuid(),
  generation: z.uuid(),
  revision: z.int().nonnegative(),
  updatedAt: z.iso.datetime(),
  players: z.array(PlayerSchema).max(5),
  demo: DemoSchema.nullable().default(null),
  catalog: CatalogSummarySchema.nullable(),
  preparation: PreparationViewSchema.nullable(),
  skillTest: SkillTestViewSchema.nullable(),
  scout: ScoutingSchema.nullable(),
  round: RoundSchema.nullable(),
  journey: JourneySchema.nullable(),
  group: GroupSchema.nullable(),
});
export const IdentitySchema = z.object({
  player: PlayerSchema.nullable(),
  canManageBackups: z.boolean(),
});
export const ErrorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) });
const CommandBase = { requestId: IntentIdSchema, generation: z.uuid() };
const RoundBase = { ...CommandBase, expectedRevision: z.int().nonnegative(), roundId: z.uuid() };
const MapTurnBase = { ...RoundBase, mapId: z.uuid(), turnId: z.uuid(), heroId: ContentIdSchema };
export const CommandSchema = z.discriminatedUnion('type', [
  z.strictObject({
    ...CommandBase,
    type: z.literal('SET_GROUP_SIZE'),
    playerCount: z.int().min(1).max(5),
    expectedRevision: z.int().nonnegative(),
    agreed: z.literal(true),
  }),
  z.strictObject({ ...MapTurnBase, type: z.literal('START_TRAVEL') }),
  z.strictObject({
    ...MapTurnBase,
    type: z.literal('MOVE_HERO'),
    fromSpaceId: SpaceIdSchema,
    destinationSpaceId: SpaceIdSchema,
  }),
  z.strictObject({
    ...CommandBase,
    type: z.literal('OPEN_JOURNEY_MAP'),
    expectedRevision: z.int().nonnegative(),
    planId: ContentIdSchema,
    planHash: z.string().regex(/^[a-f0-9]{64}$/),
    agreed: z.literal(true),
  }),
  z.strictObject({
    ...CommandBase,
    type: z.literal('START_ROUNDS'),
    expectedRevision: z.int().nonnegative(),
    agreed: z.literal(true),
  }),
  z.strictObject({
    ...RoundBase,
    type: z.literal('START_TURN'),
    heroId: ContentIdSchema,
    agreed: z.literal(true),
  }),
  z.strictObject({
    ...RoundBase,
    type: z.literal('END_TURN'),
    heroId: ContentIdSchema,
    turnId: z.uuid(),
  }),
  z.strictObject({ ...RoundBase, type: z.literal('BEGIN_SHADOW'), agreed: z.literal(true) }),
  z.strictObject({
    ...RoundBase,
    type: z.literal('CONFIRM_SHADOW_STEP'),
    step: ShadowStepSchema,
    agreed: z.literal(true),
  }),
  z.strictObject({ ...RoundBase, type: z.literal('END_RALLY'), agreed: z.literal(true) }),
  z.strictObject({
    ...RoundBase,
    type: z.literal('START_INTERACTION_TEST'),
    turnId: z.uuid(),
    heroId: ContentIdSchema,
    stat: StatSchema,
    modifier: z.int().min(-20).max(20),
    target: z.int().min(1).max(99).nullable(),
  }),
  z.strictObject({
    ...CommandBase,
    type: z.literal('DISCARD_PREPARED_SKILL'),
    expectedRevision: z.int().nonnegative(),
    heroId: ContentIdSchema,
    copy: CopyIdSchema,
  }),
  z.strictObject({
    ...CommandBase,
    type: z.literal('START_RALLY_SCOUT'),
    expectedRevision: z.int().nonnegative(),
    heroId: ContentIdSchema,
    roundId: z.uuid().optional(),
  }),
  z.strictObject({
    ...CommandBase,
    type: z.literal('START_SCOUT'),
    expectedRevision: z.int().nonnegative(),
    heroId: ContentIdSchema,
    count: z.int().min(1).max(15),
  }),
  z.strictObject({
    ...CommandBase,
    type: z.literal('RESOLVE_SCOUT'),
    expectedRevision: z.int().nonnegative(),
    scoutId: z.uuid(),
    prepareCopy: CopyIdSchema.nullable(),
    top: z.array(CopyIdSchema).max(15),
    bottom: z.array(CopyIdSchema).max(15),
    discardPreparedCopy: CopyIdSchema.nullable(),
  }),
  z.strictObject({
    ...CommandBase,
    type: z.literal('CONVERT_FATE'),
    expectedRevision: z.int().nonnegative(),
    testId: z.uuid(),
  }),
  z.strictObject({
    ...CommandBase,
    type: z.literal('GAIN_INSPIRATION'),
    expectedRevision: z.int().nonnegative(),
    heroId: ContentIdSchema,
  }),
  z.strictObject({
    ...CommandBase,
    type: z.literal('START_SKILL_TEST'),
    expectedRevision: z.int().nonnegative(),
    heroId: ContentIdSchema,
    stat: StatSchema,
    modifier: z.int().min(-20).max(20),
    target: z.int().min(1).max(99).nullable(),
  }),
  z.strictObject({
    ...CommandBase,
    type: z.literal('RESOLVE_SKILL_TEST'),
    expectedRevision: z.int().nonnegative(),
    testId: z.uuid(),
  }),
  z.strictObject({
    ...CommandBase,
    type: z.literal('PREPARE_COMPANY'),
    expectedRevision: z.int().nonnegative(),
    agreed: z.literal(true),
  }),
  z.strictObject({
    ...CommandBase,
    type: z.literal('SELECT_HEROES'),
    expectedRevision: z.int().nonnegative(),
    heroIds: z.array(ContentIdSchema).max(4),
  }),
  z.strictObject({
    ...CommandBase,
    type: z.literal('CONFIGURE_HERO'),
    expectedRevision: z.int().nonnegative(),
    heroId: ContentIdSchema,
    roleId: ContentIdSchema.nullable(),
    itemCopies: z.array(CopyIdSchema).max(3),
  }),
  z.strictObject({
    ...CommandBase,
    type: z.literal('OPEN_DEMO'),
    expectedDemoId: z.uuid().nullable(),
  }),
  z.strictObject({
    ...CommandBase,
    type: z.literal('RESOLVE_DEMO'),
    demoId: z.uuid(),
    choice: z.enum(['A', 'B']),
    agreed: z.literal(true),
  }),
]);
const DemoReceiptSchema = z.strictObject({
  requestId: IntentIdSchema,
  type: z.enum(['OPEN_DEMO', 'RESOLVE_DEMO']),
  appliedRevision: z.int().nonnegative(),
  demoId: z.uuid(),
  choice: z.enum(['A', 'B']).nullable(),
});
export const ReceiptSchema = z.union([
  z.strictObject({
    requestId: IntentIdSchema,
    type: z.literal('SET_GROUP_SIZE'),
    appliedRevision: z.int().nonnegative(),
    expectedPlayers: z.int().min(1).max(5),
  }),
  z.strictObject({
    requestId: IntentIdSchema,
    type: z.enum(['OPEN_JOURNEY_MAP', 'START_TRAVEL', 'MOVE_HERO']),
    appliedRevision: z.int().nonnegative(),
    mapId: z.uuid(),
    heroId: ContentIdSchema.nullable(),
    spaceId: SpaceIdSchema.nullable(),
    movesRemaining: z.int().min(0).max(4),
    roundId: z.uuid().nullable(),
    turnId: z.uuid().nullable(),
  }),
  DemoReceiptSchema,
  z.strictObject({
    requestId: IntentIdSchema,
    type: z.enum([
      'START_ROUNDS',
      'START_TURN',
      'END_TURN',
      'BEGIN_SHADOW',
      'START_INTERACTION_TEST',
      'CONFIRM_SHADOW_STEP',
      'END_RALLY',
    ]),
    appliedRevision: z.int().nonnegative(),
    roundId: z.uuid(),
    roundNumber: z.int().positive(),
    phase: z.enum(['action', 'shadow', 'rally']),
    turnId: z.uuid().nullable(),
    testId: z.uuid().nullable(),
  }),
  z.strictObject({
    requestId: IntentIdSchema,
    type: z.enum(['START_SCOUT', 'START_RALLY_SCOUT', 'RESOLVE_SCOUT', 'DISCARD_PREPARED_SKILL']),
    appliedRevision: z.int().nonnegative(),
    heroId: ContentIdSchema,
    scoutId: z.uuid().nullable(),
    preparedCount: z.int().min(0).max(4),
  }),
  z.strictObject({
    requestId: IntentIdSchema,
    type: z.enum(['START_SKILL_TEST', 'RESOLVE_SKILL_TEST', 'GAIN_INSPIRATION', 'CONVERT_FATE']),
    appliedRevision: z.int().nonnegative(),
    heroId: ContentIdSchema,
    testId: z.uuid().nullable(),
    inspiration: z.int().nonnegative(),
  }),
  z.strictObject({
    requestId: IntentIdSchema,
    type: z.enum(['SELECT_HEROES', 'CONFIGURE_HERO', 'PREPARE_COMPANY']),
    appliedRevision: z.int().nonnegative(),
    preparationStatus: z.enum(['draft', 'prepared']),
  }),
]);
export const BackupPreviewSchema = z.object({
  format: z.literal('lotr-offline-session'),
  formatVersion: z.literal(1),
  exportedAt: z.iso.datetime(),
  payload: z.object({
    state: z.object({ players: z.array(PlayerSchema.strip()).max(5), updatedAt: z.iso.datetime() }),
  }),
});
export const HostSchema = z.object({
  isLoopbackOnly: z.boolean(),
  addresses: z.array(z.object({ address: z.ipv4(), label: z.string(), joinUrl: z.url() })),
});
export type Session = z.infer<typeof SessionSchema>;
export type GroupCommand = Extract<Command, { type: 'SET_GROUP_SIZE' }>;
export type JourneyCommand = Extract<
  Command,
  { type: 'OPEN_JOURNEY_MAP' | 'START_TRAVEL' | 'MOVE_HERO' }
>;
export type HostInfo = z.infer<typeof HostSchema>;
export type Player = z.infer<typeof PlayerSchema>;
export type Command = z.infer<typeof CommandSchema>;
export type Receipt = z.infer<typeof ReceiptSchema>;

export type PreparationCommand = Extract<
  Command,
  { type: 'SELECT_HEROES' | 'CONFIGURE_HERO' | 'PREPARE_COMPANY' }
>;
export type SkillTestCommand = Extract<
  Command,
  { type: 'START_SKILL_TEST' | 'RESOLVE_SKILL_TEST' | 'GAIN_INSPIRATION' | 'CONVERT_FATE' }
>;
export type ScoutingCommand = Extract<
  Command,
  { type: 'START_SCOUT' | 'START_RALLY_SCOUT' | 'RESOLVE_SCOUT' | 'DISCARD_PREPARED_SKILL' }
>;
export type RoundCommand = Extract<
  Command,
  {
    type:
      | 'START_ROUNDS'
      | 'START_TURN'
      | 'END_TURN'
      | 'BEGIN_SHADOW'
      | 'START_INTERACTION_TEST'
      | 'CONFIRM_SHADOW_STEP'
      | 'END_RALLY';
  }
>;
