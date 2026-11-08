import type { State } from '../server/state';
import type { CombatAttempt } from '../shared/combat-controller';
import type { DeployedGroup } from '../shared/deployment';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';
import { f, plus } from '../map-assembly/physical';
import { defeatedHeroes } from '../server/physical-defeat';
import { battleCombat, battleSpatial } from '../scenario/battle-combat';

export function groupInRange(state: State, heroId: string, group: DeployedGroup, ranged: boolean) {
  const ordinary = state.journey!.heroes.find((h) => h.heroId === heroId)!.spaceId;
  const from = state.scenario!.spaceBindings.find((b) => b.id === ordinary)?.sourceId;
  if (battleCombat(state)) {
    const { layout } = battleSpatial(state);
    invariant(
      from &&
        layout.cells.some((c) => c.id === from) &&
        layout.cells.some((c) => c.id === group.spaceId),
      'Posizione battaglia fuori dalla fonte.',
    );
    return (
      from === group.spaceId ||
      (ranged &&
        layout.walkableEdges.some(
          ([a, b]) => (a === from && b === group.spaceId) || (b === from && a === group.spaceId),
        ))
    );
  }
  invariant(
    from && state.mapGeneration?.status === 'frozen',
    'Posizione di combattimento non riconciliata.',
  );
  return (
    group.spaceId === from ||
    (ranged &&
      state.mapGeneration.projection.movementGraph.edges.some(
        (e) => (e.a === from && e.b === group.spaceId) || (e.b === from && e.a === group.spaceId),
      ))
  );
}

/** Visible movement edges, never the authoring ConnectedSpaces collection. */
function activationGraph(state: State) {
  if (battleCombat(state)) {
    const { layout } = battleSpatial(state);
    return (from: string) =>
      layout.walkableEdges.flatMap(([a, b]) => (a === from ? [b] : b === from ? [a] : []));
  }
  invariant(state.mapGeneration?.status === 'frozen', 'Attivazione senza grafo congelato.');
  const p = state.mapGeneration.projection;
  const visible = new Set(
    p.spaces
      .filter((s) => state.scenario!.tiles.some((t) => t.source === s.tileSource && t.visible))
      .map((s) => s.id),
  );
  const edges = p.movementGraph.edges.filter((e) => visible.has(e.a) && visible.has(e.b));
  return (from: string) => edges.flatMap((e) => (e.a === from ? [e.b] : e.b === from ? [e.a] : []));
}
function heroSourceSpace(state: State, heroId: string) {
  const position = state.journey!.heroes.find((h) => h.heroId === heroId);
  invariant(position, 'Destinatario senza posizione.');
  const binding = state.scenario!.spaceBindings.find((b) => b.id === position.spaceId);
  invariant(binding, 'Destinatario senza binding fonte.');
  return binding.sourceId;
}
function activationDistances(state: State, to: string) {
  const neighbors = activationGraph(state),
    distances = new Map([[to, 0]]),
    queue = [to];
  for (let n = 0; n < queue.length; n++)
    for (const next of neighbors(queue[n]!))
      if (!distances.has(next)) {
        distances.set(next, distances.get(queue[n]!)! + 1);
        queue.push(next);
      }
  return distances;
}
export function activationDistance(state: State, from: string, to: string) {
  return activationDistances(state, to).get(from);
}
export function activeCompany(state: State) {
  return state.preparation!.heroes.filter(
    (h) =>
      !defeatedHeroes(state).includes(h.heroId) &&
      !state.journey!.heroes.find((p) => p.heroId === h.heroId)!.removed,
  );
}
export function activationTargets(
  state: State,
  from: string,
  policy: {
    movement: number;
    alternativeMovement: number;
    alternativeDestination: string;
    alternativeTarget?: 'nearest' | 'highest-might' | undefined;
  },
  initialHeroId: string | null,
  range: number,
) {
  const heroes = activeCompany(state).flatMap((h) => {
    const distance = activationDistance(state, from, heroSourceSpace(state, h.heroId));
    return distance === undefined ? [] : [{ heroId: h.heroId, distance }];
  });
  const attackable = heroes.filter((h) => h.distance <= policy.movement + range);
  const initial = attackable.find((h) => h.heroId === initialHeroId);
  const nearest = (pool: typeof heroes) =>
    pool.filter((h) => h.distance === Math.min(...pool.map((h) => h.distance)));
  if (attackable.length)
    return (initial ? [initial] : nearest(attackable)).map((h) => ({
      ...h,
      branch: 'primary' as const,
      moves: Math.max(0, h.distance - range),
      stop: range,
    }));
  const stop = policy.alternativeDestination === 'adjacent-to-hero' ? 1 : 0;
  const might = (id: string) => state.content!.heroes.find((h) => h.id === id)!.stats.might;
  const alternatives =
    policy.alternativeTarget === 'highest-might'
      ? heroes.filter((h) => might(h.heroId) === Math.max(...heroes.map((h) => might(h.heroId))))
      : nearest(heroes);
  return alternatives.map((h) => ({
    ...h,
    branch: 'alternative' as const,
    moves: Math.min(policy.alternativeMovement, Math.max(0, h.distance - stop)),
    stop,
  }));
}
export function activationSteps(state: State, from: string, heroId: string) {
  const distances = activationDistances(state, heroSourceSpace(state, heroId));
  const distance = distances.get(from);
  return distance === undefined
    ? []
    : activationGraph(state)(from).filter((next) => distances.get(next) === distance - 1);
}

export function nearestThreatSteps(state: State, from: string) {
  const sc = state.scenario!;
  if (battleCombat(state)) {
    const { layout } = battleSpatial(state),
      cap = battleCombat(state)!;
    const threats = cap.threats.filter((t) =>
      sc.battle!.placements.some((p) => p.kind === 'threat' && p.anchor === t.anchor),
    );
    const candidates = threats.flatMap((t) => {
      const cell = layout.placements.find((p) => p.id === t.anchor)!.cell!,
        distances = activationDistances(state, cell),
        distance = distances.get(from);
      return distance === undefined
        ? []
        : [
            {
              targetId: t.source,
              distance,
              spaces:
                distance === 0
                  ? []
                  : activationGraph(state)(from).filter((s) => distances.get(s) === distance - 1),
            },
          ];
    });
    const nearest = Math.min(...candidates.map((c) => c.distance));
    return candidates
      .filter((c) => c.distance === nearest)
      .flatMap((c) =>
        c.spaces.map((destination) => ({
          from,
          destination,
          targetId: c.targetId,
          distance: c.distance,
        })),
      );
  }
  invariant(state.mapGeneration?.status === 'frozen', 'Movimento senza grafo congelato.');
  const p = state.mapGeneration.projection;
  const visible = new Set(
    p.spaces
      .filter((s) => sc.tiles.some((t) => t.source === s.tileSource && t.visible))
      .map((s) => s.id),
  );
  const edges = p.movementGraph.edges.filter((e) => visible.has(e.a) && visible.has(e.b));
  const neighbors = (space: string) =>
    edges.flatMap((e) => (e.a === space ? [e.b] : e.b === space ? [e.a] : []));
  const threats = sc.instances.filter(
    (i) =>
      i.visible &&
      !i.stopped &&
      i.spaceId &&
      sc.pack.manifest.prefabs.some((p) => p.source === i.prefab && p.nodeType === 'threat'),
  );
  const candidates = threats.flatMap((target) => {
    const distances = new Map<string, number>([[target.spaceId!, 0]]),
      queue = [target.spaceId!];
    for (let n = 0; n < queue.length; n++)
      for (const neighbor of neighbors(queue[n]!))
        if (!distances.has(neighbor)) {
          distances.set(neighbor, distances.get(queue[n]!)! + 1);
          queue.push(neighbor);
        }
    const distance = distances.get(from);
    return distance === undefined
      ? []
      : [
          {
            targetId: target.id,
            distance,
            spaces:
              distance === 0
                ? []
                : neighbors(from).filter((s) => distances.get(s) === distance - 1),
          },
        ];
  });
  const nearest = Math.min(...candidates.map((c) => c.distance));
  return candidates
    .filter((c) => c.distance === nearest)
    .flatMap((c) =>
      c.spaces.map((destination) => ({
        from,
        destination,
        targetId: c.targetId,
        distance: c.distance,
      })),
    );
}
export function threatMovements(state: State, attempt: CombatAttempt) {
  const sc = state.scenario!;
  const group = sc.enemies!.groups.find((g) => g.id === attempt.groupId)!;
  const hero = state.journey!.heroes.find((h) => h.heroId === attempt.heroId)!;
  const fromHero = sc.spaceBindings.find((b) => b.id === hero.spaceId)!.sourceId;
  const actors: ('hero' | 'group')[] = ['hero', 'group'];
  return actors.flatMap((actor) => {
    if (
      attempt.movement?.done.includes(actor) ||
      (actor === 'hero' && (hero.removed || defeatedHeroes(state).includes(attempt.heroId))) ||
      (actor === 'group' && (!group.placed || !group.figures.some((f) => f.health > 0)))
    )
      return [];
    const from = actor === 'hero' ? fromHero : group.spaceId;
    return nearestThreatSteps(state, from).map((c) => ({
      ...c,
      actor,
      id: `move:${digest({ attempt: attempt.id, actor, from, destination: c.destination, targetId: c.targetId })}`,
    }));
  });
}
export function moveEnemyOneSpace(state: State, attempt: CombatAttempt, destination: string) {
  invariant(
    threatMovements(state, attempt).some(
      (m) => m.actor === 'group' && m.destination === destination,
    ),
    'Movimento nemico non diretto verso la minaccia più vicina.',
  );
  placeEnemyInSpace(
    state,
    state.scenario!.enemies!.groups.find((g) => g.id === attempt.groupId)!,
    destination,
  );
}
export function placeEnemyInSpace(state: State, g: DeployedGroup, destination: string) {
  if (battleCombat(state)) {
    const { layout, departure } = battleSpatial(state),
      vertices = layout.patches.filter((p) => p.cell === destination).flatMap((p) => p.vertices);
    invariant(vertices.length, 'Destinazione battaglia fuori dalla fonte.');
    g.spaceId = destination;
    g.tileSource = departure.target.model;
    g.position = [
      f(vertices.reduce((n, p) => n + p[0], 0) / vertices.length),
      f(vertices.reduce((n, p) => n + p[1], 0) / vertices.length),
      0,
    ];
    return;
  }
  invariant(state.mapGeneration?.status === 'frozen', 'Posa senza realizzazione.');
  const p = state.mapGeneration.projection,
    s = p.spaces.find((s) => s.id === destination)!;
  const tile = p.sections.flatMap((s) => s.tiles).find((t) => t.source === s.tileSource)!;
  const hexes = tile.hexes.filter((h) => h.space === s.index);
  const sum = hexes.reduce((sum, h) => plus(sum, h.worldCenter), [0, 0, 0] as [
    number,
    number,
    number,
  ]);
  g.spaceId = destination;
  g.tileSource = s.tileSource;
  g.position = [f(sum[0] / hexes.length), f(sum[1] / hexes.length), f(sum[2] / hexes.length)];
}
