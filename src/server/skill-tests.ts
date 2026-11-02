import { randomUUID } from 'node:crypto';
import type { SkillTestCommand } from '../shared/protocol';
import { skillTestView } from '../shared/skill-tests';
import { ApiError } from './errors';
import type { State } from './state';
import { refillEmptyDeck, revealCards } from './skill-deck';

export function applySkillTest(state: State, playerId: string, command: SkillTestCommand) {
  if (state.revision !== command.expectedRevision)
    throw new ApiError(409, 'TABLE_CHANGED', 'Il tavolo è cambiato. Controlla la prova e riprova.');
  if (!state.content || state.preparation?.status !== 'prepared')
    throw new ApiError(409, 'COMPANY_NOT_READY', 'Prepara i mazzi prima di effettuare una prova.');
  if (state.round?.phase === 'rally')
    throw new ApiError(
      409,
      'ROUND_PHASE',
      'Concludi la Riorganizzazione prima di effettuare prove o registrare ispirazione.',
    );
  if (command.type === 'START_SKILL_TEST' && state.scout)
    throw new ApiError(
      409,
      'SCOUT_IN_PROGRESS',
      'Concludi la Scoperta prima di iniziare una prova.',
    );
  const test = state.skillTest;
  if (command.type === 'RESOLVE_SKILL_TEST' || command.type === 'CONVERT_FATE') {
    if (!test || test.id !== command.testId || test.status !== 'converting')
      throw new ApiError(409, 'TEST_CLOSED', 'Questa prova è già conclusa o è cambiata.');
  } else if (command.type === 'START_SKILL_TEST' && test?.status === 'converting') {
    throw new ApiError(
      409,
      'TEST_IN_PROGRESS',
      'Concludi la prova in corso prima di iniziarne un’altra.',
    );
  }
  const heroId = 'heroId' in command ? command.heroId : test!.heroId;
  const hero = state.preparation.heroes.find((entry) => entry.heroId === heroId);
  if (!hero) throw new ApiError(409, 'HERO_UNAVAILABLE', 'Questo eroe non è nella compagnia.');
  if (hero.playerId !== playerId)
    throw new ApiError(403, 'HERO_NOT_YOURS', 'Puoi effettuare prove solo con i tuoi eroi.');
  if (command.type === 'GAIN_INSPIRATION') {
    const limit = state.content.heroes.find((entry) => entry.id === hero.heroId)!.stats.inspiration;
    if (hero.inspiration >= limit)
      throw new ApiError(
        409,
        'INSPIRATION_FULL',
        'Questo eroe ha già raggiunto il limite di ispirazione.',
      );
    hero.inspiration++;
  } else if (command.type === 'CONVERT_FATE') {
    if (hero.inspiration < 1)
      throw new ApiError(
        409,
        'INSPIRATION_REQUIRED',
        'Serve un’ispirazione per convertire un fato.',
      );
    if (skillTestView(state.content, test)!.fateRemaining < 1)
      throw new ApiError(409, 'FATE_UNAVAILABLE', 'Non resta fato da convertire in questa prova.');
    hero.inspiration--;
    test!.converted++;
  } else if (command.type === 'START_SKILL_TEST') {
    const definition = state.content.heroes.find((entry) => entry.id === hero.heroId)!;
    const count = Math.max(1, definition.stats[command.stat] + command.modifier);
    const availableCount = hero.deck.length + hero.discard.length;
    const revealed = revealCards(hero, count);
    state.skillTest = {
      id: randomUUID(),
      heroId: hero.heroId,
      stat: command.stat,
      modifier: command.modifier,
      availableCount,
      target: command.target,
      revealed,
      converted: 0,
      status: 'converting',
    };
  } else {
    hero.discard.push(...test!.revealed);
    test!.status = 'resolved';
    refillEmptyDeck(hero);
  }
  return hero;
}
