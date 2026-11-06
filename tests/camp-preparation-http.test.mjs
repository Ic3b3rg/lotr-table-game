import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readyPreparation,
  reachCamp,
  scenarioInput,
  readSession,
  readBackup,
  ok,
  choice,
  confirm,
} from './camp-preparation-helper.mjs';

test('HTTP/SQLite next choices begin with current roles and confirm a source recipe while departure stays gated', async (t) => {
  const r = await readyPreparation(t);
  const camp = await reachCamp(r),
    before = (await readBackup(r.host)).payload;
  await ok(scenarioInput(r.host, r.player, { kind: 'camp-prepare' }));
  let s = await readSession(r.host);
  assert.equal(s.scenario.conclusion.stage, 'camp-preparation');
  const h = choice(s);
  assert.equal(h.recipe.roleId, 'role-1');
  assert.equal(h.accessory, null);
  assert.equal(h.confirmedRevision, null);
  assert.deepEqual(
    h.recipe.cards.map((c) => c.kind),
    [...Array(6).fill('basic'), ...Array(5).fill('hero'), ...Array(3).fill('role')],
  );
  assert.equal(h.recipe.futurePrepared, 'role-1-skill-1');
  assert.deepEqual(h.recipe.weakness, { count: 1, source: 'future-common-draw' });
  const reply = await (await ok(scenarioInput(r.host, r.player, confirm(s)))).json();
  s = await readSession(r.host);
  assert.equal(choice(s).confirmedRevision, s.revision);
  assert.equal(reply.receipt.kind, 'camp-confirm');
  assert.deepEqual(
    reply.receipt.preparation.heroes,
    s.scenario.conclusion.campaign.preparation.heroes,
  );
  await ok(scenarioInput(r.host, r.other, confirm(s, 'hero-2')));
  s = await readSession(r.host);
  assert.ok(s.scenario.conclusion.campaign.preparation.heroes.every((h) => h.confirmedRevision));
  const saved = (await readBackup(r.host)).payload;
  assert.equal((await scenarioInput(r.host, r.player, { kind: 'ack' })).status, 409);
  assert.deepEqual((await readBackup(r.host)).payload, saved);
  assert.deepEqual(saved.state.preparation, before.state.preparation);
  assert.deepEqual(saved.state.physical.snapshot, before.state.physical.snapshot);
  assert.deepEqual(saved.state.physical.cycle.seed, before.state.physical.cycle.seed);
  assert.deepEqual(saved.state.journey, before.state.journey);
  assert.deepEqual(saved.state.round, before.state.round);
  assert.deepEqual(
    s.scenario.conclusion.campaign.training,
    camp.scenario.conclusion.campaign.training,
  );
  assert.deepEqual(s.scenario.conclusion.xp, camp.scenario.conclusion.xp);
  assert.equal(s.scenario.play.lore, camp.scenario.play.lore);
});
