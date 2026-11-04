import { z } from 'zod';
import { BoonKindSchema } from './combat';
import { HashSchema } from './generated-map';
import { ContentIdSchema } from './catalog';

const reference = z.strictObject({
  sourceId: z.string().min(1).max(100),
  locator: z.string().min(1).max(300),
});
const effect = z.discriminatedUnion('op', [
  z.strictObject({ op: z.literal('exchange-test-cards') }),
  z.strictObject({ op: z.literal('add-hits'), valueIndex: z.int().min(0).max(23) }),
  z.strictObject({ op: z.literal('add-success'), valueIndex: z.int().min(0).max(23) }),
  z.strictObject({
    op: z.literal('discard-on-suffer'),
    families: z
      .array(z.enum(['damage', 'fear']))
      .min(1)
      .max(2),
  }),
  z.strictObject({
    op: z.literal('discard-at-end-turn'),
    condition: z.literal('no-nearby-enemies'),
  }),
  z.strictObject({ op: z.literal('prevent-all-before-test'), family: z.enum(['damage', 'fear']) }),
]);
export const BoonInputSchema = z.strictObject({
  version: z.literal('source-boons-v1'),
  rules: z.array(reference).min(1).max(16),
  definitions: z
    .array(
      z.strictObject({
        cardId: ContentIdSchema,
        kind: BoonKindSchema,
        cardHash: HashSchema,
        originalHash: HashSchema,
        mechanicsHash: HashSchema,
        usageHash: HashSchema,
        source: reference,
        effects: z.array(effect).min(1).max(8),
      }),
    )
    .length(3),
});
export const BoonEffectSchema = z.union([
  effect.options[0],
  effect.options[3],
  effect.options[4],
  effect.options[5],
  z.strictObject({ op: z.enum(['add-hits', 'add-success']), n: z.int().min(0).max(56) }),
]);
export const BoonArtifactSchema = z.strictObject({
  version: z.literal('source-boons-v1'),
  input: BoonInputSchema,
  rawFingerprint: HashSchema,
  definitions: z
    .array(
      z.strictObject({
        cardId: ContentIdSchema,
        kind: BoonKindSchema,
        effects: z.array(BoonEffectSchema).min(1).max(8),
      }),
    )
    .length(3),
  stock: z.strictObject({
    status: z.enum(['unverified', 'verified']),
    quantities: z.record(BoonKindSchema, z.int().min(0).max(15)).nullable(),
    copies: z.array(z.strictObject({ id: ContentIdSchema, kind: BoonKindSchema })).max(15),
  }),
  runtimeReady: z.boolean(),
  fingerprint: HashSchema,
});
export type BoonArtifact = z.infer<typeof BoonArtifactSchema>;
export type BoonEffect = z.infer<typeof BoonEffectSchema>;
export type BoonKind = z.infer<typeof BoonKindSchema>;

export const BoonCustodySchema = z
  .array(
    z.strictObject({
      copyId: ContentIdSchema,
      heroId: ContentIdSchema,
      kind: BoonKindSchema,
      face: z.literal('faceup'),
      source: z.string().min(1).max(3000),
    }),
  )
  .max(15);
export type BoonCustody = z.infer<typeof BoonCustodySchema>;
