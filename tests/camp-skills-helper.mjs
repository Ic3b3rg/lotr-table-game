import assert from 'node:assert/strict';
import {
  readyLair,
  reachLair,
  commitLair,
  finishPhysical,
  ok,
} from './lair-victory-http-helper.mjs';
import { attachCampSkills } from './fixtures/camp-skills.mjs';
import { scenarioInput } from './scenario-helper.mjs';
import { readSession, readBackup } from './skill-test-helper.mjs';

export async function readyCamp(t, { reward = 6, edit = () => {}, catalogEdit = () => {} } = {}) {
  return readyLair(t, {
    catalogEdit(c) {
      for (const h of c.heroes) h.stats.wit = 6;
      catalogEdit(c);
    },
    edit(pack, frozen) {
      pack.definitions
        .find((d) => d.source === pack.principal)
        .states.find((s) => s.index === 90)
        .actions.find((a) => a.op === 'awardXP').amount = reward;
      attachCampSkills(pack).catalogFingerprint =
        frozen.mapGeneration.projection.context.catalogFingerprint;
      edit(pack, frozen);
    },
  });
}

export async function reachCamp(r) {
  await reachLair(r);
  await ok(commitLair(r));
  const tested = await finishPhysical(r);
  assert.equal(tested.scenario.play.tests[0].total, 6);
  for (let n = 0; n < 3; n++) await ok(scenarioInput(r.host, r.player, { kind: 'ack' }));
  const s = await readSession(r.host);
  assert.equal(s.scenario.conclusion.stage, 'camp');
  return s;
}

export function offer(s, roleId = 'role-1', n = 0) {
  return s.scenario.pack.manifest.campSkills.roles.find((r) => r.id === roleId).upgrades[n];
}
export function buyInput(
  s,
  { heroId = 'hero-1', roleId = 'role-1', n = 0, operation = 'buy' } = {},
) {
  return { kind: 'camp-skill', heroId, roleId, copy: offer(s, roleId, n).copy, operation };
}
export function training(s) {
  return s.scenario.conclusion.campaign.training;
}
export function campaignHero(s, heroId = 'hero-1') {
  return s.scenario.conclusion.campaign.heroes.find((h) => h.heroId === heroId);
}
export { scenarioInput, readSession, readBackup, ok };
