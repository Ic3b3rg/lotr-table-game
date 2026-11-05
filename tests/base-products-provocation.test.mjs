import test from 'node:test';
import assert from 'node:assert/strict';
import { readyCombat, drainCombat } from './combat-controller-helper.mjs';
import { sourceCatalog } from './original-encounter-helper.mjs';
import { attachFailure } from './fixtures/adventure-failure.mjs';
import { attachBaseProducts, sealBaseProducts } from './fixtures/base-products.mjs';
import { attachActivationSource } from './fixtures/shadow-activations.mjs';
import { attachExploration } from './fixtures/exploration.mjs';
import { endTurns } from './original-round-helper.mjs';
import { drainFollowup, rally } from './second-shadow-helper.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';
import { readSession, readBackup } from './skill-test-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';
import { baseNode, baseIntent, finishPhysical, ok } from './base-products-http-helper.mjs';
import { command } from './preparation-helper.mjs';
import { randomUUID } from 'node:crypto';

test('the paid visit and the later source sprint each provoke the whole live population and return once through the same ledger', async (t) => {
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
      attachBaseProducts(pack, pack.manifest.prefabs[1], 9);
      sealBaseProducts(pack);
    },
    (c) => {
      sourceCatalog(c);
      for (const h of c.heroes) {
        h.stats.damage = 20;
        h.stats.fear = 20;
        h.stats.wisdom = 2;
      }
    },
    (ir) => {
      for (const d of ir.definitions) d.body = [{ op: 'keep-faceup' }];
    },
  );
  let s = await readSession(r.host);
  const destination = s.scenario.spaceBindings.find((b) => b.sourceId === baseNode(s).spaceId).id;
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
    here = baseNode(s).spaceId;
  assert.ok(living.length);
  assert.ok(living.every((g) => g.spaceId === here && !g.exhausted));
  const origin = (await readBackup(r.host)).payload.state.physical.cycle.seed;
  await ok(command(r.host, r.player, baseIntent(s), s));
  s = await readSession(r.host);
  assert.equal(s.combat.current.kind, 'provocation');
  assert.equal(s.round.heroes[0].actionsUsed, 0, 'the action awaits its source return');
  await drainCombat(r);
  await finishPhysical(r);
  s = await readSession(r.host);
  assert.equal(s.scenario.pending.kind, 'sprint');
  assert.equal(s.scenario.play.tests.at(-1).successes, 2);
  const dest = s.scenario.pending.options.find((o) => o.event.startsWith('move:'));
  assert.ok(dest);
  const before = await readBackup(r.host),
    id = randomUUID();
  await ok(
    scenarioInput(
      r.host,
      r.player,
      { kind: 'source-sprint', destinationSpaceId: dest.event.slice(5) },
      { requestId: id },
      s,
    ),
  );
  const suspended = (await readBackup(r.host)).payload;
  assert.equal(suspended.state.combat.operation.origin.kind, 'source-sprint');
  assert.equal(suspended.state.round.heroes[0].actionsUsed, 1);
  assert.equal(
    suspended.state.journey.heroes[0].spaceId,
    before.payload.state.journey.heroes[0].spaceId,
  );
  assert.equal(
    (
      await r.host.request(
        '/api/commands',
        {
          type: 'SCENARIO_INPUT',
          requestId: randomUUID(),
          generation: suspended.state.generation,
          expectedRevision: suspended.state.revision,
          scenarioId: s.scenario.id,
          packFingerprint: s.scenario.packFingerprint,
          projectionFingerprint: s.scenario.projectionFingerprint,
          pendingId: s.scenario.pending.id,
          sourceFingerprint: s.scenario.pending.fingerprint,
          heroId: s.scenario.pending.heroId,
          input: { kind: 'source-sprint', destinationSpaceId: null },
        },
        r.player.cookie,
      )
    ).status,
    409,
  );
  assert.deepEqual((await readBackup(r.host)).payload, suspended);
  await drainCombat(r);
  s = await readSession(r.host);
  assert.equal(s.scenario.pending, null);
  assert.equal(s.scenario.play.active, null);
  assert.equal(s.journey.heroes[0].spaceId, dest.event.slice(5));
  assert.equal(s.round.heroes[0].actionsUsed, 1);
  assert.equal(s.scenario.globals.inventedChain, 7);
  const final = (await readBackup(r.host)).payload.state;
  const operations = final.combat.operations.slice(-2);
  assert.deepEqual(
    operations.map((o) => o.origin.kind),
    ['interaction', 'source-sprint'],
  );
  for (const op of operations) {
    assert.equal(op.status, 'returned');
    assert.deepEqual(new Set(op.provoked), new Set(living.map((g) => g.id)));
  }
  assert.deepEqual(final.physical.cycle.seed, origin);
  assert.ok(final.physical.snapshot.parents.every((p) => p.returnCount === 1));
});
