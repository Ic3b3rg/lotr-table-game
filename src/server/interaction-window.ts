import type { State } from './state';
import { ApiError } from './errors';
import {
  beforeInteractionProblem,
  requireInteractionCoverage,
} from '../physical-resolution/interaction-look';
import { digest } from '../map-freeze/hash';

/** Preflight reads known obligations and availability, never the actual hidden top. */
export function requireBeforeInteraction(state: State, heroId: string, threat: boolean) {
  const p = state.physical!;
  if (!p.cycle?.interactionLookRules) return;
  const gate = (code: string, message: string): never => {
    throw new ApiError(409, code, message);
  };
  try {
    requireInteractionCoverage(
      p.fronts!.artifact,
      state.content!,
      p.heroes.map((h) => h.heroId),
    );
    if (digest(p.fronts!.catalog) !== digest(state.content)) throw new Error('Catalogo cambiato.');
  } catch {
    gate(
      'INTERACTION_BEFORE_CAPABILITY',
      'Le capacità prima di interagire non sono tutte verificate per la compagnia corrente. Nessun costo è stato applicato.',
    );
  }
  const problem = beforeInteractionProblem(p, heroId, threat, state.preparation!);
  if (problem) gate(problem.code, problem.message);
}
