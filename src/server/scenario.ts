import { answerBattleStartup } from '../scenario/battle-startup';
import { validateCampPreparationCatalog } from '../scenario/camp-preparation-capability';
import { validateCampItemsCatalog } from '../scenario/camp-items-capability';
import { validateItemStartup } from '../scenario/item-capability';
import { validateCombatParty } from '../combat/party';
import { validatePreparedPolicies } from '../scenario/prepared-effects';
import { definitionId } from '../shared/preparation';
import type { Command, ScenarioCommand } from '../shared/protocol';
import type { State } from './state';
import { loadScenarioPack, validateScenarioBinding } from '../scenario/pack';
import { beginScenario, resumeScenario } from '../scenario/runtime';
import { ApiError } from './errors';
import { needsPhysical, loadPhysicalSource, requireLinkedTitle } from '../scenario/physical';
import { initializeOriginalCycle } from './physical-cycle';
import { requiresProvocation } from '../scenario/deployment';
import { validateFailureParty, answerCampaign } from '../scenario/conclusion';
import { validateCampCatalog } from '../scenario/camp-capability';
import { validateStartupPreparationSource } from '../scenario/startup-preparation';
import { requireInteractionCoverage } from '../physical-resolution/interaction-look';

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
    validateCampCatalog(pack, state.content!);
    validateCampItemsCatalog(pack, state.content!);
    validateCampPreparationCatalog(pack, state.content!);
    validatePreparedPolicies(pack, state.content);
    validateCombatParty(state, pack);
    validateFailureParty(state, pack);
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
  physicalPath: string,
  explorationEntropy?: string,
) {
  let summaries: ReturnType<typeof answerCampaign> = {};
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
    const parsed = loadScenarioPack(path);
    validateCampCatalog(parsed.pack, state.content!);
    validateCampItemsCatalog(parsed.pack, state.content!);
    validateCampPreparationCatalog(parsed.pack, state.content!);
    let physical;
    if (needsPhysical(parsed.pack)) {
      try {
        physical = loadPhysicalSource(physicalPath);
        if (
          parsed.pack.manifest.scope === 'original-encounter-v1' &&
          (!physical.fronts || !physical.lastStand)
        )
          throw new Error('Closure fisica originale incompleta.');
      } catch {
        throw new ApiError(
          409,
          'PHYSICAL_SOURCE_REQUIRED',
          'Il raw privato verificato dei mazzi danni e paure manca o non corrisponde. Nessun avvio è stato applicato.',
        );
      }
    }
    requireLinkedTitle(parsed.pack, physical?.raw);
    try {
      validateStartupPreparationSource(parsed.pack, state.content, physical?.fronts);
    } catch {
      throw new ApiError(
        409,
        'STARTUP_PREPARATION_SOURCE_REQUIRED',
        'Le capacità verificate di preparazione non corrispondono al catalogo e ai fronti. Nessun avvio è stato applicato.',
      );
    }
    try {
      validateItemStartup(state, parsed.pack, physical?.fronts);
    } catch {
      throw new ApiError(
        409,
        'ITEM_SOURCE_REQUIRED',
        'L’oggetto richiede carta, quantità, inventario e capacità verificati prima dell’avvio. Nessuna modifica è stata applicata.',
      );
    }
    if (physical?.fronts?.interactionLook) {
      try {
        requireInteractionCoverage(
          physical.fronts,
          state.content!,
          state.preparation.heroes.map((h) => h.heroId),
        );
      } catch {
        throw new ApiError(
          409,
          'INTERACTION_BEFORE_CAPABILITY',
          'La copertura delle capacità prima di interagire è incompleta o non corrisponde al catalogo. Nessun avvio è stato applicato.',
        );
      }
    }
    beginScenario(state, parsed, physical);
  } else if (state.scenario?.battle && state.scenario.phase === 'setup')
    answerBattleStartup(state, playerId, command);
  else if (state.scenario?.conclusion && state.scenario.conclusion.stage !== 'conclusion')
    summaries = answerCampaign(state, playerId, command);
  else resumeScenario(state, playerId, command, physicalPath, undefined, explorationEntropy);
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
  if (
    sc.phase === 'action' &&
    sc.pack.manifest.scope === 'original-encounter-v1' &&
    !state.physical!.cycle
  )
    initializeOriginalCycle(state);
  return {
    scenarioId: sc.id,
    pendingId,
    source,
    kind,
    phase: sc.phase,
    ...summaries,
  };
}
export function allowScenarioPlay(state: State, command: Command) {
  const sc = state.scenario!;
  if (sc.conclusion) {
    if (command.type === 'SCENARIO_INPUT') return;
    throw new ApiError(
      409,
      'ADVENTURE_ENDED',
      'L’avventura è conclusa. Proseguite insieme verso il campo; turni, esplorazioni e attacchi sono terminati.',
    );
  }
  const original =
    sc.pack.manifest.scope === 'original-encounter-v1' && state.physical?.cycle?.version === 2;
  if (sc.battle) {
    if (command.type === 'SCENARIO_INPUT' && sc.pending) return;
    if (sc.phase === 'action' && sc.pack.manifest.battleStartup?.combat) {
      if (command.type === 'COMBAT_INPUT' && (state.combat?.active || state.combat?.operation))
        return;
      if (command.type === 'CYCLE_INPUT' && state.physical!.cycle!.pending) return;
      if (
        command.type === 'START_ATTACK' &&
        !sc.pending &&
        !state.physical?.snapshot.active &&
        !state.combat?.operation &&
        state.combat?.grants.some((g) => g.id === command.grantId && g.status === 'offered')
      )
        return;
      if (
        sc.pending ||
        state.physical?.snapshot.active ||
        state.combat?.active ||
        state.combat?.operation
      )
        throw new ApiError(
          409,
          'COMBAT_PENDING',
          'Completa il combattimento e il suo ritorno prima di proseguire.',
        );
      if (
        ['START_ATTACK', 'START_TURN', 'END_TURN', 'START_TRAVEL', 'MOVE_HERO'].includes(
          command.type,
        )
      )
        return;
    }
    if (
      sc.phase === 'action' &&
      ['START_TURN', 'END_TURN', 'START_TRAVEL', 'MOVE_HERO', 'CYCLE_INPUT'].includes(command.type)
    )
      return;
    throw new ApiError(
      409,
      'BATTLE_STARTUP_BOUNDARY',
      'Completa l’allestimento. Il seguito degli incontri e dei round richiede la propria capacità fonte.',
    );
  }
  if (original && command.type === 'SCENARIO_INPUT' && sc.pending) return;
  if (
    original &&
    command.type === 'COMBAT_INPUT' &&
    (state.combat?.active || state.combat?.operation?.interactionOrder)
  )
    return;
  if (
    original &&
    command.type === 'START_ATTACK' &&
    sc.pack.manifest.combat &&
    (!state.combat?.active ||
      state.combat?.grants.some((g) => g.id === command.grantId && g.status === 'offered'))
  )
    return;
  if (original && command.type === 'CYCLE_INPUT' && state.physical!.cycle!.pending) return;
  if (sc.pending)
    throw new ApiError(
      409,
      'SCENARIO_PENDING',
      'Concludi la richiesta dell’avventura prima delle altre azioni.',
    );
  if (state.physical?.snapshot.active)
    throw new ApiError(
      409,
      'PHYSICAL_PENDING',
      'Risolvi la conseguenza corrente sul posto indicato. Le altre azioni attendono il suo completamento.',
    );
  if (state.physical && state.physical.version !== 1 && command.type === 'START_INTERACTION_TEST')
    throw new ApiError(
      409,
      'PHYSICAL_INTERACTION_CAPABILITY',
      'L’interazione richiede il proprio consumer fonte, compresi i costi prima di interagire. La prova libera non lo sostituisce e nessuna azione è stata consumata.',
    );
  if (state.combat?.active || state.combat?.operation)
    throw new ApiError(
      409,
      'COMBAT_PENDING',
      'Concludi il combattimento e il suo ritorno prima delle altre azioni.',
    );
  const allowed =
    // Enemy checks precede the ordinary action's cost and movement.
    sc.phase === 'action' &&
    (['START_TURN', 'END_TURN', 'START_TRAVEL', 'MOVE_HERO'].includes(command.type) ||
      (original && (command.type === 'INTERACT_SCENARIO' || command.type === 'EXPLORE_SCENARIO')));
  const phaseCommand =
    original &&
    !!sc.pack.manifest.rounds &&
    ['BEGIN_SHADOW', 'CONFIRM_SHADOW_STEP', 'END_RALLY', 'START_RALLY_SCOUT'].includes(
      command.type,
    );
  if (
    'heroId' in command &&
    command.heroId &&
    ['START_TRAVEL', 'MOVE_HERO', 'INTERACT_SCENARIO', 'EXPLORE_SCENARIO'].includes(command.type) &&
    requiresProvocation(state, command.heroId) &&
    !sc.pack.manifest.combat
  )
    throw new ApiError(
      409,
      'ENEMY_PROVOCATION_CAPABILITY',
      'Un gruppo nemico pronto è nella casella dell’eroe. La provocazione richiede il combattimento, non ancora disponibile. Nessun costo o movimento è stato applicato.',
    );
  if (!allowed && !phaseCommand)
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
