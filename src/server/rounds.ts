import { randomUUID } from 'node:crypto';
import type { RoundCommand } from '../shared/protocol';
import type { Round } from '../shared/rounds';
import { ApiError } from './errors';
import type { State } from './state';
import { applySkillTest } from './skill-tests';
import { shuffled } from './shuffle';

export function newRound(state: State, number: number): Round {
  return {
    id: randomUUID(),
    number,
    phase: 'action',
    shadowStep: null,
    activeHeroId: null,
    turnId: null,
    heroes: state.preparation!.heroes.map((hero) => ({
      heroId: hero.heroId,
      actionsUsed: 0,
      turnEnded: false,
      rallyDone: false,
    })),
  };
}

export function applyRoundCommand(state: State, playerId: string, command: RoundCommand) {
  if (state.revision !== command.expectedRevision)
    throw new ApiError(409, 'TABLE_CHANGED', 'Il tavolo è cambiato. Controlla il round e riprova.');
  if (state.preparation?.status !== 'prepared')
    throw new ApiError(409, 'COMPANY_NOT_READY', 'Prepara la compagnia prima di iniziare i turni.');
  if (state.scout || state.skillTest?.status === 'converting')
    throw new ApiError(
      409,
      'REVEAL_PENDING',
      'Concludi le carte rivelate prima di cambiare turno o fase.',
    );
  if (command.type === 'START_ROUNDS') {
    if (state.round) throw new ApiError(409, 'ROUNDS_STARTED', 'I round sono già iniziati.');
    state.round = newRound(state, 1);
  } else {
    const round = state.round;
    if (!round || round.id !== command.roundId)
      throw new ApiError(409, 'ROUND_CHANGED', 'Questo round è concluso o è cambiato.');
    if (command.type === 'CONFIRM_SHADOW_STEP') {
      if (round.phase !== 'shadow' || round.shadowStep !== command.step)
        throw new ApiError(409, 'SHADOW_STEP_CHANGED', 'Questo passaggio dell’Ombra è cambiato.');
      if (command.step === 'enemies') round.shadowStep = 'darkness';
      else if (command.step === 'darkness') round.shadowStep = 'threat';
      else {
        for (const hero of state.preparation.heroes) {
          hero.deck = shuffled([...hero.deck, ...hero.discard]);
          hero.discard = [];
        }
        round.phase = 'rally';
        round.shadowStep = null;
      }
    } else if (command.type === 'END_RALLY') {
      if (round.phase !== 'rally' || round.heroes.some((hero) => !hero.rallyDone))
        throw new ApiError(
          409,
          'RALLY_PENDING',
          'Ogni eroe deve concludere Scoperta 2 prima del nuovo round.',
        );
      state.round = newRound(state, round.number + 1);
    } else {
      if (round.phase !== 'action')
        throw new ApiError(409, 'ROUND_PHASE', 'Questa operazione richiede la Fase di Azione.');
      if (command.type === 'BEGIN_SHADOW') {
        if (round.activeHeroId || round.heroes.some((hero) => !hero.turnEnded))
          throw new ApiError(
            409,
            'TURNS_PENDING',
            'Tutti gli eroi devono concludere il proprio turno.',
          );
        round.phase = 'shadow';
        round.shadowStep = 'enemies';
      } else {
        const hero = state.preparation.heroes.find((hero) => hero.heroId === command.heroId);
        const progress = round.heroes.find((hero) => hero.heroId === command.heroId);
        if (!hero || !progress)
          throw new ApiError(409, 'HERO_UNAVAILABLE', 'Questo eroe non è nella compagnia.');
        if (hero.playerId !== playerId)
          throw new ApiError(
            403,
            'HERO_NOT_YOURS',
            'Puoi gestire soltanto il turno dei tuoi eroi.',
          );
        if (command.type === 'START_TURN') {
          if (round.activeHeroId || progress.turnEnded)
            throw new ApiError(
              409,
              'TURN_UNAVAILABLE',
              'Un turno è in corso oppure questo eroe ha già concluso.',
            );
          round.activeHeroId = hero.heroId;
          round.turnId = randomUUID();
        } else {
          if (round.activeHeroId !== hero.heroId || round.turnId !== command.turnId)
            throw new ApiError(409, 'TURN_CHANGED', 'Questo turno è concluso o è cambiato.');
          if (command.type === 'START_INTERACTION_TEST') {
            if (progress.actionsUsed >= 2)
              throw new ApiError(409, 'NO_ACTIONS', 'Questo eroe ha già usato le sue due azioni.');
            const { roundId, turnId, ...intent } = command;
            applySkillTest(state, playerId, { ...intent, type: 'START_SKILL_TEST' });
            progress.actionsUsed++;
          } else {
            progress.turnEnded = true;
            round.activeHeroId = null;
            round.turnId = null;
          }
        }
      }
    }
  }
  return {
    roundId: state.round!.id,
    roundNumber: state.round!.number,
    phase: state.round!.phase,
    turnId: state.round!.turnId,
    testId: command.type === 'START_INTERACTION_TEST' ? state.skillTest!.id : null,
  };
}
