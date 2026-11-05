import { z } from 'zod';
import { ContentIdSchema } from './catalog';
import { SourceSchema, HashSchema, Int32Schema } from './generated-map';

const model = z.strictObject({ source: SourceSchema, modelId: Int32Schema });
/** A scenario award identifies a title model and its distinct physical skill card. */
export const ScenarioTitleGrantSchema = z.strictObject({
  cardId: ContentIdSchema,
  cardHash: HashSchema,
  titleModel: model,
  skillModel: model,
  alreadyOwned: z.string().min(1).max(16000),
});
export type ScenarioTitleGrant = z.infer<typeof ScenarioTitleGrantSchema>;
