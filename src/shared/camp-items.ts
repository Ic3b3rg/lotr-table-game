import { z } from 'zod';
import { ContentIdSchema } from './catalog';
import { CopyIdSchema } from './preparation';
import { HashSchema, SourceSchema, Int32Schema } from './generated-map';

const evidence = z
  .array(
    z.strictObject({
      sourceId: ContentIdSchema,
      locator: z.string().min(1).max(1000),
    }),
  )
  .min(1)
  .max(20);
const method = z.strictObject({
  assemblyHash: HashSchema,
  method: z.string().regex(/^06[0-9a-f]{6}$/),
  bodyHash: HashSchema,
});
export const CampItemCardSchema = z.strictObject({
  cardId: ContentIdSchema,
  cardHash: HashSchema,
  model: z.strictObject({
    source: SourceSchema,
    modelId: Int32Schema,
    objectHash: HashSchema,
    type: z.union([z.literal(0), z.literal(1), z.literal(2)]),
    level: z.int().min(1).max(3),
    twoHanded: z.boolean(),
    upgradeCost: z.int().nonnegative(),
    upgrades: z.array(SourceSchema).max(10),
  }),
  quantity: z.int().min(1).max(20),
  originalText: z.string().min(1).max(8000),
  mechanics: z.strictObject({
    execution: z.literal('requires-consumer'),
    attackStats: z.array(z.enum(['might', 'wisdom', 'agility', 'spirit', 'wit'])).max(5),
    depletion: z.int().nonnegative().nullable(),
    ranged: z.boolean().nullable(),
    rangedMarker: z.string().max(100).nullable(),
    clauses: z.array(z.string().min(1).max(8000)).min(1).max(20),
  }),
  evidence: z.strictObject({
    identity: evidence,
    quantity: evidence,
    rank: evidence,
    links: evidence,
    lore: evidence,
    icons: evidence,
    text: evidence,
    mechanics: evidence,
  }),
});
export const CampItemsCapabilitySchema = z.strictObject({
  version: z.literal('source-camp-items-v1'),
  evidenceHash: HashSchema,
  catalogFingerprint: HashSchema,
  failureFingerprint: HashSchema,
  ownedProductIds: z.tuple([z.literal(0)]),
  product: z.strictObject({
    id: z.literal(0),
    source: SourceSchema,
    objectHash: HashSchema,
    items: z
      .array(
        z.strictObject({
          source: SourceSchema,
          quantity: z.int().min(1).max(20),
        }),
      )
      .min(1)
      .max(100),
  }),
  sources: z
    .array(
      z.strictObject({
        id: ContentIdSchema,
        kind: z.enum([
          'workbook',
          'app-model',
          'localization',
          'assembly',
          'rules',
          'errata',
          'derived',
        ]),
        sha256: HashSchema,
      }),
    )
    .min(1)
    .max(20),
  methods: z.strictObject({
    highlight: method,
    show: method,
    hide: method,
    upgrades: method,
    heroInventory: method,
    groupInventory: method,
    confirm: method,
    select: method,
    item: method,
    group: method,
    heroes: method,
    getHeroItems: method,
    getGroupItems: method,
    available: method,
    maxCount: method,
    lore: method,
    upgradeable: method,
  }),
  cards: z.array(CampItemCardSchema).min(1).max(100),
});
export const CampItemInputSchema = z.strictObject({
  kind: z.literal('camp-item'),
  heroId: ContentIdSchema.nullable(),
  copy: CopyIdSchema,
  upgrade: CopyIdSchema,
});
export const CampItemReceiptSchema = CampItemInputSchema.omit({ kind: true }).extend({
  fromModelId: Int32Schema,
  toModelId: Int32Schema,
  fromRank: z.int().min(1).max(2),
  toRank: z.int().min(2).max(3),
  threshold: z.int().nonnegative(),
  lore: z.int().nonnegative(),
});
export type CampItemCard = z.infer<typeof CampItemCardSchema>;
export type CampItemInput = z.infer<typeof CampItemInputSchema>;
export type CampItemReceipt = z.infer<typeof CampItemReceiptSchema>;
