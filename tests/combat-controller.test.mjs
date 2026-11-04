import test from 'node:test';
import { digest } from '../dist/map-freeze-library.mjs';
import assert from 'node:assert/strict';
import { readyCombat, drainCombat } from './combat-controller-helper.mjs';
import { readSession, readBackup } from './skill-test-helper.mjs';
import { command } from './preparation-helper.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';
import { sourceCatalog } from './original-encounter-helper.mjs';
import { startHost } from './host-helper.mjs';
import { join } from 'node:path';

const start = (ready, s, option = s.combat.attacks.find((o) => !o.reason), requestId) =>
  command(
    ready.host,
    ready.player,
    {
      ...(requestId ? { requestId } : {}),
      type: 'START_ATTACK',
      roundId: s.round.id,
      turnId: s.round.turnId,
      heroId: option.heroId,
      groupId: option.groupId,
      itemCopies: option.itemCopies,
      stat: option.stat,
      replaceCopy: null,
      grantId: null,
    },
    s,
  );

test('original ledger pays and reveals atomically, rejects stale/foreign values and completes zero-hit attack/counter/return', async (t) => {
  const ready = await readyCombat(t);
  const before = await readBackup(ready.host);
  const s = await readSession(ready.host);
  assert.ok(s.combat.attacks.length);
  const option = s.combat.attacks.find((o) => !o.reason);
  assert.ok(option);
  const pair = await Promise.all([
    start(ready, s, option, 'invented-attack-retry-0000001'),
    start(ready, s, option, 'invented-attack-retry-0000001'),
  ]);
  const bodies = await Promise.all(
    pair.map(async (r) => {
      assert.equal(r.status, 200, await r.clone().text());
      return r.json();
    }),
  );
  assert.deepEqual(bodies[0], bodies[1]);
  const paid = await readBackup(ready.host);
  assert.equal(
    paid.payload.state.round.heroes[0].actionsUsed,
    before.payload.state.round.heroes[0].actionsUsed + 1,
  );
  assert.ok(paid.payload.state.physical.snapshot.resolution.revealed.length);
  assert.deepEqual(
    paid.payload.state.physical.cycle.seed,
    before.payload.state.physical.cycle.seed,
  );
  assert.equal((await start(ready, s, option)).status, 409);
  const after = await drainCombat(ready);
  assert.equal(after.round.activeHeroId, option.heroId);
  assert.equal(after.combat.current, null);
  const backup = await readBackup(ready.host);
  const attempt = backup.payload.state.combat.attempts.at(-1);
  assert.equal(attempt.result.hits, 0);
  assert.equal(attempt.stage, 'completed');
  assert.ok(attempt.selection);
  if (attempt.packet.executed) assert.equal(attempt.outcome.recipientHeroId, option.heroId);
  assert.deepEqual(backup.payload.state.mapGeneration, before.payload.state.mapGeneration);
});

test('closure gate sees an unselected mandatory benefit instruction before any cost and preserves candidates', async (t) => {
  const ready = await readyCombat(t, (src) => {
    src.additions[0].effect = { op: 'gain-boon', boon: 'hidden' };
    const instruction = src.assets.find((a) => a.source === 'fixture.assets:51');
    instruction.data.MinGroupSize = 1;
    instruction.dataHash = digest(instruction.data);
  });
  const before = await readBackup(ready.host);
  const s = await readSession(ready.host);
  const option = s.combat.attacks[0];
  assert.match(option.reason, /benefic/i);
  const r = await start(ready, s, option);
  assert.equal(r.status, 409);
  assert.deepEqual((await readBackup(ready.host)).payload, before.payload);
});

test('provocation suspends a real movement, resolves its physical consumer and returns once without exhausting the group', async (t) => {
  const ready = await readyCombat(t);
  let s = await readSession(ready.host);
  const hero = s.preparation.heroes[0],
    at = s.journey.heroes.find((h) => h.heroId === hero.heroId);
  const groups = s.scenario.enemies.groups.filter((g) => g.figures.some((f) => f.health > 0));
  const here = s.scenario.spaceBindings.find((b) => b.id === at.spaceId).sourceId;
  const provoking = groups.find((g) => g.spaceId === here) ?? groups[0];
  const target = s.scenario.spaceBindings.find((b) => b.sourceId === provoking.spaceId).id;
  const queue = [[at.spaceId]],
    seen = new Set([at.spaceId]);
  let path;
  while (queue.length) {
    const p = queue.shift();
    if (p.at(-1) === target) {
      path = p;
      break;
    }
    for (const [a, b] of s.journey.definition.connections) {
      const next = a === p.at(-1) ? b : b === p.at(-1) ? a : null;
      if (next && !seen.has(next)) {
        seen.add(next);
        queue.push([...p, next]);
      }
    }
  }
  assert.ok(path && path.length <= 3);
  let r;
  if (!s.journey.travel?.remaining) {
    r = await cycleCommand(ready, 'START_TRAVEL');
    assert.equal(r.status, 200, await r.text());
  }
  for (const destinationSpaceId of path.slice(1)) {
    s = await readSession(ready.host);
    r = await cycleCommand(ready, 'MOVE_HERO', {
      fromSpaceId: s.journey.heroes[0].spaceId,
      destinationSpaceId,
    });
    assert.equal(r.status, 200, await r.text());
    await drainCombat(ready);
  }
  s = await readSession(ready.host);
  if (!s.journey.travel.remaining) {
    r = await cycleCommand(ready, 'START_TRAVEL');
    assert.equal(r.status, 200, await r.text());
    s = await readSession(ready.host);
  }
  const fromSpaceId = s.journey.heroes[0].spaceId;
  const destinationSpaceId = s.journey.definition.connections.flatMap(([a, b]) =>
    a === fromSpaceId ? [b] : b === fromSpaceId ? [a] : [],
  )[0];
  const before = await readBackup(ready.host);
  r = await cycleCommand(ready, 'MOVE_HERO', { fromSpaceId, destinationSpaceId });
  assert.equal(r.status, 200, await r.text());
  s = await readSession(ready.host);
  assert.equal(s.journey.heroes[0].spaceId, fromSpaceId);
  assert.equal(s.combat.current.kind, 'provocation');
  const after = await drainCombat(ready);
  assert.equal(after.journey.heroes[0].spaceId, destinationSpaceId);
  assert.equal(after.journey.travel.remaining, before.payload.state.journey.travel.remaining - 1);
  assert.equal(after.scenario.enemies.groups.find((g) => g.id === provoking.id).exhausted, false);
  const backup = await readBackup(ready.host);
  assert.equal(backup.payload.state.combat.operations.at(-1).status, 'returned');
});

test('a reached movement addition uses ordered legal hops, returns through provocations, and preserves the base outcome', async (t) => {
  const ready = await readyCombat(t, (src, pack) => {
    src.additions[0] = {
      ...src.additions[0],
      predicate: 'damage-positive',
      effect: { op: 'move-pair-toward-threat', amount: 1 },
    };
    for (const a of src.assets.filter((a) => a.cls === 'EnemyActivationModel')) {
      a.data.MinGroupSize = 1;
      a.data.KeyAttackAdditionalEffect = 'extra';
      a.dataHash = digest(a.data);
    }
    pack.manifest.prefabs[0].nodeType = 'threat';
  });
  const s = await readSession(ready.host),
    option = s.combat.attacks.find((o) => !o.reason);
  assert.ok(option);
  const before = await readBackup(ready.host);
  const r = await start(ready, s, option);
  assert.equal(r.status, 200, await r.text());
  await drainCombat(
    ready,
    (q) =>
      q.options.find((o) => o.id === 'addition')?.id ??
      q.options.find((o) => o.id.startsWith('move:'))?.id ??
      null,
  );
  const after = await readBackup(ready.host),
    attempt = after.payload.state.combat.attempts.find((a) => a.kind === 'hero-attack');
  assert.ok(attempt.outcome.suffered.damage > 0);
  assert.equal(attempt.outcome.sealed, true);
  assert.deepEqual([...attempt.movement.done].sort(), ['group', 'hero']);
  assert.equal(attempt.frontier.addition, 'completed');
  assert.equal(attempt.stage, 'completed');
  assert.equal(
    after.payload.state.journey.travel?.remaining ?? 0,
    before.payload.state.journey.travel?.remaining ?? 0,
  );
  assert.deepEqual(after.payload.state.mapGeneration, before.payload.state.mapGeneration);
});

test('a paid child attack returns to its parent after source-copy discard and packless SIGKILL replay', async (t) => {
  const ready = await readyCombat(
    t,
    (src) => {
      for (const instruction of src.assets.filter((a) => a.cls === 'EnemyActivationModel')) {
        for (const row of instruction.data.Damage) {
          row.Physical = 0;
          row.Fear = 0;
        }
        instruction.dataHash = digest(instruction.data);
      }
      const d = src.definitions.find((d) => d.id === 'role-2-skill-1');
      d.clauses = 1;
      src.clauses = [
        {
          cardId: d.id,
          definitionHash: d.definitionHash,
          originalHash: d.originalHash,
          locator: d.locator,
          clause: 0,
          window: 'after-attack-after-counterattack',
          effect: { op: 'granted-attack', inspiration: 1 },
        },
      ];
    },
    (c) => {
      sourceCatalog(c);
      for (const item of c.items.filter((i) => i.slot === 'hand')) item.ranged = true;
    },
  );
  // Establish the concession's own preconditions with ordinary fixture commands:
  // both heroes in the same space, owner acting, recipient alive after its turn.
  let s = await readSession(ready.host);
  let r = await cycleCommand(ready, 'END_TURN');
  assert.equal(r.status, 200, await r.text());
  await drainCombat(ready);
  r = await cycleCommand(ready, 'START_TURN', {}, ready.other);
  assert.equal(r.status, 200, await r.text());
  s = await readSession(ready.host);
  const recipient = s.preparation.heroes[0],
    ownerHero = s.preparation.heroes[1],
    target = s.journey.heroes.find((h) => h.heroId === recipient.heroId).spaceId,
    from = s.journey.heroes.find((h) => h.heroId === ownerHero.heroId).spaceId;
  if (from !== target) {
    const queue = [[from]],
      seen = new Set([from]);
    let path;
    while (queue.length) {
      const p = queue.shift();
      if (p.at(-1) === target) {
        path = p;
        break;
      }
      for (const [a, b] of s.journey.definition.connections) {
        const next = a === p.at(-1) ? b : b === p.at(-1) ? a : null;
        if (next && !seen.has(next)) {
          seen.add(next);
          queue.push([...p, next]);
        }
      }
    }
    assert.ok(path && path.length <= 3);
    r = await cycleCommand(ready, 'START_TRAVEL', {}, ready.other);
    assert.equal(r.status, 200, await r.text());
    for (const destinationSpaceId of path.slice(1)) {
      s = await readSession(ready.host);
      r = await cycleCommand(
        ready,
        'MOVE_HERO',
        {
          fromSpaceId: s.journey.heroes.find((h) => h.heroId === ownerHero.heroId).spaceId,
          destinationSpaceId,
        },
        ready.other,
      );
      assert.equal(r.status, 200, await r.text());
      await drainCombat(ready);
    }
  }
  s = await readSession(ready.host);
  assert.equal(s.journey.heroes[0].spaceId, s.journey.heroes[1].spaceId);
  assert.ok(s.preparation.heroes[1].prepared.some((c) => c.startsWith('role-2-skill-1:')));
  r = await start({ ...ready, player: ready.other }, s);
  assert.equal(r.status, 200, await r.text());
  s = await drainCombat(
    ready,
    (q) => q.options.find((o) => o.id.startsWith('grant:') && !o.unavailable)?.id ?? null,
    (s) => s.combat.current.stage === 'await-grant',
  );
  assert.equal(s.combat.current?.stage, 'await-grant');
  const grant = s.combat.grant,
    option = s.combat.attacks.find((o) => !o.reason);
  assert.ok(option);
  const actor = [ready.player, ready.other].find(
    (p) =>
      p.body.player.id === s.preparation.heroes.find((h) => h.heroId === grant.heroId).playerId,
  );
  const before = await readBackup(ready.host),
    owner = before.payload.state.preparation.heroes.find(
      (h) => h.heroId === s.combat.current.heroId,
    ),
    copy = before.payload.state.combat.grants.at(-1).copy;
  r = await command(
    ready.host,
    actor,
    {
      type: 'START_ATTACK',
      roundId: s.round.id,
      turnId: s.round.turnId,
      heroId: option.heroId,
      groupId: option.groupId,
      itemCopies: option.itemCopies,
      stat: option.stat,
      replaceCopy: null,
      grantId: grant.id,
    },
    s,
  );
  assert.equal(r.status, 200, await r.text());
  const paid = await readBackup(ready.host),
    afterOwner = paid.payload.state.preparation.heroes.find((h) => h.heroId === owner.heroId);
  assert.ok(!afterOwner.prepared.includes(copy));
  assert.ok(afterOwner.discard.includes(copy));
  assert.equal(
    paid.payload.state.round.heroes.find((h) => h.heroId === grant.heroId).actionsUsed,
    before.payload.state.round.heroes.find((h) => h.heroId === grant.heroId).actionsUsed,
  );
  await ready.host.stop('SIGKILL');
  const restarted = await startHost({
    LOTR_DATA_DIR: ready.host.dataDir,
    LOTR_SCENARIO_PACK: join(ready.host.dataDir, 'absent-scenario.json'),
    LOTR_PHYSICAL_PACK: join(ready.host.dataDir, 'absent-physical.json'),
    LOTR_CONTENT_PACK: join(ready.host.dataDir, 'absent-catalog.json'),
  });
  const oldHost = ready.host;
  ready.host = restarted;
  try {
    assert.deepEqual((await readBackup(restarted)).payload, paid.payload);
    await drainCombat(ready);
    const final = await readBackup(restarted),
      attempts = final.payload.state.combat.attempts.filter((a) => a.kind === 'hero-attack');
    assert.equal(attempts.length, 2);
    assert.ok(attempts.every((a) => a.returned));
    assert.equal(attempts[1].parentId, attempts[0].id);
    assert.equal(attempts[1].cost, 'grant');
    assert.equal(final.payload.state.combat.grants.at(-1).status, 'used');
    assert.equal(
      final.payload.state.preparation.heroes
        .find((h) => h.heroId === owner.heroId)
        .discard.filter((c) => c === copy).length,
      1,
    );
  } finally {
    await restarted.stop();
    ready.host = oldHost;
  }
});

test('a fully defeated group is removed once, rewards one living recipient at cap, and never calls a null enemy logic', async (t) => {
  const ready = await readyCombat(t, (src) => {
    for (const item of src.items) if (item.stat) item.body = '1 Success: 50 hits';
  });
  const s = await readSession(ready.host),
    before = await readBackup(ready.host),
    offer = s.combat.attacks.find((o) => !o.reason);
  assert.ok(offer);
  let r = await command(
    ready.host,
    ready.player,
    {
      type: 'START_ATTACK',
      roundId: s.round.id,
      turnId: s.round.turnId,
      heroId: offer.heroId,
      groupId: offer.groupId,
      itemCopies: offer.itemCopies,
      stat: offer.stat,
      replaceCopy: null,
      grantId: null,
      hits: 50,
    },
    s,
  );
  assert.equal(r.status, 422);
  assert.deepEqual((await readBackup(ready.host)).payload, before.payload);
  r = await start(ready, s, offer);
  assert.equal(r.status, 200, await r.text());
  let spent = false;
  const reward = await drainCombat(
    ready,
    (q) => {
      const slot = q.options.find((o) => o.id.startsWith('slot:'));
      if (!spent && slot) {
        spent = true;
        return slot.id;
      }
      return null;
    },
    (s) => s.combat.current.stage === 'reward',
  );
  assert.equal(spent, true);
  assert.equal(reward.scenario.enemies.groups.find((g) => g.id === offer.groupId).placed, false);
  assert.equal(reward.combat.current.applied.defeated, true);
  assert.equal(reward.combat.current.instruction, null);
  const stable = await readBackup(ready.host),
    q = reward.combat.pending,
    actor = [ready.player, ready.other].find((p) => p.body.player.id === q.actorPlayerId),
    choice = q.options[0].id;
  const intent = {
    type: 'COMBAT_INPUT',
    requestId: 'invented-reward-retry-00001',
    combatId: q.combatId,
    pendingId: q.id,
    sourceFingerprint: q.sourceFingerprint,
    choice,
  };
  const pair = await Promise.all([
    command(ready.host, actor, intent, reward),
    command(ready.host, actor, intent, reward),
  ]);
  const bodies = await Promise.all(
    pair.map(async (r) => {
      assert.equal(r.status, 200, await r.clone().text());
      return r.json();
    }),
  );
  assert.deepEqual(bodies[0], bodies[1]);
  await drainCombat(ready);
  const after = await readBackup(ready.host),
    attempt = after.payload.state.combat.attempts[0],
    recipient = attempt.reward.heroId;
  assert.equal(attempt.returned, true);
  assert.equal(attempt.selection, null);
  assert.ok(attempt.reward.amount >= 0 && attempt.reward.amount <= 1);
  assert.equal(
    after.payload.state.preparation.heroes.find((h) => h.heroId === recipient).inspiration -
      stable.payload.state.preparation.heroes.find((h) => h.heroId === recipient).inspiration,
    attempt.reward.amount,
  );
  assert.equal(after.payload.state.scenario.play.lore, before.payload.state.scenario.play.lore);
  assert.deepEqual(after.payload.state.scenario.instances, before.payload.state.scenario.instances);
  assert.equal(after.payload.state.combat.attempts.length, 1);
});
