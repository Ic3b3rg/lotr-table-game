import type { State } from '../server/state';
import { ApiError } from '../server/errors';
import { invariant } from '../map-freeze/validate';
import { cycleUUID } from '../physical-resolution/cycle-request';
import { processRoundEvent, startPhaseEvent, pumpPhaseEvent, resumeScenario } from './runtime';
import { defeatedHeroes } from '../server/physical-defeat';
import { groupTrialProgram } from './encounter-physical';
import { validatePhysicalProgram } from '../physical-resolution/program';
import { validatePhysical } from '../physical-resolution/runtime';
import { livingEnemyGroups } from './deployment';
import { combatArtifact, startSourceActivation, advanceCombat } from '../combat/controller';
import { preflightCombatOperation } from '../combat/preflight';
import { activeCompany, activationTargets } from '../combat/movement';
import { effectiveGroup } from '../combat/group';

function fail(message: string): never {
  throw new ApiError(409, 'ROUND_SOURCE_CAPABILITY', message);
}
function source(state: State) {
  const sc = state.scenario!;
  if (!sc.pack.manifest.rounds || !sc.rounds)
    fail(
      'La fonte completa di Ombra e Riorganizzazione non è inclusa in questo avvio. I progressi sono salvati.',
    );
  return sc.pack.manifest.rounds;
}
function integer(state: State, name: string) {
  const value = state.scenario!.globals[name];
  invariant(
    typeof value === 'number' && Number.isInteger(value),
    'Binding intero della fase non valido.',
  );
  return value;
}
export { sourceDarknessHeroes } from './darkness';
import { sourceDarknessHeroes } from './darkness';

function threat(state: State) {
  const data = source(state),
    sc = state.scenario!,
    heroes = state.preparation!.heroes.length;
  const tokens = sc.instances
    .filter(
      (i) =>
        i.visible &&
        sc.pack.manifest.prefabs.some((p) => p.source === i.prefab && p.sourceNodeType === 2),
    )
    .map((i) => i.id);
  const tiles = sc.tiles.filter((t) => t.visible && !t.explored).map((t) => t.source);
  const before = Math.max(0, integer(state, data.bindings.threat));
  const delta =
    heroes * data.threat.perHero +
    tokens.length * data.threat.perToken +
    tiles.length * data.threat.perUnexploredTile;
  return { before, heroes, tokens, tiles, delta, after: before + delta };
}
function threatBoundary(state: State, after: number) {
  const data = source(state),
    sc = state.scenario!;
  if (after >= data.threat.limit)
    fail(
      'La minaccia raggiungerebbe la perdita dell’avventura, il cui seguito non è ancora disponibile. Nessun tick o aumento è stato applicato.',
    );
  const reached = sc.threats
    .filter((t) => t.threshold <= after)
    .sort((a, b) => a.threshold - b.threshold);
  if (reached.length && !sc.pack.manifest.followup)
    fail(
      `La minaccia raggiungerebbe la soglia ${reached[0]!.threshold}, che richiede effetti fonte ulteriori. Nessun tick o aumento è stato applicato.`,
    );
}

/** Inspect the entire deterministic continuation on a disposable state, before any game effect. */
export function preflightSourceShadow(state: State, entropy?: string) {
  const data = source(state);
  if (defeatedHeroes(state).length || state.physical!.snapshot.lastStand?.lossDue)
    fail(
      'Un eroe è sconfitto: l’inizio dell’Ombra richiede il seguito della perdita dell’avventura. Nessun avanzamento è stato applicato.',
    );
  invariant(!data.configuration.initialEnemyGroups.length, 'Attivazioni nemiche non disponibili.');
  const shadow = state.scenario!.pack.manifest.combat?.source.shadow;
  if (livingEnemyGroups(state).length && !shadow)
    fail(
      'I gruppi nemici in gioco richiedono le loro attivazioni, non ancora disponibili. Nessun tick, pesca o costo è stato applicato.',
    );
  if (shadow) preflightActivations(state);
  sourceDarknessHeroes(state);
  if (integer(state, data.bindings.threat) >= data.threat.limit)
    threatBoundary(state, integer(state, data.bindings.threat));
  const work = structuredClone(state);
  // Trials return to the same action for either outcome. Prove their consumer
  // structurally, then traverse the nonphysical continuation on the disposable
  // copy. This does not reveal cards, invent a test outcome or acknowledge play.
  for (const d of work.scenario!.pack.definitions)
    for (const s of d.states)
      for (const a of s.actions)
        if (a.op === 'spawnRandom' && a.trial) {
          const p = state.physical!;
          if (!(p.version === 3 && p.fronts && p.lastStand))
            fail(
              'La prova della soglia richiede le capacità fisiche complete. Nessun effetto è stato applicato.',
            );
          validatePhysical(p);
          validatePhysicalProgram(groupTrialProgram(state, a), p.heroes.length);
          delete a.trial;
        }
  // This closure's spawn has no result-dependent branches: all new groups wait
  // until the next Shadow. Inspect the certified pool structurally, not a draw.
  if (shadow)
    for (const d of work.scenario!.pack.definitions)
      for (const s of d.states)
        s.actions = s.actions.map((a) =>
          a.op === 'spawnRandom'
            ? { index: a.index, op: 'set' as const, target: a.points, value: 0, origin: a.origin }
            : a,
        );
  try {
    if (work.scenario!.pack.manifest.followup) {
      initializeShadow(work, 'preflight');
      activeFrame(work).stage = 'darkness';
      work.scenario!.enemies!.entropy ??= entropy ?? '0'.repeat(64);
      finishSourceDarkness(work);
      for (let n = 0; n < 2000; n++) {
        const sc = work.scenario!,
          frame = activeFrame(work);
        if (sc.pending) {
          const q = sc.pending;
          if (
            ![
              'message',
              'objective',
              'placement',
              'deployment-intro',
              'deployment',
              'exploration-markers',
            ].includes(q.kind)
          )
            fail(
              'Il seguito richiede una conseguenza ulteriore. Nessun effetto è stato applicato.',
            );
          resumeScenario(work, work.players[0]!.id, {
            type: 'SCENARIO_INPUT',
            requestId: 'preflight-source-closure-only',
            generation: work.generation,
            expectedRevision: work.revision,
            scenarioId: sc.id,
            packFingerprint: sc.packFingerprint,
            projectionFingerprint: sc.projectionFingerprint,
            pendingId: q.id,
            sourceFingerprint: q.fingerprint,
            heroId: q.heroId,
            input: { kind: 'ack' },
          });
        }
        if (advanceSourceShadow(work)) break;
        if (frame.stage === 'threat') {
          applySourceThreat(work);
          if (activeFrame(work).stage === 'reset') break;
        }
        invariant(n < 1999, 'Preflight seguito ciclico.');
      }
      invariant(
        activeFrame(work).stage === 'reset',
        'Seguito senza ritorno alla Riorganizzazione.',
      );
      work.scenario!.globals[data.bindings.round] = integer(work, data.bindings.round) + 1;
      processRoundEvent(work, data.events.start, false);
      return;
    }
    processRoundEvent(work, data.events.end, true);
    const nextThreat = threat(work).after;
    threatBoundary(work, nextThreat);
    work.scenario!.globals[data.bindings.threat] = nextThreat;
    work.scenario!.globals[data.bindings.round] = integer(work, data.bindings.round) + 1;
    processRoundEvent(work, data.events.start, false);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    fail(
      'Il seguito degli eventi della fase non è interamente eseguibile. Nessun tick, pesca o aumento è stato applicato.',
    );
  }
}
function initializeShadow(state: State, requestId: string) {
  const sc = state.scenario!,
    round = state.round!,
    rounds = sc.rounds!;
  invariant(rounds.active === null, 'Ombra già in corso.');
  const id = cycleUUID({ scenario: sc.id, round: round.id, requestId, kind: 'source-round' });
  const activations = !!sc.pack.manifest.combat?.source.shadow;
  rounds.frames.push({
    id,
    roundId: round.id,
    number: round.number,
    stage: activations ? 'enemies' : 'darkness',
    ...(activations ? { activated: [], refreshed: [] } : {}),
    darknessHeroes: sourceDarknessHeroes(state).map((n) => state.preparation!.heroes[n]!.heroId),
    threat: null,
  });
  rounds.active = id;
  round.phase = 'shadow';
  round.shadowStep = activations ? 'enemies' : 'darkness';
}
function preflightActivations(state: State) {
  const a = combatArtifact(state),
    cap = a.source.shadow!,
    sc = state.scenario!;
  if (
    sc.tiles.some((t) => t.visible && !cap.terrain.tiles.some((p) => p.source === t.source)) ||
    sc.instances.some(
      (i) => i.visible && i.prefab && cap.terrain.forbiddenPrefabs.includes(i.prefab),
    )
  )
    fail(
      'Questo terreno richiede effetti di attivazione ulteriori. Nessun effetto dell’Ombra è stato applicato.',
    );
  const work = structuredClone(state);
  for (const g of livingEnemyGroups(work)) {
    if (g.logic)
      fail(
        'Il seguito e il refresh di questo gruppo non sono ancora disponibili. Nessun effetto dell’Ombra è stato applicato.',
      );
    if (!g.placed || g.exhausted) continue;
    const effective = effectiveGroup(a, g);
    const size = g.figures.filter((f) => f.health > 0).length;
    const canAttack = effective.model.instructions
      .filter((i) => i.minimum <= size && i.maximum >= 1)
      .some((i) =>
        activationTargets(work, g.spaceId, i.activation!, null, effective.ranged ? 1 : 0).some(
          (p) => p.branch === 'primary',
        ),
      );
    if (!canAttack) {
      g.exhausted = true;
      continue;
    }
    for (const h of activeCompany(work)) {
      const missing = preflightCombatOperation(work, a, g, h.heroId, 'activation');
      if (missing.length)
        fail(
          missing.includes('boon-quantities-57')
            ? 'Una possibile attivazione richiede l’acquisizione di benefici la cui riserva non è verificata. Nessun movimento, carta, tick o minaccia è stato applicato.'
            : 'Una possibile conseguenza dell’attivazione non è ancora disponibile. Nessun effetto dell’Ombra è stato applicato.',
        );
    }
    g.exhausted = true;
  }
}
/** Rescan after the complete physical frontier, never after a mere acknowledgement. */
export function advanceSourceActivations(state: State) {
  if (!state.scenario?.rounds?.active || !state.scenario.pack.manifest.combat?.source.shadow)
    return false;
  const frame = activeFrame(state);
  if (
    frame.stage !== 'enemies' ||
    state.combat!.active ||
    state.scenario.pending ||
    state.physical!.snapshot.active
  )
    return false;
  while (startSourceActivation(state, frame.id)) {
    advanceCombat(state);
    if (state.combat!.active || state.scenario.pending || state.physical!.snapshot.active)
      return false;
  }
  frame.stage = 'darkness';
  frame.darknessHeroes = sourceDarknessHeroes(state).map(
    (n) => state.preparation!.heroes[n]!.heroId,
  );
  state.round!.shadowStep = 'darkness';
  return true;
}
function refreshSourceGroups(state: State) {
  const cap = state.scenario!.pack.manifest.combat?.source.shadow;
  if (!cap) return;
  const frame = activeFrame(state);
  for (const g of livingEnemyGroups(state)) {
    invariant(!g.logic, 'BEFORE_UNEXHAUST richiede il consumer della logica nemica.');
    // Source groups with no logic have no receiver for BEFORE_UNEXHAUST.
    // Record that event boundary before changing either property.
    invariant(!frame.refreshed!.includes(g.id), 'Refresh duplicato.');
    frame.refreshed!.push(g.id);
    g.exhausted = false;
    g.attackReduction = 0;
  }
}
export function beginSourceShadow(state: State, requestId: string, entropy?: string) {
  preflightSourceShadow(state, entropy);
  initializeShadow(state, requestId);
  if (state.scenario!.pack.manifest.followup) {
    invariant(entropy, 'Entropia della fase assente.');
    state.scenario!.enemies!.entropy ??= entropy;
  }
}
function activeFrame(state: State) {
  const sc = state.scenario!;
  const frame = sc.rounds!.frames.find((f) => f.id === sc.rounds!.active);
  invariant(frame, 'Seguito senza frame corrente.');
  return frame;
}
function continueDispatch(state: State) {
  const sc = state.scenario!,
    frame = activeFrame(state),
    dispatch = frame.dispatch!;
  if (sc.pending) return false;
  if (dispatch.waiting) {
    pumpPhaseEvent(state);
    if (sc.pending) return false;
    const i = sc.instances.find((i) => i.id === dispatch.waiting)!;
    invariant(
      i.processing === 0 && sc.instances.every((i) => i.stopped || i.settled) && !sc.tasks.length,
      'Evento senza ritorno fonte.',
    );
    dispatch.waiting = null;
  }
  while (dispatch.index < dispatch.targets.length) {
    const id = dispatch.targets[dispatch.index++]!;
    if (!startPhaseEvent(state, id, dispatch.event, true)) continue;
    dispatch.waiting = id;
    return continueDispatch(state);
  }
  frame.dispatch = null;
  return true;
}
/** Returns true only when all source events and reached thresholds have returned to reset. */
export function advanceSourceShadow(state: State): boolean {
  const sc = state.scenario!,
    cap = sc.pack.manifest.followup;
  if (!cap || !sc.rounds?.active) return false;
  const frame = activeFrame(state);
  if (sc.pending) return false;
  if (frame.stage === 'events') {
    if (!continueDispatch(state)) return false;
    frame.threat = threat(state);
    threatBoundary(state, frame.threat.after);
    frame.stage = 'threat';
    state.round!.shadowStep = 'threat';
    return false;
  }
  if (frame.stage !== 'thresholds') return false;
  for (let n = 0; n < 100; n++) {
    if (frame.threshold) {
      pumpPhaseEvent(state);
      if (sc.pending) return false;
      const binding = cap.thresholds.find((t) => t.source === frame.threshold)!;
      const receiver = sc.instances.find((i) => i.definition === binding.definition)!;
      invariant(receiver.stopped && !sc.tasks.length, 'Soglia senza completamento fonte.');
      sc.threats = sc.threats.filter((t) => t.source !== frame.threshold);
      (frame.handled ??= []).push(frame.threshold);
      frame.threshold = null;
    }
    const next = sc.threats
      .filter((t) => t.threshold <= frame.threat!.after)
      .sort((a, b) => a.threshold - b.threshold)[0];
    if (!next) {
      refreshSourceGroups(state);
      frame.stage = 'reset';
      return true;
    }
    const binding = cap.thresholds.find((t) => t.source === next.source);
    if (!binding?.definition)
      fail(
        `La soglia ${next.threshold} richiede un seguito non ancora disponibile. Nessun tick o aumento è stato applicato.`,
      );
    const receiver = sc.instances.find((i) => i.definition === binding.definition);
    invariant(receiver && !receiver.stopped, 'Receiver della soglia mancante o concluso.');
    frame.threshold = next.source;
    invariant(
      startPhaseEvent(state, receiver.id, cap.thresholdEvent, false),
      'Soglia senza handler.',
    );
    if (sc.pending) return false;
  }
  fail(
    'Il seguito delle soglie supera il limite verificato. Nessun avanzamento è stato applicato.',
  );
}
export function finishSourceDarkness(state: State) {
  const sc = state.scenario!,
    data = source(state),
    frame = sc.rounds!.frames.find((f) => f.id === sc.rounds!.active)!;
  invariant(frame.stage === 'darkness', 'Oscurità senza frame corrente.');
  if (sc.pack.manifest.followup) {
    frame.stage = 'events';
    frame.dispatch = {
      targets: [
        ...sc.instances.filter((i) => i.kind === 'timer'),
        ...sc.instances.filter((i) => i.kind === 'principal'),
      ].map((i) => i.id),
      event: data.events.end,
      index: 0,
      waiting: null,
    };
    advanceSourceShadow(state);
    return;
  }
  processRoundEvent(state, data.events.end, true);
  frame.threat = threat(state);
  threatBoundary(state, frame.threat.after);
  sc.globals[data.bindings.threat] = frame.threat.before;
  frame.stage = 'threat';
  state.round!.shadowStep = 'threat';
}
export function applySourceThreat(state: State) {
  const sc = state.scenario!,
    data = source(state),
    frame = sc.rounds!.frames.find((f) => f.id === sc.rounds!.active)!;
  invariant(frame?.stage === 'threat' && frame.threat, 'Minaccia senza richiesta corrente.');
  threatBoundary(state, frame.threat.after);
  sc.globals[data.bindings.threat] = frame.threat.after;
  if (sc.pack.manifest.followup) {
    frame.stage = 'thresholds';
    return advanceSourceShadow(state);
  }
  return true;
}
export function finishSourceReset(state: State) {
  const sc = state.scenario!,
    frame = sc.rounds!.frames.find((f) => f.id === sc.rounds!.active)!;
  invariant(
    frame.stage === 'threat' || frame.stage === 'reset',
    'Ricomposizione senza minaccia fonte.',
  );
  frame.stage = 'rally';
  state.round!.phase = 'rally';
  state.round!.shadowStep = null;
}
export function finishSourceRally(state: State) {
  const sc = state.scenario!,
    data = source(state),
    frame = sc.rounds!.frames.find((f) => f.id === sc.rounds!.active)!;
  invariant(
    frame?.stage === 'rally' && integer(state, data.bindings.round) === state.round!.number,
    'Round fonte discontinuo.',
  );
  sc.globals[data.bindings.round] = state.round!.number + 1;
  processRoundEvent(state, data.events.start, false);
  frame.stage = 'complete';
  sc.rounds!.active = null;
}
