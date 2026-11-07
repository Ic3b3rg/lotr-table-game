import { z } from 'zod';
import { SkillDefinitionSchema, type Catalog, type CampaignSkillDefinition } from './catalog';
import { definitionId } from './preparation';

/** Owned additions have their own projection; the initial catalog stays fixed. */
export const TitleSkillDefinitionSchema = SkillDefinitionSchema.extend({
  kind: z.literal('title'),
  number: z.int().min(1).max(99).nullable(),
  success: z.int().min(0).max(9),
  fate: z.int().min(0).max(9),
});
export type TitleSkillDefinition = z.infer<typeof TitleSkillDefinitionSchema>;
export function findSkillCard(
  catalog: Catalog,
  copy: string,
  titles: readonly (TitleSkillDefinition | CampaignSkillDefinition)[] = [],
) {
  const id = definitionId(copy);
  return catalog.skills.find((c) => c.id === id) ?? titles.find((c) => c.id === id);
}
