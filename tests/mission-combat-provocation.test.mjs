import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  readyMission,
  reachMission,
  commitMission,
  drainMission,
  ok,
} from './mission-combat-helper.mjs';
import { readSession, readBackup } from './skill-test-helper.mjs';
import { command } from './preparation-helper.mjs';
import { drainCombat } from './combat-controller-helper.mjs';

test('leaving the bound group runs the shared real provocation and returns to the exact movement once', async (t) => {
  const r = await readyMission(t, { shadow: true });
  await reachMission(r);
  await ok(commitMission(r));
  await drainMission(r);
  const before = await readSession(r.host),
    from = before.journey.heroes[0].spaceId,
    to = before.journey.definition.connections.flatMap(([a, b]) =>
      a === from ? [b] : b === from ? [a] : [],
    )[0];
  assert.ok(to);
  assert.equal(before.journey.travel.remaining, 1);
  const c = {
    type: 'MOVE_HERO',
    mapId: before.journey.id,
    heroId: before.preparation.heroes[0].heroId,
    fromSpaceId: from,
    destinationSpaceId: to,
    roundId: before.round.id,
    turnId: before.round.turnId,
    requestId: randomUUID(),
  };
  const reply = await ok(command(r.host, r.player, c, before)),
    receipt = await reply.json();
  assert.deepEqual(await (await ok(command(r.host, r.player, c, before))).json(), receipt);
  const waiting = await readSession(r.host);
  assert.equal(waiting.combat.current.kind, 'provocation');
  assert.equal(waiting.journey.heroes[0].spaceId, from);
  await drainCombat(r);
  const final = await readSession(r.host),
    state = (await readBackup(r.host)).payload.state;
  assert.equal(final.journey.heroes[0].spaceId, to);
  assert.equal(final.journey.travel.remaining, 0);
  assert.equal(final.round.heroes[0].actionsUsed, before.round.heroes[0].actionsUsed);
  assert.equal(state.combat.attempts.filter((a) => a.kind === 'provocation').length, 1);
  assert.equal(state.combat.attempts[0].returned, true);
  assert.ok(state.combat.attempts[0].packet.executed);
  assert.equal(state.scenario.firstCombat.callbacks.length, 0);
});
