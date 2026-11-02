import { z } from 'zod';
import { ContentIdSchema, type Catalog } from './catalog';
import { CopyIdSchema, type Preparation } from './preparation';

export const ScoutingSchema = z.strictObject({
  id: z.uuid(),
  heroId: ContentIdSchema,
  count: z.int().min(1).max(15),
  resetBefore: z.boolean(),
  revealed: z.array(CopyIdSchema).min(1).max(15),
});
export type Scouting = z.infer<typeof ScoutingSchema>;

export function scoutingProblem(
  catalog: Catalog | null,
  preparation: Preparation | null,
  scout: Scouting | null,
) {
  if (!scout) return null;
  const hero = preparation?.heroes.find((entry) => entry.heroId === scout.heroId);
  if (!catalog || preparation?.status !== 'prepared' || !hero)
    return 'Scoperta richiede un eroe della compagnia preparata.';
  if (
    (scout.resetBefore && scout.count !== 2) ||
    scout.revealed.length !== Math.min(scout.count, 15 - hero.prepared.length)
  )
    return 'Il numero di carte scoperte non è coerente.';
  return null;
}
