import { z } from 'zod';
import { ContentIdSchema } from './catalog';
import { CopyIdSchema } from './preparation';

export const HashSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const SourceSchema = z
  .string()
  .max(160)
  .regex(/^[\w.-]+:-?[1-9][0-9]*$/);
export const Int32Schema = z.int().min(-2147483648).max(2147483647);
export const HistorySchema = z.strictObject({
  usedEncounterIds: z.array(Int32Schema).max(10000),
  usedGroupIds: z.array(Int32Schema).max(10000),
  unlockedChainIds: z.array(Int32Schema).max(10000),
});
const mappedItem = z.strictObject({
  catalogId: ContentIdSchema,
  id: Int32Schema,
  source: SourceSchema,
});
export const GenerationContextSchema = HistorySchema.extend({
  policy: z.literal('new-base-A1-v1'),
  adventureId: z.literal(1),
  adventureSource: SourceSchema,
  builderSource: SourceSchema,
  catalogId: ContentIdSchema,
  catalogFingerprint: HashSchema,
  language: z.literal('Italian'),
  ownedProductIds: z.array(Int32Schema).length(1),
  groupItems: z.array(mappedItem).max(1000),
  groupItemIds: z.array(Int32Schema).max(1000),
  heroCount: z.int().min(1).max(5),
  heroes: z
    .array(
      z.strictObject({
        catalogId: ContentIdSchema,
        playerId: z.uuid(),
        roleId: ContentIdSchema,
        id: Int32Schema,
        source: SourceSchema,
        items: z.array(mappedItem.extend({ copy: CopyIdSchema })).max(3),
        itemIds: z.array(Int32Schema).max(3),
      }),
    )
    .min(1)
    .max(5),
});
export type GenerationContext = z.infer<typeof GenerationContextSchema>;
