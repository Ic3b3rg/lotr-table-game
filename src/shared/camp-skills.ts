import { z } from 'zod';
import { ContentIdSchema, SkillDefinitionSchema } from './catalog';
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
const model = z.strictObject({
  source: SourceSchema,
  modelId: Int32Schema,
  objectHash: HashSchema,
  roleSource: SourceSchema,
  sourceType: z.literal(2),
  titleSource: z.null(),
  cost: z.int().nonnegative(),
});
const method = z.strictObject({
  assemblyHash: HashSchema,
  method: z.string().regex(/^06[0-9a-f]{6}$/),
  bodyHash: HashSchema,
});
export const CampSkillOfferSchema = z.strictObject({
  card: SkillDefinitionSchema.extend({ kind: z.literal('role'), quantity: z.literal(1) }),
  copy: CopyIdSchema,
  cost: z.int().positive(),
  binding: z.enum(['exact', 'equivalent-set']),
  models: z.array(model).min(1).max(2),
  originalText: z.string().min(1).max(8000),
  mechanics: z.strictObject({
    execution: z.literal('requires-consumer'),
    clauses: z
      .array(
        z.strictObject({
          timing: z.string().min(1).max(4000).nullable(),
          condition: z.string().min(1).max(4000).nullable(),
          cost: z.string().min(1).max(4000).nullable(),
          effect: z.string().min(1).max(8000),
          limit: z.string().min(1).max(4000).nullable(),
        }),
      )
      .min(1)
      .max(10),
    keywords: z
      .array(
        z.strictObject({
          keyword: z.enum(['strike', 'sprint', 'hide', 'guard', 'rest', 'scout']),
          value: z.int().nonnegative().nullable(),
        }),
      )
      .max(10),
  }),
  evidence: z.strictObject({
    identity: evidence,
    cost: evidence,
    icons: evidence,
    text: evidence,
    mechanics: evidence,
  }),
});
export const CampSkillsCapabilitySchema = z.strictObject({
  version: z.literal('source-camp-skills-v1'),
  evidenceHash: HashSchema,
  catalogFingerprint: HashSchema,
  failureFingerprint: HashSchema,
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
    editable: method,
    hero: method,
    roles: method,
    page: method,
    load: method,
    select: method,
    skillRole: method,
    close: method,
    getXP: method,
    setXP: method,
    getSkills: method,
    add: method,
    remove: method,
  }),
  roles: z
    .array(
      z.strictObject({
        id: ContentIdSchema,
        source: SourceSchema,
        modelId: Int32Schema,
        objectHash: HashSchema,
        core: z.array(model).length(2),
        upgrades: z.array(CampSkillOfferSchema).length(9),
      }),
    )
    .length(6),
});
export const CampSkillInputSchema = z.strictObject({
  kind: z.literal('camp-skill'),
  heroId: ContentIdSchema,
  roleId: ContentIdSchema,
  copy: CopyIdSchema,
  operation: z.enum(['buy', 'sell']),
});
export const CampTrainingSchema = z.strictObject({
  version: z.literal('source-camp-skills-v1'),
  balances: z
    .array(
      z.strictObject({
        heroId: ContentIdSchema,
        roleId: ContentIdSchema,
        availableXP: z.int().nonnegative(),
      }),
    )
    .max(30),
});
export const CampSkillReceiptSchema = CampSkillInputSchema.omit({ kind: true }).extend({
  cost: z.int().positive(),
  before: z.int().nonnegative(),
  after: z.int().nonnegative(),
});
export type CampSkillOffer = z.infer<typeof CampSkillOfferSchema>;
export type CampSkillReceipt = z.infer<typeof CampSkillReceiptSchema>;
export type CampSkillInput = z.infer<typeof CampSkillInputSchema>;
