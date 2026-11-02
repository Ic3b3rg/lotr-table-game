import { randomUUID } from 'node:crypto';
import type { ScoutingCommand } from '../shared/protocol';
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
    const resetBefore = command.type === 'START_RALLY_SCOUT';
    const count = resetBefore ? 2 : command.count;
    if (resetBefore) {
      hero.deck = shuffled([...hero.deck, ...hero.discard]);
      hero.discard = [];
    }
    state.scout = {
      id: randomUUID(),
      heroId,
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
    state.scout = null;
    refillEmptyDeck(hero);
  }
  return {
    heroId,
    scoutId: scout?.id ?? state.scout?.id ?? null,
    preparedCount: hero.prepared.length,
  };
}
