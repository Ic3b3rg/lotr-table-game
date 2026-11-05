import { z } from 'zod';
import { ContentIdSchema } from './catalog';
import { HashSchema, SourceSchema, Int32Schema } from './generated-map';
const model = z.strictObject({
  source: SourceSchema,
  modelId: Int32Schema,
  objectHash: HashSchema,
});
export const ItemGrantSchema = z.strictObject({
  cardId: ContentIdSchema,
  cardHash: HashSchema,
  model: model.extend({ type: z.literal(2), level: z.literal(1) }),
  quantity: z.literal(1),
  depletion: z.int().min(1).max(3),
  policyHash: HashSchema,
  upgrade: z.strictObject({ threshold: z.int().positive(), choices: z.array(model).min(1).max(4) }),
});
export const ItemCustodySchema = z
  .array(
    z.strictObject({
      copy: z.string().min(1).max(120),
      cardId: ContentIdSchema,
      modelId: Int32Schema,
      heroId: ContentIdSchema,
      source: z.string().min(1).max(300),
    }),
  )
  .max(1);
export type ItemGrant = z.infer<typeof ItemGrantSchema>;
