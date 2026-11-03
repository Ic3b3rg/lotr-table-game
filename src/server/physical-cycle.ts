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
  if (hero.playerId !== playerId)
    throw new ApiError(403, 'HERO_NOT_YOURS', 'Puoi gestire soltanto i tuoi eroi.');
  return hero;
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
    darknessHeroes: [],
    children,
  };
  const id = uuid({
    scenario: state.scenario!.id,
    player: record.playerId,
    request: record.requestId,
  });
  openPhysical(
    p,
    {
      effectId: `ordinary:${record.requestId}`,
      instanceId: 'ordinary-cycle',
      state: round.number,
      entry: state.physical!.cycle?.records.length ?? 0,
      action: 0,
      parameterHash: digest({ intent, round, spatial }),
    },
    program,
    context,
    spatial,
    id,
  );
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
    if (active!.kind === 'gate')
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
  } else if (c.type === 'CONFIRM_SHADOW_STEP') {
    if (round.phase !== 'shadow' || round.shadowStep !== c.step)
      fail('SHADOW_STEP_CHANGED', 'Questo passaggio è cambiato.');
    if (
      c.step === 'darkness' &&
      persistentEffects(p).some((e) => e.window === 'after-darkness-suffering-batch')
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
function replay(state: State, cycle: CycleState) {
  const original = state.physical!;
  const p = structuredClone(original);
  delete p.cycle;
  p.runs = p.runs.filter((r) => r.source.instanceId !== 'ordinary-cycle');
  p.snapshot = replayPhysical(p);
  const work = {
    ...state,
    revision: cycle.seed.revision,
    round: structuredClone(cycle.seed.round),
    journey: structuredClone(cycle.seed.journey),
    physical: p,
    preparation: structuredClone(
      p.snapshot.resolution!.resources?.preparation ?? state.preparation,
    ),
  };
  const ledger: CycleState = { ...cycle, records: [], pending: null };
  const receipts: Receipt[] = [];
  for (const record of cycle.records) {
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
  return { work, receipts };
}
export function applyPhysicalCycle(state: State, playerId: string, command: Command) {
  const p = state.physical!,
    { generation: _, requestId, ...intent } = command;
  const c = CycleIntentSchema.parse(intent);
  if (state.revision !== c.expectedRevision)
    fail('TABLE_CHANGED', 'Il tavolo è cambiato. Controlla la richiesta e riprova.');
  const cycle: CycleState = p.cycle
    ? structuredClone(p.cycle)
    : {
        version: 1,
        seed: {
          revision: state.revision,
          round: structuredClone(state.round!),
          journey: structuredClone(state.journey!),
        },
        records: [],
        pending: null,
      };
  cycle.records.push({ playerId, requestId, intent: c });
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
