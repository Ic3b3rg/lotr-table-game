import test from 'node:test';
import assert from 'node:assert/strict';
import { readyCombat, drainCombat } from './combat-controller-helper.mjs';
import { sourceCatalog } from './original-encounter-helper.mjs';
import { attachFailure } from './fixtures/adventure-failure.mjs';
import { attachThreatTokens, sealThreatTokens } from './fixtures/threat-tokens.mjs';
import { attachActivationSource } from './fixtures/shadow-activations.mjs';
import { attachExploration } from './fixtures/exploration.mjs';
import { endTurns } from './original-round-helper.mjs';
import { drainFollowup, rally } from './second-shadow-helper.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';
import { readSession, readBackup } from './skill-test-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';
import {
  threatTokenNode,
  threatTokenIntent,
  resolveThreatTest,
  ok,
} from './threat-tokens-http-helper.mjs';
const node = (s) => threatTokenNode(s, 'null-product');
const intent = (s) => threatTokenIntent(s, 'null-product');
import { command } from './preparation-helper.mjs';
test('a threat token provokes every ready group before its source cost, then uses the real spirit test and fear consumer before returning', async (t) => {
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
      // Before startup, bind the fear owner to the actual hero start space.
      // readyCombat may legally move its first hero toward any random spawn;
      // returning to this start is then within its already-paid two-step route.
      const projection = frozen.mapGeneration.projection,
        startTile = projection.sections.find((s) => s.id === 0).tiles[0].source;
      const center = pack.manifest.prefabs.find((p) =>
        projection.assignments.some(
          (a) =>
            a.prefab.source === p.source &&
            projection.spaces.some(
              (s) => s.id === a.spaceId && s.tileSource === startTile && s.index === 1,
            ),
        ),
      );
      assert.ok(center && !pack.manifest.playablePrefabs.includes(center.source));
      const other = pack.manifest.prefabs.find(
        (p) => p !== center && !pack.manifest.playablePrefabs.includes(p.source),
      );
      assert.ok(other);
      attachThreatTokens(pack, [other, center]);
      sealThreatTokens(pack);
    },
    (c) => {
      sourceCatalog(c);
      for (const h of c.heroes) {
        h.stats.damage = 20;
        h.stats.fear = 20;
        h.stats.wisdom = 2;
        h.stats.spirit = 2;
      }
      for (const skill of c.skills) Object.assign(skill, { success: 0, fate: 1 });
    },
    (ir) => {
      for (const d of ir.definitions) d.body = [{ op: 'keep-faceup' }];
    },
  );
  let s = await readSession(r.host);
  const destination = s.scenario.spaceBindings.find((b) => b.sourceId === node(s).spaceId).id;
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
    assert.ok(
      path && path.length <= 3,
      JSON.stringify({
        actor: actor.body.player.id,
        from,
        destination,
        path,
        groups: s.scenario.enemies.groups.map((g) => ({ spaceId: g.spaceId, placed: g.placed })),
      }),
    );
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
    here = node(s).spaceId;
  assert.ok(living.length);
  assert.ok(living.every((g) => g.spaceId === here && !g.exhausted));
  const origin = (await readBackup(r.host)).payload.state.physical.cycle.seed;
  await ok(command(r.host, r.player, intent(s), s));
  s = await readSession(r.host);
  assert.equal(s.combat.current.kind, 'provocation');
  assert.equal(s.round.heroes[0].actionsUsed, 0);
  const population = living.map((g) => g.id);
  await drainCombat(r);
  s = await readSession(r.host);
  assert.equal(s.scenario.pending.kind, 'physical');
  const paid = (await readBackup(r.host)).payload.state;
  assert.deepEqual(
    paid.combat.attempts
      .filter((a) => a.kind === 'provocation')
      .slice(-population.length)
      .map((a) => a.groupId)
      .sort(),
    population.sort(),
  );
  const before = paid.physical.snapshot.areas[0];
  assert.ok(
    before.damage.length + before.fear.length > 0,
    'all real provocations transferred physical cards before the source test',
  );
  await resolveThreatTest(r, 0);
  s = await readSession(r.host);
  for (let n = 0; s.scenario.pending && n < 40; n++) {
    const q = s.physical.active;
    assert.equal(q.kind, 'decision');
    const option =
      ['resolve', 'close', 'reveal'].find((id) => q.options.some((o) => o.id === id)) ??
      q.options[0].id;
    await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option }));
    s = await readSession(r.host);
  }
  const final = (await readBackup(r.host)).payload.state;
  assert.equal(final.physical.snapshot.areas[0].fear.length, before.fear.length + 1);
  assert.equal(final.round.heroes[0].actionsUsed, 1);
  assert.equal(final.scenario.play.tests.at(-1).stat, 'spirit');
  assert.equal(final.scenario.play.tests.at(-1).successes, 0);
  assert.equal(final.scenario.play.attempts.at(-1).returned, true);
  assert.equal(node(final).stopped, true);
  assert.deepEqual(final.physical.cycle.seed, origin);
});
