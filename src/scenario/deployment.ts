import type { State } from '../server/state';
import type { ScenarioAction, ScenarioInstance, SourceText } from '../shared/scenario';
import { invariant } from '../map-freeze/validate';
import { generateDeployment } from '../combat/deployment';
import { verifySourceDeployment } from '../combat/deployment-compiler';
import { add, cubeKey, directionCube, normalizeDirection } from '../map-geometry/model';
import { plus, f } from '../map-assembly/physical';
import { compileSourceText } from './text';

export function materializeDeployment(
  state: State,
  i: ScenarioInstance,
  a: Extract<ScenarioAction, { op: 'spawnRandom' }>,
  effectId: string,
) {
  const sc = state.scenario!,
    cap = sc.pack.manifest.followup!,
    enemies = sc.enemies!;
  invariant(
    state.mapGeneration?.status === 'frozen' && enemies.entropy,
    'Spawn senza contesto congelato.',
  );
  invariant(!enemies.attempts.some((p) => p.effectId === effectId), 'Spawn duplicato.');
  const p = state.mapGeneration.projection;
  const visible = (source: string) =>
    sc.tiles.some((t) => t.source === source && t.visible && t.explored);
  const tiles = p.sections.flatMap((s) => s.tiles);
  const occupied = new Map(
    tiles.flatMap((t) => t.hexes.map((h) => [cubeKey(h.globalCoords), t.source] as const)),
  );
  const spaces = p.spaces
    .filter((s) => visible(s.tileSource))
    .map((s) => {
      const tile = tiles.find((t) => t.source === s.tileSource)!;
      const hexes = tile.hexes.filter((h) => h.space === s.index);
      invariant(hexes.length, 'Posa spawn senza esagoni congelati.');
      const sum = hexes.reduce((sum, h) => plus(sum, h.worldCenter), [0, 0, 0] as [
        number,
        number,
        number,
      ]);
      const position: [number, number, number] = [
        f(sum[0] / hexes.length),
        f(sum[1] / hexes.length),
        f(sum[2] / hexes.length),
      ];
      const outside = tile.shape.edges.some((e) => {
        const h = tile.hexes[e.hex]!;
        const neighbor = occupied.get(
          cubeKey(
            add(
              h.globalCoords,
              directionCube(normalizeDirection(e.direction + tile.compositeRotation)),
            ),
          ),
        );
        return !neighbor || !visible(neighbor);
      });
      return {
        id: s.id,
        sectionId: s.sectionId,
        tileSource: s.tileSource,
        position,
        connected: s.connected,
        outside,
      };
    });
  const store = a.points.scope === 'global' ? sc.globals : i.variables;
  const points = store[a.points.name],
    enemyPoints = sc.globals[cap.enemyPointsBinding];
  invariant(
    typeof points === 'number' && typeof enemyPoints === 'number',
    'Budget spawn non numerico.',
  );
  const result = generateDeployment(verifySourceDeployment(cap.deployment), {
    id: effectId,
    entropy: enemies.entropy,
    cursor: enemies.cursor,
    heroes: state.preparation!.heroes.length,
    threat: Number(sc.globals[sc.pack.manifest.rounds!.bindings.threat]),
    limit: sc.pack.manifest.rounds!.threat.limit,
    points,
    enemyPoints,
    excludeGameEnemyPoints: a.excludeGameEnemyPoints,
    filter: a.filter,
    sections: a.sections,
    reserved: [],
    inPlay: enemies.groups.filter((g) => g.figures.some((f) => f.health > 0)),
    spaces,
  });
  enemies.cursor = result.cursor;
  enemies.groups.push(...result.groups);
  enemies.attempts.push({
    effectId,
    groups: result.groups.map((g) => g.id),
    remaining: result.remaining,
    reason: result.reason,
    draws: result.draws,
  });
}
export function deploymentText(state: State, groupId: string): SourceText {
  const sc = state.scenario!,
    group = sc.enemies!.groups.find((g) => g.id === groupId)!;
  const artifact = verifySourceDeployment(sc.pack.manifest.followup!.deployment),
    model = artifact.compiled.models.find((m) => m.source === group.source)!;
  const name = group.figures.length > 1 ? model.plural : model.name;
  return sc.pack.manifest.followup!.deploymentText.flatMap((t) =>
    t.kind === 'text'
      ? compileSourceText(
          t.text.replaceAll('{count}', String(group.figures.length)).replaceAll('{enemy}', name),
        )
      : [t],
  );
}

/** The controller is absent: protect costs against the current, living enemies. */
export function livingEnemyGroups(state: State) {
  return state.scenario?.enemies?.groups.filter((g) => g.figures.some((f) => f.health > 0)) ?? [];
}
export function requiresProvocation(state: State, heroId: string) {
  const ordinary = state.journey?.heroes.find((h) => h.heroId === heroId)?.spaceId;
  const source = state.scenario?.spaceBindings.find((b) => b.id === ordinary)?.sourceId;
  return livingEnemyGroups(state).some((g) => g.placed && !g.exhausted && g.spaceId === source);
}
