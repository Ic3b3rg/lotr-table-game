// All identities, cards, requirements and source records in this fixture are invented.
import { catalogFixture } from './catalog.mjs';
import { campCompilation } from './camp-skills.mjs';
import { hash } from './map-freeze.mjs';

export function addCampItemCards(catalog) {
  for (const hero of catalog.heroes) hero.maxHands ??= 2;
  const sword = catalog.items.find((c) => c.id === 'sword');
  const advanced = catalog.items.find((c) => c.id === 'advanced');
  sword.upgrades = ['advanced', 'invented-alternative'];
  advanced.upgrades = ['invented-final'];
  catalog.items.push(
    {
      ...structuredClone(advanced),
      id: 'invented-alternative',
      name: { ...advanced.name, text: 'Alternativa inventata' },
      upgrades: ['invented-final'],
    },
    {
      ...structuredClone(advanced),
      id: 'invented-final',
      name: { ...advanced.name, text: 'Ultimo rango inventato' },
      rank: 3,
      upgrades: [],
    },
  );
  return catalog;
}
export function campItemCatalog() {
  return addCampItemCards(catalogFixture());
}
export function attachCampItems(pack, catalog) {
  const source = { id: 'invented-items', kind: 'derived', sha256: hash('invented item evidence') };
  const refs = (name) => [{ sourceId: source.id, locator: `invented:${name}` }];
  const sources = new Map(catalog.items.map((c, n) => [c.id, `invented.assets:${15000 + n}`]));
  const cards = catalog.items.map((c, n) => ({
    cardId: c.id,
    cardHash: hash(c),
    model: {
      source: sources.get(c.id),
      modelId: 500 + n,
      objectHash: hash({ inventedItem: c.id }),
      type: { hand: 0, armor: 1, trinket: 2 }[c.slot],
      level: c.rank,
      twoHanded: c.hands === 2,
      upgradeCost: c.id === 'sword' ? 3 : 7,
      upgrades: c.upgrades.map((id) => sources.get(id)),
    },
    quantity: c.quantity,
    originalText: 'An invented item ability, awaiting its future consumer.',
    mechanics: {
      execution: 'requires-consumer',
      attackStats: [],
      depletion: c.slot === 'trinket' ? 2 : null,
      ranged: c.ranged,
      rangedMarker: null,
      clauses: ['An invented item ability, awaiting its future consumer.'],
    },
    evidence: Object.fromEntries(
      ['identity', 'quantity', 'rank', 'links', 'lore', 'icons', 'text', 'mechanics'].map((key) => [
        key,
        refs(`${c.id}:${key}`),
      ]),
    ),
  }));
  const cap = {
    version: 'source-camp-items-v1',
    evidenceHash: hash('invented complete camp item evidence'),
    catalogFingerprint: hash(catalog),
    failureFingerprint: hash(pack.manifest.failure),
    ownedProductIds: [0],
    product: {
      id: 0,
      source: 'invented.assets:14999',
      objectHash: hash('invented base product'),
      items: cards.map((c) => ({ source: c.model.source, quantity: c.quantity })),
    },
    sources: [source],
    methods: Object.fromEntries(
      [
        'highlight',
        'show',
        'hide',
        'upgrades',
        'heroInventory',
        'groupInventory',
        'confirm',
        'select',
        'item',
        'group',
        'heroes',
        'getHeroItems',
        'getGroupItems',
        'available',
        'maxCount',
        'lore',
        'upgradeable',
      ].map((name) => [
        name,
        {
          assemblyHash: pack.manifest.failure.methods.xp.assemblyHash,
          method: '06009998',
          bodyHash: hash(`invented item ${name}`),
        },
      ]),
    ),
    cards,
  };
  pack.manifest.campItems = cap;
  return cap;
}
export function campItemCompilation() {
  const input = campCompilation();
  const catalog = campItemCatalog();
  attachCampItems(input.pack, catalog);
  input.campItemsCertificate = { instructionHash: hash(input.pack.manifest.campItems) };
  return input;
}
