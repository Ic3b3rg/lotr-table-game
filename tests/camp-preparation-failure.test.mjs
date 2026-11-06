import test from 'node:test';
import assert from 'node:assert/strict';
import { readyFailure, defeatHero, ok } from './adventure-failure-helper.mjs';
import { endTurns } from './original-round-helper.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';
import { readSession, readBackup } from './skill-test-helper.mjs';
import { attachCampSkills } from './fixtures/camp-skills.mjs';
import { addCampItemCards, attachCampItems } from './fixtures/camp-items.mjs';
import { attachCampPreparation } from './fixtures/camp-preparation.mjs';
import { choice, confirm } from './camp-preparation-helper.mjs';

test('the real defeat consumer reaches next choices with defeated heroes campaign-active and the archived loss untouched', async (t) => {
  let catalog;
  const r = await readyFailure(
    t,
    (pack) => {
      attachCampSkills(pack, catalog);
      attachCampItems(pack, catalog);
      attachCampPreparation(pack, catalog);
    },
    (c) => {
      addCampItemCards(c);
      catalog = structuredClone(c);
    },
  );
  await defeatHero(r);
  await endTurns(r);
  await ok(cycleCommand(r, 'BEGIN_SHADOW', {}, r.other));
  for (let n = 0; n < 4; n++) await ok(scenarioInput(r.host, r.player, { kind: 'ack' }));
  let s = await readSession(r.host);
  assert.equal(s.scenario.conclusion.stage, 'camp');
  assert.equal(s.scenario.conclusion.outcome, 'failure');
  assert.ok(s.physical.lastStand.heroes.some((h) => h.defeated));
  const before = (await readBackup(r.host)).payload;
  await ok(scenarioInput(r.host, r.player, { kind: 'camp-prepare' }));
  s = await readSession(r.host);
  await ok(scenarioInput(r.host, r.player, confirm(s)));
  s = await readSession(r.host);
  assert.ok(choice(s).confirmedRevision);
  assert.ok(s.scenario.conclusion.campaign.heroes.every((h) => h.status === 'active'));
  assert.deepEqual(s.scenario.conclusion.xp, before.state.scenario.conclusion.xp);
  const after = (await readBackup(r.host)).payload;
  assert.deepEqual(after.state.physical.snapshot, before.state.physical.snapshot);
  assert.deepEqual(after.state.physical.cycle.seed, before.state.physical.cycle.seed);
  assert.equal(s.scenario.conclusion.campaign.next.status, 'requires-content');
});
