import type { Scenario, ScenarioDefinition } from './scenario';
import type { Projection } from './generated-map';
type ExplorationContext = Pick<
  Scenario,
  'pack' | 'id' | 'packFingerprint' | 'projectionFingerprint' | 'tiles'
>;

// A compiled handler alone is insufficient: a deferred continuation may omit
// the release. Prove every supported settling path before spending movement.
// Interactive effects and broadcasts need their own receiver/context proof;
// until then these closures remain unavailable rather than failing after entry.
function processingCloses(
  d: ScenarioDefinition,
  event: string,
  clues = false,
  deployment = false,
): boolean {
  if (d.deferredHandlers[event]) return false;
  if (d.handlers[event] === undefined) return true;
  const memo = new Map<string, boolean>(),
    active = new Set<string>();
  function visit(index: number | undefined, released: boolean): boolean {
    if (index === undefined) return false;
    const key = `${index}:${released}`;
    if (memo.has(key)) return memo.get(key)!;
    if (active.has(key)) return false;
    active.add(key);
    const s = d.states.find((s) => s.index === index);
    const follow = (name: string) => visit(s?.transitions[name] ?? d.handlers[name], released);
    let closed = false;
    if (s) {
      closed = true;
      for (const a of s.actions) {
        if (a.op === 'release') released = true;
        else if (a.op === 'stop') break;
        else if (a.op === 'branchBool') {
          closed = follow(a.trueEvent) && follow(a.falseEvent);
          active.delete(key);
          memo.set(key, closed);
          return closed;
        } else if (a.op === 'message') {
          if (
            (a.mode !== 'ordinary' && !(clues && a.mode === 'objective')) ||
            a.consequence ||
            a.inspiration
          ) {
            closed = false;
            break;
          }
        } else if (clues && (a.op === 'switchInt' || a.op === 'isExplored')) {
          const events =
            a.op === 'switchInt' ? a.cases.map((c) => c.event) : [a.trueEvent, a.falseEvent];
          const next = s.transitions.FINISHED ?? d.handlers.FINISHED;
          closed =
            events.every(follow) &&
            (a.op === 'isExplored' || (next === undefined ? released : visit(next, released)));
          active.delete(key);
          memo.set(key, closed);
          return closed;
        } else if (
          clues &&
          (['lore', 'copyInt', 'multiplyInt', 'focus'].includes(a.op) ||
            (a.op === 'spawnRandom' && deployment))
        ) {
          continue;
        } else if (
          ![
            'getStart',
            'getTile',
            'getPosition',
            'set',
            'flip',
            'addInt',
            'revealNode',
            'hideNode',
            'section',
            'revealTile',
            'objective',
            'threat',
          ].includes(a.op)
        ) {
          closed = false;
          break;
        }
      }
      if (closed && !s.actions.some((a) => a.op === 'stop')) {
        const next = s.transitions.FINISHED ?? d.handlers.FINISHED;
        closed = next === undefined ? released : visit(next, released);
      }
    }
    active.delete(key);
    memo.set(key, closed);
    return closed;
  }
  return [d.handlers[event], ...d.states.map((s) => s.transitions[event])]
    .filter((target) => target !== undefined)
    .every((target) => visit(target, false));
}

/** Capability is per tile and reveal closure; it never grants encounter interaction. */
export function explorationProblem(
  sc: ExplorationContext,
  p: Projection,
  tileSource: string,
): string | null {
  const capability = sc.pack.manifest.exploration;
  const clues = !!sc.pack.manifest.clues,
    deployment = !!sc.pack.manifest.followup;
  if (!capability?.tiles.some((t) => t.source === tileSource))
    return 'Questa tessera richiede effetti di esplorazione ancora in sviluppo.';
  for (const space of p.spaces.filter((s) => s.tileSource === tileSource)) {
    const assignment = p.assignments.find((a) => a.spaceId === space.id);
    if (!assignment) continue;
    const prefab = sc.pack.manifest.prefabs.find((m) => m.source === assignment.prefab.source);
    const d = sc.pack.definitions.find((d) => d.source === prefab?.fsmSource);
    if (
      !d ||
      !processingCloses(d, 'PRE_REVEAL', clues, deployment) ||
      !processingCloses(d, 'REVEALED', clues, deployment)
    )
      return 'La rivelazione di un segnalino di questa tessera richiede effetti ancora in sviluppo.';
  }
  const principal = sc.pack.definitions.find((d) => d.source === sc.pack.principal)!;
  if (!processingCloses(principal, capability.adjacent.event, clues, deployment))
    return 'Gli effetti di una sezione adiacente richiedono capacità ancora in sviluppo.';
  return null;
}

export function explorationConfirmation(sc: ExplorationContext) {
  const d = sc.pack.definitions.find((d) => d.source === sc.pack.manifest.exploration?.definition);
  return d?.states
    .find((s) => s.index === d.handlers['NODE CLICKED'])
    ?.actions.find((a) => a.op === 'confirm');
}

export function explorationSource(sc: ExplorationContext, tileSource: string) {
  return {
    scenarioId: sc.id,
    packFingerprint: sc.packFingerprint,
    projectionFingerprint: sc.projectionFingerprint,
    template: sc.pack.manifest.exploration?.definition,
    tile: sc.tiles.find((t) => t.source === tileSource),
  };
}
