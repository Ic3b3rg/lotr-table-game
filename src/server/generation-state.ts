import type { Catalog } from '../shared/catalog';
import type { Preparation } from '../shared/preparation';
import type { MapGeneration } from '../shared/generated-map';
import { validateContext, validateProjection, invariant } from '../map-freeze/validate';
import { digest } from '../map-freeze/hash';

type GenerationState = {
  mapGeneration: MapGeneration | null;
  content: Catalog | null;
  preparation: Preparation | null;
  players: { id: string }[];
  journey: unknown;
  round: unknown;
  scout: unknown;
  skillTest: { status: string } | null;
};
export function generationStateProblem(state: GenerationState): string | null {
  try {
    const g = state.mapGeneration;
    if (!g) return null;
    invariant(state.preparation?.status === 'prepared' && state.content, 'Compagnia non pronta.');
    invariant(
      !state.journey && !state.round && !state.scout && state.skillTest?.status !== 'converting',
      'Realizzazione e consumer legacy non possono coesistere.',
    );
    const c = g.status === 'frozen' ? g.projection.context : g.job.context;
    validateContext(c);
    invariant(
      c.catalogFingerprint === digest(state.content) && c.catalogId === state.content.id,
      'Catalogo cambiato.',
    );
    invariant(
      digest(
        c.heroes.map((h) => ({
          heroId: h.catalogId,
          playerId: h.playerId,
          roleId: h.roleId,
          itemCopies: h.items.map((i) => i.copy),
        })),
      ) ===
        digest(
          state.preparation.heroes.map(({ heroId, playerId, roleId, itemCopies }) => ({
            heroId,
            playerId,
            roleId,
            itemCopies,
          })),
        ),
      'Compagnia cambiata.',
    );
    for (const r of g.requests)
      invariant(
        state.players.some((p) => p.id === r.playerId),
        'Richiedente non valido.',
      );
    invariant(
      new Set(g.requests.map((r) => `${r.playerId}:${r.requestId}`)).size === g.requests.length,
      'Intenti duplicati.',
    );
    if (g.status === 'frozen') validateProjection(g.projection);
    else {
      const j = g.job;
      invariant(j.contextFingerprint === digest(c), 'Contesto cambiato.');
      invariant(
        j.attempt === j.attempts.length && j.seed === ((j.requestedSeed + j.attempt) | 0),
        'Confine attempt incoerente.',
      );
      j.attempts.forEach((a, i) => {
        invariant(
          a.index === i &&
            a.seed === ((j.requestedSeed + i) | 0) &&
            a.status === 'source-failure' &&
            a.sourceErrorCode !== null &&
            a.historyFingerprint === digest(a.history),
          'Retry non valido.',
        );
        if (i)
          invariant(
            a.incomingFingerprint === j.attempts[i - 1]!.retainedFingerprint,
            'Pool retry incoerente.',
          );
      });
      if (j.attempt)
        invariant(
          j.attempts.at(-1)!.retainedFingerprint === digest(j.incoming),
          'Pool entrante incoerente.',
        );
      else
        invariant(
          j.incoming.randomEncounterPool.length === 0 && j.incoming.itemEncounterPool.length === 0,
          'Pool iniziale non vuoto.',
        );
      if (g.status === 'paused' && g.failure)
        invariant(
          g.failure.index === j.attempt && g.failure.seed === j.seed,
          'Failure fuori dal confine attempt.',
        );
    }
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Generazione non valida.';
  }
}

import type { Receipt } from '../shared/protocol';
export function generationReceiptProblem(
  state: GenerationState,
  commands: { playerId: string; requestId: string; receipt: Receipt }[],
): string | null {
  const g = state.mapGeneration;
  const records = commands.filter(
    (c) => c.receipt.type === 'GENERATE_ADVENTURE_MAP' || c.receipt.type === 'RESUME_ADVENTURE_MAP',
  );
  if (!g) return records.length ? 'Ricevuta senza generazione.' : null;
  if (records.length !== g.requests.length) return 'Registro generazione incompleto.';
  for (const request of g.requests) {
    const r = records.find(
      (c) => c.playerId === request.playerId && c.requestId === request.requestId,
    )?.receipt;
    if (
      !r ||
      (r.type !== 'GENERATE_ADVENTURE_MAP' && r.type !== 'RESUME_ADVENTURE_MAP') ||
      r.type !== request.type ||
      r.jobId !== (g.status === 'frozen' ? g.id : g.job.id) ||
      r.status !== g.status ||
      r.projectionFingerprint !== (g.status === 'frozen' ? g.projection.fingerprint : null)
    )
      return 'Ricevuta generazione incoerente.';
  }
  return null;
}
