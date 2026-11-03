import type { PhysicalActive, PhysicalCounts } from './physical';
import type { Session } from './protocol';

export function physicalAllocationProblem(
  active: PhysicalActive,
  counts: PhysicalCounts,
): string | null {
  if (![counts.damage, counts.fear].every((n) => Number.isInteger(n) && n >= 0))
    return 'Scegli quantità intere non negative.';
  if (active.kind === 'gate' || active.kind === 'decision') return 'La conseguenza resta sospesa.';
  const total = counts.damage + counts.fear;
  const maximum = active.kind === 'prevent' ? active.budget : active.count;
  const minimum = active.kind === 'prevent' ? 0 : active.minimum;
  const available = active.kind === 'prevent' ? active.remaining : active.available;
  if (total < minimum) return `Scegli ancora ${minimum - total} carte da scartare.`;
  if (total > maximum || counts.damage > available.damage || counts.fear > available.fear)
    return 'L’allocazione supera le quantità disponibili.';
  return null;
}
export function bindPhysicalAnswer(
  session: Pick<Session, 'scenario' | 'physical'>,
  counts: PhysicalCounts,
) {
  const sc = session.scenario,
    q = sc?.pending,
    active = session.physical?.active;
  if (
    !sc ||
    q?.kind !== 'physical' ||
    !active ||
    active.kind === 'gate' ||
    q.physical?.parentId !== active.runId ||
    q.physical.child !== active.child ||
    q.physical.grant !== (active.kind === 'prevent' ? active.grant : null) ||
    physicalAllocationProblem(active, counts)
  )
    throw new Error('Richiesta fisica non disponibile.');
  return {
    type: 'SCENARIO_INPUT' as const,
    scenarioId: sc.id,
    packFingerprint: sc.packFingerprint,
    projectionFingerprint: sc.projectionFingerprint,
    pendingId: q.id,
    sourceFingerprint: q.fingerprint,
    heroId: q.heroId,
    input: {
      kind:
        active.kind === 'prevent' ? ('physical-prevent' as const) : ('physical-discard' as const),
      damage: counts.damage,
      fear: counts.fear,
    },
  };
}

export function bindPhysicalDecision(
  session: Pick<Session, 'scenario' | 'physical'>,
  input: import('./physical').PhysicalInput,
) {
  const sc = session.scenario,
    q = sc?.pending,
    active = session.physical?.active;
  const cycle = session.physical?.cycle?.pending;
  const continuing =
    active?.kind === 'gate' &&
    active.reason === 'last-stand-unavailable' &&
    input.kind === 'physical-continue-last-stand';
  if (cycle && (active?.kind === 'decision' || continuing) && active.runId === cycle.runId) {
    const { type: _, ...binding } = cycle;
    return { type: 'CYCLE_INPUT' as const, ...binding, input };
  }
  if (
    !sc ||
    q?.kind !== 'physical' ||
    (!continuing && active?.kind !== 'decision') ||
    q.physical?.parentId !== active.runId ||
    q.physical.child !== active.child ||
    q.physical.grant !== null ||
    q.physical.cursor !== (active.kind === 'decision' ? active.cursor : undefined)
  )
    throw new Error('La decisione fisica è cambiata.');
  return {
    type: 'SCENARIO_INPUT' as const,
    scenarioId: sc.id,
    packFingerprint: sc.packFingerprint,
    projectionFingerprint: sc.projectionFingerprint,
    pendingId: q.id,
    sourceFingerprint: q.fingerprint,
    heroId: q.heroId,
    input,
  };
}
