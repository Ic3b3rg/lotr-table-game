import { z } from 'zod';
import { ContentIdSchema, type Catalog } from './catalog';
import { CopyIdSchema, type Preparation } from './preparation';
import type { Scouting } from './scouting';
import { findSkillCard, type TitleSkillDefinition } from './skill-cards';

export const StatSchema = z.enum(['might', 'wisdom', 'agility', 'spirit', 'wit']);
export const STAT_LABELS = {
  might: 'Forza',
  wisdom: 'Saggezza',
  agility: 'Agilità',
  spirit: 'Spirito',
  wit: 'Ingegno',
} as const;
export const SkillTestSchema = z.strictObject({
  id: z.uuid(),
  heroId: ContentIdSchema,
  stat: StatSchema,
  modifier: z.int().min(-20).max(20),
  // Fifteen initial cards plus the two campaign-unique titles enabled by P2.
  availableCount: z.int().min(1).max(17),
  target: z.int().min(1).max(99).nullable(),
  revealed: z.array(CopyIdSchema).min(1).max(30),
  converted: z.int().min(0).max(60),
  status: z.enum(['converting', 'resolved']),
});
export const SkillTestViewSchema = SkillTestSchema.extend({
  successes: z.int().nonnegative(),
  fateRemaining: z.int().nonnegative(),
  outcome: z.enum(['pass', 'fail', 'count']).nullable(),
});
export type SkillTest = z.infer<typeof SkillTestSchema>;

export function skillTestView(
  catalog: Catalog | null,
  test: SkillTest | null,
  titles: readonly TitleSkillDefinition[] = [],
) {
  if (!test || !catalog) return null;
  const cards = test.revealed.map((copy) => findSkillCard(catalog, copy, titles)!);
  const successes = cards.reduce((n, card) => n + card.success, test.converted);
  const fateRemaining = cards.reduce((n, card) => n + card.fate, -test.converted);
  const outcome: 'pass' | 'fail' | 'count' | null =
    test.status !== 'resolved'
      ? null
      : test.target === null
        ? 'count'
        : successes >= test.target
          ? 'pass'
          : 'fail';
  return { ...test, successes, fateRemaining, outcome };
}

export function skillTestProblem(
  catalog: Catalog | null,
  preparation: Preparation | null,
  test: SkillTest | null,
  scout: Scouting | null = null,
  physicalHeld: { heroId: string; cards: string[] }[] = [],
  titles: readonly TitleSkillDefinition[] = [],
): string | null {
  if (!test) return null;
  const hero = preparation?.heroes.find((entry) => entry.heroId === test.heroId);
  if (!catalog || !hero || preparation?.status !== 'prepared')
    return 'La prova richiede un eroe della compagnia preparata.';
  const definition = catalog.heroes.find((entry) => entry.id === hero.heroId)!;
  if (!definition) return 'L’eroe della prova non appartiene al catalogo.';
  const available = [...hero.deck, ...hero.discard];
  if (test.status === 'converting') available.push(...test.revealed);
  else
    available.push(
      ...hero.prepared,
      ...(scout?.heroId === hero.heroId ? scout.revealed : []),
      ...physicalHeld.filter((h) => h.heroId === hero.heroId).flatMap((h) => h.cards),
    );
  if (
    new Set(test.revealed).size !== test.revealed.length ||
    test.revealed.some((copy) => !findSkillCard(catalog, copy, titles)) ||
    test.revealed.some((copy) => !available.includes(copy)) ||
    test.revealed.length !==
      Math.min(test.availableCount, Math.max(1, definition.stats[test.stat] + test.modifier)) ||
    (test.status === 'converting' && test.availableCount !== available.length)
  )
    return 'Carte rivelate non coerenti con la prova.';
  const view = skillTestView(catalog, test, titles)!;
  if (view.fateRemaining < 0) return 'La prova ha convertito più fato di quello disponibile.';
  return null;
}
