import { z } from 'zod';
import { HashSchema, SourceSchema } from './generated-map';
import { ContentIdSchema } from './catalog';
import { StatSchema } from './skill-tests';
const id = z.string().min(1).max(350);
const amount = z.int().min(0).max(56);
export const AttackModifierSchema = z.enum([
  'pierce',
  'smite',
  'lethal',
  'sunder',
  'stun',
  'cleave',
]);
export type AttackModifier = z.infer<typeof AttackModifierSchema>;
export const BoonKindSchema = z.enum(['emboldened', 'determined', 'hidden']);
export const CombatAdditionSchema = z.strictObject({
  key: id,
  textHash: HashSchema,
  predicate: z.enum([
    'always',
    'damage-positive',
    'fear-positive',
    'zero-damage-and-fear',
    'recipient-in-darkness',
  ]),
  window: z.enum(['condition-known', 'after-enemy-attack']),
  effect: z.discriminatedUnion('op', [
    z.strictObject({ op: z.literal('discard-prepared'), amount }),
    z.strictObject({ op: z.literal('discard-inspiration'), amount }),
    z.strictObject({ op: z.literal('discard-boons') }),
    z.strictObject({ op: z.literal('gain-inspiration'), amount }),
    z.strictObject({ op: z.literal('gain-weakness'), amount }),
    z.strictObject({ op: z.literal('flip-random'), family: z.enum(['damage', 'fear']), amount }),
    z.strictObject({
      op: z.literal('suffer'),
      family: z.enum(['damage', 'fear']),
      amount,
      face: z.enum(['faceup', 'facedown']),
    }),
    z.strictObject({ op: z.literal('lose-boon-or-weakness'), boon: BoonKindSchema }),
    z.strictObject({ op: z.literal('gain-boon'), boon: BoonKindSchema.nullable() }),
    z.strictObject({ op: z.literal('move-pair-toward-threat'), amount: z.literal(1) }),
  ]),
});
export type CombatAddition = z.infer<typeof CombatAdditionSchema>;
const clauseBase = {
  cardId: ContentIdSchema,
  definitionHash: HashSchema,
  originalHash: HashSchema,
  locator: id,
  clause: z.int().min(0).max(15),
};
// Reviewed, source-linked clauses. Text never dispatches an effect at runtime.
export const CompanyClauseSchema = z.strictObject({
  ...clauseBase,
  window: z.enum([
    'before-test',
    'test-convert',
    'attack-test',
    'after-test',
    'after-attack-after-counterattack',
    'would-suffer',
    'after-explore',
    'during-own-turn',
    'after-prepare',
    'end-own-turn',
    'start-own-turn',
    'before-sprint',
    'after-this-card-sprint',
  ]),
  effect: z.discriminatedUnion('op', [
    z.strictObject({ op: z.literal('strike'), n: amount }),
    z.strictObject({ op: z.literal('guard'), n: amount }),
    z.strictObject({ op: z.literal('add-success'), n: amount, stat: StatSchema }),
    z.strictObject({ op: z.literal('replace-stat'), stat: StatSchema, inspiration: amount }),
    z.strictObject({ op: z.literal('convert-all'), noPrintedSuccess: z.boolean() }),
    z.strictObject({ op: z.literal('convert-one-then-scout'), scout: z.int().min(1).max(5) }),
    z.strictObject({ op: z.literal('granted-attack'), inspiration: amount }),
    z.strictObject({ op: z.literal('requires-capability'), capability: id }),
  ]),
});
export type CompanyClause = z.infer<typeof CompanyClauseSchema>;
const asset = z.strictObject({
  source: SourceSchema,
  cls: z.enum(['EnemyModel', 'EnemyBonusModel', 'EnemyActivationModel']),
  objectHash: HashSchema,
  dataHash: HashSchema,
  data: z.record(z.string().max(200), z.json()),
});
const shadowFields = {
  companyFingerprint: HashSchema,
  activationOverride: z.literal(-1),
  controller: z.strictObject({
    assemblyHash: HashSchema,
    method: z.string().regex(/^06[0-9a-f]{6}$/),
    bodyHash: HashSchema,
    normalDifficulty: z.literal(0),
    enemyPointsPerHero: z.literal(0),
    difficultyEvidenceHash: HashSchema,
  }),
  beforeUnexhaust: id,
  terrain: z.strictObject({
    tiles: z.array(z.strictObject({ source: SourceSchema, evidenceHash: HashSchema })).max(200),
    forbiddenPrefabs: z.array(SourceSchema).max(100),
    evidenceHash: HashSchema,
  }),
  instructions: z
    .array(
      z.strictObject({
        source: SourceSchema,
        movement: z.int().min(0).max(8),
        alternativeMovement: z.int().min(0).max(8),
        alternativeDestination: z.enum(['hero', 'adjacent-to-hero']),
        alternativeTarget: z.enum(['nearest', 'highest-might']).optional(),
        evidenceHash: HashSchema,
      }),
    )
    .min(1)
    .max(300),
  thresholds: z
    .array(
      z.strictObject({
        source: SourceSchema,
        owner: SourceSchema,
        definition: SourceSchema,
        threshold: z.int().positive().max(999),
        multiplier: z.int().positive().max(100),
        nextSource: SourceSchema,
        nextOwner: SourceSchema,
        nextThreshold: z.int().positive().max(999),
        evidenceHash: HashSchema,
      }),
    )
    .max(10),
};
export const ScriptedCombatGroupSchema = z.strictObject({
  key: id,
  model: SourceSchema,
  bonuses: z.array(SourceSchema).max(3),
  logic: SourceSchema,
  sourceGroup: SourceSchema.nullable(),
  objectHash: HashSchema,
  baseStats: z
    .array(
      z.strictObject({
        health: z.int().min(1).max(1000),
        armor: z.int().nonnegative().max(1000),
        sorcery: z.int().nonnegative().max(1000),
      }),
    )
    .min(1)
    .max(3),
});
const ShadowSourceSchema = z.discriminatedUnion('version', [
  z.strictObject({ version: z.literal('source-shadow-activations-v1'), ...shadowFields }),
  z.strictObject({
    version: z.literal('source-battle-shadow-v1'),
    ...shadowFields,
    battle: z.strictObject({
      boardFingerprint: HashSchema,
      model: SourceSchema,
      principal: SourceSchema,
      evidenceHash: HashSchema,
    }),
  }),
]);
export const CombatClosureSourceSchema = z.strictObject({
  format: z.literal('combat-closure-v1'),
  evidenceHash: HashSchema,
  projectionFingerprint: HashSchema,
  deploymentFingerprint: HashSchema,
  files: z
    .array(z.strictObject({ file: id, sha256: HashSchema }))
    .min(1)
    .max(32),
  models: z.array(SourceSchema).min(1).max(32),
  assets: z.array(asset).min(1).max(300),
  texts: z
    .array(
      z.strictObject({
        key: id,
        value: z.string().max(20000),
        file: id,
        locator: id,
        sha256: HashSchema,
      }),
    )
    .max(300),
  additions: z.array(CombatAdditionSchema).max(100),
  items: z
    .array(
      z.strictObject({
        id: ContentIdSchema,
        model: SourceSchema,
        definitionHash: HashSchema,
        originalHash: HashSchema,
        file: id,
        locator: id,
        ranged: z.boolean(),
        stat: StatSchema.nullable(),
        body: z.string().max(20000),
      }),
    )
    .max(32),
  clauses: z.array(CompanyClauseSchema).max(200),
  heroes: z
    .array(
      z.strictObject({
        heroId: ContentIdSchema,
        definitionHash: HashSchema,
        originalHash: HashSchema,
        locator: id,
        effect: z.enum([
          'rally-extra-card',
          'after-strike-scout-once',
          'before-interact-fate-inspiration',
        ]),
      }),
    )
    .max(5),
  definitions: z
    .array(
      z.strictObject({
        id: ContentIdSchema,
        definitionHash: HashSchema,
        originalHash: HashSchema,
        locator: id,
        clauses: z.int().min(0).max(16),
      }),
    )
    .max(100),
  shadow: ShadowSourceSchema.optional(),
  scriptedGroups: z.array(ScriptedCombatGroupSchema).max(16).optional(),
});
export type CombatClosureSource = z.infer<typeof CombatClosureSourceSchema>;
export const CombatClosureArtifactSchema = z.strictObject({
  version: z.literal('combat-closure-v1'),
  source: CombatClosureSourceSchema,
  compiled: z.unknown(),
  fingerprint: HashSchema,
});
export const CombatStreamsSchema = z.strictObject({
  instruction: z.int().min(0).max(1000000),
  reduction: z.int().min(0).max(1000000),
  target: z.int().min(0).max(1000000).optional(),
});
export type CombatStreams = z.infer<typeof CombatStreamsSchema>;
export const ActivationHeroSelectionSchema = z.strictObject({
  algorithm: z.literal('combat-target-sha256-rejection-v1'),
  population: z.array(ContentIdSchema).min(1).max(5),
  heroId: ContentIdSchema,
  index: z.int().min(0).max(4),
  cursorBefore: z.int().nonnegative(),
  cursorAfter: z.int().nonnegative(),
});
export const InstructionSelectionSchema = z.strictObject({
  algorithm: z.literal('combat-group-sha256-rejection-v1'),
  groupId: id,
  model: SourceSchema,
  size: z.int().min(1).max(3),
  population: z
    .array(z.strictObject({ source: SourceSchema, fingerprint: HashSchema }))
    .min(1)
    .max(100),
  source: SourceSchema,
  fingerprint: HashSchema,
  cursorBefore: z.int().nonnegative(),
  cursorAfter: z.int().nonnegative(),
  index: z.int().min(0).max(99),
});
export type InstructionSelection = z.infer<typeof InstructionSelectionSchema>;
export const SuccessSlotSchema = z.strictObject({
  id,
  copyId: id,
  cost: z.int().min(1).max(100),
  hits: z.int().min(0).max(1000),
  modifiers: z.array(AttackModifierSchema).max(6),
  label: z.string().max(1000),
});
export type SuccessSlot = z.infer<typeof SuccessSlotSchema>;
export const AttackTestResultSchema = z.strictObject({
  successes: z.int().min(0).max(999),
  addedHits: z.int().min(0).max(1000),
  allocations: z
    .array(z.strictObject({ slotId: id, successes: z.array(z.int().nonnegative()).max(100) }))
    .max(32),
  unspent: z.int().min(0).max(999),
  hits: z.int().min(0).max(10000),
  modifiers: z.array(AttackModifierSchema).max(6),
});
export type AttackTestResult = z.infer<typeof AttackTestResultSchema>;
export const FamilyAmountsSchema = z.strictObject({ damage: amount, fear: amount });
export const AttackOutcomeSchema = z.strictObject({
  attackId: id,
  groupId: id,
  instructionId: SourceSchema,
  instructionHash: HashSchema,
  recipientHeroId: ContentIdSchema,
  cause: z.enum(['counterattack', 'provocation', 'activation']),
  rootSource: id,
  directSource: id,
  returnTo: id,
  artifactFingerprint: HashSchema,
  projectionFingerprint: HashSchema,
  figureIds: z.array(id).min(1).max(3),
  offered: FamilyAmountsSchema,
  negated: FamilyAmountsSchema,
  prevented: FamilyAmountsSchema,
  suffered: FamilyAmountsSchema,
  childSources: z
    .array(
      z.strictObject({
        source: id,
        recipientHeroId: ContentIdSchema,
        family: z.enum(['damage', 'fear']),
        amount,
      }),
    )
    .max(1000),
  sealed: z.boolean(),
});
export type AttackOutcome = z.infer<typeof AttackOutcomeSchema>;
export const CombatPhysicalContextSchema = z.strictObject({
  version: z.literal('combat-windows-v1'),
  roundId: z.uuid(),
  artifactFingerprint: HashSchema,
  clauses: z.array(CompanyClauseSchema).max(200),
  heroes: CombatClosureSourceSchema.shape.heroes,
});
export type CombatPhysicalContext = z.infer<typeof CombatPhysicalContextSchema>;

export const AttackTestViewSchema = z.strictObject({
  heroId: ContentIdSchema,
  groupId: id,
  stage: z.enum(['converting', 'spending', 'after-test']),
  slots: z.array(SuccessSlotSchema).max(32),
  successes: z.int().min(0).max(999),
  spent: z.int().min(0).max(999),
  remaining: z.int().min(0).max(999),
  addedHits: z.int().min(0).max(1000),
  hits: z.int().min(0).max(10000),
  allocations: AttackTestResultSchema.shape.allocations,
});
export const AttackTestChildSchema = z.strictObject({
  kind: z.literal('attack-test'),
  hero: z.int().min(0).max(4),
  stat: StatSchema,
  groupId: id,
  slots: z.array(SuccessSlotSchema).max(32),
  replaceCopy: id.nullable(),
});
export type AttackTestChild = z.infer<typeof AttackTestChildSchema>;
