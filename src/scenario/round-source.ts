import type { State } from '../server/state';
import { ApiError } from '../server/errors';
import { invariant } from '../map-freeze/validate';
import { cycleUUID } from '../physical-resolution/cycle-request';
import { processRoundEvent } from './runtime';
import { defeatedHeroes } from '../server/physical-defeat';

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
export function sourceDarknessHeroes(state: State): number[] {
  const data = source(state),
    sc = state.scenario!;
  if (data.configuration.disableDarkness) return [];
  if (sc.globals[data.bindings.darknessOverride] !== '')
    fail(
      'L’istruzione di oscurità di questa fonte richiede un consumer ulteriore. Nessuna pesca è stata applicata.',
    );
  return state.preparation!.heroes.flatMap((hero, index) => {
    if (defeatedHeroes(state).includes(hero.heroId)) return [];
    const position = state.journey!.heroes.find((p) => p.heroId === hero.heroId)!;
    const binding = sc.spaceBindings.find((b) => b.id === position.spaceId);
    const space = data.darkness.spaces.find((s) => s.id === binding?.sourceId);
    invariant(space, 'Posizione senza proprietà fonte di oscurità.');
    const token = sc.instances.some(
      (i) =>
        i.visible &&
        i.spaceId === binding!.sourceId &&
        i.prefab &&
        data.darkness.tokenPrefabs.includes(i.prefab),
    );
    return sc.globals[data.bindings.darkness] === true || space.hasDarkness || token ? [index] : [];
  });
}
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
  if (reached.length)
    fail(
      `La minaccia raggiungerebbe la soglia ${reached[0]!.threshold}, che richiede effetti fonte ulteriori. Nessun tick o aumento è stato applicato.`,
    );
}

/** Inspect the entire deterministic continuation on a disposable state, before any game effect. */
export function preflightSourceShadow(state: State) {
  const data = source(state);
  if (defeatedHeroes(state).length || state.physical!.snapshot.lastStand?.lossDue)
    fail(
      'Un eroe è sconfitto: l’inizio dell’Ombra richiede il seguito della perdita dell’avventura. Nessun avanzamento è stato applicato.',
    );
  invariant(!data.configuration.initialEnemyGroups.length, 'Attivazioni nemiche non disponibili.');
  sourceDarknessHeroes(state);
  if (integer(state, data.bindings.threat) >= data.threat.limit)
    threatBoundary(state, integer(state, data.bindings.threat));
  const work = structuredClone(state);
  try {
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
export function beginSourceShadow(state: State, requestId: string) {
  preflightSourceShadow(state);
  const sc = state.scenario!,
    round = state.round!,
    rounds = sc.rounds!;
  invariant(rounds.active === null, 'Ombra già in corso.');
  const id = cycleUUID({ scenario: sc.id, round: round.id, requestId, kind: 'source-round' });
  rounds.frames.push({
    id,
    roundId: round.id,
    number: round.number,
    stage: 'darkness',
    darknessHeroes: sourceDarknessHeroes(state).map((n) => state.preparation!.heroes[n]!.heroId),
    threat: null,
  });
  rounds.active = id;
  round.phase = 'shadow';
  round.shadowStep = 'darkness';
}
export function finishSourceDarkness(state: State) {
  const sc = state.scenario!,
    data = source(state),
    frame = sc.rounds!.frames.find((f) => f.id === sc.rounds!.active)!;
  invariant(frame.stage === 'darkness', 'Oscurità senza frame corrente.');
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
}
export function finishSourceReset(state: State) {
  const sc = state.scenario!,
    frame = sc.rounds!.frames.find((f) => f.id === sc.rounds!.active)!;
  invariant(frame.stage === 'threat', 'Ricomposizione senza minaccia fonte.');
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
