import { z } from 'zod';
import { ContentIdSchema } from './catalog';
import { HashSchema, SourceSchema, VectorSchema } from './generated-map';
import { CombatClosureArtifactSchema } from './combat';
import { DeploymentSourceSchema } from './deployment';

const id = z.string().min(1).max(350);
const origin = z.strictObject({
  definition: SourceSchema,
  state: z.int().nonnegative(),
  action: z.int().nonnegative(),
  parameterHash: HashSchema,
});
const filter = z.strictObject({
  MustHaveAny: z.int().nonnegative(),
  MustHaveAll: z.int().nonnegative(),
  ExcludeIfAny: z.int().nonnegative(),
});
const proof = z.strictObject({
  source: SourceSchema,
  objectHash: HashSchema,
});
const method = z.strictObject({
  assemblyHash: HashSchema,
  method: z.string().regex(/^06[0-9a-f]{6}$/),
  bodyHash: HashSchema,
});

/** Audited source adapters are frozen at departure, never selected by a client intent. */
export const BattleRoundsCapabilitySchema = z.strictObject({
  version: z.literal('source-battle-rounds-v1'),
  evidenceHash: HashSchema,
  boardFingerprint: HashSchema,
  baseCombatFingerprint: HashSchema,
  heroIds: z.array(ContentIdSchema).min(2).max(5),
  model: proof,
  adventure: proof.extend({ gameObject: SourceSchema }),
  principal: proof.extend({ gameObject: SourceSchema }),
  globals: proof.extend({
    defaults: z.record(z.string().min(1).max(150), z.union([z.int(), z.boolean(), z.string()])),
    reset: method,
  }),
  methods: z.record(z.string().min(1).max(100), method),
  // Parsed with the shared round schema and source compiler before accepting the capability.
  rounds: z.unknown(),
  combat: CombatClosureArtifactSchema,
  deployment: DeploymentSourceSchema,
  definitions: z.array(z.unknown()).min(1).max(32),
  certificates: z.array(z.unknown()).min(1).max(32),
  instances: z
    .array(
      z.strictObject({
        source: SourceSchema,
        gameObject: SourceSchema,
        role: z.enum(['principal', 'threshold', 'logic']),
        objectHash: HashSchema,
        lifecycleHash: HashSchema,
        certificateHash: HashSchema,
      }),
    )
    .min(1)
    .max(32),
  timers: z.array(SourceSchema).max(32),
  thresholds: z
    .array(
      z.strictObject({
        source: SourceSchema,
        owner: SourceSchema,
        definition: SourceSchema,
        perHero: z.int().positive().max(100),
        objectHash: HashSchema,
      }),
    )
    .length(4),
  thresholdEvent: id,
  playerCountBinding: id,
  enemyPointsBinding: id,
  principalThresholdBinding: id,
  productModels: z
    .array(proof.extend({ id: z.int().nonnegative() }))
    .min(1)
    .max(10),
  nodes: z
    .array(
      proof.extend({
        owner: SourceSchema,
        anchor: id,
        kind: z.enum(['threat', 'search']),
      }),
    )
    .min(1)
    .max(20),
  points: z
    .array(
      proof.extend({
        owner: SourceSchema,
        anchor: id,
        filter,
        cell: id,
        position: VectorSchema,
      }),
    )
    .min(1)
    .max(16),
  spawns: z
    .array(
      z.discriminatedUnion('kind', [
        z.strictObject({
          kind: z.literal('points'),
          origin,
          points: z
            .array(z.strictObject({ source: SourceSchema, perHero: z.int().nonnegative() }))
            .min(1)
            .max(16),
        }),
        z.strictObject({
          kind: z.enum(['fixed', 'tracker']),
          origin,
          recipe: id,
          anchor: id.nullable(),
          pose: z.enum(['source-point', 'actor', 'previous-group']),
          successEvent: id,
          failureEvent: id,
        }),
      ]),
    )
    .min(1)
    .max(32),
  deploymentText: z.unknown(),
  victoryEvent: id,
});

export const BattleRoundRuntimeSchema = z.strictObject({
  groups: z
    .array(
      z.strictObject({
        groupId: id,
        recipe: id,
        logicInstanceId: id,
        effectId: id,
        actorHeroId: ContentIdSchema.nullable(),
      }),
    )
    .max(100),
  callbacks: z
    .array(
      z.strictObject({
        id: z.uuid(),
        attackId: z.uuid(),
        groupId: id,
        logicInstanceId: id,
        heroId: ContentIdSchema,
        playerId: z.uuid(),
        exhausted: z.boolean(),
        nextGroupId: id.nullable(),
        returned: z.boolean(),
        interrupted: z.literal('hero-defeated').optional(),
      }),
    )
    .max(100),
  reserved: z.array(z.strictObject({ source: SourceSchema, count: z.int().nonnegative() })).max(32),
  reservedEliteBanners: z.int().nonnegative().max(32),
  bannerPools: z.strictObject({
    normal: z.array(z.int().nonnegative()).max(32),
    elite: z.array(z.int().nonnegative()).max(32),
    reservedElite: z.array(z.int().nonnegative()).max(32),
    returnedGroups: z.array(id).max(100),
  }),
});

export type BattleRoundsCapability = z.infer<typeof BattleRoundsCapabilitySchema>;
export type BattleRoundRuntime = z.infer<typeof BattleRoundRuntimeSchema>;
