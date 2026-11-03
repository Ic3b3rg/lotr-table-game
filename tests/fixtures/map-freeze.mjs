// Invented generator/catalog mapping; never production company context.
import { createHash } from 'node:crypto';
import { encountersFixture, addEncounter, fixed } from './map-encounters.mjs';
import { ref } from './map-assembly.mjs';
import { catalogFixture } from './catalog.mjs';
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
export const hash = (value) => createHash('sha256').update(canonical(value)).digest('hex');
export function generatorFixture(catalog = catalogFixture()) {
  const input = encountersFixture();
  const s = input.assembly.selection;
  for (const t of s.standard) t.oppositeHashId = s.standard[(t.index + 60) % 120].hashId;
  s.items = catalog.items.map((v, index) => ({
    index,
    source: ref(60000 + index),
    id: 70000 + index,
    upgradeSources: [],
  }));
  for (const [i, v] of catalog.items.entries())
    s.items[i].upgradeSources = v.upgrades.map(
      (id) => s.items[catalog.items.findIndex((x) => x.id === id)].source,
    );
  s.products[0].itemQuantities = catalog.items.map((v, i) => ({
    itemSource: s.items[i].source,
    quantity: v.quantity,
  }));
  const m = addEncounter(input);
  fixed(input, 0, 0, m, 0);
  const { context, ...selection } = s;
  return {
    formatVersion: 1,
    algorithm: 'session-A1-generator-pack-v1',
    catalog: { id: catalog.id, fingerprint: hash(catalog), sources: catalog.sources },
    identity: { adventureId: 1, adventureSource: ref(80000), builderSource: ref(80001) },
    campaign: { language: 'Italian', ownedProductIds: [0], groupItemCatalogIds: [] },
    mapping: {
      heroes: catalog.heroes.map((h, i) => ({
        catalogId: h.id,
        id: 800 + i,
        source: ref(81000 + i),
      })),
      items: catalog.items.map((v, i) => ({
        catalogId: v.id,
        id: s.items[i].id,
        source: s.items[i].source,
      })),
    },
    template: { selection, geometry: input.assembly.geometry, placement: input.placement },
  };
}
