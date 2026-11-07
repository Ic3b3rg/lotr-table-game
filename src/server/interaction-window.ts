import type { State } from './state';
import { ApiError } from './errors';
import {
  beforeInteractionEffects,
  beforeOrderFeasible,
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
  const resources = p.snapshot.resolution?.resources ?? {
    preparation: state.preparation!,
    depletion: [],
    boons: [],
  };
  let effects;
  try {
    effects = beforeInteractionEffects(
      p.raw,
      p.fronts!.artifact,
      p.fronts!.catalog,
      resources,
      p.snapshot.areas.find((h) => h.heroId === heroId)!,
      p.snapshot.resolution!.faceup,
      threat,
    );
  } catch {
    gate(
      'INTERACTION_BEFORE_CAPABILITY',
      'Un effetto attivo prima di interagire richiede una capacità ancora non disponibile. Nessun costo è stato applicato.',
    );
  }
  const hero = state.preparation!.heroes.find((h) => h.heroId === heroId)!;
  const cap = state.content!.heroes.find((h) => h.id === heroId)!.stats.inspiration;
  if (!beforeOrderFeasible(effects!, hero.inspiration, cap))
    gate(
      'INTERACTION_HIDDEN_FUNDING',
      'Gli obblighi prima dell’interazione non hanno un ordine garantito senza dipendere da un premio ancora nascosto. Questa combinazione richiede una regola di prosecuzione verificata. Nessun costo o carta è stato applicato.',
    );
  if (effects!.some((e) => e.kind === 'look') && !hero.deck.length && !hero.discard.length)
    gate(
      'INTERACTION_CARDLESS',
      'Non è disponibile alcuna carta nel mazzo o negli scarti per guardare. Questa combinazione richiede una regola verificata. Nessun costo o carta è stato applicato.',
    );
}
