import { validatePreparedPolicies } from '../scenario/prepared-effects';
import { definitionId } from '../shared/preparation';
import type { Command, ScenarioCommand } from '../shared/protocol';
import type { State } from './state';
import { loadScenarioPack, validateScenarioBinding } from '../scenario/pack';
import { beginScenario, resumeScenario } from '../scenario/runtime';
import { ApiError } from './errors';

export function scenarioOffer(state: State, path: string) {
  const base = {
    available: false,
    reason: 'Create e salvate la mappa prima di avviare l’avventura.',
    packFingerprint: null as string | null,
    projectionFingerprint: null as string | null,
    name: null as string | null,
  };
  if (state.scenario)
    return { ...base, reason: 'Avventura già avviata.', name: state.scenario.pack.name };
  if (state.mapGeneration?.status !== 'frozen') return base;
  try {
    const { pack, fingerprint } = loadScenarioPack(path);
    validateScenarioBinding(pack, state.mapGeneration.projection);
    validatePreparedPolicies(pack, state.content);
    return {
      ...base,
      available: true,
      reason: 'Il gruppo può avviare l’avventura dalla mappa salvata.',
      packFingerprint: fingerprint,
      projectionFingerprint: state.mapGeneration.projection.fingerprint,
      name: pack.name,
    };
  } catch {
    return {
      ...base,
      reason:
        'Il materiale privato necessario per questa mappa manca o non corrisponde. Controllate il pacchetto dell’avventura sul PC.',
    };
  }
}
export function applyScenario(
  state: State,
  playerId: string,
  command: ScenarioCommand,
  path: string,
) {
  if (state.revision !== command.expectedRevision)
    throw new ApiError(
      409,
      'TABLE_CHANGED',
      'Il tavolo è cambiato. Controlla la richiesta e riprova.',
    );
  if (command.type === 'START_SCENARIO') {
    const offer = scenarioOffer(state, path);
    if (
      state.scenario ||
      !offer.available ||
      offer.packFingerprint !== command.packFingerprint ||
      offer.projectionFingerprint !== command.projectionFingerprint
    )
      throw new ApiError(
        409,
        'SCENARIO_SOURCE_CHANGED',
        'Il pacchetto o la realizzazione sono cambiati o non sono certificati.',
      );
    if (
      state.preparation?.status !== 'prepared' ||
      state.journey ||
      state.round ||
      state.scout ||
      state.skillTest
    )
      throw new ApiError(
        409,
        'SCENARIO_BOUNDARY',
        'L’avventura richiede la compagnia pronta senza altre richieste o turni.',
      );
    if (
      state.preparation.heroes.some(
        (h) =>
          h.prepared.length !== 1 ||
          definitionId(h.prepared[0]!) !==
            state.content!.roles.find((r) => r.id === h.roleId)!.skills[0],
      )
    )
      throw new ApiError(
        409,
        'SCENARIO_BOUNDARY',
        'L’avventura richiede la preparazione iniziale di ruolo. Le Scoperte libere dei tavoli precedenti restano conservate, ma non costituiscono questo nuovo avvio.',
      );
    beginScenario(state, loadScenarioPack(path));
  } else resumeScenario(state, playerId, command);
  const sc = state.scenario!;
  const source = command.type === 'START_SCENARIO' ? 'SCENARIO_BEGIN' : command.sourceFingerprint;
  const kind = command.type === 'START_SCENARIO' ? 'start' : command.input.kind;
  const pendingId = command.type === 'START_SCENARIO' ? null : command.pendingId;
  sc.commands.push({
    playerId,
    requestId: command.requestId,
    pendingId,
    source,
    kind,
    revision: state.revision + 1,
  });
  return { scenarioId: sc.id, pendingId, source, kind, phase: sc.phase };
}
export function allowScenarioPlay(state: State, command: Command) {
  const sc = state.scenario!;
  const allowed =
    sc.phase === 'action' &&
    ['START_TURN', 'END_TURN', 'START_TRAVEL', 'MOVE_HERO'].includes(command.type);
  if (!allowed)
    throw new ApiError(
      409,
      'SCENARIO_CAPABILITY',
      'Concludi l’avvio. Le altre interazioni, esplorazioni ed effetti dell’avventura richiedono capacità ancora non disponibili.',
    );
  if (command.type === 'MOVE_HERO') {
    const source = sc.spaceBindings.find((b) => b.id === command.destinationSpaceId)?.sourceId;
    const projection =
      state.mapGeneration!.status === 'frozen' ? state.mapGeneration!.projection : null;
    const space = projection?.spaces.find((s) => s.id === source);
    if (!space || !sc.tiles.some((t) => t.source === space.tileSource && t.visible && t.explored))
      throw new ApiError(
        409,
        'EXPLORATION_CAPABILITY',
        'Questa casella richiede esplorazione fonte, non ancora disponibile. Il movimento rimane da risolvere.',
      );
  }
}
