import test from 'node:test';
import assert from 'node:assert/strict';
import { readyCombat, drainCombat } from './combat-controller-helper.mjs';
import { sourceCatalog } from './original-encounter-helper.mjs';
import { attachFailure } from './fixtures/adventure-failure.mjs';
import { attachSearches, sealSearches } from './fixtures/search-encounters.mjs';
import { attachActivationSource } from './fixtures/shadow-activations.mjs';
import { attachExploration } from './fixtures/exploration.mjs';
import { endTurns } from './original-round-helper.mjs';
import { drainFollowup, rally } from './second-shadow-helper.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';
import { readSession, readBackup } from './skill-test-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';
import { searchNode, searchIntent, ok } from './search-http-helper.mjs';
import { command } from './preparation-helper.mjs';
test('the real search interaction provokes every ready group before cost and heals an actual physical copy before cleanup', async (t) => {
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
      for (const p of pack.manifest.prefabs.slice(1, 3))
        p.nodeSource = p.modelSource.split(':')[0] + ':' + p.nodeSource.split(':')[1];
      attachSearches(pack, pack.manifest.prefabs.slice(1, 3));
      sealSearches(pack);
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
  const destination = s.scenario.spaceBindings.find((b) => b.sourceId === searchNode(s).spaceId).id;
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
    here = searchNode(s).spaceId;
  assert.ok(living.length);
  assert.ok(living.every((g) => g.spaceId === here && !g.exhausted));
  const origin = (await readBackup(r.host)).payload.state.physical.cycle.seed;
  await ok(command(r.host, r.player, searchIntent(s), s));
  s = await readSession(r.host);
  assert.equal(s.combat.current.kind, 'provocation');
  assert.equal(s.round.heroes[0].actionsUsed, 0);
  const population = living.map((g) => g.id);
  await drainCombat(r);
  s = await readSession(r.host);
  assert.equal(s.scenario.pending.kind, 'choice');
  const paid = (await readBackup(r.host)).payload.state;
  assert.deepEqual(
    paid.combat.attempts
      .filter((a) => a.kind === 'provocation')
      .slice(-population.length)
      .map((a) => a.groupId)
      .sort(),
    population.sort(),
  );
  const before = paid.physical.snapshot.areas[0],
    count = before.damage.length + before.fear.length;
  assert.ok(count > 0, 'the real provocation transferred cards before the search reward');
  await ok(scenarioInput(r.host, r.player, { kind: 'choice', event: 'RESTORE' }));
  s = await readSession(r.host);
  if (s.physical.active) {
    const q = s.physical.active;
    assert.equal(q.mode, 'select');
    await ok(scenarioInput(r.host, r.player, { kind: 'physical-select', ids: [q.options[0].id] }));
  }
  const healed = (await readBackup(r.host)).payload.state.physical.snapshot.areas[0];
  assert.equal(healed.damage.length + healed.fear.length, count - 1);
  await ok(scenarioInput(r.host, r.player, { kind: 'ack' }));
  const final = (await readBackup(r.host)).payload.state;
  assert.equal(final.round.heroes[0].actionsUsed, 1);
  assert.equal(final.scenario.play.attempts.at(-1).returned, true);
  assert.equal(searchNode(final).stopped, true);
  assert.deepEqual(final.physical.cycle.seed, origin);
});
