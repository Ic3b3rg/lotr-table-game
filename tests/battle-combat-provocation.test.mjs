import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  readyBattle,
  departBattle,
  enterAdjacentEnemy,
  readSession,
  readBackup,
  ok,
  command,
  drainBattle,
} from './battle-combat-helper.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';

test('a real movement offers ready-group order and returns once with the original actor, position and residual', async (t) => {
  // A separate finite invented printing has single-figure groups, both source
  // instruction candidates and the complete two-model/bonus pool. No seed filtering.
  const r = await readyBattle(t, { singleFigureGroups: true });
  t.after(() => t.diagnostic(r.host.diagnostics()));
  await departBattle(r);
  const { from, destination } = await enterAdjacentEnemy(r),
    before = await readBackup(r.host);
  const s = await readSession(r.host),
    intent = {
      type: 'MOVE_HERO',
      mapId: s.journey.id,
      roundId: s.round.id,
      turnId: s.round.turnId,
      heroId: s.round.activeHeroId,
      fromSpaceId: destination,
      destinationSpaceId: from,
      requestId: randomUUID(),
    };
  const replies = await Promise.all([
    command(r.host, r.player, intent, s),
    command(r.host, r.player, intent, s),
  ]);
  for (const response of replies) assert.equal(response.status, 200, await response.clone().text());
  assert.deepEqual(await replies[0].json(), await replies[1].json());
  const offered = await readSession(r.host),
    q = offered.combat.pending;
  assert.ok(
    q && q.options.length >= 2,
    'The live complete source must offer multiple ready groups',
  );
  assert.equal(offered.journey.heroes[0].spaceId, destination);
  assert.equal(offered.journey.travel.remaining, 1, 'The suspended movement is not spent early');
  const chosen = q.options.at(-1).id;
  const denied = await readBackup(r.host),
    bad = await command(r.host, r.other, {
      type: 'COMBAT_INPUT',
      combatId: q.combatId,
      pendingId: q.id,
      sourceFingerprint: q.sourceFingerprint,
      choice: chosen,
    });
  assert.equal(bad.status, 403, await bad.text());
  assert.deepEqual((await readBackup(r.host)).payload, denied.payload);
  await ok(
    command(r.host, r.player, {
      type: 'COMBAT_INPUT',
      combatId: q.combatId,
      pendingId: q.id,
      sourceFingerprint: q.sourceFingerprint,
      choice: chosen,
    }),
  );
  assert.equal((await readBackup(r.host)).payload.state.combat.operation.provoked[0], chosen);
  const returned = await drainBattle(r),
    after = (await readBackup(r.host)).payload.state;
  assert.equal(returned.combat.current, null);
  assert.equal(returned.combat.pending, null);
  assert.equal(returned.journey.heroes[0].spaceId, from);
  assert.equal(returned.journey.travel.remaining, 0);
  assert.equal(returned.round.heroes[0].actionsUsed, 1);
  assert.equal(after.combat.operation, null);
  assert.equal(after.combat.operations.length, 1);
  const op = after.combat.operations[0];
  assert.equal(op.status, 'returned');
  assert.equal(op.playerId, r.player.body.player.id);
  assert.equal(op.origin.fromSpaceId, destination);
  assert.equal(op.origin.destinationSpaceId, from);
  assert.equal(op.origin.turnId, s.round.turnId);
  assert.deepEqual(new Set(op.provoked), new Set(q.options.map((o) => o.id)));
  assert.equal(
    after.physical.cycle.records.filter((x) => x.requestId === intent.requestId).length,
    1,
  );
  for (const attempt of after.combat.attempts) {
    assert.equal(attempt.kind, 'provocation');
    assert.equal(attempt.returned, true);
    assert.equal(attempt.packet.executed, true);
    assert.equal(attempt.outcome.sealed, true);
  }
  assert.ok(after.physical.runs.length > before.payload.state.physical.runs.length);
  const retry = await readBackup(r.host);
  await ok(command(r.host, r.player, intent, s));
  assert.deepEqual((await readBackup(r.host)).payload, retry.payload);
});
