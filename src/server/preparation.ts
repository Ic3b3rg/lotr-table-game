import { randomInt } from 'node:crypto';
import type { PreparationCommand } from '../shared/protocol';
import { preparationProblem, rosterProblem, type PreparedHero } from '../shared/preparation';
import { ApiError } from './errors';
import type { State } from './state';

export function applyPreparation(
  state: State,
  playerId: string,
  command: PreparationCommand,
): void {
  if (!state.content)
    throw new ApiError(
      409,
      'CATALOG_REQUIRED',
      'Carica le carte sul PC prima di scegliere gli eroi.',
    );
  if (state.revision !== command.expectedRevision)
    throw new ApiError(
      409,
      'TABLE_CHANGED',
      'La compagnia è cambiata. Controlla le scelte aggiornate e riprova.',
    );
  if (state.preparation?.status === 'prepared')
    throw new ApiError(
      409,
      'COMPANY_PREPARED',
      'La compagnia è già pronta. Gli eroi sono fissati per la campagna.',
    );
  const preparation = state.preparation ?? { status: 'draft', heroes: [], weaknessDeck: [] };
  if (command.type === 'PREPARE_COMPANY') {
    const roster = rosterProblem(
      state.players.map((player) => player.id),
      preparation,
    );
    if (roster) throw new ApiError(409, 'COMPANY_INCOMPLETE', roster);
    preparation.weaknessDeck = shuffled(state.content.weaknessCards.map((id) => `${id}:1`));
    for (const [index, hero] of preparation.heroes.entries()) {
      const definition = state.content.heroes.find((entry) => entry.id === hero.heroId)!;
      const role = state.content.roles.find((entry) => entry.id === hero.roleId)!;
      hero.prepared = [`${role.skills[0]}:1`];
      hero.deck = shuffled([
        ...state.content.basicSkills.map((id) => `${id}:${index + 1}`),
        ...definition.skills.map((id) => `${id}:1`),
        ...role.skills.slice(1).map((id) => `${id}:1`),
        preparation.weaknessDeck.pop()!,
      ]);
    }
    preparation.status = 'prepared';
  } else if (command.type === 'SELECT_HEROES') {
    if (
      new Set(command.heroIds).size !== command.heroIds.length ||
      (state.players.length > 1 && command.heroIds.length > 1)
    )
      throw new ApiError(
        409,
        'HERO_SELECTION',
        'Scegli un eroe per persona, oppure da due a quattro se giochi da solo.',
      );
    const others = preparation.heroes.filter((hero) => hero.playerId !== playerId);
    const existing = preparation.heroes.filter((hero) => hero.playerId === playerId);
    if (others.length + command.heroIds.length > 5)
      throw new ApiError(
        409,
        'HERO_SELECTION',
        'La compagnia può contenere al massimo cinque eroi.',
      );
    preparation.heroes = [
      ...others,
      ...existing.filter((hero) => command.heroIds.includes(hero.heroId)),
    ];
    for (const id of command.heroIds) {
      const definition = state.content.heroes.find((hero) => hero.id === id);
      if (!definition || others.some((hero) => hero.heroId === id))
        throw new ApiError(
          409,
          'HERO_UNAVAILABLE',
          'Questo eroe è già scelto o non appartiene alla scatola base.',
        );
      const previous = existing.find((hero) => hero.heroId === id);
      if (previous) continue;
      const taken = new Set(preparation.heroes.flatMap((hero) => hero.itemCopies));
      const itemCopies: string[] = [];
      for (const itemId of definition.startingItemIds) {
        const item = state.content.items.find((entry) => entry.id === itemId)!;
        const copy = Array.from({ length: item.quantity }, (_, i) => `${itemId}:${i + 1}`).find(
          (value) => !taken.has(value),
        );
        if (copy) {
          itemCopies.push(copy);
          taken.add(copy);
        }
      }
      const hero: PreparedHero = {
        heroId: id,
        playerId,
        roleId: preparation.heroes.some((hero) => hero.roleId === definition.suggestedRoleId)
          ? null
          : definition.suggestedRoleId,
        itemCopies,
        prepared: [],
        deck: [],
        discard: [],
      };
      preparation.heroes.push(hero);
    }
  } else {
    const hero = preparation.heroes.find((hero) => hero.heroId === command.heroId);
    if (!hero) throw new ApiError(409, 'HERO_UNAVAILABLE', 'Scegli prima questo eroe.');
    if (hero.playerId !== playerId)
      throw new ApiError(403, 'HERO_NOT_YOURS', 'Puoi modificare solo i tuoi eroi.');
    hero.roleId = command.roleId;
    hero.itemCopies = command.itemCopies;
  }
  const problem = preparationProblem(
    state.content,
    state.players.map((player) => player.id),
    preparation,
  );
  if (problem) throw new ApiError(409, 'PREPARATION_INVALID', problem);
  state.preparation = preparation;
}

function shuffled<T>(input: T[]): T[] {
  const result = [...input];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}
