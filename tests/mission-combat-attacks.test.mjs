import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readyMission,
  reachMission,
  commitMission,
  drainMission,
  ok,
  strongInventedWeapons,
} from './mission-combat-helper.mjs';
import { readSession, readBackup } from './skill-test-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';
import { command } from './preparation-helper.mjs';
import { drainCombat } from './combat-controller-helper.mjs';

async function variant(t, edit) {
  const r = await readyMission(t, { edit });
  await reachMission(r);
  await ok(commitMission(r, 'PUSH'));
  const s = await drainMission(r, { pause: (s) => s.scenario.pending?.kind === 'source-attack' });
  assert.equal(s.scenario.pending?.kind, 'source-attack');
  assert.ok(s.physical.boons.held.some((b) => b.kind === 'emboldened'));
  return { r, s };
}
test('only a successful variant offers a source-bound optional attack and declining returns once without another cost', async (t) => {
  const { r, s } = await variant(t),
    used = s.round.heroes[0].actionsUsed;
  assert.ok(s.combat.grant);
  assert.ok(s.combat.attacks.length);
  assert.ok(s.combat.attacks.every((a) => a.groupId === s.scenario.firstCombat.spawns[0].groupId));
  const before = await readBackup(r.host);
  const denied = await scenarioInput(r.host, r.other, {
    kind: 'choice',
    event: 'decline-source-attack',
  });
  assert.equal(denied.status, 403);
  assert.deepEqual((await readBackup(r.host)).payload, before.payload);
  await ok(scenarioInput(r.host, r.player, { kind: 'choice', event: 'decline-source-attack' }));
  const final = await drainMission(r);
  assert.equal(final.round.heroes[0].actionsUsed, used);
  assert.equal(final.scenario.firstCombat.spawns[0].grant, 'declined');
  assert.equal(final.scenario.firstCombat.spawns[0].returned, true);
  assert.equal(final.combat.grant, null);
  assert.equal(final.scenario.play.active, null);
});

test('a granted attack uses real cards and weapon spending, defeats the group and returns through its source callback once', async (t) => {
  const { r, s } = await variant(t, strongInventedWeapons),
    grant = s.combat.grant,
    offer = s.combat.attacks.find((a) => !a.reason),
    used = s.round.heroes[0].actionsUsed;
  assert.ok(offer);
  await ok(
    command(
      r.host,
      r.player,
      {
        type: 'START_ATTACK',
        roundId: s.round.id,
        turnId: s.round.turnId,
        heroId: offer.heroId,
        groupId: offer.groupId,
        itemCopies: offer.itemCopies,
        stat: offer.stat,
        replaceCopy: null,
        grantId: grant.id,
      },
      s,
    ),
  );
  for (let n = 0; n < 8; n++) {
    await drainCombat(
      r,
      (q) => q.options?.find((o) => o.id.startsWith('slot:') && !o.unavailable)?.id ?? null,
      (s) => !!s.scenario.pending,
    );
    const at = await readSession(r.host);
    if (at.scenario.pending) await drainMission(r);
    if (!(await readSession(r.host)).combat.current) break;
  }
  const b = (await readBackup(r.host)).payload.state,
    sc = b.scenario,
    spawn = sc.firstCombat.spawns[0],
    group = sc.enemies.groups.find((g) => g.id === spawn.groupId);
  assert.equal(b.round.heroes[0].actionsUsed, used);
  assert.equal(spawn.grant, 'used');
  assert.equal(spawn.returned, true);
  const attack = b.combat.attempts.find((a) => a.id === spawn.attackId);
  assert.equal(attack.cost, 'grant');
  assert.equal(attack.applied.defeated, true);
  assert.ok(attack.result.hits >= 10);
  assert.ok(attack.result.allocations.length);
  assert.ok(group.figures.every((f) => f.health === 0));
  assert.equal(group.placed, false);
  assert.equal(sc.firstCombat.callbacks.length, 1);
  assert.equal(sc.firstCombat.callbacks[0].cause, 'defeated');
  assert.equal(sc.firstCombat.callbacks[0].returned, true);
  assert.equal(sc.play.lore, 2); // The invented callback awards two; the original is checked separately.
  assert.equal(sc.objective.id, 2, 'the callback objective survives the principal return');
  assert.match(sc.objective.text.map((t) => t.text ?? '').join(''), /3/);
  assert.equal(sc.play.active, null);
  assert.equal(b.combat.active, null);
  const logic = sc.instances.find((i) => i.id === spawn.logicInstanceId);
  assert.equal(logic.stopped, true);
  assert.ok(
    sc.tiles
      .filter((t) =>
        r.frozen.mapGeneration.projection.sections
          .find((s) => s.id === 2)
          .tiles.some((x) => x.source === t.source),
      )
      .every((t) => t.visible && !t.explored),
  );
});
