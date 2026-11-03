import type { State } from './state';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';

export function defeatedHeroes(state: State) {
  return (
    state.physical?.snapshot.lastStand?.heroes.filter((h) => h.defeated).map((h) => h.heroId) ?? []
  );
}
export function syncPhysicalDefeat(state: State) {
  const defeated = defeatedHeroes(state);
  for (const h of state.journey?.heroes ?? []) if (defeated.includes(h.heroId)) h.removed = true;
  const round = state.round;
  if (!round) return;
  for (const h of round.heroes)
    if (defeated.includes(h.heroId)) {
      h.turnEnded = true;
      h.rallyDone = round.phase === 'rally';
    }
  if (round.activeHeroId && defeated.includes(round.activeHeroId)) {
    round.activeHeroId = null;
    round.turnId = null;
  }
  if (state.journey?.travel && defeated.includes(state.journey.travel.heroId))
    state.journey.travel = null;
}
export function validatePhysicalDefeat(state: State) {
  invariant(
    digest(state.journey?.heroes.filter((h) => h.removed).map((h) => h.heroId) ?? []) ===
      digest(defeatedHeroes(state)),
    'Figure rimosse senza sconfitta fonte o sconfitto ancora sulla mappa.',
  );
}
