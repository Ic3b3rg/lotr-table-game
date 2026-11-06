import type { State } from '../server/state';
import type {
  CampPreparationInput,
  CampPreparationReceipt,
  CampRecipe,
} from '../shared/camp-preparation';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';
import { ApiError } from '../server/errors';
import { definitionId } from '../shared/preparation';
import { physicalTitleSkills } from '../physical-resolution/title-skills';

/** An identity recipe, never an active deck, physical allocation or random draw. */
export function campRecipe(state: State, heroId: string, accessory: string | null): CampRecipe {
  const sc = state.scenario!,
    campaign = sc.conclusion!.campaign!,
    cap = sc.pack.manifest.campPreparation!,
    hero = campaign.heroes.find((h) => h.heroId === heroId)!;
  const basic = cap.cards.filter((c) => c.kind === 'basic').sort((a, b) => a.number - b.number),
    own = cap.cards
      .filter((c) => c.kind === 'hero' && c.ownerId === heroId)
      .sort((a, b) => a.number - b.number),
    role = cap.cards
      .filter((c) => c.kind === 'role' && c.ownerId === hero.roleId)
      .sort((a, b) => a.number - b.number),
    initial = [...basic, ...own, ...role],
    titles = physicalTitleSkills(state.physical),
    missing = initial.find((c) => c.identity !== 'bound');
  const gate = !hero.roleId
    ? 'Scegli un ruolo per questo eroe.'
    : own.length !== 5 || role.length !== 3 || missing
      ? `L’identità fonte di una carta necessaria per questo eroe o ruolo richiede ancora verifica${missing ? ` (${missing.cardId})` : ''}. Scegli un ruolo disponibile.`
      : hero.titleCopies.some((copy) => !titles.some((t) => t.id === definitionId(copy)))
        ? 'Un titolo posseduto richiede la propria identità fonte.'
        : null;
  return {
    heroId,
    roleId: hero.roleId,
    cards: [
      ...initial.map((c) => ({ kind: c.kind, cardId: c.cardId, copy: null })),
      ...sc.pack.manifest
        .campSkills!.roles.flatMap((r) => r.upgrades)
        .filter((o) => hero.skillCopies!.includes(o.copy))
        .map((o) => ({ kind: 'purchased' as const, cardId: o.card.id, copy: o.copy })),
      ...hero.titleCopies.map((copy) => ({
        kind: 'title' as const,
        cardId: definitionId(copy),
        copy,
      })),
    ],
    futurePrepared: role.find((c) => c.number === 1)?.cardId ?? null,
    weakness: { count: 1, source: 'future-common-draw' },
    itemCopies: [...hero.itemCopies],
    accessory,
    balances: campaign
      .training!.balances.filter((b) => b.heroId === heroId)
      .map(({ roleId, availableXP }) => ({ roleId, availableXP })),
    gate,
  };
}

/** Reconcile real camp changes without executing any future setup. */
export function refreshCampPreparation(state: State) {
  const campaign = state.scenario?.conclusion?.campaign,
    prep = campaign?.preparation;
  if (!prep) return;
  for (const selection of prep.heroes) {
    invariant(
      !selection.accessory || campaign!.inventory?.some((i) => i.copy === selection.accessory),
      'Accessorio selezionato senza copia di campagna.',
    );
    const recipe = campRecipe(state, selection.heroId, selection.accessory),
      hash = digest(recipe);
    if (hash !== selection.summaryHash) selection.confirmedRevision = null;
    selection.recipe = recipe;
    selection.summaryHash = hash;
  }
}

export function transactCampPreparation(
  state: State,
  playerId: string,
  input: CampPreparationInput,
): CampPreparationReceipt {
  const sc = state.scenario!,
    c = sc.conclusion!,
    campaign = c.campaign,
    cap = sc.pack.manifest.campPreparation;
  if (!cap || !campaign || !campaign.training)
    throw new ApiError(
      409,
      'CAMP_PREPARATION_UNAVAILABLE',
      'La scelta per il seguito richiede le identità verificate prima dell’avvio. La partenza resta indisponibile.',
    );
  if (input.kind === 'camp-prepare') {
    if (c.stage !== 'camp')
      throw new ApiError(409, 'CAMP_PREPARATION_PHASE', 'Apri la preparazione dal campo.');
    campaign.preparation ??= {
      version: cap.version,
      heroes: campaign.heroes.map((h) => {
        const recipe = campRecipe(state, h.heroId, null);
        return {
          heroId: h.heroId,
          accessory: null,
          recipe,
          summaryHash: digest(recipe),
          confirmedRevision: null,
        };
      }),
    };
    c.stage = 'camp-preparation';
  } else {
    const prep = campaign.preparation;
    if (c.stage !== 'camp-preparation' || !prep)
      throw new ApiError(
        409,
        'CAMP_PREPARATION_PHASE',
        'Apri la preparazione prima di scegliere o confermare.',
      );
    if (input.kind === 'camp-return') c.stage = 'camp';
    else {
      const owner = state.preparation!.heroes.find((h) => h.heroId === input.heroId),
        selection = prep.heroes.find((h) => h.heroId === input.heroId),
        hero = campaign.heroes.find((h) => h.heroId === input.heroId);
      if (!owner || owner.playerId !== playerId || !selection || !hero)
        throw new ApiError(403, 'HERO_NOT_YOURS', 'Scegli e conferma soltanto per il tuo eroe.');
      if (input.kind === 'camp-select-role') {
        const cards = cap.cards.filter((c) => c.kind === 'role' && c.ownerId === input.roleId);
        if (cards.length !== 3 || cards.some((c) => c.identity !== 'bound'))
          throw new ApiError(
            409,
            'CAMP_ROLE_SOURCE_REQUIRED',
            'Questo ruolo richiede ancora l’identità fonte delle sue carte. Scegli un ruolo disponibile.',
          );
        for (const other of campaign.heroes)
          if (other.heroId !== hero.heroId && other.roleId === input.roleId) other.roleId = null;
        hero.roleId = input.roleId;
      } else if (input.kind === 'camp-accessory') {
        if (
          input.copy !== null &&
          (!campaign.inventory?.some((i) => i.copy === input.copy) ||
            prep.heroes.some((h) => h.heroId !== input.heroId && h.accessory === input.copy))
        )
          throw new ApiError(
            409,
            'CAMP_ACCESSORY_UNAVAILABLE',
            'La copia deve essere nell’inventario comune e libera. Solo il proprietario può rilasciare la propria scelta.',
          );
        selection.accessory = input.copy;
      } else {
        if (
          selection.recipe.gate ||
          input.summaryHash !== selection.summaryHash ||
          selection.confirmedRevision !== null
        )
          throw new ApiError(
            409,
            'CAMP_SUMMARY_CHANGED',
            selection.recipe.gate ??
              'Il riepilogo è cambiato o è già confermato. Controlla le scelte correnti.',
          );
        selection.confirmedRevision = state.revision + 1;
      }
    }
  }
  refreshCampPreparation(state);
  return { action: input.kind, heroes: structuredClone(campaign.preparation!.heroes) };
}

export function validateCampPreparationState(state: State) {
  const sc = state.scenario,
    campaign = sc?.conclusion?.campaign,
    prep = campaign?.preparation;
  invariant(!prep || sc?.pack.manifest.campPreparation, 'Preparazione senza capacità congelata.');
  invariant(
    sc?.conclusion?.stage !== 'camp-preparation' || prep,
    'Richiesta di preparazione senza scelte.',
  );
  if (!prep) return;
  invariant(
    digest(prep.heroes.map((h) => h.heroId)) === digest(campaign!.heroes.map((h) => h.heroId)),
    'Eroi della preparazione incoerenti.',
  );
  const accessories = prep.heroes.flatMap((h) => (h.accessory ? [h.accessory] : [])),
    roles = campaign!.heroes.flatMap((h) => (h.roleId ? [h.roleId] : []));
  invariant(
    new Set(accessories).size === accessories.length && new Set(roles).size === roles.length,
    'Ruolo o copia selezionati più volte.',
  );
  for (const h of prep.heroes) {
    const recipe = campRecipe(state, h.heroId, h.accessory);
    invariant(
      (!h.accessory || campaign!.inventory?.some((i) => i.copy === h.accessory)) &&
        digest(recipe) === digest(h.recipe) &&
        h.summaryHash === digest(recipe) &&
        (h.confirmedRevision === null || (!recipe.gate && h.confirmedRevision <= state.revision)),
      'Riepilogo o conferma della preparazione incoerenti.',
    );
  }
}
