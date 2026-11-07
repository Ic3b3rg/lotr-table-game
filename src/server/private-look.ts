import { ApiError } from './errors';
import type { State } from './state';
import { PrivateLookViewSchema, type PrivateLookView } from '../shared/interaction-look';
import { definitionId } from '../shared/preparation';
import { cycleRequest } from '../physical-resolution/cycle-request';

/** A pure, allowlisted read of only the current owner's active result. */
export function privateLookView(
  state: State,
  playerId: string,
  pendingId: string,
  generation: string,
): PrivateLookView {
  const stale = (): never => {
    throw new ApiError(
      409,
      'PRIVATE_LOOK_CHANGED',
      'Questa lettura è conclusa o il tavolo è cambiato.',
    );
  };
  if (generation !== state.generation) stale();
  const p = state.physical,
    active = p?.snapshot.active;
  const current =
    state.scenario?.pending?.kind === 'physical'
      ? state.scenario.pending.id
      : p
        ? cycleRequest(p)?.pendingId
        : null;
  if (
    !active ||
    active.kind !== 'decision' ||
    active.purpose !== 'interaction-look' ||
    current !== pendingId
  )
    stale();
  if (active!.actorPlayerId !== playerId)
    throw new ApiError(
      403,
      'PRIVATE_LOOK_OWNER',
      'La lettura spetta al proprietario dell’eroe indicato.',
    );
  const result = p!.snapshot.resolution?.privateLooks
    ?.slice()
    .reverse()
    .find(
      (r) =>
        r.runId === active!.runId && r.child === active!.child && r.heroId === active!.actorHeroId,
    );
  if (!result) stale();
  const card = p!.fronts!.catalog.skills.find((c) => c.id === definitionId(result!.copy));
  if (!card) stale();
  return PrivateLookViewSchema.parse({
    pendingId,
    generation,
    heroId: result!.heroId,
    card: {
      name: card!.name.text,
      text: card!.text.text,
      success: card!.success,
      fate: card!.fate,
    },
    reward: result!.reward,
  });
}
