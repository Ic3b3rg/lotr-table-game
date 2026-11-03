import type { PhysicalState } from './model';
import { digest } from '../map-freeze/hash';
export const cycleUUID = (value: unknown) => {
  const h = digest(value);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
export function cycleRequest(p: PhysicalState) {
  const active = p.snapshot.active,
    task = p.cycle?.pending;
  if (!active || !task) return null;
  const cursor = active.kind === 'decision' ? active.cursor : digest(active);
  return {
    runId: task.runId,
    pendingId: cycleUUID({ runId: task.runId, cursor }),
    sourceFingerprint: digest({ source: p.runs.find((r) => r.id === task.runId)!.source, cursor }),
    type: task.type,
  };
}
