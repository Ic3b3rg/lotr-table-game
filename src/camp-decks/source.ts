import { digest } from '../map-freeze/hash';
import type { CampRecipe } from '../shared/camp-preparation';
import {
  parseJson,
  check,
  sourceSchema,
  sameSet,
  unique,
  PENDING,
  type CampDeckCard,
  type CampDeckSource,
} from './model';

function deriveRecipe(s: CampDeckSource, hero: CampDeckSource['campaign']['heroes'][number]) {
  const choice = s.choices.find((c) => c.heroId === hero.heroId)!;
  const cards = s.catalog.cards;
  const ordered = (kind: CampDeckCard['kind'], ownerId: string | null) =>
    cards
      .filter((c) => c.kind === kind && c.ownerId === ownerId)
      .sort((a, b) => a.number - b.number);
  const initial = [
    ...ordered('basic', null),
    ...ordered('hero', hero.heroId),
    ...ordered('role', hero.roleId),
  ];
  const purchases = cards.filter(
    (c) => c.kind === 'purchased' && c.copies.some((copy) => hero.skillCopies.includes(copy)),
  );
  const titles = hero.titleCopies.map((copy) => cards.find((c) => c.copies.includes(copy))!);
  const missing = initial.find(
    (c) =>
      c.identity !== 'bound' ||
      s.capability.cards.find((b) => b.cardId === c.id)!.identity !== 'bound',
  );
  const gate = !hero.roleId
    ? 'Scegli un ruolo per questo eroe.'
    : missing
      ? `L’identità fonte di una carta necessaria per questo eroe o ruolo richiede ancora verifica (${missing.id}). Scegli un ruolo disponibile.`
      : titles.some((c) => c.identity !== 'bound')
        ? 'Un titolo posseduto richiede la propria identità fonte.'
        : purchases.some((c) => c.identity !== 'bound')
          ? 'Selected purchased identity requires content.'
          : null;
  const recipe: CampRecipe = {
    heroId: hero.heroId,
    roleId: hero.roleId,
    cards: [
      ...initial.map((c) => ({
        kind: c.kind as 'basic' | 'hero' | 'role',
        cardId: c.id,
        copy: null,
      })),
      ...purchases.flatMap((c) =>
        c.copies
          .filter((copy) => hero.skillCopies.includes(copy))
          .map((copy) => ({ kind: 'purchased' as const, cardId: c.id, copy })),
      ),
      ...hero.titleCopies.map((copy, i) => ({
        kind: 'title' as const,
        cardId: titles[i]!.id,
        copy,
      })),
    ],
    futurePrepared: initial.find((c) => c.kind === 'role' && c.number === 1)?.id ?? null,
    weakness: { count: 1, source: 'future-common-draw' },
    itemCopies: [...hero.itemCopies],
    accessory: choice.accessory,
    balances: structuredClone(hero.balances),
    gate,
  };
  check(recipe.cards.length <= 200, 'Recipe card budget.');
  return recipe;
}

/** All projected authority is validated before recipes or capability are consulted. */
export function parseSource(raw: unknown) {
  const s = structuredClone(parseJson(sourceSchema, raw));
  const { cards, heroIds, roleIds } = s.catalog;
  unique(heroIds, 'Catalog heroes');
  unique(roleIds, 'Catalog roles');
  unique(
    cards.map((c) => c.id),
    'Card definitions',
  );
  unique(
    cards.flatMap((c) => c.copies),
    'Physical copies',
  );
  unique([...cards.map((c) => c.id), ...cards.flatMap((c) => c.copies)], 'Definitions/copies');
  const copies = new Map(cards.flatMap((c) => c.copies.map((copy) => [copy, c] as const)));
  for (const c of cards) {
    check(c.copies.length === (c.kind === 'basic' ? 5 : 1), 'Frozen card quantity.');
    check(
      c.kind === 'hero'
        ? heroIds.includes(c.ownerId!)
        : c.kind === 'role' || c.kind === 'purchased'
          ? roleIds.includes(c.ownerId!)
          : c.ownerId === null,
      'Card owner binding.',
    );
  }
  const series = (kind: CampDeckCard['kind'], ownerId: string | null, count: number) => {
    const rows = cards.filter((c) => c.kind === kind && c.ownerId === ownerId);
    check(rows.length === count, `Missing ${kind} identities.`);
    sameSet(
      rows.map((c) => String(c.number)),
      Array.from({ length: count }, (_, i) => String(i + 1)),
      `${kind} numbers`,
    );
  };
  series('basic', null, 6);
  heroIds.forEach((id) => series('hero', id, 5));
  roleIds.forEach((id) => series('role', id, 3));
  series('weakness', null, 20);
  series('title', null, 21);
  const initial = cards.filter((c) => ['basic', 'hero', 'role'].includes(c.kind));
  sameSet(
    s.capability.cards.map((b) => b.cardId),
    initial.map((c) => c.id),
    'Capability cards',
  );
  check(
    s.capability.catalogFingerprint === s.catalog.fingerprint,
    'Capability/catalog fingerprint.',
  );
  for (const b of s.capability.cards) {
    const c = cards.find((c) => c.id === b.cardId)!;
    check(
      b.cardHash === c.definitionHash &&
        b.kind === c.kind &&
        b.ownerId === c.ownerId &&
        b.number === c.number,
      'Capability card binding/hash.',
    );
  }
  const roster = s.originalRoster;
  unique(
    roster.map((r) => r.heroId),
    'Original roster',
  );
  unique(
    roster.map((r) => r.initialRoleId),
    'Original roles',
  );
  for (const r of roster)
    check(
      heroIds.includes(r.heroId) && roleIds.includes(r.initialRoleId),
      'Original roster binding.',
    );
  const heroes = roster.map((r) => r.heroId);
  sameSet(
    s.campaign.heroes.map((h) => h.heroId),
    heroes,
    'Campaign roster',
  );
  sameSet(
    s.choices.map((h) => h.heroId),
    heroes,
    'Choices roster',
  );
  sameSet(s.drawOrder, heroes, 'Group draw order');
  unique(
    s.campaign.heroes.flatMap((h) => (h.roleId === null ? [] : [h.roleId])),
    'Selected roles',
  );
  const inventory = s.campaign.inventory;
  unique(
    inventory.map((i) => i.copy),
    'Campaign inventory',
  );
  const inventoryByCopy = new Map(inventory.map((i) => [i.copy, i]));
  for (const i of inventory) {
    check(i.ownerId === null || heroes.includes(i.ownerId), 'Inventory owner.');
    const card = copies.get(i.copy);
    check(
      i.kind === 'purchased' || i.kind === 'title'
        ? card?.kind === i.kind && i.ownerId !== null
        : !card,
      'Inventory card identity/kind/owner.',
    );
  }
  const ownedSkills: string[] = [],
    ownedTitles: string[] = [],
    equipment: string[] = [];
  for (const h of s.campaign.heroes) {
    check(h.roleId === null || roleIds.includes(h.roleId), 'Selected role missing.');
    unique(h.skillCopies, 'Owned skill copies');
    unique(h.titleCopies, 'Owned title copies');
    unique(
      h.balances.map((b) => b.roleId),
      'Role balances',
    );
    check(
      h.balances.every((b) => roleIds.includes(b.roleId)),
      'Balance role.',
    );
    const rosterIndex = roster.findIndex((r) => r.heroId === h.heroId),
      r = roster[rosterIndex]!;
    for (const copy of h.skillCopies) {
      const c = copies.get(copy);
      check(c, 'Unknown owned skill identity.');
      if (c.kind === 'purchased') {
        const i = inventoryByCopy.get(copy);
        check(i?.kind === 'purchased' && i.ownerId === h.heroId, 'Purchased ownership.');
      } else
        check(
          c.kind === 'basic'
            ? c.copies[rosterIndex] === copy
            : (c.kind === 'hero' && c.ownerId === h.heroId) ||
                (c.kind === 'role' && c.ownerId === r.initialRoleId),
          'Old free card ownership.',
        );
    }
    for (const copy of h.titleCopies) {
      const i = inventoryByCopy.get(copy);
      check(i?.kind === 'title' && i.ownerId === h.heroId, 'Title ownership.');
    }
    const choice = s.choices.find((c) => c.heroId === h.heroId)!;
    for (const copy of [
      ...h.itemCopies,
      ...(choice.accessory === null ? [] : [choice.accessory]),
    ]) {
      const i = inventoryByCopy.get(copy);
      check(
        i &&
          (i.ownerId === null || i.ownerId === h.heroId) &&
          i.kind === (copy === choice.accessory ? 'accessory' : 'item'),
        'Equipment ownership/kind.',
      );
      equipment.push(copy);
    }
    ownedSkills.push(...h.skillCopies);
    ownedTitles.push(...h.titleCopies);
  }
  unique(ownedSkills, 'Aggregate owned skills');
  unique(ownedTitles, 'Aggregate owned titles');
  unique(equipment, 'Selected equipment');
  for (const i of inventory)
    if (i.kind === 'purchased' || i.kind === 'title')
      check(
        (i.kind === 'purchased' ? ownedSkills : ownedTitles).includes(i.copy),
        'Owned inventory copy missing.',
      );
  const weaknessCopies = cards.filter((c) => c.kind === 'weakness').flatMap((c) => c.copies);
  sameSet(
    s.oldWeaknesses.map((w) => w.copy),
    weaknessCopies,
    'Conserved weakness pool',
  );
  for (const w of s.oldWeaknesses) {
    const r = roster.find((r) => r.heroId === w.heroId);
    check(w.episodeFingerprint === s.episode.fingerprint, 'Weakness episode lineage.');
    check(
      w.zone === 'reserve'
        ? w.heroId === null && w.playerId === null
        : r && r.playerId === w.playerId,
      'Weakness zone/ownership lineage.',
    );
  }
  const recipes = roster.map((r) =>
    deriveRecipe(s, s.campaign.heroes.find((h) => h.heroId === r.heroId)!),
  );
  for (const recipe of recipes) {
    const choice = s.choices.find((c) => c.heroId === recipe.heroId)!;
    check(
      digest(choice.recipe) === digest(recipe) && choice.summaryHash === digest(recipe),
      'Recipe/summary mismatch.',
    );
    check(
      choice.confirmedRevision === null
        ? recipe.gate !== null
        : !recipe.gate && choice.confirmedRevision <= s.revision,
      'Current confirmation required; future confirmation rejected.',
    );
  }
  return { s, recipes, copies };
}

export function capabilityFor(context: ReturnType<typeof parseSource>) {
  const { s, recipes } = context;
  const blockers = recipes.flatMap((r) => (r.gate === null ? [] : [r.gate]));
  for (const c of s.catalog.cards)
    if (c.kind === 'weakness' && c.identity !== 'bound')
      blockers.push(`Weakness identity requires content: ${c.id}.`);
  return {
    format: 'camp-decks-capability-v1' as const,
    enabled: blockers.length === 0,
    sourceFingerprint: digest(s),
    phase: 'before-activation-and-preparation-triggers' as const,
    runtimeReady: false as const,
    adventureStartEnabled: false as const,
    blockers,
    pending: [...PENDING],
  };
}
export function campDeckCapability(source: unknown) {
  return capabilityFor(parseSource(source));
}
