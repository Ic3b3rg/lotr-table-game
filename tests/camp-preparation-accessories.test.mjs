import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  readyGroupItemCamp,
  reachGroupCamp,
  scenarioInput,
  readSession,
  readBackup,
  ok,
} from './camp-items-group-helper.mjs';
import { attachCampPreparation } from './fixtures/camp-preparation.mjs';
import { choice, confirm } from './camp-preparation-helper.mjs';
import { itemInput } from './camp-items-helper.mjs';

test('a real common copy is optional, exclusive, owner-released and never stolen; contenders retry the entire winning result', async (t) => {
  const r = await readyGroupItemCamp(t, {
    edit(pack, _, catalog) {
      attachCampPreparation(pack, catalog);
    },
  });
  const camp = await reachGroupCamp(r),
    archive = (await readBackup(r.host)).payload;
  await ok(scenarioInput(r.host, r.player, { kind: 'camp-prepare' }));
  let s = await readSession(r.host);
  const actors = [r.player, r.other],
    ids = [randomUUID(), randomUUID()];
  const inputs = actors.map((_, n) => ({
    kind: 'camp-accessory',
    heroId: `hero-${n + 1}`,
    copy: 'trinket:1',
  }));
  const replies = await Promise.all(
    actors.map((a, n) => scenarioInput(r.host, a, inputs[n], { requestId: ids[n] }, s)),
  );
  assert.deepEqual(replies.map((r) => r.status).sort(), [200, 409]);
  const winner = replies.findIndex((r) => r.status === 200),
    loser = 1 - winner,
    result = await replies[winner].json();
  assert.deepEqual(
    await (
      await ok(scenarioInput(r.host, actors[winner], inputs[winner], { requestId: ids[winner] }, s))
    ).json(),
    result,
  );
  s = await readSession(r.host);
  assert.equal(s.scenario.conclusion.campaign.inventory.length, 1);
  assert.equal(
    s.scenario.conclusion.campaign.preparation.heroes.filter((h) => h.accessory).length,
    1,
  );
  const before = (await readBackup(r.host)).payload;
  assert.equal((await scenarioInput(r.host, actors[loser], inputs[loser])).status, 409);
  assert.equal(
    (
      await scenarioInput(r.host, actors[loser], {
        kind: 'camp-accessory',
        heroId: `hero-${winner + 1}`,
        copy: null,
      })
    ).status,
    403,
  );
  assert.deepEqual((await readBackup(r.host)).payload, before);
  await ok(scenarioInput(r.host, actors[winner], confirm(s, `hero-${winner + 1}`)));
  await ok(scenarioInput(r.host, actors[winner], { ...inputs[winner], copy: null }));
  assert.equal(choice(await readSession(r.host), `hero-${winner + 1}`).confirmedRevision, null);
  await ok(scenarioInput(r.host, actors[loser], inputs[loser]));
  s = await readSession(r.host);
  await ok(scenarioInput(r.host, actors[loser], confirm(s, `hero-${loser + 1}`)));
  await ok(scenarioInput(r.host, r.player, { kind: 'camp-return' }));
  await ok(
    scenarioInput(
      r.host,
      actors[winner],
      itemInput({ heroId: null, copy: 'trinket:1', upgrade: 'invented-trinket-2:1' }),
    ),
  );
  s = await readSession(r.host);
  assert.equal(choice(s, `hero-${loser + 1}`).accessory, 'invented-trinket-2:1');
  assert.equal(choice(s, `hero-${loser + 1}`).confirmedRevision, null);
  assert.equal(s.scenario.conclusion.campaign.inventory.length, 1);
  assert.equal(s.scenario.conclusion.campaign.inventory[0].copy, 'invented-trinket-2:1');
  await ok(scenarioInput(r.host, actors[loser], { kind: 'camp-prepare' }));
  const retained = (await readBackup(r.host)).payload;
  assert.equal(
    (
      await scenarioInput(r.host, actors[winner], {
        kind: 'camp-accessory',
        heroId: `hero-${loser + 1}`,
        copy: null,
      })
    ).status,
    403,
  );
  assert.deepEqual((await readBackup(r.host)).payload, retained);
  await ok(
    scenarioInput(r.host, actors[loser], {
      kind: 'camp-accessory',
      heroId: `hero-${loser + 1}`,
      copy: null,
    }),
  );
  assert.equal(choice(await readSession(r.host), `hero-${loser + 1}`).accessory, null);
  const after = (await readBackup(r.host)).payload;
  assert.deepEqual(after.state.physical.snapshot, archive.state.physical.snapshot);
  assert.deepEqual(after.state.physical.cycle.seed, archive.state.physical.cycle.seed);
  assert.deepEqual(after.state.preparation, archive.state.preparation);
  assert.deepEqual(after.state.journey, archive.state.journey);
  assert.deepEqual(after.state.round, archive.state.round);
  assert.deepEqual(
    s.scenario.conclusion.campaign.training,
    camp.scenario.conclusion.campaign.training,
  );
  assert.equal(s.scenario.play.lore, camp.scenario.play.lore);
});
