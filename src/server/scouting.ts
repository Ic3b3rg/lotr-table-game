import { randomUUID } from 'node:crypto';
import type { ScoutingCommand } from '../shared/protocol';
import { rallyScoutCount } from '../shared/rally-scout';
import { ApiError } from './errors';
import type { State } from './state';
import { refillEmptyDeck, revealCards } from './skill-deck';
import { shuffled } from './shuffle';

export function applyScouting(state: State, playerId: string, command: ScoutingCommand) {
  if (state.revision !== command.expectedRevision)
    throw new ApiError(409, 'TABLE_CHANGED', 'Il tavolo è cambiato. Controlla le carte e riprova.');
  if (!state.content || state.preparation?.status !== 'prepared')
    throw new ApiError(409, 'COMPANY_NOT_READY', 'Prepara la compagnia prima di scoprire carte.');
  if (state.skillTest?.status === 'converting')
    throw new ApiError(409, 'TEST_IN_PROGRESS', 'Concludi la prova prima di scoprire altre carte.');
  const scout = state.scout;
  if (command.type === 'RESOLVE_SCOUT') {
    if (!scout || scout.id !== command.scoutId)
      throw new ApiError(409, 'SCOUT_CLOSED', 'Questa Scoperta è già conclusa o è cambiata.');
  } else if (scout) {
    throw new ApiError(
      409,
      'SCOUT_IN_PROGRESS',
      'Concludi la Scoperta in corso prima di continuare.',
    );
  }
  const heroId = command.type === 'RESOLVE_SCOUT' ? scout!.heroId : command.heroId;
  const hero = state.preparation.heroes.find((entry) => entry.heroId === heroId);
  if (!hero) throw new ApiError(409, 'HERO_UNAVAILABLE', 'Questo eroe non è nella compagnia.');
  if (hero.playerId !== playerId)
    throw new ApiError(403, 'HERO_NOT_YOURS', 'Puoi gestire soltanto le carte dei tuoi eroi.');
  const round = state.round;
  const progress = round?.heroes.find((entry) => entry.heroId === heroId);
  if (round?.phase === 'rally') {
    if (command.type === 'START_RALLY_SCOUT') {
      if (command.roundId !== round.id || progress?.rallyDone !== false)
        throw new ApiError(
          409,
          'RALLY_SCOUT_UNAVAILABLE',
          'Questo eroe ha già effettuato Scoperta o il round è cambiato.',
        );
    } else if (command.type !== 'RESOLVE_SCOUT' || scout?.roundId !== round.id) {
      throw new ApiError(
        409,
        'ROUND_PHASE',
        'Durante Riorganizzazione effettua soltanto la Scoperta dedicata a ogni eroe.',
      );
    }
  } else if (command.type === 'START_RALLY_SCOUT' && (round || command.roundId)) {
    throw new ApiError(
      409,
      'ROUND_PHASE',
      'La ricomposizione dei mazzi avviene all’inizio della Riorganizzazione comune.',
    );
  }
  if (command.type === 'DISCARD_PREPARED_SKILL') {
    if (!hero.prepared.includes(command.copy))
      throw new ApiError(
        409,
        'CARD_NOT_PREPARED',
        'Questa carta non è preparata: nessuno scarto registrato.',
      );
    hero.prepared = hero.prepared.filter((copy) => copy !== command.copy);
    hero.discard.push(command.copy);
    refillEmptyDeck(hero);
  } else if (command.type !== 'RESOLVE_SCOUT') {
    const resetBefore = command.type === 'START_RALLY_SCOUT' && !round;
    let count: number;
    if (command.type === 'START_RALLY_SCOUT') {
      const knownCount =
        round?.phase === 'rally'
          ? rallyScoutCount(state.preparation.heroes, state.journey, heroId)
          : 2;
      if (command.proximity && knownCount !== null)
        throw new ApiError(
          409,
          'PROXIMITY_ALREADY_KNOWN',
          'La vicinanza è già determinata dal tavolo: non puoi sostituire il conteggio con una dichiarazione.',
        );
      if (knownCount === null && !command.proximity)
        throw new ApiError(
          409,
          'PROXIMITY_REQUIRED',
          'Questo round precedente non ha posizioni registrate. Il gruppo deve indicare se l’eroe è vicino ad Aragorn.',
        );
      count = knownCount ?? (command.proximity === 'near' ? 3 : 2);
    } else count = command.count;
    if (resetBefore) {
      hero.deck = shuffled([...hero.deck, ...hero.discard]);
      hero.discard = [];
    }
    state.scout = {
      id: randomUUID(),
      heroId,
      roundId: round?.phase === 'rally' ? round.id : null,
      count,
      resetBefore,
      revealed: revealCards(hero, count),
    };
  } else {
    const assigned = [
      ...(command.prepareCopy ? [command.prepareCopy] : []),
      ...command.top,
      ...command.bottom,
    ];
    if (
      assigned.length !== scout!.revealed.length ||
      new Set(assigned).size !== assigned.length ||
      assigned.some((copy) => !scout!.revealed.includes(copy))
    )
      throw new ApiError(
        409,
        'SCOUT_CHOICES_INVALID',
        'Assegna ogni carta scoperta una sola volta.',
      );
    const prepared = [...hero.prepared, ...(command.prepareCopy ? [command.prepareCopy] : [])];
    const discard = command.discardPreparedCopy;
    if (prepared.length > 4 !== Boolean(discard) || (discard && !prepared.includes(discard)))
      throw new ApiError(
        409,
        'PREPARED_LIMIT',
        'Oltre quattro preparate, scegli una delle cinque carte da scartare.',
      );
    hero.prepared = prepared.filter((copy) => copy !== discard);
    if (discard) hero.discard.push(discard);
    hero.deck = [...command.top, ...hero.deck, ...command.bottom];
    if (scout!.roundId) progress!.rallyDone = true;
    state.scout = null;
    refillEmptyDeck(hero);
  }
  return {
    heroId,
    scoutId: scout?.id ?? state.scout?.id ?? null,
    preparedCount: hero.prepared.length,
  };
}
