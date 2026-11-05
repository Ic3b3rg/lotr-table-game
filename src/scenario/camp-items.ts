import type { State } from '../server/state';
import type { CampItemInput, CampItemReceipt, CampItemCard } from '../shared/camp-items';
import { definitionId } from '../shared/preparation';
import { ApiError } from '../server/errors';
import { invariant } from '../map-freeze/validate';

function validCopy(entry: CampItemCard, copy: string) {
  return Array.from({ length: entry.quantity }, (_, n) => `${entry.cardId}:${n + 1}`).includes(
    copy,
  );
}
function inventory(state: State) {
  const campaign = state.scenario!.conclusion!.campaign!;
  return [
    ...campaign.heroes.flatMap((h) => h.itemCopies),
    ...(campaign.inventory ?? []).map((i) => i.copy),
  ];
}

/** Replace in the campaign's existing inventory; the closed episode remains immutable evidence. */
export function transactCampItem(
  state: State,
  playerId: string,
  input: CampItemInput,
): CampItemReceipt {
  const sc = state.scenario!,
    c = sc.conclusion,
    cap = sc.pack.manifest.campItems;
  if (!cap || c?.stage !== 'camp' || !c.campaign)
    throw new ApiError(
      409,
      'CAMP_ITEMS_UNAVAILABLE',
      'I miglioramenti richiedono il campo e gli oggetti verificati prima dell’avvio.',
    );
  const hero = c.campaign.heroes.find((h) => h.heroId === input.heroId);
  if (
    input.heroId !== null &&
    (!hero ||
      !state.preparation!.heroes.some((h) => h.heroId === input.heroId && h.playerId === playerId))
  )
    throw new ApiError(403, 'HERO_NOT_YOURS', 'Migliora soltanto l’equipaggiamento del tuo eroe.');
  const from = cap.cards.find((c) => c.cardId === definitionId(input.copy)),
    to = cap.cards.find((c) => c.cardId === definitionId(input.upgrade)),
    group = c.campaign.inventory?.find((i) => i.copy === input.copy);
  if (
    !from ||
    !validCopy(from, input.copy) ||
    (input.heroId === null
      ? !group || from.model.type !== 2 || group.modelId !== from.model.modelId
      : !hero!.itemCopies.includes(input.copy) || from.model.type === 2)
  )
    throw new ApiError(
      409,
      'CAMP_ITEM_NOT_OWNED',
      'Questa copia non è nell’inventario indicato. Gli accessori restano della Compagnia.',
    );
  if (
    !to ||
    !validCopy(to, input.upgrade) ||
    !from.model.upgrades.includes(to.model.source) ||
    to.model.level !== from.model.level + 1 ||
    to.model.type !== from.model.type
  )
    throw new ApiError(
      409,
      'CAMP_ITEM_UPGRADE_UNAVAILABLE',
      'Scegli un’alternativa verificata del rango successivo per questo oggetto.',
    );
  if (sc.play!.lore < from.model.upgradeCost)
    throw new ApiError(
      409,
      'CAMP_LORE_INSUFFICIENT',
      'La Sapienza condivisa non raggiunge ancora il requisito di questo oggetto.',
    );
  if (inventory(state).includes(input.upgrade))
    throw new ApiError(
      409,
      'CAMP_ITEM_COPY_OWNED',
      'Questa copia migliorata è già posseduta nella Compagnia.',
    );
  if (input.heroId === null) {
    const entries = c.campaign.inventory!;
    entries.splice(entries.indexOf(group!), 1);
    entries.push({ copy: input.upgrade, cardId: to.cardId, modelId: to.model.modelId });
  } else hero!.itemCopies[hero!.itemCopies.indexOf(input.copy)] = input.upgrade;
  const { kind: _, ...intent } = input;
  return {
    ...intent,
    fromModelId: from.model.modelId,
    toModelId: to.model.modelId,
    fromRank: from.model.level,
    toRank: to.model.level,
    threshold: from.model.upgradeCost,
    lore: sc.play!.lore,
  };
}

export function validateCampItemsState(state: State) {
  const sc = state.scenario,
    cap = sc?.pack.manifest.campItems,
    campaign = sc?.conclusion?.campaign;
  if (!cap || !campaign) return;
  const all = inventory(state);
  invariant(new Set(all).size === all.length, 'Copia oggetto posseduta più volte nella Compagnia.');
  const card = (copy: string) => {
    const entry = cap.cards.find((c) => c.cardId === definitionId(copy));
    invariant(entry && validCopy(entry, copy), 'Oggetto del campo senza copia fonte.');
    return entry;
  };
  for (const hero of campaign.heroes) {
    const entries = hero.itemCopies.map(card),
      definition = state.content!.heroes.find((h) => h.id === hero.heroId)!;
    invariant(
      entries.every((c) => c.model.type !== 2) &&
        entries.filter((c) => c.model.type === 1).length <= 1 &&
        entries.reduce(
          (sum, c) => sum + (c.model.type === 0 ? (c.model.twoHanded ? 2 : 1) : 0),
          0,
        ) <= definition.maxHands,
      'Equipaggiamento personale del campo incoerente.',
    );
  }
  for (const item of campaign.inventory ?? []) {
    const entry = card(item.copy);
    invariant(
      entry.model.type === 2 &&
        entry.cardId === item.cardId &&
        entry.model.modelId === item.modelId,
      'Accessorio comune diverso dal modello fonte.',
    );
  }
}
