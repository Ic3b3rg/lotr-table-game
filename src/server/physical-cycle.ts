import { createHash } from 'node:crypto';
import { CycleIntentSchema, type CycleIntent, type CycleState } from '../shared/physical-cycle';
import type { Command, Receipt } from '../shared/protocol';
import { CommandSchema } from '../shared/protocol';
import type { State } from './state';
import type { PhysicalState } from '../physical-resolution/model';
import type { PhysicalProgram } from '../shared/physical';
import { answerPhysical, openPhysical, replayPhysical } from '../physical-resolution/runtime';
import { persistentEffects, travelMoves } from '../physical-resolution/effects';
import { applyJourneyCommand } from './journey-map';
import { rallyScoutCount } from '../shared/rally-scout';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';
import { ApiError } from './errors';
import type { LastStandArtifact } from '../physical-resolution/last-stand-program';
import { syncPhysicalDefeat, defeatedHeroes } from './physical-defeat';

const ordinary = new Set(CycleIntentSchema.options.map((o) => o.shape.type.value));
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
function finish(state: State, task: NonNullable<CycleState['pending']>) {
  const round = state.round!,
    progress = round.heroes.find((h) => h.heroId === task.heroId)!;
  if (task.type === 'END_TURN') {
    progress.turnEnded = true;
    round.activeHeroId = null;
    round.turnId = null;
    state.journey!.travel = null;
  } else if (task.type === 'START_RALLY_SCOUT') progress.rallyDone = true;
  else {
    round.phase = 'rally';
    round.shadowStep = null;
  }
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
    heroes: state.preparation!.heroes.map((h) => ({
      heroId: h.heroId,
      playerId: h.playerId,
      spaceId: j.heroes.find((x) => x.heroId === h.heroId)!.spaceId,
    })),
    connections: structuredClone(j.definition.connections),
  };
  const program: PhysicalProgram = {
    profile: 'source-fronts-v1',
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
function execute(state: State, cycle: CycleState, record: CycleState['records'][number]): Receipt {
  const c = record.intent,
    round = state.round!,
    p = state.physical!;
  const base = {
    requestId: record.requestId,
    type: c.type,
    appliedRevision: c.expectedRevision + 1,
  };
  if (cycle.terminal || p.snapshot.lastStand?.terminal)
    fail(
      'ADVENTURE_LOSS_PENDING',
      'La perdita dell’avventura è salvata. Il seguito originale non è ancora disponibile.',
    );
  if (c.expectedRevision !== state.revision)
    fail('TABLE_CHANGED', 'Il tavolo è cambiato. Controlla la richiesta e riprova.');
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
    state.preparation = structuredClone(p.snapshot.resolution!.resources!.preparation);
    syncPhysicalDefeat(state);
    const completed = !p.snapshot.active;
    if (completed) {
      finish(state, cycle.pending!);
      cycle.pending = null;
    }
    return { ...base, type: 'CYCLE_INPUT', runId: c.runId, source: c.sourceFingerprint, completed };
  }
  if (cycle.pending || p.snapshot.active)
    fail('PHYSICAL_PENDING', 'Concludi la conseguenza corrente prima di proseguire nel round.');
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
      invariant(state.mapGeneration?.status === 'frozen', 'Movimento senza realizzazione.');
      const space = state.mapGeneration.projection.spaces.find((s) => s.id === source);
      if (!space || !sc.tiles.some((t) => t.source === space.tileSource && t.visible && t.explored))
        fail(
          'EXPLORATION_CAPABILITY',
          'La casella richiede esplorazione fonte ancora non disponibile.',
        );
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
    round.phase = 'shadow';
    round.shadowStep = 'enemies';
    const loss = p.snapshot.lastStand?.lossDue;
    if (loss)
      cycle.terminal = {
        ...loss,
        kind: 'adventure-loss',
        timing: 'shadow-start',
        consumer: 'original-adventure-loss-unavailable',
      };
  } else if (c.type === 'CONFIRM_SHADOW_STEP') {
    if (round.phase !== 'shadow' || round.shadowStep !== c.step)
      fail('SHADOW_STEP_CHANGED', 'Questo passaggio è cambiato.');
    if (
      c.step === 'darkness' &&
      (darknessHeroes(state).length ||
        persistentEffects(p).some((e) => e.window === 'after-darkness-suffering-batch'))
    )
      fail(
        'PHYSICAL_DARKNESS_CAPABILITY',
        'Le reazioni richiedono la vera fonte di oscurità. Una conferma manuale non la esegue.',
      );
    if (c.step === 'enemies') round.shadowStep = 'darkness';
    else if (c.step === 'darkness') round.shadowStep = 'threat';
    else runId = runSource(state, record, [{ kind: 'rally-reset', hero: 0 }]);
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
      c.type === 'END_TURN' || c.type === 'START_RALLY_SCOUT' || c.type === 'CONFIRM_SHADOW_STEP',
      'Continuazione senza comando.',
    );
    const task = { runId, type: c.type, heroId: hero?.heroId ?? p.heroes[0]!.heroId };
    if (p.snapshot.active) cycle.pending = task;
    else finish(state, task);
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
    completed: !cycle.pending,
  };
}
type Replay = { work: State; receipts: Receipt[] };
let lastReplay: { context: string; records: string; result: Replay } | null = null;

function replay(state: State, cycle: CycleState): Replay {
  const original = state.physical!;
  const {
    physical: _,
    preparation: __,
    round: ___,
    journey: ____,
    revision: _____,
    updatedAt: ______,
    ...environment
  } = state;
  const { snapshot: _snapshot, cycle: _cycle, ...origin } = original;
  const prefix = original.runs.filter((r) => r.source.instanceId !== 'ordinary-cycle');
  const context = digest({ environment, origin: { ...origin, runs: prefix }, seed: cycle.seed });
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
    receipts.push(execute(work, ledger, record));
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
  const c = CycleIntentSchema.parse(intent);
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
  });
  p.version = 3;
  const { work, receipts } = replay(state, cycle);
  for (const key of ['physical', 'preparation', 'round', 'journey'] as const)
    Object.assign(state, { [key]: work[key] });
  return receipts.at(-1)!;
}
export function validatePhysicalCycle(state: State) {
  const p = state.physical;
  if (!p?.cycle) {
    invariant(p?.version !== 3, 'Runtime ordinario senza ledger.');
    return;
  }
  invariant(
    p.version === 3 &&
      state.scenario?.phase === 'action' &&
      state.scenario.pack.manifest.scope === 'synthetic-physical-p1',
    'Ledger ordinario fuori dal consumer supportato.',
  );
  const { work } = replay(state, p.cycle);
  for (const key of ['physical', 'preparation', 'round', 'journey'] as const)
    invariant(
      digest(work[key]) === digest(state[key]),
      `Ledger ordinario non riconciliato: ${key}.`,
    );
}
export function validateCycleReceipts(
  state: State,
  commands: { playerId: string; requestId: string; fingerprint?: string; receipt: Receipt }[],
) {
  const cycle = state.physical?.cycle;
  if (!cycle) return;
  const { receipts } = replay(state, cycle);
  const relevant = commands.filter(
    (c) =>
      ordinary.has(c.receipt.type as CycleIntent['type']) &&
      c.receipt.appliedRevision > cycle.seed.revision,
  );
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
