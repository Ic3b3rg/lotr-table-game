import {
  CampDepartureCapabilitySchema,
  CampDepartureInputSchema,
  BattleStartupStateSchema,
} from './camp-departure';
import {
  CampPreparationCapabilitySchema,
  CampPreparationSchema,
  CampPreparationInputs,
} from './camp-preparation';
import { CampItemsCapabilitySchema, CampItemInputSchema } from './camp-items';
import { z } from 'zod';
import {
  CampSkillsCapabilitySchema,
  CampSkillInputSchema,
  CampTrainingSchema,
} from './camp-skills';
import { SearchRecoverySchema } from './search-recovery';
import { CombatClosureArtifactSchema } from './combat';
import { BoonKindSchema } from './combat';
import { FirstCombatCapabilitySchema, FirstCombatStateSchema } from './mission-combat';
import { HashSchema, SourceSchema, Int32Schema, VectorSchema } from './generated-map';
import { ContentIdSchema } from './catalog';
import { CopyIdSchema } from './preparation';
import { PhysicalProgramSchema, PhysicalInputSchema } from './physical';
import { StatSchema } from './skill-tests';
import { ScenarioTitleGrantSchema } from './scenario-title';
import { ItemGrantSchema } from './item-inventory';
import { RoundSourceSchema, SourceRoundStateSchema } from './source-rounds';
import { DeploymentSourceSchema, DeploymentStateSchema } from './deployment';
import { NegatedSufferingSchema } from './negated-suffering';
import { ThreatContinuationsSchema, ThreatCauseSchema } from './threat-continuations';

export const SourceTextSchema = z
  .array(
    z.discriminatedUnion('kind', [
      z.strictObject({
        kind: z.literal('text'),
        text: z
          .string()
          .max(20000)
          .refine((text) => !/\p{Co}/u.test(text), 'Icona privata non risolta nel testo fonte.'),
        style: z.enum(['plain', 'bold', 'italic', 'boldItalic']),
      }),
      z.strictObject({
        kind: z.literal('icon'),
        name: z.enum([
          'might',
          'agility',
          'spirit',
          'wisdom',
          'wit',
          'success',
          'fate',
          'inspiration',
          'action',
          'attack',
          'ranged',
          'damage',
          'fear',
          'lore',
          'person',
          'search',
          'threat',
          'exploration',
        ]),
      }),
    ]),
  )
  .min(1)
  .max(500);
export type SourceText = z.infer<typeof SourceTextSchema>;
export const VariableRefSchema = z.strictObject({
  scope: z.enum(['local', 'global']),
  name: z.string().min(1).max(150),
});
const methodEvidence = z.strictObject({
  assemblyHash: HashSchema,
  method: z.string().regex(/^06[0-9a-f]{6}$/),
  bodyHash: HashSchema,
});
export const AdventureFailureCapabilitySchema = z.strictObject({
  version: z.literal('source-adventure-failure-v1'),
  event: z.string().min(1).max(100),
  evidenceHash: HashSchema,
  methods: z.strictObject(
    Object.fromEntries(
      ['signal', 'next', 'proceed', 'reset', 'loader', 'map', 'camp', 'xp'].map((k) => [
        k,
        methodEvidence,
      ]),
    ) as Record<
      'signal' | 'next' | 'proceed' | 'reset' | 'loader' | 'map' | 'camp' | 'xp',
      typeof methodEvidence
    >,
  ),
  next: z.strictObject({
    source: SourceSchema,
    id: Int32Schema,
    modelHash: HashSchema,
    type: z.enum(['journey', 'battle']),
    name: SourceTextSchema,
    location: SourceTextSchema,
    story: SourceTextSchema,
    restArea: z.int().nonnegative().max(100),
  }),
  partyBonus: z.strictObject({
    requiredSkillId: Int32Schema,
    amount: z.int().nonnegative().max(99),
    text: SourceTextSchema,
    skills: z
      .array(z.strictObject({ cardId: ContentIdSchema, modelId: Int32Schema.nullable() }))
      .max(1000),
  }),
});
const LairCapabilitySchema = z.strictObject({
  version: z.literal('source-lair-victory-v1'),
  prefab: SourceSchema,
  event: z.string().min(1).max(100),
  evidenceHash: HashSchema,
  definitionHash: HashSchema,
  principalHash: HashSchema,
  cluesFingerprint: HashSchema,
  failureFingerprint: HashSchema,
  methods: z.strictObject({ end: methodEvidence, challenge: methodEvidence, sum: methodEvidence }),
});
const LinkedCapabilitySchema = z.strictObject({
  version: z.literal('source-linked-encounters-v1'),
  evidenceHash: HashSchema,
  encounters: z.tuple([
    z.strictObject({ prefab: SourceSchema, definitionHash: HashSchema }),
    z.strictObject({ prefab: SourceSchema, definitionHash: HashSchema }),
  ]),
  events: z.strictObject({
    searched: z.string().min(1).max(100),
    reveal: z.string().min(1).max(100),
    returned: z.string().min(1).max(100),
  }),
  threat: z.strictObject({
    definition: SourceSchema,
    state: z.int().nonnegative(),
    action: z.int().nonnegative(),
    binding: VariableRefSchema,
    delta: Int32Schema.refine((n) => n < 0),
  }),
  title: ScenarioTitleGrantSchema,
  roundsFingerprint: HashSchema,
  failureFingerprint: HashSchema,
  methods: z.strictObject({
    choose: methodEvidence,
    award: methodEvidence,
    unique: methodEvidence,
    threat: methodEvidence,
    broadcast: methodEvidence,
    sequence: methodEvidence,
  }),
});
const searchOwner = <R extends string>(role: R) =>
  z.strictObject({
    role: z.literal(role),
    prefab: SourceSchema,
    prefabHash: HashSchema,
    definitionHash: HashSchema,
    objectHash: HashSchema,
    lifecycleHash: HashSchema,
    certificateHash: HashSchema,
    model: z.strictObject({ source: SourceSchema, objectHash: HashSchema }),
    node: z.strictObject({ source: SourceSchema, objectHash: HashSchema }),
  });
const SearchesCapabilitySchema = z.strictObject({
  version: z.literal('source-search-encounters-v1'),
  evidenceHash: HashSchema,
  ownedProductIds: z.tuple([z.literal(0)]),
  encounters: z.tuple([searchOwner('choice'), searchOwner('challenge')]),
  roundsFingerprint: HashSchema,
  failureFingerprint: HashSchema,
  methods: z.strictObject({
    confirm: methodEvidence,
    cancel: methodEvidence,
    challenge: methodEvidence,
    sum: methodEvidence,
    sequence: methodEvidence,
    hide: methodEvidence,
    release: methodEvidence,
  }),
});
const threatTokenOwner = <R extends string>(role: R) =>
  searchOwner(role).extend({
    admittedStates: z.array(z.int().nonnegative()).min(1).max(20),
    excludedStates: z.array(z.int().nonnegative()).max(3),
  });
const ThreatTokensCapabilitySchema = z.strictObject({
  version: z.literal('source-threat-tokens-v1'),
  evidenceHash: HashSchema,
  ownedProductIds: z.tuple([z.literal(0)]),
  encounters: z.tuple([threatTokenOwner('retry'), threatTokenOwner('null-product')]),
  gate: z.strictObject({
    state: z.int().nonnegative(),
    action: z.int().nonnegative(),
    excludedTarget: z.int().nonnegative(),
    capability: z.literal('null-product-not-owned'),
  }),
  threat: z.strictObject({
    definition: SourceSchema,
    state: z.int().nonnegative(),
    action: z.int().nonnegative(),
    binding: VariableRefSchema,
    delta: z.literal(-4),
  }),
  roundsFingerprint: HashSchema,
  failureFingerprint: HashSchema,
  methods: z.strictObject({
    confirm: methodEvidence,
    cancel: methodEvidence,
    owns: methodEvidence,
    isOwned: methodEvidence,
    add: methodEvidence,
    threat: methodEvidence,
    binding: methodEvidence,
    getThreat: methodEvidence,
    setThreat: methodEvidence,
    hide: methodEvidence,
    release: methodEvidence,
    sequence: methodEvidence,
  }),
});
const productModel = <I extends number>(id: I) =>
  z.strictObject({ id: z.literal(id), source: SourceSchema, objectHash: HashSchema });
const BaseProductsCapabilitySchema = z.strictObject({
  version: z.literal('source-base-products-v1'),
  prefab: SourceSchema,
  definitionHash: HashSchema,
  prefabHash: HashSchema,
  sourceObjectHash: HashSchema,
  lifecycleHash: HashSchema,
  sourceCertificateHash: HashSchema,
  evidenceHash: HashSchema,
  ownedProductIds: z.tuple([z.literal(0)]),
  models: z.tuple([productModel(0), productModel(5)]),
  gate: z.strictObject({
    state: z.int().nonnegative(),
    action: z.int().nonnegative(),
    excludedTarget: z.int().nonnegative(),
    capability: z.literal('outside-approved-base-products'),
  }),
  excludedStates: z.array(z.int().nonnegative()).length(5),
  roundsFingerprint: HashSchema,
  failureFingerprint: HashSchema,
  methods: z.strictObject({
    owns: methodEvidence,
    isOwned: methodEvidence,
    product: methodEvidence,
    compare: methodEvidence,
    add: methodEvidence,
    confirm: methodEvidence,
    cancel: methodEvidence,
    hide: methodEvidence,
    release: methodEvidence,
  }),
});
const ItemsCapabilitySchema = z.strictObject({
  version: z.literal('source-item-inventory-v1'),
  prefab: SourceSchema,
  prefabHash: HashSchema,
  definitionHash: HashSchema,
  sourceObjectHash: HashSchema,
  lifecycleHash: HashSchema,
  sourceCertificateHash: HashSchema,
  evidenceHash: HashSchema,
  ownedProductIds: z.tuple([z.literal(0)]),
  product: productModel(0),
  initialInventory: z.array(z.never()).length(0),
  baseSkillModelIds: z.array(Int32Schema).min(1).max(200),
  collectorSkillId: Int32Schema,
  titleModel: z.strictObject({
    source: SourceSchema,
    modelId: Int32Schema,
    objectHash: HashSchema,
  }),
  modal: z.strictObject({
    state: z.int().nonnegative(),
    owner: z.int().nonnegative(),
    waiter: z.int().nonnegative(),
  }),
  grant: ItemGrantSchema,
  roundsFingerprint: HashSchema,
  failureFingerprint: HashSchema,
  methods: z.record(
    z.enum([
      'enter',
      'progress',
      'title',
      'titleProgress',
      'upgrade',
      'owned',
      'nonMounts',
      'skill',
      'modalUpdate',
      'modalOpen',
      'modalClose',
      'modalCallback',
      'sequence',
    ]),
    methodEvidence,
  ),
});
const scalar = z.union([Int32Schema, z.boolean(), VectorSchema, z.string().max(1000)]);
const variable = z.strictObject({
  name: z.string().min(1).max(150),
  type: z.enum(['int', 'bool', 'vector', 'string']),
  value: scalar,
});
const intValue = z.union([
  z.strictObject({ kind: z.literal('literal'), value: Int32Schema }),
  z.strictObject({ kind: z.literal('variable'), ref: VariableRefSchema }),
]);
const tile = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('start') }),
  z.strictObject({ kind: z.literal('hash'), value: Int32Schema }),
  z.strictObject({ kind: z.literal('variable'), ref: VariableRefSchema }),
]);
const actionBase = {
  index: z.int().nonnegative().max(100),
  origin: z.strictObject({
    type: z.string().min(1).max(200),
    parameterHash: HashSchema,
    load: z.literal('hash-match-positional'),
  }),
};
const action = <O extends string, T extends z.ZodRawShape>(op: O, shape: T) =>
  z.strictObject({ ...actionBase, op: z.literal(op), ...shape });
// No executable strings, catch-all action or unknown-action fallback.
export const ScenarioActionSchema = z.discriminatedUnion('op', [
  action('confirm', {
    text: SourceTextSchema,
    label: SourceTextSchema,
    cancelLabel: SourceTextSchema,
    confirmEvent: z.string().min(1).max(100),
    cancelEvent: z.string().min(1).max(100),
  }),
  action('modalWait', {
    text: SourceTextSchema,
    label: SourceTextSchema,
    cancelLabel: SourceTextSchema,
    confirmEvent: z.string().min(1).max(100),
    cancelEvent: z.string().min(1).max(100),
  }),
  action('addItem', { itemModel: SourceSchema, text: SourceTextSchema }),
  action('sourceTest', {
    text: SourceTextSchema,
    stat: StatSchema,
    target: z.int().min(1).max(99),
    passEvent: z.string().min(1).max(100),
    failEvent: z.string().min(1).max(100),
  }),
  action('challenge', {
    text: SourceTextSchema,
    stat: StatSchema,
    sum: z.union([
      VariableRefSchema,
      z.strictObject({ kind: z.literal('literal'), value: z.int().min(0).max(99) }),
    ]),
    bounds: z
      .array(
        z.strictObject({
          maximum: z.union([z.int().min(0).max(99), VariableRefSchema]),
          event: z.string().min(1).max(100),
        }),
      )
      .min(1)
      .max(20),
  }),
  action('choice', {
    text: SourceTextSchema,
    options: z
      .array(
        z.strictObject({
          event: z.string().min(1).max(100),
          label: SourceTextSchema,
          requirement: VariableRefSchema.optional(),
          cost: z.literal('interact').optional(),
        }),
      )
      .min(1)
      .max(20),
    cancel: z
      .strictObject({ event: z.string().min(1).max(100), label: SourceTextSchema })
      .nullable(),
  }),
  action('chooseHero', { text: SourceTextSchema, target: VariableRefSchema }),
  action('awardTitle', { recipient: VariableRefSchema, titleModel: SourceSchema }),
  action('nullProduct', { products: z.tuple([z.null()]), falseEvent: z.string().min(1).max(100) }),
  action('ownsProducts', {
    products: z.tuple([SourceSchema.nullable()]),
    ownEvent: z.string().min(1).max(100),
    missingEvent: z.string().min(1).max(100),
  }),
  action('lore', { amount: z.int().min(1).max(99) }),
  action('awardXP', { amount: z.int().min(0).max(99) }),
  action('nextAdventure', { source: SourceSchema, id: Int32Schema }),
  action('proceed', {}),
  action('endGame', { success: z.literal(true) }),
  action('physical', { text: SourceTextSchema, program: PhysicalProgramSchema }),
  action('message', {
    mode: z.enum(['ordinary', 'tile', 'scout', 'spirit', 'objective']),
    text: SourceTextSchema,
    ignoreLog: z.boolean(),
    inspiration: z.literal(1).optional(),
    recovery: SearchRecoverySchema.optional(),
    boon: BoonKindSchema.optional(),
    sprint: z.literal(1).optional(),
    consequence: z
      .strictObject({
        family: z.enum(['damage', 'fear']),
        amount: z.int().min(1).max(56),
        face: z.enum(['faceup', 'facedown']),
      })
      .optional(),
  }),
  action('getStart', { target: VariableRefSchema }),
  action('revealTile', { tile }),
  action('highlight', { tile, spaceIndex: z.int().min(0).max(31) }),
  action('explore', {
    tile,
    noInspiration: z.boolean(),
    skipIntro: z.boolean(),
    skipOutro: z.boolean(),
    skipAdjacentSectionEvent: z.boolean().optional(),
    intro: SourceTextSchema.optional(),
  }),
  action('section', { sectionId: z.int().min(0).max(3), text: SourceTextSchema }),
  action('objective', {
    id: z.int().nonnegative(),
    text: SourceTextSchema,
    bindings: z
      .array(
        z.strictObject({
          placeholder: z.string().regex(/^\{[a-zA-Z0-9_-]{1,80}\}$/),
          ref: VariableRefSchema,
        }),
      )
      .min(1)
      .max(5)
      .optional(),
  }),
  action('threat', { source: SourceSchema, threshold: z.int().positive().max(999) }),
  action('set', { target: VariableRefSchema, value: scalar }),
  action('flip', { target: VariableRefSchema }),
  action('getTile', { target: VariableRefSchema }),
  action('getPosition', { target: VariableRefSchema }),
  action('branchBool', {
    ref: VariableRefSchema,
    trueEvent: z.string().min(1).max(100),
    falseEvent: z.string().min(1).max(100),
  }),
  action('broadcast', { event: z.string().min(1).max(100) }),
  action('send', { definition: SourceSchema, event: z.string().min(1).max(100) }),
  action('spawnFixed', {
    model: SourceSchema,
    logic: SourceSchema,
    spaceId: z.string().min(1).max(200),
    size: z.literal(2),
    additionalPoints: z.literal(13),
    ignoreCost: z.literal(false),
    randomBonuses: z.literal(false),
    bonuses: z.array(z.never()).length(0),
    text: SourceTextSchema,
    grant: z.boolean(),
    successEvent: z.string().min(1).max(100),
    failureEvent: z.string().min(1).max(100),
  }),
  action('removeEnemies', {}),
  action('spawnRandom', {
    suffering: NegatedSufferingSchema.optional(),
    points: VariableRefSchema,
    text: SourceTextSchema,
    excludeGameEnemyPoints: z.boolean(),
    trial: z
      .strictObject({
        stat: StatSchema,
        target: z.int().min(1).max(99),
        failure: z.strictObject({
          family: z.enum(['damage', 'fear']),
          amount: z.int().min(1).max(56),
          face: z.enum(['faceup', 'facedown']),
        }),
      })
      .optional(),
    filter: z.strictObject({
      MustHaveAny: Int32Schema,
      MustHaveAll: Int32Schema,
      ExcludeIfAny: Int32Schema,
    }),
    sections: z.array(z.int().min(0).max(3)).max(4).nullable(),
  }),
  action('release', {}),
  action('stop', {}),
  action('revealNode', {}),
  action('hideNode', {}),
  action('addInt', { target: VariableRefSchema, value: intValue }),
  action('subtractInt', { target: VariableRefSchema, left: intValue, right: intValue }),
  action('multiplyInt', { target: VariableRefSchema, left: intValue, right: intValue }),
  action('compareInt', {
    left: intValue,
    right: intValue,
    equalEvent: z.string().min(1).max(100),
    lessEvent: z.string().min(1).max(100),
    greaterEvent: z.string().min(1).max(100),
  }),
  action('copyInt', { target: VariableRefSchema, value: intValue }),
  action('switchInt', {
    value: intValue,
    cases: z
      .array(z.strictObject({ equals: intValue, event: z.string().min(1).max(100) }))
      .min(1)
      .max(100),
  }),
  action('isExplored', {
    tile,
    trueEvent: z.string().min(1).max(100),
    falseEvent: z.string().min(1).max(100),
  }),
  action('focus', { positions: z.array(VariableRefSchema).min(1).max(20) }),
]);
export type ScenarioAction = z.infer<typeof ScenarioActionSchema>;
export const ScenarioDefinitionSchema = z.strictObject({
  source: SourceSchema,
  initial: z.int().nonnegative(),
  variables: z.array(variable).max(200),
  handlers: z.record(z.string().min(1).max(100), z.int().nonnegative()),
  deferredHandlers: z.record(z.string().min(1).max(100), z.string().min(1).max(100)).default({}),
  states: z
    .array(
      z.strictObject({
        index: z.int().nonnegative(),
        transitions: z.record(z.string().min(1).max(100), z.int().nonnegative()),
        deferredTransitions: z
          .record(z.string().min(1).max(100), z.string().min(1).max(100))
          .optional(),
        actions: z.array(ScenarioActionSchema).max(100),
      }),
    )
    .min(1)
    .max(100),
});
export const ScenarioPackSchema = z.strictObject({
  formatVersion: z.literal(1),
  algorithm: z.literal('source-startup-ir-v1'),
  identity: z.strictObject({
    adventureId: z.union([z.literal(1), z.literal(2)]),
    adventureSource: SourceSchema,
    language: z.literal('Italian'),
  }),
  name: z.string().min(1).max(200),
  sources: z
    .array(z.strictObject({ file: z.string().min(1).max(150), sha256: HashSchema }))
    .min(1)
    .max(100),
  globals: z.array(variable).max(500),
  principal: SourceSchema,
  timers: z.array(SourceSchema).max(20),
  definitions: z.array(ScenarioDefinitionSchema).min(1).max(500),
  preparedEffects: z
    .array(
      z.discriminatedUnion('effect', [
        z.strictObject({
          skillId: ContentIdSchema,
          cardHash: HashSchema,
          effect: z.literal('inspiration'),
          amount: z.literal(1),
        }),
        z.strictObject({
          skillId: ContentIdSchema,
          cardHash: HashSchema,
          effect: z.literal('requires-capability'),
          capability: z.string().min(1).max(100),
        }),
      ]),
    )
    .max(100)
    .optional(),
  manifest: z.strictObject({
    campDeparture: CampDepartureCapabilitySchema.optional(),
    battleStartup: CampDepartureCapabilitySchema.optional(),
    startupPreparation: z
      .strictObject({
        version: z.literal('source-startup-preparation-v1'),
        frontsFingerprint: HashSchema,
        catalogHash: HashSchema,
        evidenceHash: HashSchema,
      })
      .optional(),
    liveGroups: z
      .strictObject({
        version: z.literal('source-live-groups-v1'),
        evidenceHash: HashSchema,
        roundsFingerprint: HashSchema,
        followupFingerprint: HashSchema,
        failureFingerprint: HashSchema,
      })
      .optional(),
    threatContinuations: ThreatContinuationsSchema.optional(),
    boons: z
      .strictObject({ version: z.literal('source-boons-v1'), fingerprint: HashSchema })
      .optional(),
    failure: AdventureFailureCapabilitySchema.optional(),
    campSkills: CampSkillsCapabilitySchema.optional(),
    campItems: CampItemsCapabilitySchema.optional(),
    campPreparation: CampPreparationCapabilitySchema.optional(),
    lair: LairCapabilitySchema.optional(),
    linked: LinkedCapabilitySchema.optional(),
    baseProducts: BaseProductsCapabilitySchema.optional(),
    items: ItemsCapabilitySchema.optional(),
    firstCombat: FirstCombatCapabilitySchema.optional(),
    searches: SearchesCapabilitySchema.optional(),
    threatTokens: ThreatTokensCapabilitySchema.optional(),
    clues: z
      .strictObject({
        version: z.literal('source-clues-v1'),
        projectionFingerprint: HashSchema,
        encounters: z.array(SourceSchema).length(4),
        counter: VariableRefSchema,
        event: z.string().min(1).max(100),
        fortEvent: z.string().min(1).max(100),
        fort: z.strictObject({
          prefab: SourceSchema,
          tile: VariableRefSchema,
          position: VariableRefSchema,
        }),
        evidenceHash: HashSchema,
      })
      .optional(),
    combat: CombatClosureArtifactSchema.optional(),
    rounds: RoundSourceSchema.optional(),
    followup: z
      .strictObject({
        version: z.literal('source-shadow-followup-v1'),
        projectionFingerprint: HashSchema,
        evidenceHash: HashSchema,
        playerCountBinding: z.string().min(1).max(150),
        enemyPointsBinding: z.string().min(1).max(150),
        thresholdEvent: z.string().min(1).max(100),
        instances: z
          .array(
            z.strictObject({
              gameObject: SourceSchema,
              definition: SourceSchema,
              kind: z.enum(['logic', 'threat']),
              hasNode: z.boolean(),
              initializationHash: HashSchema,
              lifecycleHash: HashSchema,
            }),
          )
          .min(1)
          .max(32),
        thresholds: z
          .array(z.strictObject({ source: SourceSchema, definition: SourceSchema.nullable() }))
          .min(1)
          .max(100),
        deployment: z.strictObject({
          version: z.literal('source-deployment-v1'),
          source: DeploymentSourceSchema,
          compiled: z.unknown(),
          fingerprint: HashSchema,
        }),
        deploymentText: SourceTextSchema,
        explorationNodes: z
          .array(
            z.strictObject({
              tileSource: SourceSchema,
              source: SourceSchema,
              position: VectorSchema,
            }),
          )
          .max(200),
        explorationText: z.strictObject({ single: SourceTextSchema, plural: SourceTextSchema }),
      })
      .optional(),
    scope: z.enum([
      'startup-only',
      'battle-startup-v1',
      'synthetic-physical-p0',
      'synthetic-physical-p1',
      'original-encounter-v1',
    ]),
    playablePrefabs: z.array(SourceSchema).length(1).optional(),
    exploration: z
      .strictObject({
        version: z.literal('source-exploration-v1'),
        definition: SourceSchema,
        tiles: z
          .array(
            z.strictObject({
              source: SourceSchema,
              intros: z.array(SourceTextSchema).min(1).max(56),
            }),
          )
          .min(1)
          .max(200),
        inspiration: z.union([z.literal(0), z.literal(1)]),
        outro: SourceTextSchema,
        adjacent: z.strictObject({
          event: z.string().min(1).max(100),
          variable: VariableRefSchema.nullable(),
        }),
        evidenceHash: HashSchema,
      })
      .optional(),
    evidenceHash: HashSchema,
    prefabs: z
      .array(
        z.strictObject({
          source: SourceSchema,
          modelSource: SourceSchema,
          encounterId: Int32Schema,
          nodeSource: SourceSchema,
          nodeType: z.enum(['search', 'person', 'threat']),
          sourceNodeType: z.int().min(0).max(20).default(0),
          token3DType: z.int().min(0).max(100).default(2),
          fsmSource: SourceSchema,
          initializationHash: HashSchema,
          closureHash: HashSchema,
          inspection: SourceTextSchema,
          capabilities: z.array(z.string().min(1).max(100)).min(1).max(20),
          progress: z
            .strictObject({ firstPass: VariableRefSchema, total: VariableRefSchema })
            .optional(),
        }),
      )
      .min(0)
      .max(500),
  }),
});
export type ScenarioPack = z.infer<typeof ScenarioPackSchema>;
export type ScenarioDefinition = z.infer<typeof ScenarioDefinitionSchema>;
export type VariableRef = z.infer<typeof VariableRefSchema>;
export const SourceSprintInputSchema = z.strictObject({
  kind: z.literal('source-sprint'),
  destinationSpaceId: z.string().min(1).max(100).nullable(),
});
export const EncounterInputSchema = z.discriminatedUnion('kind', [
  CampDepartureInputSchema,
  CampSkillInputSchema,
  CampItemInputSchema,
  ...CampPreparationInputs,
  ...PhysicalInputSchema.options,
  z.strictObject({ kind: z.literal('ack') }),
  z.strictObject({ kind: z.literal('choice'), event: z.string().min(1).max(100) }),
  z.strictObject({ kind: z.literal('choose-hero'), heroId: ContentIdSchema }),
  SourceSprintInputSchema,
  z.strictObject({
    kind: z.literal('camp-role'),
    heroId: ContentIdSchema,
    roleId: ContentIdSchema,
  }),
]);
const playBinding = {
  expectedRevision: z.int().nonnegative(),
  scenarioId: z.uuid(),
  packFingerprint: HashSchema,
  projectionFingerprint: HashSchema,
};
export const EncounterIntentSchema = z.discriminatedUnion('type', [
  z.strictObject({
    ...playBinding,
    type: z.literal('INTERACT_SCENARIO'),
    instanceId: z.string().min(1).max(200),
    heroId: ContentIdSchema,
    roundId: z.uuid(),
    turnId: z.uuid(),
    sourceFingerprint: HashSchema,
    choiceEvent: z.string().min(1).max(100).optional(),
  }),
  z.strictObject({
    ...playBinding,
    type: z.literal('SCENARIO_INPUT'),
    pendingId: z.uuid(),
    sourceFingerprint: HashSchema,
    heroId: ContentIdSchema.nullable(),
    input: EncounterInputSchema,
  }),
  z.strictObject({
    ...playBinding,
    type: z.literal('EXPLORE_SCENARIO'),
    mapId: z.uuid(),
    heroId: ContentIdSchema,
    roundId: z.uuid(),
    turnId: z.uuid(),
    fromSpaceId: z.string().min(1).max(100),
    destinationSpaceId: z.string().min(1).max(100),
    sourceFingerprint: HashSchema,
  }),
]);
export const ScenarioInstanceSchema = z.strictObject({
  id: z.string().min(1).max(200),
  kind: z.enum(['principal', 'timer', 'encounter', 'exploration', 'logic', 'threat']),
  definition: SourceSchema,
  prefab: SourceSchema.nullable(),
  spaceId: z.string().max(200).nullable(),
  state: z.int().nonnegative(),
  entry: z.int().nonnegative(),
  started: z.array(z.int().nonnegative()).max(100),
  completed: z.array(z.int().nonnegative()).max(100),
  settled: z.boolean(),
  processing: z.union([z.literal(0), z.literal(1)]),
  stopped: z.boolean(),
  visible: z.boolean(),
  variables: z.record(z.string(), scalar),
});
export const ScenarioRequestSchema = z.strictObject({
  id: z.uuid(),
  instanceId: z.string().max(200),
  state: z.int().nonnegative(),
  entry: z.int().nonnegative(),
  action: z.int().min(-1),
  kind: z.enum([
    'message',
    'placement',
    'scout',
    'test',
    'objective',
    'handoff',
    'physical',
    'choice',
    'hero-choice',
    'source-attack',
    'sprint',
    'exploration-intro',
    'exploration-outro',
    'deployment-intro',
    'deployment',
    'exploration-markers',
    'camp-preparation',
    'campaign-map',
    'campaign-story',
    'camp',
  ]),
  options: z
    .array(z.strictObject({ event: z.string().min(1).max(100), label: SourceTextSchema }))
    .min(1)
    .max(21)
    .optional(),
  text: SourceTextSchema,
  heroId: ContentIdSchema.nullable(),
  actorPlayerId: z.uuid().nullable(),
  stage: z.enum(['ready', 'revealed']),
  tileSource: SourceSchema.nullable(),
  fingerprint: HashSchema,
  physical: z
    .strictObject({
      parentId: z.uuid(),
      cursor: HashSchema.optional(),
      child: z.int().min(0).max(32),
      grant: z.int().min(0).max(4).nullable(),
    })
    .optional(),
});
const taskBase = {
  instanceId: z.string().max(200),
  entry: z.int().nonnegative(),
  action: z.int().nonnegative(),
};
const ExplorationAttemptFields = {
  id: z.uuid(),
  instanceId: z.string().max(200),
  tileSource: SourceSchema,
  heroId: ContentIdSchema,
  playerId: z.uuid(),
  roundId: z.uuid(),
  requestId: z.string().min(24).max(80),
  fromSpaceId: z.string().max(100),
  destinationSpaceId: z.string().max(100),
  movesRemaining: z.int().min(0).max(4),
  movementCost: z.literal(1),
  actionCost: z.literal(0),
  entropy: HashSchema,
  intro: z.int().nonnegative().max(99),
  reward: z.int().min(0).max(1),
  returned: z.boolean(),
};
const TurnExplorationAttemptSchema = z.strictObject({
  ...ExplorationAttemptFields,
  turnId: z.uuid(),
});
const ShadowExplorationAttemptSchema = z.strictObject({
  ...ExplorationAttemptFields,
  turnId: z.null(),
  shadowOrigin: z.strictObject({
    version: z.literal('source-shadow-exploration-v1'),
    frameId: z.uuid(),
    attemptId: z.uuid(),
  }),
});
const SprintExplorationAttemptSchema = TurnExplorationAttemptSchema.extend({
  sprintOrigin: z.strictObject({ version: z.literal('source-sprint-v1'), attemptId: z.uuid() }),
});
export const ScenarioSchema = z.strictObject({
  battle: BattleStartupStateSchema.optional(),
  firstCombat: FirstCombatStateSchema.optional(),
  conclusion: z
    .strictObject({
      version: z.enum(['source-adventure-failure-v1', 'source-lair-victory-v1']),
      id: z.uuid(),
      outcome: z.enum(['failure', 'victory']),
      timing: z.enum([
        'no-active-heroes',
        'shadow-start',
        'threat-start',
        'threat-increase',
        'source-end',
      ]),
      cause: z.union([
        z.strictObject({
          kind: z.literal('source-victory'),
          instanceId: z.string().min(1).max(200),
          effectId: z.string().min(1).max(300),
          instructionHash: HashSchema,
          attemptId: z.uuid(),
          heroId: ContentIdSchema,
          playerId: z.uuid(),
          controllerHash: HashSchema,
        }),
        ThreatCauseSchema,
        z.strictObject({
          runId: z.uuid(),
          heroId: ContentIdSchema,
          instructionHash: HashSchema,
        }),
      ]),
      triggerRequestId: z.string().min(24).max(80),
      episodeHash: HashSchema,
      suspendedRequest: ScenarioRequestSchema.nullable(),
      suspendedPrincipal: ScenarioInstanceSchema,
      stage: z.enum(['conclusion', 'campaign-map', 'campaign-story', 'camp', 'camp-preparation']),
      xp: z
        .array(
          z.strictObject({
            heroId: ContentIdSchema,
            roleId: ContentIdSchema,
            amount: z.int().nonnegative().max(99),
            source: z.string().max(300),
          }),
        )
        .max(5),
      bonusLore: z.int().nonnegative().max(99),
      nextAdventureId: Int32Schema.nullable(),
      alternatives: z.array(Int32Schema).max(100),
      completedAdventureIds: z.array(Int32Schema).max(100),
      transitionCount: z.int().min(0).max(1),
      campEntryCount: z.int().min(0).max(1),
      campaign: z
        .strictObject({
          heroes: z
            .array(
              z.strictObject({
                heroId: ContentIdSchema,
                roleId: ContentIdSchema.nullable(),
                status: z.literal('active'),
                lastStandDifficulty: z.literal(1),
                itemCopies: z.array(CopyIdSchema).max(3),
                titleCopies: z.array(CopyIdSchema).max(21),
                skillCopies: z.array(CopyIdSchema).max(200).optional(),
              }),
            )
            .max(5),
          inventory: z
            .array(
              z.strictObject({ copy: CopyIdSchema, cardId: ContentIdSchema, modelId: Int32Schema }),
            )
            .max(1)
            .optional(),
          training: CampTrainingSchema.optional(),
          preparation: CampPreparationSchema.optional(),
          sceneGlobals: z.record(z.string(), scalar),
          adventureRules: z.array(z.string().max(1000)).max(100),
          next: z
            .strictObject({
              source: SourceSchema,
              id: Int32Schema,
              type: z.enum(['journey', 'battle']),
              status: z.literal('requires-content'),
            })
            .nullable(),
        })
        .nullable(),
    })
    .optional(),
  rounds: SourceRoundStateSchema.optional(),
  enemies: DeploymentStateSchema.optional(),
  explorationMarkers: z
    .array(z.strictObject({ source: SourceSchema, tileSource: SourceSchema, visible: z.boolean() }))
    .max(200)
    .optional(),
  explorations: z
    .strictObject({
      version: z.literal('source-exploration-v1'),
      active: z.uuid().nullable(),
      attempts: z
        .array(
          z.union([
            TurnExplorationAttemptSchema,
            ShadowExplorationAttemptSchema,
            SprintExplorationAttemptSchema,
          ]),
        )
        .max(200),
    })
    .optional(),
  play: z
    .strictObject({
      active: z.uuid().nullable(),
      lore: z.int().nonnegative(),
      attempts: z
        .array(
          z.strictObject({
            id: z.uuid(),
            instanceId: z.string().max(200),
            heroId: ContentIdSchema,
            playerId: z.uuid(),
            roundId: z.uuid(),
            turnId: z.uuid(),
            requestId: z.string().min(24).max(80),
            cost: z.literal(1),
            entryChoice: z
              .strictObject({
                state: z.int().nonnegative(),
                action: z.int().nonnegative(),
                event: z.string().min(1).max(100),
              })
              .optional(),
            returned: z.boolean(),
            interrupted: z.literal('hero-defeated').optional(),
          }),
        )
        .max(1000),
      tests: z
        .array(
          z.strictObject({
            attemptId: z.uuid(),
            source: z.string().max(300),
            runId: z.uuid(),
            heroId: ContentIdSchema,
            stat: StatSchema,
            target: z.int().min(1).max(99).nullable(),
            successes: z.int().nonnegative(),
            total: z.int().min(0).max(99).nullable(),
          }),
        )
        .max(1000),
    })
    .optional(),
  id: z.uuid(),
  pack: ScenarioPackSchema,
  packFingerprint: HashSchema,
  projectionFingerprint: HashSchema,
  phase: z.enum(['setup', 'action']),
  instances: z.array(ScenarioInstanceSchema).min(1).max(600),
  globals: z.record(z.string(), scalar),
  tiles: z
    .array(z.strictObject({ source: SourceSchema, visible: z.boolean(), explored: z.boolean() }))
    .min(1)
    .max(200),
  spaceBindings: z
    .array(z.strictObject({ sourceId: z.string().max(200), id: z.string().max(100) }))
    .min(1)
    .max(1000),
  tasks: z
    .array(
      z.discriminatedUnion('kind', [
        z.strictObject({
          ...taskBase,
          kind: z.literal('startup'),
          parentId: z.uuid(),
          heroId: ContentIdSchema,
        }),
        z.strictObject({
          ...taskBase,
          kind: z.literal('spawnFixed'),
          effectId: z.string().min(1).max(300),
          stage: z.enum(['placement', 'following', 'grant', 'attack']),
        }),
        z.strictObject({
          ...taskBase,
          kind: z.literal('sprint'),
          attemptId: z.uuid(),
          fromSpaceId: z.string().min(1).max(100),
          stage: z.enum(['choice', 'exploring']),
        }),
        z.strictObject({
          ...taskBase,
          kind: z.literal('spawnRandom'),
          stage: z.enum(['intro', 'placements']),
          groupIndex: z.int().nonnegative(),
          effectId: z.string().max(300),
          parentId: z.uuid().optional(),
        }),
        z.strictObject({ ...taskBase, kind: z.literal('physical'), parentId: z.uuid() }),
        z.strictObject({
          ...taskBase,
          kind: z.literal('explore'),
          tileSource: SourceSchema,
          spaceIndex: z.int().nonnegative(),
          stage: z.enum(['intro', 'pre', 'revealed', 'next', 'adjacent', 'outro', 'done']),
          waiting: z.string().max(200).nullable(),
          adjacent: z.array(z.int().min(0).max(3)).max(4).optional(),
          adjacentIndex: z.int().nonnegative().max(4).optional(),
        }),
        z.strictObject({
          ...taskBase,
          kind: z.literal('section'),
          sectionId: z.int().nonnegative(),
          tileIndex: z.int().nonnegative(),
          remaining: z.array(SourceSchema).max(200).optional(),
          order: z.array(SourceSchema).max(200).optional(),
          markers: z.enum(['unrevealed', 'pending', 'done']).optional(),
        }),
      ]),
    )
    .max(30),
  pending: ScenarioRequestSchema.nullable(),
  objective: z.strictObject({ id: z.int().nonnegative(), text: SourceTextSchema }).nullable(),
  threats: z
    .array(z.strictObject({ source: SourceSchema, threshold: z.int().positive() }))
    .max(100),
  completedSetup: z
    .array(
      z.strictObject({
        kind: z.enum(['scout', 'test']),
        heroId: ContentIdSchema,
        source: z.string().max(300),
        requestId: z.uuid(),
        serviceId: z.uuid(),
        revealed: z.array(CopyIdSchema).min(1).max(30),
        converted: z.int().nonnegative(),
        outcome: z.enum(['pass', 'fail']).nullable(),
        reward: z.int().min(0).max(1),
      }),
    )
    .max(10),
  effects: z
    .array(
      z.strictObject({
        id: z.string().max(300),
        instanceId: z.string().max(200),
        state: z.int().nonnegative(),
        entry: z.int().nonnegative(),
        action: z.int().nonnegative(),
        op: z.string().max(100),
      }),
    )
    .max(10000),
  events: z
    .array(
      z.strictObject({
        id: z.uuid(),
        event: z.string().max(100),
        receivers: z.array(z.string().max(200)).max(600),
      }),
    )
    .max(1000),
  commands: z
    .array(
      z.strictObject({
        playerId: z.uuid(),
        requestId: z.string().max(100),
        pendingId: z.uuid().nullable(),
        source: z.string().max(300),
        kind: z.string().max(50),
        revision: z.int().nonnegative(),
      }),
    )
    .max(5000),
  cardEffects: z
    .array(
      z.strictObject({
        id: z.string().max(400),
        heroId: ContentIdSchema,
        copy: CopyIdSchema,
        policyHash: HashSchema,
        source: z.string().max(300),
        reward: z.int().min(0).max(1),
      }),
    )
    .max(100)
    .optional(),
  initialInspiration: z
    .array(z.strictObject({ heroId: ContentIdSchema, value: z.int().nonnegative() }))
    .min(1)
    .max(5),
  messageLog: z
    .array(z.strictObject({ id: z.string().max(300), text: SourceTextSchema }))
    .max(1000),
  handoffCount: z.int().min(0).max(1),
});
export type Scenario = z.infer<typeof ScenarioSchema>;
const publicExplorations = ScenarioSchema.shape.explorations.unwrap();
export const ScenarioViewSchema = ScenarioSchema.extend({
  enemies: DeploymentStateSchema.omit({ entropy: true }).optional(),
  explorations: publicExplorations
    .extend({
      attempts: z
        .array(
          z.union([
            TurnExplorationAttemptSchema.omit({ entropy: true }),
            ShadowExplorationAttemptSchema.omit({ entropy: true }),
            SprintExplorationAttemptSchema.omit({ entropy: true }),
          ]),
        )
        .max(200),
    })
    .optional(),
});
export type ScenarioView = z.infer<typeof ScenarioViewSchema>;
export function scenarioView(sc: Scenario | null): ScenarioView | null {
  if (!sc) return null;
  const { enemies, explorations, ...visible } = sc;
  const publicEnemies = enemies ? (({ entropy: _entropy, ...rest }) => rest)(enemies) : null;
  return {
    ...visible,
    ...(publicEnemies ? { enemies: publicEnemies } : {}),
    ...(explorations
      ? {
          explorations: {
            ...explorations,
            attempts: explorations.attempts.map(({ entropy: _entropy, ...attempt }) => attempt),
          },
        }
      : {}),
  };
}
export type ScenarioInstance = z.infer<typeof ScenarioInstanceSchema>;
export type ScenarioRequest = z.infer<typeof ScenarioRequestSchema>;
export const ScenarioOfferSchema = z.strictObject({
  available: z.boolean(),
  reason: z.string().max(1000),
  packFingerprint: HashSchema.nullable(),
  projectionFingerprint: HashSchema.nullable(),
  name: z.string().max(200).nullable(),
});

export const HANDOFF_TEXT: SourceText = [
  {
    kind: 'text',
    text: 'L’avvio è completo. Inizia la Fase di Azione e scegli il primo eroe di turno.',
    style: 'plain',
  },
];
