import { createHash, randomUUID } from 'node:crypto';
import type { Command } from '../shared/protocol';
import { ApiError } from './errors';
import { Store, advance } from './store';
import { applyPreparation } from './preparation';
import { applySkillTest } from './skill-tests';
import { applyScouting } from './scouting';
import { applyRoundCommand } from './rounds';
import { applyJourneyCommand } from './journey-map';

export function performCommand(store: Store, playerId: string, command: Command) {
  const { generation, requestId, ...intent } = command;
  const fingerprint = createHash('sha256').update(JSON.stringify(intent)).digest('hex');
  return store.once(playerId, requestId, generation, fingerprint, (state) => {
    if (
      command.type === 'OPEN_JOURNEY_MAP' ||
      command.type === 'START_TRAVEL' ||
      command.type === 'MOVE_HERO'
    ) {
      const result = applyJourneyCommand(state, playerId, command, store.journeyPlan);
      advance(state);
      return { requestId, type: command.type, appliedRevision: state.revision, ...result };
    }
    if (
      command.type === 'START_ROUNDS' ||
      command.type === 'START_TURN' ||
      command.type === 'END_TURN' ||
      command.type === 'BEGIN_SHADOW' ||
      command.type === 'START_INTERACTION_TEST' ||
      command.type === 'CONFIRM_SHADOW_STEP' ||
      command.type === 'END_RALLY'
    ) {
      const result = applyRoundCommand(state, playerId, command);
      advance(state);
      return { requestId, type: command.type, appliedRevision: state.revision, ...result };
    }
    if (
      command.type === 'START_SCOUT' ||
      command.type === 'START_RALLY_SCOUT' ||
      command.type === 'RESOLVE_SCOUT' ||
      command.type === 'DISCARD_PREPARED_SKILL'
    ) {
      const result = applyScouting(state, playerId, command);
      advance(state);
      return { requestId, type: command.type, appliedRevision: state.revision, ...result };
    }
    if (
      command.type === 'START_SKILL_TEST' ||
      command.type === 'RESOLVE_SKILL_TEST' ||
      command.type === 'GAIN_INSPIRATION' ||
      command.type === 'CONVERT_FATE'
    ) {
      const hero = applySkillTest(state, playerId, command);
      advance(state);
      return {
        requestId,
        type: command.type,
        appliedRevision: state.revision,
        heroId: hero.heroId,
        testId: state.skillTest?.id ?? null,
        inspiration: hero.inspiration,
      };
    }
    if (
      command.type === 'SELECT_HEROES' ||
      command.type === 'CONFIGURE_HERO' ||
      command.type === 'PREPARE_COMPANY'
    ) {
      applyPreparation(state, playerId, command);
      advance(state);
      return {
        requestId,
        type: command.type,
        appliedRevision: state.revision,
        preparationStatus: state.preparation!.status,
      };
    }
    if (command.type === 'OPEN_DEMO') {
      if (
        (state.demo?.id ?? null) !== command.expectedDemoId ||
        (state.demo && state.demo.choice === null)
      ) {
        throw new ApiError(
          409,
          'DEMO_CHANGED',
          'La prova è già aperta o è cambiata. Guarda lo stato aggiornato.',
        );
      }
      state.demo = { id: randomUUID(), choice: null, resolvedBy: null };
    } else {
      if (!state.demo || state.demo.id !== command.demoId || state.demo.choice !== null) {
        throw new ApiError(
          409,
          'DEMO_CLOSED',
          'Questa prova è già conclusa. Nessuna scelta è stata applicata di nuovo.',
        );
      }
      state.demo.choice = command.choice;
      state.demo.resolvedBy = playerId;
    }
    advance(state);
    return {
      requestId,
      type: command.type,
      appliedRevision: state.revision,
      demoId: state.demo.id,
      choice: state.demo.choice,
    };
  });
}
