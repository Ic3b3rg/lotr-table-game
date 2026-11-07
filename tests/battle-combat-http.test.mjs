import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readyBattle,
  confirmedCamp,
  finishSetup,
  scenarioInput,
  readSession,
  readBackup,
  command,
  ok,
  drainBattle,
  attackIntent,
} from './battle-combat-helper.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';
import { randomUUID } from 'node:crypto';

test('three-owner camp→battle consumes a real legal hero attack intent', async (t) => {
  const r = await readyBattle(t);
  t.after(() => t.diagnostic(r.host.diagnostics()));
  const camp = await confirmedCamp(r);
  await ok(
    scenarioInput(r.host, r.player, {
      kind: 'camp-depart',
      offerFingerprint: camp.campDeparture.fingerprint,
      agreed: true,
    }),
  );
  await finishSetup(r);
  await ok(cycleCommand(r, 'START_TURN'));
  await ok(cycleCommand(r, 'START_TRAVEL'));
  const before = (await readBackup(r.host)).payload.state,
    hero = before.preparation.heroes[0],
    from = before.journey.heroes[0].spaceId,
    adjacent = before.journey.definition.connections.flatMap(([a, b]) =>
      a === from ? [b] : b === from ? [a] : [],
    ),
    group = before.scenario.enemies.groups.find((g) =>
      adjacent.includes(before.scenario.spaceBindings.find((b) => b.sourceId === g.spaceId).id),
    );
  assert.ok(group, 'The complete invented spawn has an adjacent live group');
  const destination = before.scenario.spaceBindings.find((b) => b.sourceId === group.spaceId).id;
  await ok(cycleCommand(r, 'MOVE_HERO', { fromSpaceId: from, destinationSpaceId: destination }));
  const s = await readSession(r.host);
  assert.equal(s.journey.travel.remaining, 1);
  const offer = s.combat.attacks.find((o) => o.groupId === group.id && !o.reason),
    intent = { ...attackIntent(s, offer), requestId: randomUUID() },
    beforeAttack = await readBackup(r.host);
  const rejection = async (actor, fields, expected) => {
    const before = await readBackup(r.host),
      response = await command(r.host, actor, { ...intent, ...fields, requestId: randomUUID() }, s);
    assert.equal(response.status, expected, await response.text());
    assert.deepEqual(
      (await readBackup(r.host)).payload,
      before.payload,
      'Rejected intent must preserve the entire domain and receipts',
    );
  };
  await rejection(r.other, {}, 403);
  await rejection(r.player, { groupId: 'invented-stale-group' }, 409);
  await rejection(r.player, { itemCopies: ['invented-copy:1'] }, 409);
  await rejection(r.player, { turnId: randomUUID() }, 409);
  const replies = await Promise.all([
    command(r.host, r.player, intent, s),
    command(r.host, r.player, intent, s),
  ]);
  for (const response of replies) assert.equal(response.status, 200, await response.clone().text());
  assert.deepEqual(await replies[0].json(), await replies[1].json());
  const afterStart = await readBackup(r.host);
  assert.equal(afterStart.payload.state.round.heroes[0].actionsUsed, 2);
  assert.equal(afterStart.payload.state.combat.attempts.length, 1);
  assert.equal(afterStart.payload.state.journey.travel.remaining, 1);
  assert.equal(
    afterStart.payload.state.physical.cycle.records.filter((r) => r.intent.type === 'START_ATTACK')
      .length,
    1,
  );
  let converted = false;
  const returned = await drainBattle(r, {
    choose: (q, at) => {
      if (
        !converted &&
        at.combat.current?.stage === 'attack-test' &&
        q.options.some((o) => o.id === 'inspiration' && !o.unavailable)
      ) {
        converted = true;
        return 'inspiration';
      }
      return null;
    },
  });
  const after = (await readBackup(r.host)).payload.state,
    attempt = after.combat.attempts[0];
  assert.equal(attempt.returned, true);
  assert.equal(attempt.cost, 'action');
  assert.ok(attempt.result.hits > 0, 'Printed weapon slots must spend actual successes');
  assert.ok(attempt.applied.hits > 0);
  assert.notDeepEqual(
    after.scenario.enemies.groups.find((g) => g.id === group.id).figures,
    beforeAttack.payload.state.scenario.enemies.groups.find((g) => g.id === group.id).figures,
    'Computed hits change finite physical figures after armor/sorcery',
  );
  assert.equal(attempt.packet.executed, true, 'The actual enemy reply must execute');
  assert.equal(attempt.outcome.sealed, true);
  assert.ok(
    attempt.outcome.suffered.damage + attempt.outcome.suffered.fear > 0,
    'Physical consequences must actually be performed',
  );
  assert.equal(converted, true, 'The attack spends inspiration on actual revealed fate cards');
  assert.equal(returned.round.heroes[0].actionsUsed, 2);
  assert.equal(returned.journey.travel.remaining, 1);
  assert.equal(returned.combat.current, null);
  assert.ok(after.physical.runs.length > beforeAttack.payload.state.physical.runs.length);
  const privateOrder = JSON.stringify(after.preparation.heroes[1].deck);
  assert.ok(
    !JSON.stringify(returned).includes(privateOrder),
    'Common projection must not publish private deck order',
  );
  const retryBefore = await readBackup(r.host),
    retry = await command(r.host, r.player, intent, s);
  assert.equal(retry.status, 200, await retry.text());
  assert.deepEqual((await readBackup(r.host)).payload, retryBefore.payload);
});
