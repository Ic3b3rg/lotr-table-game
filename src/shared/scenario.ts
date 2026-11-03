import { z } from 'zod';
import { HashSchema, SourceSchema, Int32Schema, VectorSchema } from './generated-map';
import { ContentIdSchema } from './catalog';
import { CopyIdSchema } from './preparation';
import { PhysicalProgramSchema, PhysicalInputSchema } from './physical';
import { StatSchema } from './skill-tests';

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
const scalar = z.union([Int32Schema, z.boolean(), VectorSchema]);
const variable = z.strictObject({
  name: z.string().min(1).max(150),
  type: z.enum(['int', 'bool', 'vector']),
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
    sum: VariableRefSchema,
    bounds: z
      .array(z.strictObject({ maximum: z.int().min(0).max(99), event: z.string().min(1).max(100) }))
      .min(1)
      .max(20),
  }),
  action('choice', {
    text: SourceTextSchema,
    options: z
      .array(z.strictObject({ event: z.string().min(1).max(100), label: SourceTextSchema }))
      .min(1)
      .max(20),
    cancel: z
      .strictObject({ event: z.string().min(1).max(100), label: SourceTextSchema })
      .nullable(),
  }),
  action('nullProduct', { products: z.tuple([z.null()]), falseEvent: z.string().min(1).max(100) }),
  action('lore', { amount: z.int().min(1).max(99) }),
  action('physical', { text: SourceTextSchema, program: PhysicalProgramSchema }),
  action('message', {
    mode: z.enum(['ordinary', 'tile', 'scout', 'spirit', 'objective']),
    text: SourceTextSchema,
    ignoreLog: z.boolean(),
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
  }),
  action('section', { sectionId: z.int().min(0).max(3), text: SourceTextSchema }),
  action('objective', { id: z.int().nonnegative(), text: SourceTextSchema }),
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
  action('release', {}),
  action('stop', {}),
  action('revealNode', {}),
  action('hideNode', {}),
  action('addInt', { target: VariableRefSchema, value: intValue }),
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
    adventureId: z.literal(1),
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
    scope: z.enum([
      'startup-only',
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
      .min(1)
      .max(500),
  }),
});
export type ScenarioPack = z.infer<typeof ScenarioPackSchema>;
export type ScenarioDefinition = z.infer<typeof ScenarioDefinitionSchema>;
export type VariableRef = z.infer<typeof VariableRefSchema>;
export const EncounterInputSchema = z.discriminatedUnion('kind', [
  ...PhysicalInputSchema.options,
  z.strictObject({ kind: z.literal('ack') }),
  z.strictObject({ kind: z.literal('choice'), event: z.string().min(1).max(100) }),
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
  kind: z.enum(['principal', 'timer', 'encounter', 'exploration']),
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
    'exploration-intro',
    'exploration-outro',
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
export const ScenarioSchema = z.strictObject({
  explorations: z
    .strictObject({
      version: z.literal('source-exploration-v1'),
      active: z.uuid().nullable(),
      attempts: z
        .array(
          z.strictObject({
            id: z.uuid(),
            instanceId: z.string().max(200),
            tileSource: SourceSchema,
            heroId: ContentIdSchema,
            playerId: z.uuid(),
            roundId: z.uuid(),
            turnId: z.uuid(),
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
          }),
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
