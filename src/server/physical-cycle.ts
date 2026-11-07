import {
  replayEpisode,
  validateEpisodeState,
  validateEpisodeReceipts,
  applyEpisodeDomain,
} from './episode-state';
import { createHash, randomBytes } from 'node:crypto';
import { CombatIntentSchema, CombatOperationSchema } from '../shared/combat-controller';
import {
  initialCombat,
  startHeroAttack,
  answerCombat,
  advanceCombat,
  nextProvocation,
} from '../combat/controller';
import { CycleIntentSchema, type CycleIntent, type CycleState } from '../shared/physical-cycle';
import type { Command, Receipt } from '../shared/protocol';
import { CommandSchema } from '../shared/protocol';
import type { State } from './state';
import type { PhysicalState } from '../physical-resolution/model';
import { boonEnemyPositions } from './physical-spatial';
import type { PhysicalProgram } from '../shared/physical';
import { answerPhysical, openPhysical, replayPhysical } from '../physical-resolution/runtime';
import { persistentEffects, travelMoves } from '../physical-resolution/effects';
import { applyJourneyCommand } from './journey-map';
import { rallyScoutCount } from '../shared/rally-scout';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';
import { ApiError } from './errors';
import { beginHeroFailure, advanceConclusion } from '../scenario/conclusion';
import type { LastStandArtifact } from '../physical-resolution/last-stand-program';
import { syncPhysicalDefeat, defeatedHeroes } from './physical-defeat';
import { liveGroupRules } from '../scenario/live-groups';
import { requiresProvocation } from '../scenario/deployment';
import { EncounterIntentSchema } from '../shared/scenario';
import { z } from 'zod';
import { requireInteractionCoverage } from '../physical-resolution/interaction-look';
import {
  interactScenario,
  exploreScenario,
  finishDefeatedSprint,
  finishInvalidatedSprint,
} from '../scenario/runtime';
import { applyScenario, allowScenarioPlay } from './scenario';
import { scenarioStateProblem, scenarioReceiptProblem } from '../scenario/validate';
import {
  beginSourceShadow,
  sourceDarknessHeroes,
  finishSourceDarkness,
  applySourceThreat,
  finishSourceReset,
  finishSourceRally,
  advanceSourceShadow,
  advanceSourceActivations,
} from '../scenario/round-source';

const originalIntents = z.discriminatedUnion('type', [
  ...CycleIntentSchema.options,
  ...EncounterIntentSchema.options,
  ...CombatIntentSchema.options,
]);

const ordinary = new Set<string>([
  ...CycleIntentSchema.options.map((o) => o.shape.type.value),
  ...CombatIntentSchema.options.map((o) => o.shape.type.value),
]);
import { cycleUUID as uuid, cycleRequest } from '../physical-resolution/cycle-request';
export function isPhysicalCycle(state: State, command: Command) {
  return (
    state.scenario?.phase === 'action' &&
    state.physical &&
    state.physical.version !== 1 &&
    ordinary.has(command.type as CycleIntent['type'])
  );
}
function fail(code: string, message: string): never {
  throw new ApiError(409, code, message);
}
function owned(state: State, heroId: string, playerId: string) {
  const hero = state.preparation!.heroes.find((h) => h.heroId === heroId);
  if (!hero) fail('HERO_UNAVAILABLE', 'Questo eroe non è nella compagnia.');
  if (defeatedHeroes(state).includes(heroId))
    fail('HERO_DEFEATED', 'Questo eroe è sconfitto e non può effettuare azioni.');
  if (hero.playerId !== playerId)
    throw new ApiError(403, 'HERO_NOT_YOURS', 'Puoi gestire soltanto i tuoi eroi.');
  return hero;
}
function darknessHeroes(state: State) {
  if (state.scenario?.pack.manifest.rounds) return sourceDarknessHeroes(state);
  invariant(state.mapGeneration?.status === 'frozen', 'Contesto fisico senza mappa congelata.');
  const sc = state.scenario!,
    spaces = state.mapGeneration.projection.spaces;
  return state.preparation!.heroes.flatMap((h, n) => {
    if (defeatedHeroes(state).includes(h.heroId)) return [];
    const position = state.journey!.heroes.find((p) => p.heroId === h.heroId)!;
    const source = sc.spaceBindings.find((b) => b.id === position.spaceId)?.sourceId;
    const space = spaces.find((s) => s.id === source);
    invariant(space, 'Posizione senza contesto fonte.');
    return space.hasDarkness ? [n] : [];
  });
}
function finish(
  state: State,
  task: NonNullable<CycleState['pending']>,
  record: CycleState['records'][number],
) {
  if (task.type === 'START_ATTACK') {
    advanceCombat(state);
    continueActivations(state, record);
    return;
  }
  const round = state.round!,
    progress = round.heroes.find((h) => h.heroId === task.heroId)!;
  if (task.type === 'END_TURN') {
    progress.turnEnded = true;
    round.activeHeroId = null;
    round.turnId = null;
    state.journey!.travel = null;
  } else if (task.type === 'START_RALLY_SCOUT') progress.rallyDone = true;
  else if (state.scenario!.rounds && task.type === 'BEGIN_SHADOW') finishSourceDarkness(state);
  else if (state.scenario!.rounds) finishSourceReset(state);
  else {
    round.phase = 'rally';
    round.shadowStep = null;
  }
  if (state.scenario!.pack.manifest.liveGroups) syncPhysicalDefeat(state);
}
function openSourceDarkness(state: State, record: CycleState['records'][number]) {
  const affected = darknessHeroes(state);
  if (!affected.length) {
    finishSourceDarkness(state);
    return null;
  }
  const data = state.scenario!.pack.manifest.rounds!.darkness;
  return runSource(state, record, [
    {
      kind: 'darkness',
      hero: affected[0]!,
      heroes: affected,
      amount: data.amount,
      face: data.face,
      negate: data.negate,
    },
  ]);
}
function continueActivations(state: State, record: CycleState['records'][number]) {
  if (!advanceSourceActivations(state)) return;
  const runId = openSourceDarkness(state, record);
  if (!runId) return;
  const task = { runId, type: 'BEGIN_SHADOW' as const, heroId: state.physical!.heroes[0]!.heroId };
  if (state.physical!.snapshot.active) state.physical!.cycle!.pending = task;
  else finish(state, task, record);
}
function runSource(
  state: State,
  record: CycleState['records'][number],
  children: Extract<PhysicalProgram, { profile: 'source-fronts-v1' }>['children'],
) {
  const p = state.physical!,
    intent = record.intent,
    j = state.journey!,
    round = state.round!;
  const resources = p.snapshot.resolution!.resources;
  const context = resources
    ? structuredClone(resources)
    : { preparation: structuredClone(state.preparation!), boons: [], depletion: [] };
  invariant(
    digest(context.preparation) === digest(state.preparation),
    'Risorse ordinarie fuori dal ledger fisico.',
  );
  const spatial = {
    ...boonEnemyPositions(state),
    heroes: state.preparation!.heroes.map((h) => ({
      heroId: h.heroId,
      playerId: h.playerId,
      spaceId: j.heroes.find((x) => x.heroId === h.heroId)!.spaceId,
    })),
    connections: structuredClone(j.definition.connections),
  };
  const program: PhysicalProgram = {
    profile: 'source-fronts-v1',
    ...liveGroupRules(state),
    initialCredits: p.heroes.map(() => 0),
    limits: p.heroes.map(() => ({ kind: 'requires-capability', capability: 'source-derived' })),
    darknessHeroes: darknessHeroes(state),
    children,
  };
  const id = uuid({
    scenario: state.scenario!.id,
    player: record.playerId,
    request: record.requestId,
  });
  const ledger = p.cycle,
    entry = ledger?.records.length ?? 0;
  delete p.cycle;
  try {
    openPhysical(
      p,
      {
        effectId: `ordinary:${record.requestId}`,
        instanceId: 'ordinary-cycle',
        state: round.number,
        entry,
        action: 0,
        parameterHash: digest({ intent, round, spatial }),
      },
      program,
      context,
      spatial,
      id,
      !!record.lastStandRules,
    );
  } finally {
    if (ledger) p.cycle = ledger;
  }
  state.preparation = structuredClone(p.snapshot.resolution!.resources!.preparation);
  return id;
}
export function executeEpisodeIntent(
  state: State,
  cycle: CycleState,
  record: CycleState['records'][number],
  returning = false,
): Receipt {
  const receipt = executeIntent(state, cycle, record, returning);
  if (state.physical?.snapshot.lastStand?.terminal)
    beginHeroFailure(state, 'no-active-heroes', record.requestId);
  advanceConclusion(state);
  return receipt;
}
function executeIntent(
  state: State,
  cycle: CycleState,
  record: CycleState['records'][number],
  returning = false,
): Receipt {
  const c = record.intent,
    round = state.round!,
    p = state.physical!;
  const base = {
    requestId: record.requestId,
    type: c.type,
    appliedRevision: c.expectedRevision + 1,
  };
  if (state.scenario!.conclusion && c.type === 'SCENARIO_INPUT') {
    if (c.expectedRevision !== state.revision)
      fail('TABLE_CHANGED', 'Il tavolo è cambiato. Controlla il passaggio e riprova.');
    const result = applyScenario(
      state,
      record.playerId,
      { ...c, requestId: record.requestId, generation: state.generation },
      '',
      '',
    );
    return { ...base, type: c.type, ...result };
  }
  if (cycle.terminal || p.snapshot.lastStand?.terminal)
    fail(
      'ADVENTURE_LOSS_PENDING',
      'La perdita dell’avventura è salvata. Il seguito originale non è ancora disponibile.',
    );
  if (c.expectedRevision !== state.revision)
    fail('TABLE_CHANGED', 'Il tavolo è cambiato. Controlla la richiesta e riprova.');
  if (cycle.version >= 2)
    allowScenarioPlay(state, { ...c, requestId: record.requestId, generation: state.generation });
  const sprint =
    c.type === 'SCENARIO_INPUT' &&
    c.input.kind === 'source-sprint' &&
    c.input.destinationSpaceId !== null;
  invariant(
    (c.type === 'EXPLORE_SCENARIO' || sprint) === !!record.explorationEntropy,
    'Entropia esplorazione fuori dal suo intento.',
  );
  if (
    !returning &&
    c.type === 'SCENARIO_INPUT' &&
    c.input.kind === 'source-sprint' &&
    (state.combat?.active || state.combat?.operation)
  )
    fail('COMBAT_PENDING', 'Completa la provocazione prima del ritorno allo Scatto.');
  invariant(
    (c.type === 'BEGIN_SHADOW' && !!state.scenario!.pack.manifest.followup) ===
      !!record.shadowEntropy,
    'Entropia Ombra fuori dal suo intento.',
  );
  if (
    !returning &&
    state.combat &&
    (c.type === 'MOVE_HERO' ||
      c.type === 'INTERACT_SCENARIO' ||
      c.type === 'EXPLORE_SCENARIO' ||
      sprint) &&
    'heroId' in c &&
    c.heroId &&
    requiresProvocation(state, c.heroId)
  ) {
    // Validate the complete original command on a disposable copy before opening any provocation.
    const work = structuredClone(state),
      ledger = work.physical!.cycle!;
    if (c.type === 'INTERACT_SCENARIO' && cycle.interactionLookRules)
      interactScenario(
        work,
        record.playerId,
        { ...c, requestId: record.requestId, generation: state.generation },
        undefined,
        true,
      );
    else executeEpisodeIntent(work, ledger, record, true);
    const { expectedRevision: _, type: __, ...fields } = c;
    const origin = CombatOperationSchema.shape.origin.parse(
      c.type === 'SCENARIO_INPUT'
        ? {
            ...fields,
            kind: 'source-sprint',
            entropy: record.explorationEntropy!,
            sourceRequest: state.scenario!.pending,
          }
        : c.type === 'INTERACT_SCENARIO'
          ? { ...fields, kind: 'interaction' as const }
          : c.type === 'EXPLORE_SCENARIO'
            ? { ...fields, kind: 'exploration' as const, entropy: record.explorationEntropy! }
            : { ...fields, kind: 'movement' as const },
    );
    const op: NonNullable<State['combat']>['operations'][number] = {
      id: uuid({ request: record.requestId, kind: 'provocation-return' }),
      playerId: record.playerId,
      requestId: record.requestId,
      origin,
      provoked: [],
      status: 'provoking',
      reason: null,
      ...(c.type === 'INTERACT_SCENARIO' && cycle.interactionLookRules
        ? { interactionOrder: { version: cycle.interactionLookRules, stage: 'plan' as const } }
        : {}),
    };
    state.combat.operation = op;
    if (op.origin.kind === 'source-sprint') state.scenario!.pending = null;
    nextProvocation(state);
    return c.type === 'MOVE_HERO'
      ? {
          ...base,
          type: 'MOVE_HERO',
          mapId: c.mapId,
          heroId: c.heroId,
          spaceId: state.journey!.heroes.find((h) => h.heroId === c.heroId)!.spaceId,
          movesRemaining: state.journey!.travel!.remaining,
          roundId: c.roundId,
          turnId: c.turnId,
          completed: false,
        }
      : c.type === 'SCENARIO_INPUT'
        ? {
            ...base,
            type: 'SCENARIO_INPUT',
            scenarioId: c.scenarioId,
            pendingId: c.pendingId,
            source: c.sourceFingerprint,
            kind: 'source-sprint',
            phase: 'action',
          }
        : c.type === 'INTERACT_SCENARIO'
          ? {
              ...base,
              type: c.type,
              scenarioId: c.scenarioId,
              pendingId: null,
              source: c.sourceFingerprint,
              kind: 'provoking',
              phase: 'action',
              completed: false,
            }
          : {
              ...base,
              type: c.type,
              scenarioId: c.scenarioId,
              pendingId: null,
              source: c.sourceFingerprint,
              kind: 'explore',
              phase: 'action',
              mapId: c.mapId,
              heroId: c.heroId,
              spaceId: state.journey!.heroes.find((h) => h.heroId === c.heroId)!.spaceId,
              movesRemaining: state.journey!.travel!.remaining,
              roundId: c.roundId,
              turnId: c.turnId,
              completed: false,
            };
  }
  if (c.type === 'START_ATTACK' || c.type === 'COMBAT_INPUT') {
    const attempt =
      c.type === 'START_ATTACK'
        ? startHeroAttack(state, record.playerId, c, record.requestId)
        : answerCombat(state, record.playerId, c, record.requestId);
    continueActivations(state, record);
    const resumedJourney = resumeProvocation(state, cycle, record);
    return {
      ...(resumedJourney ? { resumedJourney } : {}),
      ...base,
      type: c.type,
      combatId: attempt.id,
      completed: attempt.returned,
    };
  }
  if (c.type === 'EXPLORE_SCENARIO') {
    invariant(cycle.version === 2, 'Esplorazione in un ledger storico.');
    exploreScenario(
      state,
      record.playerId,
      { ...c, requestId: record.requestId, generation: state.generation },
      record.explorationEntropy!,
    );
    const sc = state.scenario!;
    sc.commands.push({
      playerId: record.playerId,
      requestId: record.requestId,
      pendingId: null,
      source: c.sourceFingerprint,
      kind: 'explore',
      revision: base.appliedRevision,
    });
    return {
      ...base,
      type: 'EXPLORE_SCENARIO',
      scenarioId: sc.id,
      pendingId: null,
      source: c.sourceFingerprint,
      kind: 'explore',
      phase: 'action',
      mapId: state.journey!.id,
      heroId: c.heroId,
      spaceId: c.destinationSpaceId,
      movesRemaining: state.journey!.travel!.remaining,
      roundId: c.roundId,
      turnId: c.turnId,
    };
  }
  if (c.type === 'INTERACT_SCENARIO' || c.type === 'SCENARIO_INPUT') {
    invariant(cycle.version >= 2, 'Comando fonte in un ledger storico.');
    const command = { ...c, requestId: record.requestId, generation: state.generation };
    if (command.type === 'SCENARIO_INPUT') {
      const result = applyScenario(
        state,
        record.playerId,
        command,
        '',
        '',
        record.explorationEntropy,
      );
      if (advanceSourceShadow(state)) {
        const id = runSource(state, record, [{ kind: 'rally-reset', hero: 0 }]);
        const task = {
          runId: id,
          type: 'CONFIRM_SHADOW_STEP' as const,
          heroId: p.heroes[0]!.heroId,
        };
        if (p.snapshot.active) cycle.pending = task;
        else finish(state, task, record);
      }
      if (state.combat?.active && !state.scenario!.pending) advanceCombat(state);
      continueActivations(state, record);
      const resumedJourney = state.combat ? resumeProvocation(state, cycle, record) : undefined;
      return {
        ...(resumedJourney ? { resumedJourney } : {}),
        ...base,
        type: command.type,
        ...result,
      };
    }
    interactScenario(state, record.playerId, command);
    const sc = state.scenario!;
    sc.commands.push({
      playerId: record.playerId,
      requestId: record.requestId,
      pendingId: null,
      source: c.sourceFingerprint,
      kind: 'interact',
      revision: base.appliedRevision,
    });
    return {
      ...base,
      type: 'INTERACT_SCENARIO',
      scenarioId: sc.id,
      pendingId: null,
      source: c.sourceFingerprint,
      kind: 'interact',
      phase: sc.phase,
    };
  }
  if (c.type === 'CYCLE_INPUT') {
    p.cycle = cycle;
    const q = cycleRequest(p),
      active = p.snapshot.active;
    if (
      !q ||
      q.runId !== c.runId ||
      q.pendingId !== c.pendingId ||
      q.sourceFingerprint !== c.sourceFingerprint
    )
      fail('CYCLE_REQUEST_CHANGED', 'Questa conseguenza ordinaria è conclusa o è cambiata.');
    if (active!.actorPlayerId !== record.playerId)
      throw new ApiError(403, 'PHYSICAL_ACTOR', 'La decisione spetta al proprietario indicato.');
    if (
      active!.kind === 'gate' &&
      !(
        active!.reason === 'last-stand-unavailable' &&
        c.input.kind === 'physical-continue-last-stand'
      )
    )
      fail('PHYSICAL_CAPABILITY', 'La fonte resta sospesa alla capacità indicata.');
    try {
      answerPhysical(p, c.runId, c.input, {
        playerId: record.playerId,
        requestId: record.requestId,
        pendingId: c.pendingId,
        sourceFingerprint: c.sourceFingerprint,
        revision: base.appliedRevision,
      });
    } catch {
      fail(
        'PHYSICAL_ALLOCATION',
        'La scelta non rispetta carte, vincoli, costi o quantità della richiesta. Nessun effetto è stato applicato.',
      );
    }
    p.cycle = cycle;
    state.preparation = structuredClone(p.snapshot.resolution!.resources!.preparation);
    syncPhysicalDefeat(state);
    const completed = !p.snapshot.active;
    let resumedJourney:
      | import('zod').infer<typeof import('../shared/combat-controller').ResumedJourneySchema>
      | undefined;
    if (completed) {
      const task = cycle.pending!;
      cycle.pending = null;
      finish(state, task, record);
      if (task.type === 'START_ATTACK') resumedJourney = resumeProvocation(state, cycle, record);
    }
    return {
      ...(resumedJourney ? { resumedJourney } : {}),
      ...base,
      type: 'CYCLE_INPUT',
      runId: c.runId,
      source: c.sourceFingerprint,
      completed,
    };
  }
  if (cycle.pending || p.snapshot.active)
    fail('PHYSICAL_PENDING', 'Concludi la conseguenza corrente prima di proseguire nel round.');
  if (
    cycle.version === 2 &&
    (state.scenario!.pending ||
      state.scenario!.play!.active ||
      state.scenario!.explorations?.active)
  )
    fail('SCENARIO_PENDING', 'Concludi l’incontro prima di proseguire nel turno.');
  if (
    cycle.version === 2 &&
    ['BEGIN_SHADOW', 'CONFIRM_SHADOW_STEP', 'END_RALLY', 'START_RALLY_SCOUT'].includes(c.type) &&
    !state.scenario!.pack.manifest.rounds
  )
    fail('SCENARIO_CAPABILITY', 'La fonte originale della Fase di Ombra non è ancora disponibile.');
  if (round.id !== c.roundId) fail('ROUND_CHANGED', 'Questo round è concluso o è cambiato.');
  if (state.scout || state.skillTest?.status === 'converting')
    fail('REVEAL_PENDING', 'Concludi le carte rivelate.');
  const hero = 'heroId' in c ? owned(state, c.heroId, record.playerId) : null;
  const progress = hero ? round.heroes.find((h) => h.heroId === hero.heroId)! : null;
  let runId: string | null = null;
  if (c.type === 'START_TRAVEL' || c.type === 'MOVE_HERO') {
    if (c.type === 'MOVE_HERO') {
      const sc = state.scenario!,
        source = sc.spaceBindings.find((b) => b.id === c.destinationSpaceId)?.sourceId;
      if (!sc.battle) {
        invariant(state.mapGeneration?.status === 'frozen', 'Movimento senza realizzazione.');
        const space = state.mapGeneration.projection.spaces.find((s) => s.id === source);
        if (
          !space ||
          !sc.tiles.some((t) => t.source === space.tileSource && t.visible && t.explored)
        )
          fail(
            'EXPLORATION_CAPABILITY',
            'La casella richiede esplorazione fonte ancora non disponibile.',
          );
      }
    }
    return {
      ...base,
      ...applyJourneyCommand(
        state,
        record.playerId,
        { ...c, requestId: record.requestId, generation: state.generation },
        null,
        travelMoves(p, c.heroId),
      ),
      type: c.type,
    };
  }
  if (c.type === 'START_TURN') {
    if (round.phase !== 'action' || round.activeHeroId || progress!.turnEnded)
      fail('TURN_UNAVAILABLE', 'Un turno è in corso oppure questo eroe ha già concluso.');
    round.activeHeroId = c.heroId;
    round.turnId = uuid({ request: record.requestId, round: round.id });
  } else if (c.type === 'END_TURN') {
    if (round.phase !== 'action' || round.activeHeroId !== c.heroId || round.turnId !== c.turnId)
      fail('TURN_CHANGED', 'Questo turno è concluso o è cambiato.');
    runId = runSource(state, record, [
      {
        kind: 'end-turn',
        hero: p.heroes.findIndex((h) => h.heroId === c.heroId),
      },
    ]);
  } else if (c.type === 'BEGIN_SHADOW') {
    if (round.phase !== 'action' || round.activeHeroId || round.heroes.some((h) => !h.turnEnded))
      fail('TURNS_PENDING', 'Tutti gli eroi devono concludere il turno.');
    if (state.scenario!.rounds) {
      const started = beginSourceShadow(state, record.requestId, record.shadowEntropy);
      if (started) {
        if (state.scenario!.pack.manifest.combat?.source.shadow) continueActivations(state, record);
        else runId = openSourceDarkness(state, record);
      }
    } else {
      round.phase = 'shadow';
      round.shadowStep = 'enemies';
    }
    const loss = p.snapshot.lastStand?.lossDue;
    if (loss && !state.scenario!.conclusion)
      cycle.terminal = {
        ...loss,
        kind: 'adventure-loss',
        timing: 'shadow-start',
        consumer: 'original-adventure-loss-unavailable',
      };
  } else if (c.type === 'CONFIRM_SHADOW_STEP') {
    if (round.phase !== 'shadow' || round.shadowStep !== c.step)
      fail('SHADOW_STEP_CHANGED', 'Questo passaggio è cambiato.');
    if (state.scenario!.rounds) {
      if (c.step !== 'threat')
        fail(
          'SHADOW_STEP_CHANGED',
          'L’Ombra fonte non usa conferme manuali per nemici e oscurità.',
        );
      if (applySourceThreat(state, record.requestId))
        runId = runSource(state, record, [{ kind: 'rally-reset', hero: 0 }]);
    } else if (
      c.step === 'darkness' &&
      (darknessHeroes(state).length ||
        persistentEffects(p).some((e) => e.window === 'after-darkness-suffering-batch'))
    )
      fail(
        'PHYSICAL_DARKNESS_CAPABILITY',
        'Le reazioni richiedono la vera fonte di oscurità. Una conferma manuale non la esegue.',
      );
    if (!state.scenario!.rounds) {
      if (c.step === 'enemies') round.shadowStep = 'darkness';
      else if (c.step === 'darkness') round.shadowStep = 'threat';
      else runId = runSource(state, record, [{ kind: 'rally-reset', hero: 0 }]);
    }
  } else if (c.type === 'START_RALLY_SCOUT') {
    if (round.phase !== 'rally' || progress!.rallyDone)
      fail(
        'RALLY_SCOUT_UNAVAILABLE',
        'Questo eroe ha già effettuato Scoperta o la fase è cambiata.',
      );
    const count = rallyScoutCount(state.preparation!.heroes, state.journey, c.heroId);
    invariant(count !== null, 'Posizioni della Scoperta assenti.');
    runId = runSource(state, record, [
      { kind: 'rally-scout', hero: p.heroes.findIndex((h) => h.heroId === c.heroId), count },
    ]);
  } else {
    if (round.phase !== 'rally' || round.heroes.some((h) => !h.rallyDone))
      fail('RALLY_PENDING', 'Ogni eroe deve concludere Scoperta.');
    if (state.scenario!.rounds) finishSourceRally(state);
    state.round = {
      id: uuid({ request: record.requestId, previous: round.id }),
      number: round.number + 1,
      phase: 'action',
      shadowStep: null,
      activeHeroId: null,
      turnId: null,
      heroes: round.heroes.map((h) => ({
        heroId: h.heroId,
        actionsUsed: 0,
        turnEnded: false,
        rallyDone: false,
      })),
    };
  }
  syncPhysicalDefeat(state);
  if (runId) {
    invariant(
      c.type === 'END_TURN' ||
        c.type === 'START_RALLY_SCOUT' ||
        c.type === 'CONFIRM_SHADOW_STEP' ||
        c.type === 'BEGIN_SHADOW',
      'Continuazione senza comando.',
    );
    const task = { runId, type: c.type, heroId: hero?.heroId ?? p.heroes[0]!.heroId };
    if (p.snapshot.active) cycle.pending = task;
    else finish(state, task, record);
  }
  if (c.type === 'START_RALLY_SCOUT')
    return {
      ...base,
      type: c.type,
      heroId: hero!.heroId,
      scoutId: runId,
      preparedCount: state.preparation!.heroes.find((h) => h.heroId === hero!.heroId)!.prepared
        .length,
    };
  return {
    ...base,
    type: c.type,
    roundId: state.round!.id,
    roundNumber: state.round!.number,
    phase: state.round!.phase,
    turnId: state.round!.turnId,
    testId: null,
    heroId: hero?.heroId ?? null,
    sourceTurnId: c.type === 'END_TURN' ? c.turnId : state.round!.turnId,
    continuation: runId,
    completed: !cycle.pending && !state.scenario!.pending,
  };
}
function resumeProvocation(state: State, cycle: CycleState, record: CycleState['records'][number]) {
  const cs = state.combat,
    op = cs?.operation;
  if (!cs || !op || cs.active) return;
  if (nextProvocation(state)) return;
  let resumed:
    | import('zod').infer<typeof import('../shared/combat-controller').ResumedJourneySchema>
    | undefined;
  if (defeatedHeroes(state).includes(op.origin.heroId)) {
    op.status = 'cancelled';
    op.reason = 'L’eroe è sconfitto: il comando sospeso termina.';
    if (op.origin.kind === 'source-sprint' && !state.physical!.snapshot.lastStand?.terminal)
      finishDefeatedSprint(state, op.origin.heroId);
  } else {
    const origin = op.origin;
    const { kind: _, ...fields } = origin;
    const type =
      origin.kind === 'source-sprint'
        ? 'SCENARIO_INPUT'
        : origin.kind === 'movement'
          ? 'MOVE_HERO'
          : origin.kind === 'exploration'
            ? 'EXPLORE_SCENARIO'
            : 'INTERACT_SCENARIO';
    const {
      entropy: __,
      sourceRequest: ___,
      ...intentFields
    } = fields as typeof fields & {
      entropy?: string;
      sourceRequest?: unknown;
    };
    const intent = { ...intentFields, type, expectedRevision: state.revision };
    // A child may have changed legality. A failed return keeps all prior consequences and pays nothing new.
    const work = structuredClone(state);
    work.combat!.operation = null;
    if (origin.kind === 'source-sprint')
      work.scenario!.pending = structuredClone(origin.sourceRequest);
    try {
      const receipt = executeEpisodeIntent(
        work,
        work.physical!.cycle!,
        {
          ...record,
          playerId: op.playerId,
          requestId: op.requestId,
          intent: originalIntents.parse(intent),
          ...(origin.kind === 'exploration' || origin.kind === 'source-sprint'
            ? { explorationEntropy: origin.entropy }
            : {}),
        },
        true,
      );
      if (receipt.type === 'MOVE_HERO' || receipt.type === 'EXPLORE_SCENARIO')
        resumed = {
          mapId: receipt.mapId,
          roundId: receipt.roundId!,
          turnId: receipt.turnId!,
          heroId: receipt.heroId!,
          spaceId: receipt.spaceId!,
          movesRemaining: receipt.movesRemaining,
        };
      Object.assign(state.physical!, work.physical);
      state.physical!.cycle = cycle;
      for (const key of [
        'preparation',
        'round',
        'journey',
        'scenario',
        'skillTest',
        'scout',
        'combat',
      ] as const)
        Object.assign(state, { [key]: work[key] });
      op.status = 'returned';
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      op.status = 'cancelled';
      op.reason =
        'Dopo le conseguenze, il comando sospeso non è più legale. Nessun nuovo costo è stato applicato.';
      if (origin.kind === 'source-sprint' && !state.physical!.snapshot.lastStand?.terminal)
        finishInvalidatedSprint(state, origin.heroId);
    }
  }
  state.combat!.operations.push(structuredClone(op));
  state.combat!.operation = null;
  return resumed;
}
type Replay = { work: State; receipts: Receipt[] };
let lastReplay: { context: string; records: string; result: Replay } | null = null;

function originalStartupPrefix(state: State, scenario: NonNullable<State['scenario']>) {
  if (!scenario.pack.manifest.startupPreparation) return [];
  // The immutable handoff identifies only the startup parents. Later encounter,
  // combat and ordinary parents must be rebuilt from cycle records, never trusted.
  const count = 1 + scenario.completedSetup.length;
  invariant(state.physical!.runs.length >= count, 'Prefisso fisico startup incompleto.');
  return state.physical!.runs.slice(0, count);
}

function replay(state: State, cycle: CycleState): Replay {
  if (cycle.version === 3) return replayEpisode(state, cycle);
  const original = state.physical!;
  const {
    physical: _,
    preparation: __,
    round: ___,
    journey: ____,
    combat: _combat,
    revision: _____,
    updatedAt: ______,
    ...environment
  } = state;
  const { snapshot: _snapshot, cycle: _cycle, ...origin } = original;
  const prefix =
    cycle.version === 2
      ? originalStartupPrefix(state, cycle.seed.scenario!)
      : original.runs.filter((r) => r.source.instanceId !== 'ordinary-cycle');
  const context = digest({
    environment:
      cycle.version === 2
        ? {
            ...environment,
            scenario: cycle.seed.scenario,
            skillTest: cycle.seed.skillTest,
            scout: null,
            combat: cycle.seed.combat,
          }
        : environment,
    origin: { ...origin, runs: prefix },
    seed: cycle.seed,
  });
  // Only a byte-equivalent canonical input prefix can reuse proof. Persisted
  // snapshots/runs/pending are outputs, still compared by the validators. Keep
  // one bounded entry and clone both ways so callers cannot change that proof.
  const previous = lastReplay;
  let result: Replay;
  if (
    previous?.context === context &&
    previous.result.receipts.length <= cycle.records.length &&
    previous.records === digest(cycle.records.slice(0, previous.result.receipts.length))
  )
    result = structuredClone(previous.result);
  else {
    const p = structuredClone(original);
    delete p.cycle;
    p.runs = structuredClone(prefix);
    p.snapshot = replayPhysical(p);
    const preparation = p.snapshot.resolution!.resources?.preparation ?? cycle.seed.preparation;
    invariant(preparation, 'Ledger ordinario senza origine delle risorse.');
    if (cycle.seed.preparation)
      invariant(
        digest(cycle.seed.preparation) === digest(preparation),
        'Risorse del confine ordinario non continue con la fonte precedente.',
      );
    p.cycle = { ...cycle, records: [], pending: null };
    delete p.cycle.terminal;
    result = {
      work: {
        ...state,
        revision: cycle.seed.revision,
        round: structuredClone(cycle.seed.round),
        journey: structuredClone(cycle.seed.journey),
        physical: p,
        preparation: structuredClone(preparation),
        ...(cycle.version === 2
          ? {
              scenario: structuredClone(cycle.seed.scenario!),
              skillTest: structuredClone(cycle.seed.skillTest!),
              scout: null,
              ...(cycle.seed.combat ? { combat: structuredClone(cycle.seed.combat) } : {}),
            }
          : {}),
      },
      receipts: [],
    };
  }
  const { work, receipts } = result,
    p = work.physical!,
    ledger = p.cycle!;
  for (const record of cycle.records.slice(receipts.length)) {
    invariant(
      record.intent.expectedRevision >= work.revision,
      'Ordine del ledger ordinario modificato.',
    );
    work.revision = record.intent.expectedRevision;
    p.cycle = ledger;
    receipts.push(executeEpisodeIntent(work, ledger, record));
    ledger.records.push(record);
    work.revision++;
  }
  p.cycle = ledger;
  lastReplay = { context, records: digest(cycle.records), result: structuredClone(result) };
  return result;
}
export function applyPhysicalCycle(
  state: State,
  playerId: string,
  command: Command,
  lastStand?: LastStandArtifact,
) {
  const p = state.physical!,
    { generation: _, requestId, ...intent } = command;
  const c =
    p.cycle && p.cycle.version >= 2
      ? originalIntents.parse(intent)
      : CycleIntentSchema.parse(intent);
  if (state.revision !== c.expectedRevision)
    fail('TABLE_CHANGED', 'Il tavolo è cambiato. Controlla la richiesta e riprova.');
  if (lastStand) {
    invariant(
      c.type === 'CYCLE_INPUT' && c.input.kind === 'physical-continue-last-stand',
      'Freeze P2 fuori dal pending storico.',
    );
    p.lastStand = structuredClone(lastStand);
    p.lastStandActivation = { kind: 'legacy-continuation', runId: c.runId };
  }
  const cycle: CycleState = p.cycle
    ? structuredClone(p.cycle)
    : {
        version: 1,
        seed: {
          revision: state.revision,
          round: structuredClone(state.round!),
          journey: structuredClone(state.journey!),
          preparation: structuredClone(state.preparation!),
        },
        records: [],
        pending: null,
      };
  cycle.records.push({
    playerId,
    requestId,
    intent: c,
    ...(p.lastStand ? { lastStandRules: p.lastStand.rules } : {}),
    ...(c.type === 'EXPLORE_SCENARIO' ||
    (c.type === 'SCENARIO_INPUT' &&
      c.input.kind === 'source-sprint' &&
      c.input.destinationSpaceId !== null)
      ? { explorationEntropy: randomBytes(32).toString('hex') }
      : {}),
    ...(c.type === 'BEGIN_SHADOW' && state.scenario!.pack.manifest.followup
      ? { shadowEntropy: randomBytes(32).toString('hex') }
      : {}),
  });
  p.version = 3;
  const { work, receipts } = replay(state, cycle);
  if (cycle.version === 3) {
    applyEpisodeDomain(state, work);
    return receipts.at(-1)!;
  }
  for (const key of cycle.version === 2
    ? ([
        'physical',
        'preparation',
        'round',
        'journey',
        'scenario',
        'skillTest',
        'scout',
        'combat',
      ] as const)
    : (['physical', 'preparation', 'round', 'journey'] as const))
    Object.assign(state, { [key]: work[key] });
  return receipts.at(-1)!;
}
export function validatePhysicalCycle(state: State) {
  const p = state.physical;
  if (p?.cycle?.version === 3) {
    validateEpisodeState(state);
    return;
  }
  if (!p?.cycle) {
    invariant(p?.version !== 3, 'Runtime ordinario senza ledger.');
    return;
  }
  invariant(
    p.version === 3 &&
      state.scenario?.phase === 'action' &&
      state.scenario.pack.manifest.scope ===
        (p.cycle.version === 2 ? 'original-encounter-v1' : 'synthetic-physical-p1'),
    'Ledger ordinario fuori dal consumer supportato.',
  );
  if (p.cycle.version >= 2) {
    const seed = originalSeedState(state);
    invariant(!scenarioStateProblem(seed), 'Origine originale non riconciliata con lo startup.');
  } else
    invariant(
      p.cycle.records.length > 0 && !p.cycle.seed.scenario && p.cycle.seed.skillTest === undefined,
      'Ledger storico reinterpretato.',
    );
  const { work } = replay(state, p.cycle);
  for (const key of p.cycle.version === 2
    ? ([
        'physical',
        'preparation',
        'round',
        'journey',
        'scenario',
        'skillTest',
        'scout',
        'combat',
      ] as const)
    : (['physical', 'preparation', 'round', 'journey'] as const))
    invariant(
      digest(work[key] ?? null) === digest(state[key] ?? null),
      `Ledger ordinario non riconciliato: ${key}.`,
    );
}
export function validateCycleReceipts(
  state: State,
  commands: { playerId: string; requestId: string; fingerprint?: string; receipt: Receipt }[],
) {
  const cycle = state.physical?.cycle;
  if (!cycle) return;
  if (cycle.version === 3) {
    validateEpisodeReceipts(state, commands);
    return;
  }
  const { receipts } = replay(state, cycle);
  const relevant = commands.filter(
    (c) =>
      (ordinary.has(c.receipt.type as CycleIntent['type']) ||
        (cycle.version === 2 &&
          ['INTERACT_SCENARIO', 'SCENARIO_INPUT', 'EXPLORE_SCENARIO'].includes(c.receipt.type))) &&
      c.receipt.appliedRevision > cycle.seed.revision,
  );
  if (cycle.version >= 2) {
    const error = scenarioReceiptProblem(
      originalSeedState(state),
      commands.filter((c) => c.receipt.appliedRevision <= cycle.seed.revision),
    );
    invariant(!error, error ?? 'Ricevute startup mancanti.');
  }
  invariant(relevant.length === cycle.records.length, 'Ricevute del ciclo ordinario incomplete.');
  cycle.records.forEach((record, n) => {
    const stored = relevant.find(
      (c) => c.playerId === record.playerId && c.requestId === record.requestId,
    );
    const {
      generation: _,
      requestId: __,
      ...intent
    } = CommandSchema.parse({
      ...record.intent,
      requestId: record.requestId,
      generation: state.generation,
    });
    invariant(
      stored &&
        stored.fingerprint === createHash('sha256').update(JSON.stringify(intent)).digest('hex') &&
        digest(stored.receipt) === digest(receipts[n]),
      'Intento/ricevuta del ciclo ordinario incoerenti.',
    );
  });
}

export function initializeOriginalCycle(state: State) {
  const p = state.physical!,
    sc = state.scenario!;
  invariant(
    sc.pack.manifest.scope === 'original-encounter-v1' &&
      sc.phase === 'action' &&
      !p.cycle &&
      p.runs.length === originalStartupPrefix(state, sc).length,
    'Confine originale duplicato o non iniziale.',
  );
  if (sc.pack.manifest.combat) state.combat = initialCombat(state);
  p.version = 3;
  p.cycle = {
    version: 2,
    ...(p.fronts?.artifact.interactionLook
      ? { interactionLookRules: p.fronts.artifact.interactionLook.version }
      : {}),
    seed: {
      revision: state.revision + 1,
      round: structuredClone(state.round!),
      journey: structuredClone(state.journey!),
      preparation: structuredClone(state.preparation!),
      scenario: structuredClone(sc),
      skillTest: structuredClone(state.skillTest),
      ...(state.combat ? { combat: structuredClone(state.combat) } : {}),
    },
    records: [],
    pending: null,
  };
}
function originalSeedState(state: State): State {
  const p = structuredClone(state.physical!),
    cycle = p.cycle!,
    seed = cycle.seed,
    sc = seed.scenario;
  invariant(
    cycle.interactionLookRules === p.fronts?.artifact.interactionLook?.version,
    'Attivazione interazione diversa dal confine fonte.',
  );
  if (cycle.interactionLookRules)
    requireInteractionCoverage(
      p.fronts!.artifact,
      p.fronts!.catalog,
      p.heroes.map((h) => h.heroId),
    );
  invariant(
    cycle.version === 2 && sc && seed.preparation && seed.skillTest !== undefined,
    'Ledger originale senza confine completo.',
  );
  invariant(
    sc.pack.manifest.combat
      ? digest(seed.combat ?? null) === digest(initialCombat({ ...state, scenario: sc }))
      : seed.combat === undefined && state.combat === undefined,
    'Origine combattimento riscritta o introdotta dopo lo startup.',
  );
  invariant(
    sc.pack.manifest.scope === 'original-encounter-v1' &&
      digest(sc.pack) === digest(state.scenario!.pack) &&
      sc.id === state.scenario!.id &&
      sc.play &&
      sc.play.active === null &&
      !sc.play.attempts.length &&
      !sc.play.tests.length &&
      sc.play.lore === 0 &&
      (!sc.pack.manifest.exploration
        ? !sc.explorations
        : sc.explorations?.active === null && sc.explorations.attempts.length === 0) &&
      (!sc.pack.manifest.rounds
        ? !sc.rounds
        : sc.rounds?.active === null && sc.rounds.frames.length === 0) &&
      (!sc.pack.manifest.followup
        ? !sc.enemies
        : sc.enemies?.entropy === null &&
          sc.enemies.cursor === 0 &&
          sc.enemies.groups.length === 0 &&
          sc.enemies.attempts.length === 0) &&
      !sc.pending &&
      !sc.tasks.length,
    'Seed originale riscritto dopo lo startup.',
  );
  invariant(
    seed.round.number === 1 &&
      seed.round.phase === 'action' &&
      !seed.round.activeHeroId &&
      !seed.round.turnId &&
      seed.round.heroes.every((h) => !h.actionsUsed && !h.turnEnded && !h.rallyDone) &&
      !seed.journey.travel &&
      seed.journey.heroes.every(
        (h) => h.spaceId === seed.journey.definition.startSpaceId && !h.removed,
      ),
    'Il seed originale deve essere il primo confine round1/Azione.',
  );
  invariant(
    seed.revision === sc.commands.at(-1)?.revision && sc.commands.at(-1)?.kind === 'ack',
    'Confine originale senza handoff fonte.',
  );
  delete p.cycle;
  p.version = 2;
  p.runs = structuredClone(originalStartupPrefix(state, sc));
  p.snapshot = replayPhysical(p);
  return {
    ...state,
    revision: seed.revision,
    physical: p,
    scenario: structuredClone(sc),
    preparation: structuredClone(seed.preparation),
    round: structuredClone(seed.round),
    journey: structuredClone(seed.journey),
    skillTest: structuredClone(seed.skillTest),
    scout: null,
    ...(seed.combat ? { combat: structuredClone(seed.combat) } : {}),
  };
}
