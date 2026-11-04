import type { State } from '../server/state';
import type { CombatAttempt } from '../shared/combat-controller';
import type { DeployedGroup } from '../shared/deployment';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';
import { f, plus } from '../map-assembly/physical';
import { defeatedHeroes } from '../server/physical-defeat';

export function groupInRange(state: State, heroId: string, group: DeployedGroup, ranged: boolean) {
  const ordinary = state.journey!.heroes.find((h) => h.heroId === heroId)!.spaceId;
  const from = state.scenario!.spaceBindings.find((b) => b.id === ordinary)?.sourceId;
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

export function nearestThreatSteps(state: State, from: string) {
  invariant(state.mapGeneration?.status === 'frozen', 'Movimento senza grafo congelato.');
  const sc = state.scenario!,
    p = state.mapGeneration.projection;
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
  const g = state.scenario!.enemies!.groups.find((g) => g.id === attempt.groupId)!;
  g.spaceId = destination;
  g.tileSource = s.tileSource;
  g.position = [f(sum[0] / hexes.length), f(sum[1] / hexes.length), f(sum[2] / hexes.length)];
}
