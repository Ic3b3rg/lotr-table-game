import { adjacent, type Journey } from './journey-map';

export const ARAGORN_ID = 'base-hero-aragorn';

// null means that an old independent round has no recorded positions.
export function rallyScoutCount(
  heroes: readonly { heroId: string }[],
  journey: Journey | null,
  heroId: string,
): 2 | 3 | null {
  if (!heroes.some((hero) => hero.heroId === ARAGORN_ID)) return 2;
  if (heroId === ARAGORN_ID) return 3;
  const aragorn = journey?.heroes.find((hero) => hero.heroId === ARAGORN_ID);
  const hero = journey?.heroes.find((hero) => hero.heroId === heroId);
  if (!journey || !aragorn || !hero) return null;
  return hero.spaceId === aragorn.spaceId ||
    adjacent(journey.definition, aragorn.spaceId, hero.spaceId)
    ? 3
    : 2;
}
