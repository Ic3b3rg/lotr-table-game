import type { GroupCommand } from '../shared/protocol';
import { groupProblem } from '../shared/group';
import { ApiError } from './errors';
import type { State } from './state';

export function applyGroup(state: State, command: GroupCommand) {
  if (state.revision !== command.expectedRevision)
    throw new ApiError(
      409,
      'TABLE_CHANGED',
      'Il tavolo è cambiato. Controlla i compagni presenti e riprova.',
    );
  if (state.preparation?.status === 'prepared')
    throw new ApiError(
      409,
      'COMPANY_PREPARED',
      'La compagnia è già pronta: recupera i posti esistenti.',
    );
  const group = { expectedPlayers: command.playerCount };
  const problem = groupProblem(group, state.players.length, state.preparation);
  if (problem)
    throw new ApiError(
      409,
      'GROUP_CONFLICT',
      `${problem} Riduci prima eventuali scelte incompatibili; nessuna scelta è stata cancellata.`,
    );
  state.group = group;
  return { expectedPlayers: group.expectedPlayers };
}
