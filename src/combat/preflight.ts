import { battleLogicGroup, battleCallbackProblems } from '../scenario/battle-phase-runtime';
import type { State } from '../server/state';
import type { DeployedGroup } from '../shared/deployment';
import type { CombatClosure } from './compiler';
import { preflightCombatGroup, effectiveGroup, reachableBoonKinds } from './group';
import { nearestThreatSteps, groupInRange, activationDistance } from './movement';
import { explorationProblem } from '../shared/exploration';
import { invariant } from '../map-freeze/validate';
import { firstCombatGroup, firstCombatCallbackProblems } from '../scenario/first-combat';
import { preflightBoonRequests } from '../physical-resolution/boon-stock';
import { battleCombat, battleCombatProblems } from '../scenario/battle-combat';

/** Finite mandatory closure, including ready groups reachable through forced moves. No pool is filtered. */
export function preflightCombatOperation(
  state: State,
  a: CombatClosure,
  first: DeployedGroup,
  heroId: string,
  cause: 'counterattack' | 'provocation' | 'activation',
) {
  const battleProblems = battleCombatProblems(state, heroId, {
    attack: cause === 'counterattack',
    negation: false,
  });
  if (battleProblems.includes('battle-mandatory-physical-terminal')) return battleProblems;
  if (cause === 'counterattack') {
    // A hero can defeat this target even when it cannot answer the attack.
    if (battleLogicGroup(state, first))
      battleProblems.push(...battleCallbackProblems(state, first));
    const effect = effectiveGroup(a, first);
    if ((!effect.elite && first.exhausted) || !groupInRange(state, heroId, first, effect.ranged))
      return battleProblems;
  }
  const sc = state.scenario!,
    groups = sc.enemies!.groups.filter((g) => g.placed && g.figures.some((f) => f.health > 0));
  if (firstCombatGroup(state, first) && !groups.some((g) => g.id === first.id))
    groups.unshift(first);
  const heroSpace = sc.spaceBindings.find(
    (b) => b.id === state.journey!.heroes.find((h) => h.heroId === heroId)!.spaceId,
  )!.sourceId;
  const triggered = new Set([first.id]),
    heroSpaces = new Set([heroSpace]);
  const positions = new Map(groups.map((g) => [g.id, new Set([g.spaceId])]));
  const missing = new Set<string>(battleProblems);
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
        heroIds: [heroId],
      }))
        missing.add(dep);
      if (g.logic) {
        if (!(firstCombatGroup(state, g) || battleLogicGroup(state, g)))
          missing.add('scenario-combat-continuation');
        else
          for (const problem of battleLogicGroup(state, g)
            ? battleCallbackProblems(state, g)
            : firstCombatCallbackProblems(state))
            missing.add(problem);
      }
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
          if (!battleCombat(state)) {
            invariant(state.mapGeneration?.status === 'frozen', 'Chiusura senza mappa.');
            const space = state.mapGeneration.projection.spaces.find(
              (s) => s.id === to.destination,
            )!;
            if (
              !sc.tiles.find((t) => t.source === space.tileSource)!.explored &&
              explorationProblem(sc, state.mapGeneration.projection, space.tileSource)
            )
              missing.add('forced-exploration');
          }
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
  for (const problem of battleCombatProblems(state, heroId, {
    attack: false,
    negation: true,
    spaces: heroSpaces,
  }))
    missing.add(problem);
  if (state.physical?.boons) {
    const requests = groups
      .filter((g) => triggered.has(g.id))
      .flatMap((g) => {
        const kinds = reachableBoonKinds(a, g);
        return kinds.length ? [{ heroes: [heroId], kinds }] : [];
      });
    for (const dep of preflightBoonRequests(
      state.physical.boons,
      state.physical.snapshot.resolution?.resources?.boonCustody ?? [],
      requests,
    ))
      missing.add(dep);
  }
  return [...missing];
}
