import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readyBattle,
  departBattle,
  readSession,
  readBackup,
  ok,
  drainBattle,
  scenarioInput,
} from './battle-combat-helper.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';

test('performed provocations defeat real owners, cancel suspended movement and deliver the actual A2 terminal receiver once', async (t) => {
  // Finite invented blank printings make the loss deterministic through real
  // reveals and Last Stand tests, never a client-supplied pass/fail result.
  const r = await readyBattle(t, {
    outcome: 'loss',
    singleFigureGroups: true,
    catalogEdit: (c) => {
      for (const s of c.skills) {
        s.success = 0;
        s.fate = 0;
      }
      for (const h of c.heroes) {
        h.stats.might = 0;
        h.stats.spirit = 0;
        h.stats.agility = 0;
        h.stats.damage = 1;
        h.stats.fear = 1;
      }
    },
  });
  t.after(() => t.diagnostic(r.host.diagnostics()));
  await departBattle(r);
  const initial = (await readBackup(r.host)).payload.state;
  for (const actor of r.actors) {
    let s = await readSession(r.host);
    const hero = s.preparation.heroes.find((h) => h.playerId === actor.body.player.id);
    await ok(cycleCommand(r, 'START_TURN', {}, actor));
    s = await readSession(r.host);
    const start = s.journey.heroes.find((h) => h.heroId === hero.heroId).spaceId;
    const targets = new Set(
      s.scenario.enemies.groups
        .filter((g) => g.placed && !g.exhausted && g.figures.some((f) => f.health > 0))
        .map((g) => s.scenario.spaceBindings.find((b) => b.sourceId === g.spaceId).id),
    );
    const queue = [[start]],
      seen = new Set([start]);
    let route;
    while (queue.length) {
      const path = queue.shift(),
        here = path.at(-1);
      if (targets.has(here)) {
        route = path;
        break;
      }
      for (const next of s.journey.definition.connections.flatMap(([a, b]) =>
        a === here ? [b] : b === here ? [a] : [],
      ))
        if (!seen.has(next)) {
          seen.add(next);
          queue.push([...path, next]);
        }
    }
    assert.ok(
      route && route.length <= 4,
      'Complete source must permit a ready group within ordinary travel',
    );
    for (const destination of route.slice(1)) {
      s = await readSession(r.host);
      if (!s.journey.travel?.remaining) await ok(cycleCommand(r, 'START_TRAVEL', {}, actor));
      s = await readSession(r.host);
      await ok(
        cycleCommand(
          r,
          'MOVE_HERO',
          {
            fromSpaceId: s.journey.heroes.find((h) => h.heroId === hero.heroId).spaceId,
            destinationSpaceId: destination,
          },
          actor,
        ),
      );
    }
    s = await readSession(r.host);
    if (!s.journey.travel?.remaining) await ok(cycleCommand(r, 'START_TRAVEL', {}, actor));
    s = await readSession(r.host);
    const from = s.journey.heroes.find((h) => h.heroId === hero.heroId).spaceId,
      to = s.journey.definition.connections.flatMap(([a, b]) =>
        a === from ? [b] : b === from ? [a] : [],
      )[0];
    await ok(cycleCommand(r, 'MOVE_HERO', { fromSpaceId: from, destinationSpaceId: to }, actor));
    await drainBattle(r);
    const full = (await readBackup(r.host)).payload.state,
      ls = full.physical.snapshot.lastStand.heroes.find((h) => h.heroId === hero.heroId);
    assert.equal(ls.defeated, true);
    assert.equal(full.journey.heroes.find((h) => h.heroId === hero.heroId).spaceId, from);
    assert.equal(full.journey.heroes.find((h) => h.heroId === hero.heroId).removed, true);
    assert.equal(full.combat.operations.at(-1).status, 'cancelled');
    assert.equal(full.journey.travel, null);
  }
  let s = await readSession(r.host),
    full = (await readBackup(r.host)).payload.state;
  assert.ok(full.physical.snapshot.lastStand.terminal);
  assert.equal(full.scenario.conclusion.outcome, 'failure');
  assert.equal(full.scenario.conclusion.timing, 'no-active-heroes');
  assert.ok(Object.hasOwn(full.scenario.conclusion, 'episodeHash'));
  assert.equal(Object.hasOwn(s.scenario.conclusion, 'episodeHash'), false);
  assert.equal(
    full.scenario.pending.state,
    18,
    'The A2 receiver, not archived A1 or startup stub, owns failure',
  );
  for (let n = 0; n < 8 && s.scenario.conclusion.stage !== 'camp'; n++) {
    assert.ok(s.scenario.pending);
    await ok(scenarioInput(r.host, r.player, { kind: 'ack' }));
    s = await readSession(r.host);
  }
  full = (await readBackup(r.host)).payload.state;
  const c = full.scenario.conclusion;
  assert.equal(Object.hasOwn(s.scenario.conclusion, 'episodeHash'), false);
  assert.deepEqual(
    s.scenario.conclusion.campaign.heroes.map((h) => h.skillCopies),
    c.campaign.heroes.map((h) => [...h.skillCopies].sort()),
  );
  assert.equal(c.stage, 'camp');
  assert.equal(c.transitionCount, 1);
  assert.equal(c.campEntryCount, 1);
  assert.equal(
    c.nextAdventureId,
    18,
    'Invented source target is explicit, never arithmetic adventure+1',
  );
  assert.equal(full.scenario.play.lore, initial.scenario.play.lore + 1);
  assert.ok(c.xp.every((x) => x.amount === 3));
  assert.equal(c.xp.length, 3);
  assert.ok(full.combat.attempts.every((a) => a.returned));
  for (const old of initial.scenario.battle.campaign.balances) {
    const balance = c.campaign.training.balances.find(
        (b) => b.heroId === old.heroId && b.roleId === old.roleId,
      ),
      reward = c.xp.find((r) => r.heroId === old.heroId && r.roleId === old.roleId)?.amount ?? 0;
    assert.equal(balance.availableXP, old.availableXP + reward);
  }
});
