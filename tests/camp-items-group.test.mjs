import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readyGroupItemCamp,
  reachGroupCamp,
  scenarioInput,
  readSession,
  readBackup,
  ok,
} from './camp-items-group-helper.mjs';
import { itemInput } from './camp-items-helper.mjs';

test('a real source accessory returns to common camp inventory and upgrades there without inventing a personal owner or changing historical custody', async (t) => {
  const r = await readyGroupItemCamp(t),
    camp = await reachGroupCamp(r),
    before = (await readBackup(r.host)).payload;
  const common = itemInput({ heroId: null, copy: 'trinket:1', upgrade: 'invented-trinket-2:1' });
  for (const heroId of ['hero-1', 'hero-2']) {
    assert.equal(
      (await scenarioInput(r.host, r.player, { ...common, heroId })).status,
      heroId === 'hero-1' ? 409 : 403,
    );
    assert.deepEqual((await readBackup(r.host)).payload, before);
  }
  const receipt = (await (await ok(scenarioInput(r.host, r.other, common))).json()).receipt;
  assert.deepEqual(receipt.item, {
    heroId: null,
    copy: 'trinket:1',
    upgrade: 'invented-trinket-2:1',
    fromModelId: 9003,
    toModelId: 9004,
    fromRank: 1,
    toRank: 2,
    threshold: 26,
    lore: 30,
  });
  const s = await readSession(r.host),
    after = (await readBackup(r.host)).payload;
  assert.deepEqual(s.scenario.conclusion.campaign.inventory, [
    { copy: 'invented-trinket-2:1', cardId: 'invented-trinket-2', modelId: 9004 },
  ]);
  assert.deepEqual(s.scenario.conclusion.campaign.heroes, camp.scenario.conclusion.campaign.heroes);
  assert.deepEqual(after.state.physical.snapshot, before.state.physical.snapshot);
  assert.deepEqual(after.state.physical.cycle.seed, before.state.physical.cycle.seed);
  assert.deepEqual(s.scenario.conclusion.xp, camp.scenario.conclusion.xp);
  assert.equal(s.scenario.play.lore, 30);
  assert.equal(
    (
      await scenarioInput(
        r.host,
        r.player,
        itemInput({ heroId: null, copy: 'invented-trinket-2:1', upgrade: 'invented-trinket-3:1' }),
      )
    ).status,
    409,
  );
  assert.deepEqual((await readBackup(r.host)).payload, after);
});
