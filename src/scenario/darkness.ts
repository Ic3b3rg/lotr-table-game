import type { State } from '../server/state';
import { ApiError } from '../server/errors';
import { invariant } from '../map-freeze/validate';
import { defeatedHeroes } from '../server/physical-defeat';
const fail = (message: string): never => {
  throw new ApiError(409, 'ROUND_SOURCE_CAPABILITY', message);
};

export function sourceDarknessHeroes(state: State): number[] {
  const data = state.scenario!.pack.manifest.rounds!,
    sc = state.scenario!;
  if (data.configuration.disableDarkness) return [];
  if (sc.globals[data.bindings.darknessOverride] !== '')
    fail(
      'L’istruzione di oscurità di questa fonte richiede un consumer ulteriore. Nessuna pesca è stata applicata.',
    );
  return state.preparation!.heroes.flatMap((hero, index) => {
    if (defeatedHeroes(state).includes(hero.heroId)) return [];
    const position = state.journey!.heroes.find((p) => p.heroId === hero.heroId)!;
    const binding = sc.spaceBindings.find((b) => b.id === position.spaceId);
    const space = data.darkness.spaces.find((s) => s.id === binding?.sourceId);
    invariant(space, 'Posizione senza proprietà fonte di oscurità.');
    const token = sc.instances.some(
      (i) =>
        i.visible &&
        i.spaceId === binding!.sourceId &&
        i.prefab &&
        data.darkness.tokenPrefabs.includes(i.prefab),
    );
    return sc.globals[data.bindings.darkness] === true || space.hasDarkness || token ? [index] : [];
  });
}

/** Older combat packs retain their published geometric context. */
export function combatDarknessHeroes(state: State) {
  if (state.scenario!.pack.manifest.combat?.source.shadow) return sourceDarknessHeroes(state);
  invariant(state.mapGeneration?.status === 'frozen', 'Oscurità senza mappa.');
  const spaces = state.mapGeneration.projection.spaces;
  return state.preparation!.heroes.flatMap((h, n) => {
    const position = state.journey!.heroes.find((p) => p.heroId === h.heroId)!;
    const source = state.scenario!.spaceBindings.find((b) => b.id === position.spaceId)!.sourceId;
    return spaces.find((s) => s.id === source)!.hasDarkness ? [n] : [];
  });
}
