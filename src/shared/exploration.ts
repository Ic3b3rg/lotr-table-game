import type { Scenario } from './scenario';
import type { Projection } from './generated-map';

/** Capability is per tile and reveal closure; it never grants encounter interaction. */
export function explorationProblem(sc: Scenario, p: Projection, tileSource: string): string | null {
  const capability = sc.pack.manifest.exploration;
  if (!capability?.tiles.some((t) => t.source === tileSource))
    return 'Questa tessera richiede effetti di esplorazione ancora in sviluppo.';
  for (const space of p.spaces.filter((s) => s.tileSource === tileSource)) {
    const assignment = p.assignments.find((a) => a.spaceId === space.id);
    if (!assignment) continue;
    const prefab = sc.pack.manifest.prefabs.find((m) => m.source === assignment.prefab.source);
    const d = sc.pack.definitions.find((d) => d.source === prefab?.fsmSource);
    if (!d || d.deferredHandlers.PRE_REVEAL || d.deferredHandlers.REVEALED)
      return 'La rivelazione di un segnalino di questa tessera richiede effetti ancora in sviluppo.';
  }
  return null;
}

export function explorationConfirmation(sc: Scenario) {
  const d = sc.pack.definitions.find((d) => d.source === sc.pack.manifest.exploration?.definition);
  return d?.states
    .find((s) => s.index === d.handlers['NODE CLICKED'])
    ?.actions.find((a) => a.op === 'confirm');
}

export function explorationSource(sc: Scenario, tileSource: string) {
  return {
    scenarioId: sc.id,
    packFingerprint: sc.packFingerprint,
    projectionFingerprint: sc.projectionFingerprint,
    template: sc.pack.manifest.exploration?.definition,
    tile: sc.tiles.find((t) => t.source === tileSource),
  };
}
