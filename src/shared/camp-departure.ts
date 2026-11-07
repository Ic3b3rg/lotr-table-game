import { z } from 'zod';
import { ContentIdSchema, CampaignSkillDefinitionSchema } from './catalog';
import { HashSchema, SourceSchema, Int32Schema, VectorSchema } from './generated-map';
import { DeploymentSourceSchema } from './deployment';

const id = ContentIdSchema,
  hash = HashSchema;
const origin = z.strictObject({
  state: z.int().nonnegative(),
  action: z.int().nonnegative(),
  parameterHash: hash,
});
const step = { origin, text: z.string().min(1).max(20000) };
const anchor = z.string().min(1).max(100);
const filter = z.strictObject({
  MustHaveAny: z.int().nonnegative(),
  MustHaveAll: z.int().nonnegative(),
  ExcludeIfAny: z.int().nonnegative(),
});
export const BattleInstructionSchema = z.discriminatedUnion('op', [
  z.strictObject({
    ...step,
    op: z.literal('threshold'),
    perHero: z.literal(3),
    limitPerHero: z.literal(13),
  }),
  z.strictObject({ ...step, op: z.literal('board') }),
  z.strictObject({ ...step, op: z.literal('heroes'), anchor }),
  z.strictObject({ ...step, op: z.literal('scout'), count: z.literal(3) }),
  z.strictObject({
    ...step,
    op: z.literal('loss-weakness'),
    enHash: hash,
    itHash: hash,
    targets: z.literal('one-owner-one-hero'),
  }),
  z.strictObject({
    ...step,
    op: z.literal('terrain'),
    anchors: z.array(anchor).min(2).max(3),
    kinds: z
      .array(z.enum(['bush', 'wall', 'fire', 'rock']))
      .min(2)
      .max(3),
  }),
  z.strictObject({
    ...step,
    op: z.literal('spawn'),
    anchor,
    perHero: z.union([z.literal(4), z.literal(6), z.literal(5)]),
    filter,
  }),
  z.strictObject({
    ...step,
    op: z.literal('marker'),
    anchor,
    kind: z.enum(['threat', 'search']),
    lore: z.union([z.literal(0), z.literal(2)]),
  }),
  z.strictObject({ ...step, op: z.literal('objective'), id: z.literal(0) }),
  z.strictObject({ ...step, op: z.literal('handoff') }),
]);
const evidence = z
  .array(z.strictObject({ sourceId: id, locator: z.string().min(1).max(1000) }))
  .min(1)
  .max(20);
const card = z.strictObject({
  id,
  kind: z.enum(['basic', 'hero', 'role', 'weakness', 'purchased', 'title']),
  ownerId: id.nullable(),
  number: z.int().min(1).max(1000),
  copies: z.array(z.string().max(120)).min(1).max(5),
  identity: z.enum(['bound', 'requires-content']),
  definitionHash: hash,
  evidence,
});
/** Prospective authority. Embedded artifacts are fully recompiled by the server before use. */
export const CampDepartureCapabilitySchema = z.strictObject({
  version: z.literal('source-camp-departure-v1'),
  catalogHash: hash,
  preparationHash: hash,
  evidenceHash: hash,
  ownedProductIds: z.tuple([z.literal(0)]),
  target: z.strictObject({
    id: z.literal(2),
    model: SourceSchema,
    principal: SourceSchema,
    name: z.string().min(1).max(120),
  }),
  board: z.unknown(),
  boardFingerprint: hash,
  deckCatalog: z.strictObject({
    fingerprint: hash,
    heroIds: z.array(id).length(6),
    roleIds: z.array(id).length(6),
    cards: z.array(card).min(95).max(512),
  }),
  campaignSkills: z.array(CampaignSkillDefinitionSchema).max(221),
  fronts: z.unknown(),
  frontsFingerprint: hash,
  windows: z
    .array(
      z.strictObject({
        cardId: id,
        definitionHash: hash,
        policyHash: hash.nullable(),
        prepare: z.enum(['none', 'supported', 'requires-content']),
        setup: z.enum(['none', 'supported', 'requires-content']),
      }),
    )
    .max(512),
  spawnPolicy: z.literal('source-spawn-points-v1'),
  deployment: DeploymentSourceSchema,
  deploymentHash: hash,
  reserved: z.array(z.strictObject({ source: SourceSchema, count: z.int().nonnegative() })).max(32),
  reservedEliteBanners: z.int().nonnegative().max(32),
  instructions: z.array(BattleInstructionSchema).min(15).max(20),
  quantities: z.strictObject({
    status: z.enum(['invented', 'unverified']),
    values: z.tuple([
      z.int().nonnegative().nullable(),
      z.int().nonnegative().nullable(),
      z.int().nonnegative().nullable(),
    ]),
  }),
});
export const CampDepartureInputSchema = z.strictObject({
  kind: z.literal('camp-depart'),
  offerFingerprint: hash,
  agreed: z.literal(true),
});
export const CampDepartureOfferSchema = z.strictObject({
  available: z.boolean(),
  reason: z.string().max(2000),
  fingerprint: hash.nullable(),
  drawOrder: z.array(id).max(5),
  target: z.string().max(120).nullable(),
});
export const CampDepartureReceiptSchema = z.strictObject({
  version: z.literal('camp-departure-v1'),
  archivedEpisodeId: z.uuid(),
  episodeId: z.uuid(),
  archiveFingerprint: hash,
  sourceFingerprint: hash,
  deckSourceFingerprint: hash,
  deckArtifactFingerprint: hash,
  boardArtifactFingerprint: hash,
  realizationFingerprint: hash,
  drawOrder: z.array(id).min(2).max(5),
});
/** Stored in the existing ordinary ledger seed, never in a second command journal. */
export const EpisodeBoundarySchema = z.strictObject({
  version: z.literal('camp-departure-v1'),
  playerId: z.uuid(),
  requestId: z.string().min(24).max(80),
  expectedRevision: z.int().nonnegative(),
  input: CampDepartureInputSchema,
  pendingId: z.uuid(),
  sourceFingerprint: hash,
  entropy: hash,
  archiveFingerprint: hash,
  receipt: CampDepartureReceiptSchema,
});
export const BattleStartupStateSchema = z.strictObject({
  version: z.literal('source-battle-startup-v1'),
  cursor: z.int().nonnegative().max(20),
  runId: z.uuid().nullable(),
  runKey: z.enum(['initial', 'scout', 'loss', 'after-setup']).nullable(),
  initialized: z.boolean(),
  afterSetup: z.boolean(),
  presentation: z.int().min(0).max(100),
  heroIndex: z.int().nonnegative().max(5),
  placements: z
    .array(
      z.strictObject({
        anchor,
        kind: z.enum(['hero', 'bush', 'wall', 'fire', 'rock', 'threat', 'search']),
      }),
    )
    .max(20),
  sourceFingerprint: hash,
  campaign: z.strictObject({
    lore: z.int().nonnegative(),
    completedAdventureIds: z.array(z.int()).max(100),
    balances: z
      .array(z.strictObject({ heroId: id, roleId: id, availableXP: z.int().nonnegative() }))
      .max(30),
    lastStandsFailed: z.int().nonnegative(),
    inventoryHash: hash,
    globals: z.record(
      z.string(),
      z.union([z.string().max(1000), z.boolean(), Int32Schema, VectorSchema]),
    ),
    ownership: z.strictObject({
      heroes: z
        .array(
          z.strictObject({
            heroId: id,
            roleId: id.nullable(),
            itemCopies: z.array(z.string().max(120)).max(3),
            titleCopies: z.array(z.string().max(120)).max(21),
            purchasedCopies: z.array(z.string().max(120)).max(200),
          }),
        )
        .max(5),
      inventory: z
        .array(z.strictObject({ copy: z.string().max(120), cardId: id, modelId: z.int() }))
        .max(1),
    }),
  }),
});
export type CampDepartureCapability = z.infer<typeof CampDepartureCapabilitySchema>;
export type CampDepartureInput = z.infer<typeof CampDepartureInputSchema>;
export type CampDepartureOffer = z.infer<typeof CampDepartureOfferSchema>;
export type CampDepartureReceipt = z.infer<typeof CampDepartureReceiptSchema>;
export type EpisodeBoundary = z.infer<typeof EpisodeBoundarySchema>;
export type BattleInstruction = z.infer<typeof BattleInstructionSchema>;
