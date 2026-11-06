import { readyCamp, reachCamp } from './camp-skills-helper.mjs';
import { addCampItemCards, attachCampItems } from './fixtures/camp-items.mjs';

export function readyItemCamp(t, { lore = 3, edit = () => {}, catalogEdit = () => {} } = {}) {
  let catalog;
  return readyCamp(t, {
    catalogEdit(c) {
      addCampItemCards(c);
      catalogEdit(c);
      catalog = structuredClone(c);
    },
    edit(pack, frozen) {
      // An invented, declared source reward before startup; never a seeded camp balance.
      pack.definitions
        .find((d) => d.source === pack.principal)
        .states.find((s) => s.index === 90)
        .actions.find((a) => a.op === 'lore').amount = lore;
      attachCampItems(pack, catalog);
      edit(pack, frozen, catalog);
    },
  });
}
export function itemInput({ heroId = 'hero-1', copy = 'sword:1', upgrade = 'advanced:1' } = {}) {
  return { kind: 'camp-item', heroId, copy, upgrade };
}
export function itemHero(s, heroId = 'hero-1') {
  return s.scenario.conclusion.campaign.heroes.find((h) => h.heroId === heroId);
}
export { reachCamp, scenarioInput, readSession, readBackup, ok } from './camp-skills-helper.mjs';
