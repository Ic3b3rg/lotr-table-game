import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readyCamp,
  reachCamp,
  buyInput,
  training,
  campaignHero,
  scenarioInput,
  readSession,
  readBackup,
  ok,
} from './camp-skills-helper.mjs';

test('HTTP/SQLite camp purchase changes the real campaign inventory and role balance once, preserving reward and episode', async (t) => {
  const r = await readyCamp(t);
  let s = await reachCamp(r);
  const before = (await readBackup(r.host)).payload;
  const input = buyInput(s);
  const receipt = (await (await ok(scenarioInput(r.host, r.player, input))).json()).receipt;
  s = await readSession(r.host);
  assert.deepEqual(training(s).balances, [
    { heroId: 'hero-1', roleId: 'role-1', availableXP: 4 },
    { heroId: 'hero-2', roleId: 'role-2', availableXP: 6 },
  ]);
  assert.ok(campaignHero(s).skillCopies.includes(input.copy));
  assert.deepEqual(receipt.skill, {
    heroId: input.heroId,
    roleId: input.roleId,
    copy: input.copy,
    operation: 'buy',
    cost: 2,
    before: 6,
    after: 4,
  });
  const after = (await readBackup(r.host)).payload;
  assert.deepEqual(after.state.scenario.conclusion.xp, before.state.scenario.conclusion.xp);
  assert.deepEqual(after.state.preparation, before.state.preparation);
  assert.deepEqual(after.state.physical.cycle.seed, before.state.physical.cycle.seed);
  assert.equal(after.state.physical.cycle.records.at(-1).intent.input.kind, 'camp-skill');
  assert.equal((await scenarioInput(r.host, r.player, input)).status, 409);
  assert.deepEqual((await readBackup(r.host)).payload, after);
});
