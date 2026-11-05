import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readyMission,
  reachMission,
  commitMission,
  drainMission,
  ok,
} from './mission-combat-helper.mjs';
import { readBackup } from './skill-test-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';

for (const c of [
  { event: 'TALK', success: 0, stat: null, total: null, boon: null, fear: 0, grant: 'none' },
  { event: 'PUSH', success: 0, stat: 'might', total: 0, boon: null, fear: 2, grant: 'none' },
  {
    event: 'PUSH',
    success: 1,
    might: 2,
    stat: 'might',
    total: 2,
    boon: null,
    fear: 0,
    grant: 'none',
  },
  {
    event: 'PUSH',
    success: 1,
    stat: 'might',
    total: 3,
    boon: 'emboldened',
    fear: 0,
    grant: 'offered',
  },
  { event: 'SLIP', success: 0, stat: 'agility', total: 0, boon: null, fear: 0, grant: 'none' },
  { event: 'SLIP', success: 1, stat: 'agility', total: 2, boon: 'hidden', fear: 0, grant: 'none' },
]) {
  test(`real persona ${c.event}/${c.total ?? 'resource'} routes literal sums, physical outcomes and its exact grant`, async (t) => {
    const r = await readyMission(t, c),
      at = await reachMission(r),
      before = (await readBackup(r.host)).payload.state;
    await ok(commitMission(r, c.event));
    await drainMission(r, { pause: (s) => s.scenario.pending?.kind === 'source-attack' });
    let state = (await readBackup(r.host)).payload.state;
    const sc = state.scenario,
      spawn = sc.firstCombat.spawns[0];
    assert.equal(state.round.heroes[0].actionsUsed, at.round.heroes[0].actionsUsed + 1);
    assert.equal(sc.play.attempts.length, 1);
    assert.equal(sc.play.tests.length, c.stat ? 1 : 0);
    if (c.stat) {
      const result = sc.play.tests[0];
      assert.equal(result.stat, c.stat);
      assert.equal(result.target, null);
      assert.equal(result.successes, c.total);
      assert.equal(result.total, c.total);
      assert.equal(result.heroId, state.preparation.heroes[0].heroId);
    }
    assert.equal(
      state.physical.snapshot.areas.reduce((n, h) => n + h.fear.length, 0),
      c.fear,
    );
    const custody = state.physical.snapshot.resolution.resources.boonCustody;
    assert.equal(custody.length, c.boon ? 1 : 0);
    if (c.boon) assert.equal(custody[0].kind, c.boon);
    if (!c.stat)
      assert.equal(
        state.preparation.heroes[0].inspiration,
        Math.min(
          before.content.heroes[0].stats.inspiration,
          before.preparation.heroes[0].inspiration + 1,
        ),
      );
    assert.equal(spawn.grant, c.grant);
    assert.equal(spawn.outcome, 'spawned');
    assert.equal(sc.enemies.groups.find((g) => g.id === spawn.groupId).figures.length, 2);
    if (spawn.grant === 'offered') {
      await ok(scenarioInput(r.host, r.player, { kind: 'choice', event: 'decline-source-attack' }));
      await drainMission(r);
    }
    state = (await readBackup(r.host)).payload.state;
    assert.equal(state.scenario.play.attempts[0].returned, true);
    assert.equal(state.scenario.firstCombat.spawns[0].returned, true);
  });
}

test('a conversion consumes an actual fate card and inspiration and retains the actor and literal total', async (t) => {
  const r = await readyMission(t, { success: 1, fate: 1, might: 1 });
  await reachMission(r);
  const before = (await readBackup(r.host)).payload.state;
  assert.ok(before.preparation.heroes[0].inspiration > 0);
  await ok(commitMission(r, 'PUSH'));
  await drainMission(r, { convert: 1 });
  const s = (await readBackup(r.host)).payload.state;
  assert.equal(s.scenario.play.tests[0].total, 2);
  assert.equal(s.scenario.play.tests[0].successes, 2);
  assert.equal(s.preparation.heroes[0].inspiration, before.preparation.heroes[0].inspiration - 1);
  assert.ok(s.physical.runs.some((r) => r.answers.some((a) => a.input.option === 'inspiration')));
  assert.equal(s.scenario.firstCombat.spawns[0].grant, 'none');
});

test('the uncommitted cancel event cannot create a paid visit or a command receipt', async (t) => {
  const r = await readyMission(t);
  await reachMission(r);
  const before = (await readBackup(r.host)).payload;
  assert.equal((await commitMission(r, 'CANCEL')).status, 409);
  const after = (await readBackup(r.host)).payload;
  assert.deepEqual(after, before);
});
