import type { State } from '../server/state';
import type { CampSkillInput, CampSkillReceipt } from '../shared/camp-skills';
import { ApiError } from '../server/errors';
import { invariant } from '../map-freeze/validate';
import { digest } from '../map-freeze/hash';

function episodeSkills(state: State, heroId: string) {
  const hero = state.preparation!.heroes.find((h) => h.heroId === heroId)!;
  return [
    ...new Set([
      ...hero.prepared,
      ...hero.deck,
      ...hero.discard,
      ...(state.physical?.snapshot.resolution?.revealed.find((h) => h.heroId === heroId)?.cards ??
        []),
      ...(state.physical?.snapshot.lastStand?.titles ?? [])
        .filter((t) => t.heroId === heroId)
        .map((t) => t.copy),
    ]),
  ];
}

/** The closed episode remains evidence. The campaign owns the cards for its next consumer. */
export function initializeCampSkills(state: State) {
  const sc = state.scenario!,
    c = sc.conclusion!;
  if (!sc.pack.manifest.campSkills) return;
  invariant(c.campaign && !c.campaign.training, 'Inventario del campo già inizializzato.');
  c.campaign.training = {
    version: 'source-camp-skills-v1',
    balances: c.xp.map(({ heroId, roleId, amount }) => ({ heroId, roleId, availableXP: amount })),
  };
  for (const hero of c.campaign.heroes) hero.skillCopies = episodeSkills(state, hero.heroId);
}

export function transactCampSkill(
  state: State,
  playerId: string,
  input: CampSkillInput,
): CampSkillReceipt {
  const sc = state.scenario!,
    c = sc.conclusion,
    cap = sc.pack.manifest.campSkills;
  if (!cap || c?.stage !== 'camp' || !c.campaign?.training)
    throw new ApiError(
      409,
      'CAMP_SKILLS_UNAVAILABLE',
      'Gli acquisti richiedono il campo e le carte verificate prima dell’avvio.',
    );
  const owner = state.preparation!.heroes.find((h) => h.heroId === input.heroId);
  if (!owner || owner.playerId !== playerId)
    throw new ApiError(403, 'HERO_NOT_YOURS', 'Acquista e vendi soltanto per il tuo eroe.');
  const role = cap.roles.find((r) => r.id === input.roleId),
    offer = role?.upgrades.find((o) => o.copy === input.copy),
    hero = c.campaign.heroes.find((h) => h.heroId === input.heroId)!,
    balance = c.campaign.training.balances.find(
      (b) => b.heroId === input.heroId && b.roleId === input.roleId,
    );
  if (!offer || !balance)
    throw new ApiError(
      409,
      'CAMP_SKILL_UNAVAILABLE',
      'Scegli un’abilità acquistabile di un ruolo già giocato da questo eroe.',
    );
  const holder = c.campaign.heroes.find((h) => h.skillCopies!.includes(offer.copy));
  if (input.operation === 'buy' && (holder || balance.availableXP < offer.cost))
    throw new ApiError(
      409,
      holder ? 'CAMP_COPY_OWNED' : 'CAMP_XP_INSUFFICIENT',
      holder
        ? 'Questa copia è già posseduta nella compagnia.'
        : 'L’esperienza disponibile in questo ruolo non basta.',
    );
  if (input.operation === 'sell' && holder !== hero)
    throw new ApiError(
      409,
      'CAMP_SKILL_NOT_OWNED',
      'Puoi vendere soltanto un’abilità upgrade che hai acquistato.',
    );
  const before = balance.availableXP;
  if (input.operation === 'buy') {
    hero.skillCopies!.push(offer.copy);
    balance.availableXP -= offer.cost;
  } else {
    hero.skillCopies!.splice(hero.skillCopies!.indexOf(offer.copy), 1);
    balance.availableXP += offer.cost;
  }
  const { kind: _, ...intent } = input;
  return { ...intent, cost: offer.cost, before, after: balance.availableXP };
}

export function validateCampState(state: State) {
  const sc = state.scenario;
  if (!sc) return;
  const cap = sc.pack.manifest.campSkills,
    c = sc.conclusion,
    campaign = c?.campaign;
  if (!cap) {
    invariant(
      !campaign?.training && !campaign?.heroes.some((h) => h.skillCopies !== undefined),
      'Inventario abilità senza capacità congelata.',
    );
    return;
  }
  if (!campaign) return;
  const training = campaign.training;
  invariant(
    training &&
      training.balances.length === c!.xp.length &&
      campaign.heroes.every((h) => h.skillCopies),
    'Inventario o saldi del campo incompleti.',
  );
  const offers = cap.roles.flatMap((r) => r.upgrades),
    all = campaign.heroes.flatMap((h) => h.skillCopies!);
  invariant(new Set(all).size === all.length, 'Copia abilità posseduta da più eroi.');
  for (const hero of campaign.heroes) {
    const initial = episodeSkills(state, hero.heroId),
      extras = hero.skillCopies!.slice(initial.length);
    invariant(
      digest(hero.skillCopies!.slice(0, initial.length)) === digest(initial) &&
        extras.every((copy) => offers.some((o) => o.copy === copy)),
      'Inventario abilità della campagna incoerente.',
    );
  }
  training.balances.forEach((balance, n) => {
    const reward = c!.xp[n]!,
      hero = campaign.heroes.find((h) => h.heroId === balance.heroId);
    const cost = cap.roles
      .find((r) => r.id === balance.roleId)
      ?.upgrades.filter((o) => hero?.skillCopies!.includes(o.copy))
      .reduce((sum, o) => sum + o.cost, 0);
    invariant(
      balance.heroId === reward.heroId &&
        balance.roleId === reward.roleId &&
        cost !== undefined &&
        balance.availableXP === reward.amount - cost,
      'Saldo del ruolo non riconciliato con premi e copie.',
    );
  });
}
