import type { State } from '../server/state';
import type { DeployedGroup } from '../shared/deployment';
import type { CombatClosure } from './compiler';
import { preflightCombatGroup, effectiveGroup } from './group';
import { nearestThreatSteps, groupInRange, activationDistance } from './movement';
import { explorationProblem } from '../shared/exploration';
import { invariant } from '../map-freeze/validate';

/** Finite mandatory closure, including ready groups reachable through forced moves. No pool is filtered. */
export function preflightCombatOperation(
  state: State,
  a: CombatClosure,
  first: DeployedGroup,
  heroId: string,
  cause: 'counterattack' | 'provocation' | 'activation',
) {
  if (cause === 'counterattack') {
    const effect = effectiveGroup(a, first);
    if ((!effect.elite && first.exhausted) || !groupInRange(state, heroId, first, effect.ranged))
      return [];
  }
  const sc = state.scenario!,
    groups = sc.enemies!.groups.filter((g) => g.placed && g.figures.some((f) => f.health > 0));
  const heroSpace = sc.spaceBindings.find(
    (b) => b.id === state.journey!.heroes.find((h) => h.heroId === heroId)!.spaceId,
  )!.sourceId;
  const triggered = new Set([first.id]),
    heroSpaces = new Set([heroSpace]);
  const positions = new Map(groups.map((g) => [g.id, new Set([g.spaceId])]));
  const missing = new Set<string>();
  let changed = true,
    iterations = 0;
  while (changed) {
    invariant(++iterations < 10000, 'Chiusura movimento non finita.');
    changed = false;
    let moves = false;
    for (const g of groups.filter((g) => triggered.has(g.id))) {
      for (const dep of preflightCombatGroup(a, g, {
        boons: state.physical!.snapshot.resolution!.resources?.boons ?? [],
        quantities: null,
        artifact: state.physical?.boons,
        custody: state.physical?.snapshot.resolution?.resources?.boonCustody,
        heroIds: state.physical?.heroes.map((h) => h.heroId),
      }))
        missing.add(dep);
      if (g.logic) missing.add('scenario-combat-continuation');
      const model = a.compiled.models.find((m) => m.source === g.source)!;
      const size = g.figures.filter((f) => f.health > 0).length;
      const canMove = model.instructions.some(
        (i) =>
          i.minimum <= size &&
          i.maximum >= 1 &&
          i.addition?.effect.op === 'move-pair-toward-threat',
      );
      if (!canMove) continue;
      moves = true;
      const spaces = positions.get(g.id)!;
      for (const from of [...spaces])
        for (const to of nearestThreatSteps(state, from))
          if (!spaces.has(to.destination)) {
            spaces.add(to.destination);
            changed = true;
          }
    }
    if (moves)
      for (const from of [...heroSpaces])
        for (const to of nearestThreatSteps(state, from)) {
          if (!heroSpaces.has(to.destination)) {
            heroSpaces.add(to.destination);
            changed = true;
          }
          invariant(state.mapGeneration?.status === 'frozen', 'Chiusura senza mappa.');
          const space = state.mapGeneration.projection.spaces.find((s) => s.id === to.destination)!;
          if (
            !sc.tiles.find((t) => t.source === space.tileSource)!.explored &&
            explorationProblem(sc, state.mapGeneration.projection, space.tileSource)
          )
            missing.add('forced-exploration');
        }
    for (const g of groups) {
      if (
        !moves ||
        g.exhausted ||
        (cause === 'counterattack' && g.id === first.id) ||
        triggered.has(g.id)
      )
        continue;
      const provokes = [...positions.get(g.id)!].some((p) => heroSpaces.has(p));
      const effect = effectiveGroup(a, g),
        size = g.figures.filter((f) => f.health > 0).length;
      // A forced hero step can enable a later primary without provoking that
      // group. Include its complete attack closure before the phase begins.
      const laterActivation =
        cause === 'activation' &&
        groups.indexOf(g) > groups.indexOf(first) &&
        [...positions.get(g.id)!].some((from) =>
          [...heroSpaces].some((to) => {
            const distance = activationDistance(state, from, to);
            return (
              distance !== undefined &&
              effect.model.instructions.some(
                (i) =>
                  i.minimum <= size &&
                  i.maximum >= 1 &&
                  distance <= i.activation!.movement + (effect.ranged ? 1 : 0),
              )
            );
          }),
        );
      if (provokes || laterActivation) {
        triggered.add(g.id);
        changed = true;
      }
    }
  }
  return [...missing];
}
