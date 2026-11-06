// All identities, text-free content hashes, episodes and inventories are invented.
import { createHash } from 'node:crypto';
export const canonical = (v) =>
  Array.isArray(v)
    ? `[${v.map(canonical).join(',')}]`
    : v && typeof v === 'object'
      ? `{${Object.entries(v)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([k, x]) => `${JSON.stringify(k)}:${canonical(x)}`)
          .join(',')}}`
      : JSON.stringify(v);
export const hash = (v) => createHash('sha256').update(canonical(v)).digest('hex');
export const seed = '12'.repeat(32);
const copies = (id, n = 1) => Array.from({ length: n }, (_, i) => `${id}:${i + 1}`);
export function refreshChoices(s) {
  s.choices = s.campaign.heroes.map((h) => {
    const initial = [
      ...s.catalog.cards.filter((c) => c.kind === 'basic').sort((a, b) => a.number - b.number),
      ...s.catalog.cards
        .filter((c) => c.kind === 'hero' && c.ownerId === h.heroId)
        .sort((a, b) => a.number - b.number),
      ...s.catalog.cards
        .filter((c) => c.kind === 'role' && c.ownerId === h.roleId)
        .sort((a, b) => a.number - b.number),
    ];
    const missing = initial.find(
      (c) =>
        c.identity !== 'bound' ||
        s.capability.cards.find((r) => r.cardId === c.id)?.identity !== 'bound',
    );
    const gate = !h.roleId
      ? 'Scegli un ruolo per questo eroe.'
      : missing
        ? `L’identità fonte di una carta necessaria per questo eroe o ruolo richiede ancora verifica (${missing.id}). Scegli un ruolo disponibile.`
        : h.titleCopies.some(
              (copy) => s.catalog.cards.find((c) => c.copies.includes(copy))?.identity !== 'bound',
            )
          ? 'Un titolo posseduto richiede la propria identità fonte.'
          : null;
    const recipe = {
      heroId: h.heroId,
      roleId: h.roleId,
      cards: [
        ...initial.map((c) => ({ kind: c.kind, cardId: c.id, copy: null })),
        ...s.catalog.cards
          .filter((c) => c.kind === 'purchased')
          .flatMap((c) =>
            c.copies
              .filter((copy) => h.skillCopies.includes(copy))
              .map((copy) => ({ kind: 'purchased', cardId: c.id, copy })),
          ),
        ...h.titleCopies.map((copy) => ({
          kind: 'title',
          cardId: s.catalog.cards.find((c) => c.copies.includes(copy)).id,
          copy,
        })),
      ],
      futurePrepared: initial.find((c) => c.kind === 'role' && c.number === 1)?.id ?? null,
      weakness: { count: 1, source: 'future-common-draw' },
      itemCopies: [...h.itemCopies],
      accessory: null,
      balances: structuredClone(h.balances),
      gate,
    };
    return {
      heroId: h.heroId,
      accessory: null,
      recipe,
      summaryHash: hash(recipe),
      confirmedRevision: gate ? null : 3,
    };
  });
  return s;
}
export function source(heroCount = 2) {
  const heroIds = Array.from({ length: 6 }, (_, i) => `invented-hero-${i}`);
  const roleIds = Array.from({ length: 6 }, (_, i) => `invented-role-${i}`);
  const cards = [];
  const add = (kind, ownerId, n, quantity = 1) => {
    const id = `invented-${kind}-${ownerId ?? 'common'}-${n}`;
    cards.push({
      id,
      kind,
      ownerId,
      number: n,
      copies: copies(id, quantity),
      identity: 'bound',
      definitionHash: hash({ invented: id }),
      evidence: [{ sourceId: 'invented-book', locator: `invented:${id}` }],
    });
  };
  for (let n = 1; n <= 6; n++) add('basic', null, n, 5);
  for (const hero of heroIds) for (let n = 1; n <= 5; n++) add('hero', hero, n);
  for (const role of roleIds) for (let n = 1; n <= 3; n++) add('role', role, n);
  for (let n = 1; n <= 20; n++) add('weakness', null, n);
  for (const role of roleIds) for (let n = 4; n <= 12; n++) add('purchased', role, n);
  for (let n = 1; n <= 21; n++) add('title', null, n);
  const s = {
    format: 'camp-decks-source-v1',
    revision: 9,
    catalog: { fingerprint: hash('invented-catalog'), heroIds, roleIds, cards },
    capability: {
      version: 'source-camp-preparation-v1',
      catalogFingerprint: hash('invented-catalog'),
      evidenceHash: hash('invented-capability'),
      cards: cards
        .filter((c) => ['basic', 'hero', 'role'].includes(c.kind))
        .map((c) => ({
          cardId: c.id,
          cardHash: c.definitionHash,
          kind: c.kind,
          ownerId: c.ownerId,
          number: c.number,
          identity: 'bound',
          evidence: structuredClone(c.evidence),
        })),
    },
    originalRoster: heroIds.slice(0, heroCount).map((heroId, i) => ({
      heroId,
      playerId: `invented-player-${i}`,
      initialRoleId: roleIds[i],
    })),
    episode: { id: 'invented-episode', fingerprint: hash('invented-episode'), outcome: 'loss' },
    drawOrder: heroIds.slice(0, heroCount).reverse(),
    campaign: { heroes: [], inventory: [], provenance: { history: ['invented-camp'] } },
    oldWeaknesses: [],
    choices: [],
  };
  for (const [i, r] of s.originalRoster.entries()) {
    const free = cards.filter(
      (c) =>
        c.kind === 'basic' ||
        (c.kind === 'hero' && c.ownerId === r.heroId) ||
        (c.kind === 'role' && c.ownerId === r.initialRoleId),
    );
    const purchase = cards.find((c) => c.kind === 'purchased' && c.ownerId === r.initialRoleId);
    const title = cards.filter((c) => c.kind === 'title')[i];
    const item = `invented-item-${i}:1`;
    s.campaign.heroes.push({
      heroId: r.heroId,
      roleId: roleIds[(i + 1) % 6],
      skillCopies: [...free.map((c) => c.copies[c.kind === 'basic' ? i : 0]), purchase.copies[0]],
      titleCopies: [title.copies[0]],
      itemCopies: [item],
      balances: [{ roleId: r.initialRoleId, availableXP: 11 }],
      provenance: {
        inspiration: 2,
        removedTitles: [title.copies[0]],
        previousRole: r.initialRoleId,
      },
    });
    s.campaign.inventory.push(
      { copy: purchase.copies[0], kind: 'purchased', ownerId: r.heroId },
      { copy: title.copies[0], kind: 'title', ownerId: r.heroId },
      { copy: item, kind: 'item', ownerId: r.heroId },
    );
  }
  s.oldWeaknesses = cards
    .filter((c) => c.kind === 'weakness')
    .map((c, i) => {
      const r = i < 10 ? s.originalRoster[i % heroCount] : null;
      return {
        copy: c.copies[0],
        heroId: r?.heroId ?? null,
        playerId: r?.playerId ?? null,
        zone: r ? ['deck', 'discard', 'prepared', 'revealed', 'setAside'][i % 5] : 'reserve',
        episodeFingerprint: s.episode.fingerprint,
      };
    });
  return refreshChoices(s);
}
export function grownSource() {
  const s = source();
  const h = s.campaign.heroes[0];
  for (const c of s.catalog.cards.filter((c) => c.kind === 'purchased')) {
    if (s.campaign.inventory.some((i) => i.copy === c.copies[0])) continue;
    s.campaign.inventory.push({ copy: c.copies[0], kind: 'purchased', ownerId: h.heroId });
    h.skillCopies.push(c.copies[0]);
  }
  return refreshChoices(s);
}
