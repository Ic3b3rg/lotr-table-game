import { ScenarioViewSchema, EncounterIntentSchema } from './scenario';
import { CycleAnswerSchema } from './physical-cycle';
import { PhysicalInputSchema, PhysicalViewSchema } from './physical';
import { z } from 'zod';
import { CombatIntentSchema, CombatViewSchema, ResumedJourneySchema } from './combat-controller';
import { CatalogSummarySchema, ContentIdSchema } from './catalog';
import { CopyIdSchema, PreparationViewSchema } from './preparation';
import { SkillTestViewSchema, StatSchema } from './skill-tests';
import { ScoutingSchema } from './scouting';
import { RoundSchema, ShadowStepSchema } from './rounds';
import { JourneySchema, SpaceIdSchema } from './journey-map';
import { GroupSchema } from './group';
import { MapGenerationSchema, HashSchema, Int32Schema } from './generated-map';

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
  schemaVersion: z.literal(19),
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
  mapGeneration: MapGenerationSchema.nullable(),
  scenario: ScenarioViewSchema.nullable().default(null),
  combat: CombatViewSchema.optional(),
  encounterFingerprints: z.record(z.string().max(200), HashSchema).default({}),
  explorationFingerprints: z.record(z.string().max(100), HashSchema).default({}),
  physical: PhysicalViewSchema.nullable().default(null),
});
export const IdentitySchema = z.object({
  player: PlayerSchema.nullable(),
  canManageBackups: z.boolean(),
});
export const ErrorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) });
export const ScenarioInputSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('camp-role'),
    heroId: ContentIdSchema,
    roleId: ContentIdSchema,
  }),
  z.strictObject({ kind: z.literal('choice'), event: z.string().min(1).max(100) }),
  ...PhysicalInputSchema.options,
  z.strictObject({ kind: z.literal('ack') }),
  z.strictObject({ kind: z.literal('scout-reveal') }),
  z.strictObject({
    kind: z.literal('scout-resolve'),
    prepareCopy: CopyIdSchema.nullable(),
    top: z.array(CopyIdSchema).max(15),
    bottom: z.array(CopyIdSchema).max(15),
    discardPreparedCopy: CopyIdSchema.nullable(),
  }),
  z.strictObject({ kind: z.literal('test-reveal') }),
  z.strictObject({ kind: z.literal('convert') }),
  z.strictObject({ kind: z.literal('test-resolve') }),
]);
const CommandBase = { requestId: IntentIdSchema, generation: z.uuid() };
const RoundBase = { ...CommandBase, expectedRevision: z.int().nonnegative(), roundId: z.uuid() };
const MapTurnBase = { ...RoundBase, mapId: z.uuid(), turnId: z.uuid(), heroId: ContentIdSchema };
export const CommandSchema = z.discriminatedUnion('type', [
  CombatIntentSchema.options[0].extend(CommandBase),
  CombatIntentSchema.options[1].extend(CommandBase),
  EncounterIntentSchema.options[0].extend(CommandBase),
  EncounterIntentSchema.options[2].extend(CommandBase),
  CycleAnswerSchema.extend(CommandBase),
  z.strictObject({
    ...CommandBase,
    type: z.literal('START_SCENARIO'),
    expectedRevision: z.int().nonnegative(),
    packFingerprint: HashSchema,
    projectionFingerprint: HashSchema,
    agreed: z.literal(true),
  }),
  z.strictObject({
    ...CommandBase,
    type: z.literal('SCENARIO_INPUT'),
    expectedRevision: z.int().nonnegative(),
    scenarioId: z.uuid(),
    packFingerprint: HashSchema,
    projectionFingerprint: HashSchema,
    pendingId: z.uuid(),
    sourceFingerprint: HashSchema,
    heroId: ContentIdSchema.nullable(),
    input: ScenarioInputSchema,
  }),
  z.strictObject({
    ...CommandBase,
    type: z.literal('GENERATE_ADVENTURE_MAP'),
    expectedRevision: z.int().nonnegative(),
    packFingerprint: HashSchema,
    contextFingerprint: HashSchema,
    requestedSeed: Int32Schema.optional(),
    agreed: z.literal(true),
  }),
  z.strictObject({
    ...CommandBase,
    type: z.literal('RESUME_ADVENTURE_MAP'),
    expectedRevision: z.int().nonnegative(),
    jobId: z.uuid(),
    packFingerprint: HashSchema,
    contextFingerprint: HashSchema,
    agreed: z.literal(true),
  }),
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
    proximity: z.enum(['near', 'far']).optional(),
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
    type: z.enum(['START_ATTACK', 'COMBAT_INPUT']),
    appliedRevision: z.int().nonnegative(),
    combatId: z.uuid(),
    completed: z.boolean(),
    resumedJourney: ResumedJourneySchema.optional(),
  }),
  z.strictObject({
    requestId: IntentIdSchema,
    type: z.literal('EXPLORE_SCENARIO'),
    completed: z.boolean().optional(),
    appliedRevision: z.int().nonnegative(),
    scenarioId: z.uuid(),
    pendingId: z.uuid().nullable(),
    source: HashSchema,
    kind: z.literal('explore'),
    phase: z.literal('action'),
    mapId: z.uuid(),
    heroId: ContentIdSchema,
    spaceId: SpaceIdSchema,
    movesRemaining: z.int().min(0).max(4),
    roundId: z.uuid(),
    turnId: z.uuid(),
  }),
  z.strictObject({
    requestId: IntentIdSchema,
    type: z.literal('CYCLE_INPUT'),
    resumedJourney: ResumedJourneySchema.optional(),
    appliedRevision: z.int().nonnegative(),
    runId: z.uuid(),
    source: HashSchema,
    completed: z.boolean(),
  }),
  z.strictObject({
    requestId: IntentIdSchema,
    type: z.enum(['START_SCENARIO', 'SCENARIO_INPUT', 'INTERACT_SCENARIO']),
    resumedJourney: ResumedJourneySchema.optional(),
    appliedRevision: z.int().nonnegative(),
    scenarioId: z.uuid(),
    pendingId: z.uuid().nullable(),
    source: z.string().max(300),
    kind: z.string().max(50),
    completed: z.boolean().optional(),
    phase: z.enum(['setup', 'action']),
  }),
  z.strictObject({
    requestId: IntentIdSchema,
    type: z.enum(['GENERATE_ADVENTURE_MAP', 'RESUME_ADVENTURE_MAP']),
    appliedRevision: z.int().nonnegative(),
    jobId: z.uuid(),
    status: z.enum(['pending', 'paused', 'frozen']),
    projectionFingerprint: HashSchema.nullable(),
  }),
  z.strictObject({
    requestId: IntentIdSchema,
    type: z.literal('SET_GROUP_SIZE'),
    appliedRevision: z.int().nonnegative(),
    expectedPlayers: z.int().min(1).max(5),
  }),
  z.strictObject({
    requestId: IntentIdSchema,
    type: z.enum(['OPEN_JOURNEY_MAP', 'START_TRAVEL', 'MOVE_HERO']),
    completed: z.boolean().optional(),
    appliedRevision: z.int().nonnegative(),
    mapId: z.uuid(),
    heroId: ContentIdSchema.nullable(),
    spaceId: SpaceIdSchema.nullable(),
    movesRemaining: z.int().min(0).max(4),
    movesGranted: z.int().min(0).max(2).optional(),
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
    heroId: ContentIdSchema.nullable().optional(),
    sourceTurnId: z.uuid().nullable().optional(),
    continuation: z.uuid().nullable().optional(),
    completed: z.boolean().optional(),
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

export type MapGenerationCommand = Extract<
  Command,
  { type: 'GENERATE_ADVENTURE_MAP' | 'RESUME_ADVENTURE_MAP' }
>;

export type ScenarioCommand = Extract<Command, { type: 'START_SCENARIO' | 'SCENARIO_INPUT' }>;
