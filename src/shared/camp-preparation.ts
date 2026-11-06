import { z } from 'zod';
import { ContentIdSchema } from './catalog';
import { CopyIdSchema } from './preparation';
import { HashSchema } from './generated-map';

const method = z.strictObject({
  assemblyHash: HashSchema,
  method: z.string().regex(/^06[0-9a-f]{6}$/),
  bodyHash: HashSchema,
});
export const CampPreparationCapabilitySchema = z.strictObject({
  version: z.literal('source-camp-preparation-v1'),
  evidenceHash: HashSchema,
  catalogFingerprint: HashSchema,
  skillsFingerprint: HashSchema,
  itemsFingerprint: HashSchema,
  sources: z
    .array(z.strictObject({ id: ContentIdSchema, sha256: HashSchema }))
    .min(1)
    .max(20),
  methods: z.strictObject({ continue: method, select: method, back: method }),
  cards: z
    .array(
      z.strictObject({
        cardId: ContentIdSchema,
        cardHash: HashSchema,
        kind: z.enum(['basic', 'hero', 'role']),
        ownerId: ContentIdSchema.nullable(),
        number: z.int().min(1).max(6),
        identity: z.enum(['bound', 'requires-content']),
        evidence: z
          .array(
            z.strictObject({ sourceId: ContentIdSchema, locator: z.string().min(1).max(1000) }),
          )
          .min(1)
          .max(20),
      }),
    )
    .length(54),
});
export const CampRecipeSchema = z.strictObject({
  heroId: ContentIdSchema,
  roleId: ContentIdSchema.nullable(),
  cards: z
    .array(
      z.strictObject({
        kind: z.enum(['basic', 'hero', 'role', 'purchased', 'title']),
        cardId: ContentIdSchema,
        copy: CopyIdSchema.nullable(),
      }),
    )
    .max(200),
  futurePrepared: ContentIdSchema.nullable(),
  weakness: z.strictObject({ count: z.literal(1), source: z.literal('future-common-draw') }),
  itemCopies: z.array(CopyIdSchema).max(3),
  accessory: CopyIdSchema.nullable(),
  balances: z
    .array(z.strictObject({ roleId: ContentIdSchema, availableXP: z.int().nonnegative() }))
    .max(6),
  gate: z.string().min(1).max(1000).nullable(),
});
export const CampPreparationHeroSchema = z.strictObject({
  heroId: ContentIdSchema,
  accessory: CopyIdSchema.nullable(),
  recipe: CampRecipeSchema,
  summaryHash: HashSchema,
  confirmedRevision: z.int().positive().nullable(),
});
export const CampPreparationSchema = z.strictObject({
  version: z.literal('source-camp-preparation-v1'),
  heroes: z.array(CampPreparationHeroSchema).min(2).max(5),
});
export const CampPreparationInputs = [
  z.strictObject({ kind: z.literal('camp-prepare') }),
  z.strictObject({
    kind: z.literal('camp-select-role'),
    heroId: ContentIdSchema,
    roleId: ContentIdSchema,
  }),
  z.strictObject({
    kind: z.literal('camp-accessory'),
    heroId: ContentIdSchema,
    copy: CopyIdSchema.nullable(),
  }),
  z.strictObject({
    kind: z.literal('camp-confirm'),
    heroId: ContentIdSchema,
    summaryHash: HashSchema,
  }),
  z.strictObject({ kind: z.literal('camp-return') }),
] as const;
export const CampPreparationInputSchema = z.discriminatedUnion('kind', CampPreparationInputs);
export const CampPreparationReceiptSchema = z.strictObject({
  action: z.enum([
    'camp-prepare',
    'camp-select-role',
    'camp-accessory',
    'camp-confirm',
    'camp-return',
  ]),
  heroes: z.array(CampPreparationHeroSchema).min(2).max(5),
});
export type CampPreparationInput = z.infer<typeof CampPreparationInputSchema>;
export type CampPreparationReceipt = z.infer<typeof CampPreparationReceiptSchema>;
export type CampRecipe = z.infer<typeof CampRecipeSchema>;
