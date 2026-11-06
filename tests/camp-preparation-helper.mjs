import {
  readyItemCamp,
  reachCamp,
  scenarioInput,
  readSession,
  readBackup,
  ok,
} from './camp-items-helper.mjs';
import { attachCampPreparation } from './fixtures/camp-preparation.mjs';

export function readyPreparation(t, options = {}) {
  return readyItemCamp(t, {
    ...options,
    edit(pack, frozen, catalog) {
      attachCampPreparation(pack, catalog);
      options.edit?.(pack, frozen, catalog);
    },
  });
}
export const choice = (s, heroId = 'hero-1') =>
  s.scenario.conclusion.campaign.preparation.heroes.find((h) => h.heroId === heroId);
export const confirm = (s, heroId = 'hero-1') => ({
  kind: 'camp-confirm',
  heroId,
  summaryHash: choice(s, heroId).summaryHash,
});
export { reachCamp, scenarioInput, readSession, readBackup, ok };
