import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { adjacent, JourneyDefinitionSchema, type JourneyPlan } from '../shared/journey-map';
import type { JourneyCommand, Receipt } from '../shared/protocol';
import type { State } from './state';
import { ApiError } from './errors';

export function journeyBudgetProblem(state: State, receipts: Receipt[]): string | null {
  const journey = state.journey;
  const travel = journey?.travel;
  if (!journey || !travel) return null;
  let granted = 0;
  let moved = 0;
  for (const receipt of receipts) {
    if (
      (receipt.type === 'START_TRAVEL' ||
        receipt.type === 'MOVE_HERO' ||
        receipt.type === 'EXPLORE_SCENARIO') &&
      receipt.mapId === journey.id &&
      receipt.roundId === travel.roundId &&
      receipt.turnId === travel.turnId &&
      receipt.heroId === travel.heroId
    ) {
      if (receipt.type === 'START_TRAVEL') {
        granted += receipt.movesGranted ?? 2;
      } else moved++;
    }
  }
  return travel.remaining === granted - moved
    ? null
    : 'Movimenti residui non coerenti con le ricevute del viaggio.';
}

export function loadJourneyPlan(path: string): JourneyPlan {
  try {
    if (statSync(path).size > 1_000_000) throw new Error('Mappa troppo grande.');
    const definition = JourneyDefinitionSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
    return {
      definition,
      hash: createHash('sha256').update(JSON.stringify(definition)).digest('hex'),
    };
  } catch (cause) {
    throw new Error('Mappa locale non valida: controlla il pacchetto prima di avviare il tavolo.', {
      cause,
    });
  }
}

export function applyJourneyCommand(
  state: State,
  playerId: string,
  command: JourneyCommand,
  plan: JourneyPlan | null,
  grantedMoves = 2,
) {
  if (state.revision !== command.expectedRevision)
    throw new ApiError(409, 'TABLE_CHANGED', 'Il tavolo è cambiato. Controlla la mappa e riprova.');
  if (state.preparation?.status !== 'prepared')
    throw new ApiError(409, 'COMPANY_NOT_READY', 'Prepara la compagnia prima di aprire la mappa.');
  if (state.scout || state.skillTest?.status === 'converting')
    throw new ApiError(
      409,
      'REVEAL_PENDING',
      'Concludi le carte rivelate prima di continuare sulla mappa.',
    );
  if (command.type === 'OPEN_JOURNEY_MAP') {
    if (state.journey)
      throw new ApiError(409, 'MAP_OPEN', 'La mappa della compagnia è già aperta.');
    if (!plan || plan.definition.id !== command.planId || plan.hash !== command.planHash)
      throw new ApiError(
        409,
        'MAP_PLAN_CHANGED',
        'La mappa disponibile è cambiata. Ricarica prima di confermare.',
      );
    if (
      state.round &&
      (state.round.phase !== 'action' ||
        state.round.activeHeroId ||
        state.round.heroes.some((hero) => hero.turnEnded || hero.actionsUsed))
    )
      throw new ApiError(
        409,
        'ROUND_STARTED',
        'Apri la mappa prima di iniziare i turni del round.',
      );
    state.journey = {
      id: randomUUID(),
      definition: structuredClone(plan.definition),
      travel: null,
      heroes: state.preparation.heroes.map((hero) => ({
        heroId: hero.heroId,
        spaceId: plan.definition.startSpaceId,
      })),
    };
    return {
      mapId: state.journey.id,
      heroId: null,
      spaceId: null,
      movesRemaining: 0,
      roundId: null,
      turnId: null,
    };
  }
  const journey = state.journey;
  const round = state.round;
  if (!journey || journey.id !== command.mapId)
    throw new ApiError(409, 'MAP_CHANGED', 'Questa mappa è assente o è cambiata.');
  const hero = state.preparation.heroes.find((hero) => hero.heroId === command.heroId);
  if (!hero) throw new ApiError(409, 'HERO_UNAVAILABLE', 'Questo eroe non è nella compagnia.');
  if (hero.playerId !== playerId)
    throw new ApiError(403, 'HERO_NOT_YOURS', 'Puoi muovere soltanto i tuoi eroi.');
  if (
    !round ||
    round.phase !== 'action' ||
    round.id !== command.roundId ||
    round.turnId !== command.turnId ||
    round.activeHeroId !== command.heroId
  )
    throw new ApiError(409, 'TURN_CHANGED', 'Questo eroe non è di turno o il turno è cambiato.');
  const progress = round.heroes.find((hero) => hero.heroId === command.heroId)!;
  const position = journey.heroes.find((hero) => hero.heroId === command.heroId)!;
  if (command.type === 'START_TRAVEL') {
    if (progress.actionsUsed >= 2)
      throw new ApiError(409, 'NO_ACTIONS', 'Questo eroe ha già usato le sue due azioni.');
    progress.actionsUsed++;
    journey.travel = {
      roundId: round.id,
      turnId: round.turnId!,
      heroId: command.heroId,
      remaining: (journey.travel?.remaining ?? 0) + grantedMoves,
    };
  } else {
    if (!journey.travel || journey.travel.remaining < 1)
      throw new ApiError(
        409,
        'NO_MOVES',
        'Inizia un viaggio prima di muoverti: non restano movimenti.',
      );
    if (position.spaceId !== command.fromSpaceId)
      throw new ApiError(
        409,
        'POSITION_CHANGED',
        'L’eroe si è già spostato. Controlla la posizione e riprova.',
      );
    if (!adjacent(journey.definition, position.spaceId, command.destinationSpaceId))
      throw new ApiError(
        409,
        'NOT_ADJACENT',
        'Scegli una casella adiacente collegata da un bordo grigio.',
      );
    position.spaceId = command.destinationSpaceId;
    journey.travel.remaining--;
  }
  return {
    mapId: journey.id,
    heroId: command.heroId,
    spaceId: position.spaceId,
    movesRemaining: journey.travel.remaining,
    ...(command.type === 'START_TRAVEL' && state.physical?.cycle
      ? { movesGranted: grantedMoves }
      : {}),
    roundId: round.id,
    turnId: round.turnId,
  };
}
