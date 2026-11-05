import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { buildSync } from 'esbuild';
const built = buildSync({
  stdin: {
    contents: "export {CombatOperationSchema} from './src/shared/combat-controller';",
    resolveDir: process.cwd(),
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
});
const { CombatOperationSchema } = await import(
  'data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].contents).toString('base64')
);
test('the provocation origin retains the committed source alternative without broadening movement origins', () => {
  const origin = {
    kind: 'interaction',
    scenarioId: randomUUID(),
    packFingerprint: 'a'.repeat(64),
    projectionFingerprint: 'b'.repeat(64),
    sourceFingerprint: 'c'.repeat(64),
    heroId: 'invented-hero',
    roundId: randomUUID(),
    turnId: randomUUID(),
    instanceId: 'invented-source',
    choiceEvent: 'DELIVER',
  };
  const op = {
    id: randomUUID(),
    playerId: randomUUID(),
    requestId: randomUUID(),
    provoked: [],
    origin,
    status: 'provoking',
    reason: null,
  };
  assert.deepEqual(CombatOperationSchema.parse(op), op);
  assert.equal(
    CombatOperationSchema.safeParse({ ...op, origin: { ...origin, kind: 'movement' } }).success,
    false,
  );
});

import { readyCombat, drainCombat } from './combat-controller-helper.mjs';
import { sourceCatalog } from './original-encounter-helper.mjs';
import { attachFailure } from './fixtures/adventure-failure.mjs';
import {
  transplantLinkedPair,
  linkedNode,
  linkedIntent,
  finishPhysical,
  ok,
} from './linked-http-helper.mjs';
import { linkedTitle, sealLinked } from './fixtures/linked-encounters.mjs';
import { readSession, readBackup } from './skill-test-helper.mjs';
import { command } from './preparation-helper.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';
import { attachActivationSource } from './fixtures/shadow-activations.mjs';
import { endTurns } from './original-round-helper.mjs';
import { drainFollowup, rally } from './second-shadow-helper.mjs';

test('a real linked visit waits for the existing provocation consumer and commits its source cost and callback once', async (t) => {
  const r = await readyCombat(
    t,
    (src, pack, frozen) => {
      // Before startup: every invented melee activation can reach the party on this map.
      attachActivationSource(
        src,
        frozen.mapGeneration.projection.sections.flatMap((s) => s.tiles.map((t) => t.source)),
      );
      Object.assign(src.shadow.controller, pack.manifest.rounds.controller);
      for (const instruction of src.shadow.instructions) instruction.movement = 8;
      attachFailure(pack);
      transplantLinkedPair(pack);
      sealLinked(pack);
    },
    (c) => {
      sourceCatalog(c);
      for (const h of c.heroes) {
        h.stats.damage = 20;
        h.stats.fear = 20;
      }
    },
    (ir, _c, raw) => {
      linkedTitle(raw);
      for (const d of ir.definitions) d.body = [{ op: 'keep-faceup' }];
    },
  );
  let s = await readSession(r.host);
  const destination = s.scenario.spaceBindings.find((b) => b.sourceId === linkedNode(s).spaceId).id;
  async function moveToVisit(actor) {
    s = await readSession(r.host);
    const hero = s.preparation.heroes.find((h) => h.playerId === actor.body.player.id);
    if (!s.round.activeHeroId)
      await ok(cycleCommand(r, 'START_TURN', { heroId: hero.heroId }, actor));
    s = await readSession(r.host);
    const from = s.journey.heroes.find((h) => h.heroId === hero.heroId).spaceId,
      queue = [[from]],
      seen = new Set([from]);
    let path;
    while (queue.length) {
      const p = queue.shift();
      if (p.at(-1) === destination) {
        path = p;
        break;
      }
      for (const [a, b] of s.journey.definition.connections) {
        const n = a === p.at(-1) ? b : b === p.at(-1) ? a : null;
        if (n && !seen.has(n)) {
          seen.add(n);
          queue.push([...p, n]);
        }
      }
    }
    assert.ok(path && path.length <= 3);
    for (const destinationSpaceId of path.slice(1)) {
      s = await readSession(r.host);
      if (!s.journey.travel?.remaining) await ok(cycleCommand(r, 'START_TRAVEL', {}, actor));
      s = await readSession(r.host);
      await ok(
        cycleCommand(
          r,
          'MOVE_HERO',
          {
            fromSpaceId: s.journey.heroes.find((h) => h.heroId === hero.heroId).spaceId,
            destinationSpaceId,
          },
          actor,
        ),
      );
      await drainCombat(r);
    }
    await ok(cycleCommand(r, 'END_TURN', {}, actor));
  }
  // No placement, population or RNG outcome is seeded or retried. Both heroes move legally;
  // the existing source activation then brings the live melee groups to their shared space.
  await moveToVisit(r.player);
  await moveToVisit(r.other);
  await endTurns(r);
  await ok(cycleCommand(r, 'BEGIN_SHADOW'));
  await drainCombat(r);
  await drainFollowup(r);
  await ok(cycleCommand(r, 'CONFIRM_SHADOW_STEP', { step: 'threat' }));
  await drainFollowup(r);
  await rally(r);
  await ok(cycleCommand(r, 'START_TURN'));
  s = await readSession(r.host);
  const here = linkedNode(s).spaceId,
    groups = s.scenario.enemies.groups.filter(
      (g) => g.spaceId === here && g.figures.some((f) => f.health > 0),
    );
  assert.ok(groups.length, 'real source activation must engage the party at the invented visit');
  assert.equal(s.combat.current, null);
  const readyState = (await readBackup(r.host)).payload.state;
  assert.equal(readyState.combat.active, null);
  assert.equal(
    groups.length,
    s.scenario.enemies.groups.filter((g) => g.figures.some((f) => f.health > 0)).length,
  );
  const activated = readyState.combat.attempts.filter((a) => a.kind === 'activation');
  assert.ok(activated.length);
  assert.ok(
    groups.every((g) => activated.some((a) => a.groupId === g.id && a.stage === 'completed')),
  );
  const before = await readBackup(r.host),
    intent = { ...linkedIntent(s), requestId: randomUUID() };
  const submittedAt = s;
  await ok(command(r.host, r.player, intent, submittedAt));
  s = await readSession(r.host);
  assert.equal(s.combat.current.kind, 'provocation');
  assert.equal(s.round.heroes[0].actionsUsed, before.payload.state.round.heroes[0].actionsUsed);
  assert.equal(s.scenario.play.attempts.length, 0);
  await drainCombat(r);
  await finishPhysical(r);
  s = await readSession(r.host);
  assert.equal(s.scenario.pending.kind, 'choice');
  assert.equal(s.round.heroes[0].actionsUsed, before.payload.state.round.heroes[0].actionsUsed + 1);
  const played = (await readBackup(r.host)).payload;
  const op = played.state.combat.operations.at(-1);
  assert.equal(op.status, 'returned');
  assert.equal(op.origin.kind, 'interaction');
  assert.equal(op.origin.instanceId, linkedNode(s).id);
  await ok(scenarioInput(r.host, r.player, { kind: 'choice', event: 'LEAVE' }));
  await ok(scenarioInput(r.host, r.other, { kind: 'ack' }));
  const final = (await readBackup(r.host)).payload;
  assert.equal(final.state.scenario.play.attempts[0].returned, true);
  assert.equal(
    final.state.combat.operations.filter((o) => o.origin.kind === 'interaction').length,
    1,
  );
  const retry = await command(r.host, r.player, intent, submittedAt);
  assert.equal(retry.status, 200);
  assert.deepEqual((await readBackup(r.host)).payload, final);
});
