import { z } from 'zod';
import { ContentIdSchema } from './catalog';
import type { Preparation } from './preparation';
import type { Scouting } from './scouting';
import type { SkillTest } from './skill-tests';
import type { Journey } from './journey-map';
import { rallyScoutCount } from './rally-scout';

export const ShadowStepSchema = z.enum(['enemies', 'darkness', 'threat']);
export const PHASE_LABELS = {
  action: 'Azione',
  shadow: 'Ombra',
  rally: 'Riorganizzazione',
} as const;
export const SHADOW_LABELS = {
  enemies: 'Attivazione dei nemici',
  darkness: 'Oscurità',
  threat: 'Minaccia',
} as const;
export const RoundSchema = z.strictObject({
  id: z.uuid(),
  number: z.int().positive(),
  phase: z.enum(['action', 'shadow', 'rally']),
  shadowStep: ShadowStepSchema.nullable(),
  activeHeroId: ContentIdSchema.nullable(),
  turnId: z.uuid().nullable(),
  heroes: z
    .array(
      z.strictObject({
        heroId: ContentIdSchema,
        actionsUsed: z.int().min(0).max(2),
        turnEnded: z.boolean(),
        rallyDone: z.boolean(),
      }),
    )
    .min(2)
    .max(5),
});
export type Round = z.infer<typeof RoundSchema>;

export function roundProblem(
  round: Round | null,
  preparation: Preparation | null,
  test: SkillTest | null,
  scout: Scouting | null,
  journey: Journey | null,
): string | null {
  if (!round) return scout?.roundId ? 'La Scoperta appartiene a un round assente.' : null;
  const ids = preparation?.heroes.map((hero) => hero.heroId) ?? [];
  if (
    preparation?.status !== 'prepared' ||
    new Set(round.heroes.map((hero) => hero.heroId)).size !== ids.length ||
    round.heroes.length !== ids.length ||
    round.heroes.some((hero) => !ids.includes(hero.heroId))
  )
    return 'Gli eroi del round non corrispondono alla compagnia.';
  const active = round.heroes.find((hero) => hero.heroId === round.activeHeroId);
  if (
    Boolean(round.activeHeroId) !== Boolean(round.turnId) ||
    (round.activeHeroId && (!active || active.turnEnded || round.phase !== 'action')) ||
    round.heroes.some(
      (hero) => !hero.turnEnded && hero.heroId !== round.activeHeroId && hero.actionsUsed !== 0,
    )
  )
    return 'Turno attivo o azioni non coerenti.';
  if (
    (round.phase === 'shadow') !== Boolean(round.shadowStep) ||
    (round.phase !== 'action' && round.heroes.some((hero) => !hero.turnEnded)) ||
    (round.phase !== 'rally' && round.heroes.some((hero) => hero.rallyDone))
  )
    return 'Fase o progressi del round non coerenti.';
  if (round.phase === 'rally') {
    if (test?.status === 'converting')
      return 'Non si effettuano prove durante la Riorganizzazione.';
    if (
      scout &&
      (scout.roundId !== round.id ||
        (scout.count !== 2 &&
          (scout.count !== 3 ||
            rallyScoutCount(preparation!.heroes, journey, scout.heroId) === 2)) ||
        scout.resetBefore ||
        round.heroes.find((hero) => hero.heroId === scout.heroId)?.rallyDone !== false)
    )
      return 'Scoperta non coerente con la Riorganizzazione del round.';
  } else if (scout?.roundId) return 'Scoperta di Riorganizzazione fuori fase.';
  return null;
}
