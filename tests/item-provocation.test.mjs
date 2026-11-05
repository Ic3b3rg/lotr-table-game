import test from 'node:test';
import assert from 'node:assert/strict';
import { readyCombat, drainCombat } from './combat-controller-helper.mjs';
import { sourceCatalog } from './original-encounter-helper.mjs';
import { attachFailure } from './fixtures/adventure-failure.mjs';
import { attachItem, sealItem, itemPolicy } from './fixtures/item-encounter.mjs';
import { attachActivationSource } from './fixtures/shadow-activations.mjs';
import { attachExploration } from './fixtures/exploration.mjs';
import { endTurns } from './original-round-helper.mjs';
import { drainFollowup, rally } from './second-shadow-helper.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';
import { readSession, readBackup, signBackup } from './skill-test-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';
import { itemNode, itemIntent, finishPhysical, ok } from './item-http-helper.mjs';
import { command } from './preparation-helper.mjs';
import { randomUUID } from 'node:crypto';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { startHost } from './host-helper.mjs';
import { recoverSeat } from './last-stand-helper.mjs';
import { runtime } from './threat-helper.mjs';

test('the item visit provokes every ready group before its one cost and physical test, then returns to the wait on failure', async (t) => {
  let catalogue;
  const r = await readyCombat(
    t,
    (src, pack, frozen) => {
      attachActivationSource(
        src,
        frozen.mapGeneration.projection.sections.flatMap((s) => s.tiles.map((t) => t.source)),
      );
      Object.assign(src.shadow.controller, pack.manifest.rounds.controller);
      for (const i of src.shadow.instructions) i.movement = 8;
      attachExploration(
        pack,
        frozen.mapGeneration.projection.sections.flatMap((s) => s.tiles.map((t) => t.source)),
      );
      attachFailure(pack);
      attachItem(pack, catalogue, pack.manifest.prefabs[1], 9);
      sealItem(pack);
    },
    (c) => {
      catalogue = c;
      sourceCatalog(c);
      for (const h of c.heroes) {
        h.stats.damage = 20;
        h.stats.fear = 20;
        h.stats.wisdom = 2;
      }
    },
    (ir) => {
      ir.policies.push(itemPolicy(catalogue));
      for (const d of ir.definitions) d.body = [{ op: 'keep-faceup' }];
    },
  );
  let s = await readSession(r.host);
  const destination = s.scenario.spaceBindings.find((b) => b.sourceId === itemNode(s).spaceId).id;
  for (const actor of [r.player, r.other]) {
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
  await endTurns(r);
  await ok(cycleCommand(r, 'BEGIN_SHADOW'));
  await drainCombat(r);
  await drainFollowup(r);
  await ok(cycleCommand(r, 'CONFIRM_SHADOW_STEP', { step: 'threat' }));
  await drainFollowup(r);
  await rally(r);
  await ok(cycleCommand(r, 'START_TURN'));
  s = await readSession(r.host);
  const living = s.scenario.enemies.groups.filter((g) => g.figures.some((f) => f.health > 0)),
    here = itemNode(s).spaceId;
  assert.ok(living.length);
  assert.ok(living.every((g) => g.spaceId === here && !g.exhausted));
  const origin = (await readBackup(r.host)).payload.state.physical.cycle.seed;
  await ok(command(r.host, r.player, itemIntent(s), s));
  s = await readSession(r.host);
  assert.equal(s.combat.current.kind, 'provocation');
  assert.equal(s.round.heroes[0].actionsUsed, 0, 'the action awaits its source return');
  await drainCombat(r);
  await finishPhysical(r);
  s = await readSession(r.host);
  assert.equal(s.scenario.pending.kind, 'message');
  assert.equal(s.scenario.play.tests.at(-1).successes, 2);
  const ops = (await readBackup(r.host)).payload.state.combat.operations.filter(
    (o) => o.origin.kind === 'interaction',
  );
  assert.equal(ops.length, 1);
  assert.deepEqual(new Set(ops[0].provoked), new Set(living.map((g) => g.id)));
  await ok(scenarioInput(r.host, r.player, { kind: 'ack' }));
  const final = (await readBackup(r.host)).payload.state;
  assert.equal(final.scenario.play.active, null);
  assert.equal(itemNode(final).visible, true);
  assert.equal(final.physical.snapshot.resolution.resources.itemCustody, undefined);
  assert.equal(final.round.heroes[0].actionsUsed, 1);
  assert.deepEqual(final.physical.cycle.seed, origin);
});
