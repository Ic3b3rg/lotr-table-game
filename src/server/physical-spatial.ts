import type { State } from './state';
import { invariant } from '../map-freeze/validate';

/** Visible living enemies, including exhausted groups, for card timing windows. */
export function boonEnemyPositions(state: State) {
  if (!state.physical?.boons) return {};
  return {
    enemies: (state.scenario?.enemies?.groups ?? [])
      .filter((g) => g.placed && g.figures.some((f) => f.health > 0))
      .map((g) => {
        const spaceId = state.scenario!.spaceBindings.find((b) => b.sourceId === g.spaceId)?.id;
        invariant(spaceId, 'Nemico senza posizione nella mappa fisica.');
        return { id: g.id, spaceId };
      }),
  };
}
