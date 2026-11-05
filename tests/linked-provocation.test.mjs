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

test('a real linked visit waits for the existing provocation consumer and commits its source cost and callback once', async (t) => {
  const r = await readyCombat(
    t,
    (_src, pack) => {
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
  // All positions and groups below were created by the real startup and shadow deployment.
  const destination = s.scenario.spaceBindings.find((b) => b.sourceId === linkedNode(s).spaceId).id;
  let from = s.journey.heroes[0].spaceId;
  const queue = [[from]],
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
  if (path.length > 1) {
    if (!s.journey.travel?.remaining) await ok(cycleCommand(r, 'START_TRAVEL'));
    for (const destinationSpaceId of path.slice(1)) {
      s = await readSession(r.host);
      await ok(
        cycleCommand(r, 'MOVE_HERO', {
          fromSpaceId: s.journey.heroes[0].spaceId,
          destinationSpaceId,
        }),
      );
      await drainCombat(r);
    }
  }
  s = await readSession(r.host);
  const here = linkedNode(s).spaceId,
    groups = s.scenario.enemies.groups.filter(
      (g) => g.spaceId === here && g.figures.some((f) => f.health > 0),
    );
  assert.ok(groups.length, 'real deployment must place a group at the invented linked visit');
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
