import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readyItemCamp,
  reachCamp,
  itemInput,
  itemHero,
  scenarioInput,
  readSession,
  readBackup,
  ok,
} from './camp-items-helper.mjs';

test('HTTP/SQLite camp upgrade replaces the actual owned copy and records its source requirement without spending lore or XP', async (t) => {
  const r = await readyItemCamp(t);
  const camp = await reachCamp(r);
  assert.equal(camp.scenario.play.lore, 3);
  const before = (await readBackup(r.host)).payload;
  const input = itemInput();
  const response = await (await ok(scenarioInput(r.host, r.player, input))).json();
  const after = (await readBackup(r.host)).payload;
  const s = await readSession(r.host);
  assert.deepEqual(itemHero(s).itemCopies, ['advanced:1', 'armor:1']);
  assert.deepEqual(response.receipt.item, {
    heroId: 'hero-1',
    copy: 'sword:1',
    upgrade: 'advanced:1',
    fromModelId: 500,
    toModelId: 505,
    fromRank: 1,
    toRank: 2,
    threshold: 3,
    lore: 3,
  });
  assert.equal(s.scenario.play.lore, 3);
  assert.deepEqual(s.scenario.conclusion.xp, camp.scenario.conclusion.xp);
  assert.deepEqual(
    s.scenario.conclusion.campaign.training,
    camp.scenario.conclusion.campaign.training,
  );
  assert.deepEqual(after.state.preparation, before.state.preparation);
  assert.deepEqual(after.state.physical.snapshot, before.state.physical.snapshot);
  assert.deepEqual(after.state.physical.cycle.seed, before.state.physical.cycle.seed);
  assert.equal(after.state.physical.cycle.records.at(-1).intent.input.kind, 'camp-item');
  assert.equal((await scenarioInput(r.host, r.player, input)).status, 409);
  assert.deepEqual((await readBackup(r.host)).payload, after);
});
