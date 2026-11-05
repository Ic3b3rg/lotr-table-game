import type { State } from '../server/state';
import type { Scenario } from '../shared/scenario';
import { adjacent } from '../shared/journey-map';
import { definitionId } from '../shared/preparation';
import { preflightCombatOperation } from '../combat/preflight';
import { verifyCombatClosure } from '../combat/compiler';
import { invariant } from '../map-freeze/validate';
import { ApiError } from '../server/errors';
import { defeatedHeroes } from '../server/physical-defeat';
import { baseProductsDefinition } from './base-products';

type SprintTask = Extract<Scenario['tasks'][number], { kind: 'sprint' }>;
export function sprintActor(state: State, task: SprintTask) {
  const sc = state.scenario!,
    attempt = sc.play?.attempts.find((a) => a.id === task.attemptId && sc.play?.active === a.id),
    node = sc.instances.find((i) => i.id === task.instanceId);
  invariant(
    attempt &&
      node &&
      attempt.instanceId === node.id &&
      baseProductsDefinition(sc.pack, node.definition),
    'Scatto senza concessione fonte corrente.',
  );
  return attempt;
}

/** All visible adjacent spaces, without removing unimplemented explorations or enemy outcomes. */
export function sprintDestinations(state: State, task: SprintTask) {
  invariant(state.mapGeneration?.status === 'frozen', 'Scatto senza realizzazione.');
  const sc = state.scenario!,
    j = state.journey!,
    p = state.mapGeneration.projection;
  return j.definition.spaces.filter((space) => {
    const source = sc.spaceBindings.find((b) => b.id === space.id)?.sourceId,
      cell = p.spaces.find((s) => s.id === source);
    return (
      adjacent(j.definition, task.fromSpaceId, space.id) &&
      cell &&
      sc.tiles.some((t) => t.source === cell.tileSource && t.visible)
    );
  });
}

/** The source continuation probe owns the full receiver/context proof for this grant.
 * The older, local exploration check intentionally cannot certify broadcast callbacks. */
export function sprintExplorationProblem(state: State, tileSource: string) {
  const sc = state.scenario!;
  invariant(
    sc.pack.manifest.baseProducts && state.mapGeneration?.status === 'frozen',
    'Esplorazione Scatto senza capacità base.',
  );
  if (!sc.pack.manifest.exploration?.tiles.some((t) => t.source === tileSource))
    return 'Esplorazione della destinazione non compilata.';
  for (const space of state.mapGeneration.projection.spaces.filter(
    (s) => s.tileSource === tileSource,
  )) {
    const assignment = state.mapGeneration.projection.assignments.find(
      (a) => a.spaceId === space.id,
    );
    if (!assignment) continue;
    const prefab = sc.pack.manifest.prefabs.find((p) => p.source === assignment.prefab.source),
      d = sc.pack.definitions.find((d) => d.source === prefab?.fsmSource);
    if (!d || d.deferredHandlers.PRE_REVEAL || d.deferredHandlers.REVEALED)
      return 'Receiver della destinazione non compilato.';
  }
  return null;
}

/** No cards or random state are consumed here; missing dependencies reject the entire parent. */
export function preflightSprint(state: State, task: SprintTask) {
  const actor = sprintActor(state, task),
    sc = state.scenario!;
  invariant(state.mapGeneration?.status === 'frozen', 'Scatto senza mappa.');
  const p = state.mapGeneration.projection;
  for (const to of sprintDestinations(state, task)) {
    const source = sc.spaceBindings.find((b) => b.id === to.id)!.sourceId,
      space = p.spaces.find((s) => s.id === source)!,
      tile = sc.tiles.find((t) => t.source === space.tileSource)!;
    if (!tile.explored && sprintExplorationProblem(state, tile.source))
      throw new ApiError(
        409,
        'SCENARIO_SPRINT_EXPLORATION',
        'Una destinazione dello Scatto richiede un’esplorazione ancora non disponibile. Nessun costo o carta è stato applicato.',
      );
  }
  const combat = sc.pack.manifest.combat ? verifyCombatClosure(sc.pack.manifest.combat) : null,
    source = sc.spaceBindings.find((b) => b.id === task.fromSpaceId)!.sourceId,
    groups = (sc.enemies?.groups ?? []).filter(
      (g) =>
        g.placed && !g.exhausted && g.spaceId === source && g.figures.some((f) => f.health > 0),
    );
  for (const group of groups) {
    const missing = combat
      ? preflightCombatOperation(state, combat, group, actor.heroId, 'provocation')
      : ['combat'];
    if (group.logic || missing.length)
      throw new ApiError(
        409,
        'SCENARIO_SPRINT_PROVOCATION',
        missing.includes('boon-quantities-57')
          ? 'La provocazione dello Scatto richiede quantità di benefici non verificate. Nessun costo o carta è stato applicato.'
          : 'La provocazione dello Scatto richiede conseguenze ancora non disponibili. Nessun costo o carta è stato applicato.',
      );
  }
  const owned = state.preparation!.heroes.find((h) => h.heroId === actor.heroId)!;
  if (
    combat?.source.clauses.some(
      (c) =>
        c.window === 'before-sprint' &&
        [...owned.prepared, ...owned.itemCopies].some((copy) => definitionId(copy) === c.cardId),
    )
  )
    throw new ApiError(
      409,
      'SCENARIO_SPRINT_CAPABILITY',
      'Una capacità prima dello Scatto richiede il proprio consumer. Nessun costo o carta è stato applicato.',
    );
}

/** Internal movement authority: one current source task, one adjacent destination, no travel budget. */
export function applySprintMove(
  state: State,
  attemptId: string,
  from: string,
  destination: string,
) {
  const task = state.scenario!.tasks.find((t) => t.kind === 'sprint' && t.attemptId === attemptId);
  invariant(
    task?.kind === 'sprint' && task.fromSpaceId === from,
    'Scatto senza concessione corrente.',
  );
  const actor = sprintActor(state, task),
    round = state.round!,
    position = state.journey!.heroes.find((h) => h.heroId === actor.heroId)!;
  if (
    defeatedHeroes(state).includes(actor.heroId) ||
    position.removed ||
    round.phase !== 'action' ||
    round.activeHeroId !== actor.heroId ||
    round.id !== actor.roundId ||
    round.turnId !== actor.turnId ||
    position.spaceId !== from ||
    !sprintDestinations(state, task).some((s) => s.id === destination)
  )
    throw new ApiError(409, 'SCENARIO_SPRINT_CHANGED', 'Lo Scatto concesso non è più legale.');
  position.spaceId = destination;
}
