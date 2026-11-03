import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  readyExploration,
  startTravel,
  destinations,
  explore,
} from './original-exploration-helper.mjs';
import { readSession } from './skill-test-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';
import { certificates } from './fixtures/exploration.mjs';
import { hash } from './fixtures/map-freeze.mjs';
import { compileScenarioPack } from '../dist/scenario-library.mjs';

test('an incomplete reveal continuation is unavailable before movement or reward, even with a valid source fingerprint', async (t) => {
  const ready = await readyExploration(t, (pack, frozen) => {
    const certs = structuredClone(certificates(pack));
    for (const assignment of frozen.mapGeneration.projection.assignments) {
      const space = frozen.mapGeneration.projection.spaces.find((s) => s.id === assignment.spaceId);
      if (space.sectionId !== 1) continue;
      const prefab = pack.manifest.prefabs.find((p) => p.source === assignment.prefab.source);
      const d = pack.definitions.find((d) => d.source === prefab.fsmSource);
      if (d.handlers.REVEALED !== 1) continue;
      certs
        .find((c) => c.source === d.source)
        .deferredEdges.push({
          from: 1,
          event: 'FINISHED',
          to: 2,
          capability: 'invented-uncompiled-release',
        });
      delete d.states.find((s) => s.index === 1).transitions.FINISHED;
      d.states = d.states.filter((s) => s.index !== 2);
    }
    Object.assign(pack, compileScenarioPack({ pack, certificates: certs }).pack);
  });
  const s = await startTravel(ready),
    to = destinations(s)[0];
  assert.equal(s.explorationFingerprints[to.id], undefined);
  const sc = s.scenario;
  const sourceFingerprint = hash({
    scenarioId: sc.id,
    packFingerprint: sc.packFingerprint,
    projectionFingerprint: sc.projectionFingerprint,
    template: sc.pack.manifest.exploration.definition,
    tile: sc.tiles.find((tile) => tile.source === to.tileSource),
  });
  const { readBackup } = await import('./skill-test-helper.mjs');
  const before = await readBackup(ready.host);
  const r = await explore(ready, to, ready.player, { sourceFingerprint });
  assert.equal(r.status, 409, await r.text());
  const after = await readBackup(ready.host);
  assert.deepEqual(after.payload, before.payload);
  assert.equal(after.checksum, before.checksum);
});

test('travel exploration consumes one move, suspends for source and returns with its capped actor reward once', async (t) => {
  const ready = await readyExploration(t),
    s = await startTravel(ready),
    to = destinations(s)[0];
  assert.ok(to);
  const r = await explore(ready, to);
  assert.equal(r.status, 200, await r.text());
  let next = await readSession(ready.host);
  assert.equal(next.journey.travel.remaining, s.journey.travel.remaining - 1);
  assert.equal(next.round.heroes.find((h) => h.heroId === s.round.activeHeroId).actionsUsed, 1);
  assert.equal(next.scenario.pending.kind, 'exploration-intro');
  assert.equal(next.scenario.pending.heroId, s.round.activeHeroId);
  const introRequest = next.scenario.pending;
  for (let n = 0; next.scenario.pending && n < 15; n++) {
    const q = next.scenario.pending,
      actor = q.actorPlayerId === ready.other.body.player.id ? ready.other : ready.player;
    const a = await scenarioInput(ready.host, actor, { kind: 'ack' });
    assert.equal(a.status, 200, await a.text());
    next = await readSession(ready.host);
  }
  assert.equal(next.scenario.pending, null);
  assert.equal(next.scenario.explorations.attempts[0].returned, true);
  assert.equal(next.scenario.explorations.active, null);
  const { readBackup } = await import('./skill-test-helper.mjs');
  const rewardRun = (await readBackup(ready.host)).payload.state.physical.runs.find((r) =>
    r.program.children.some((c) => c.kind === 'inspiration'),
  );
  assert.equal(rewardRun.source.instanceId, introRequest.instanceId);
  assert.equal(rewardRun.source.state, introRequest.state);
  assert.equal(rewardRun.source.entry, introRequest.entry);
  assert.equal(rewardRun.source.action, introRequest.action);
  const reward = next.scenario.explorations.attempts[0].reward;
  assert.ok(reward === 0 || reward === 1);
  assert.equal(
    next.preparation.heroes.find((h) => h.heroId === s.round.activeHeroId).inspiration,
    s.preparation.heroes.find((h) => h.heroId === s.round.activeHeroId).inspiration + reward,
  );
  assert.equal(
    next.scenario.commands.slice(s.scenario.commands.length).filter((c) => c.kind === 'explore')
      .length,
    1,
  );
  const again = await explore(ready, to, ready.player, {
    sourceFingerprint: s.explorationFingerprints[to.id],
  });
  assert.equal(again.status, 409);
  const { command } = await import('./preparation-helper.mjs');
  assert.ok(next.journey.travel.remaining > 0);
  const moved = await command(
    ready.host,
    ready.player,
    {
      type: 'MOVE_HERO',
      mapId: next.journey.id,
      roundId: next.round.id,
      turnId: next.round.turnId,
      heroId: next.round.activeHeroId,
      fromSpaceId: to.id,
      destinationSpaceId: s.journey.heroes.find((h) => h.heroId === s.round.activeHeroId).spaceId,
    },
    next,
  );
  assert.equal(moved.status, 200, await moved.text());
  const resumed = await readSession(ready.host);
  assert.equal(resumed.journey.travel.remaining, next.journey.travel.remaining - 1);
  assert.equal(resumed.round.heroes.find((h) => h.heroId === s.round.activeHeroId).actionsUsed, 1);
});

test('exploration checks ownership, pose, adjacency, source, turn, visibility, budget and pending before changing anything', async (t) => {
  const { randomUUID } = await import('node:crypto');
  const { command } = await import('./preparation-helper.mjs');
  const { readBackup } = await import('./skill-test-helper.mjs');
  const { exploreIntent } = await import('./original-exploration-helper.mjs');
  const r = await readyExploration(t),
    s = await startTravel(r),
    to = destinations(s)[0],
    before = await readBackup(r.host);
  const visible = s.mapGeneration.projection.spaces
    .filter((x) => x.sectionId === 1)
    .map((x) => ({ ...x, id: s.scenario.spaceBindings.find((b) => b.sourceId === x.id).id }));
  const origin = s.journey.heroes.find((h) => h.heroId === s.round.activeHeroId).spaceId;
  const far = visible.find(
    (x) =>
      !s.journey.definition.connections.some(
        ([a, b]) => (a === origin && b === x.id) || (b === origin && a === x.id),
      ),
  );
  const otherTile = visible.find((x) => x.tileSource !== to.tileSource);
  assert.ok(far && otherTile);
  for (const [actor, extra, status] of [
    [r.other, {}, 403],
    [r.player, { fromSpaceId: 'invented-wrong-origin' }, 409],
    [
      r.player,
      { destinationSpaceId: far.id, sourceFingerprint: s.explorationFingerprints[far.id] },
      409,
    ],
    [r.player, { sourceFingerprint: s.explorationFingerprints[otherTile.id] }, 409],
    [r.player, { destinationSpaceId: 'invented-foreign-space' }, 409],
    [r.player, { sourceFingerprint: 'b'.repeat(64) }, 409],
    [r.player, { packFingerprint: 'b'.repeat(64) }, 409],
    [r.player, { projectionFingerprint: 'b'.repeat(64) }, 409],
    [r.player, { scenarioId: randomUUID() }, 409],
    [r.player, { turnId: randomUUID() }, 409],
    [r.player, { roundId: randomUUID() }, 409],
    [r.player, { mapId: randomUUID() }, 409],
    [r.player, { expectedRevision: s.revision - 1 }, 409],
  ]) {
    const res = await explore(r, to, actor, extra, s);
    assert.equal(res.status, status, await res.text());
    assert.deepEqual((await readBackup(r.host)).payload, before.payload);
  }
  // A second travel action is legal; exploration itself needs no third action.
  let res = await command(
    r.host,
    r.player,
    {
      type: 'START_TRAVEL',
      mapId: s.journey.id,
      heroId: s.round.activeHeroId,
      roundId: s.round.id,
      turnId: s.round.turnId,
    },
    s,
  );
  assert.equal(res.status, 200, await res.text());
  let now = await readSession(r.host);
  res = await explore(r, to, r.player, {}, now);
  assert.equal(res.status, 200, await res.text());
  now = await readSession(r.host);
  assert.equal(now.round.heroes.find((h) => h.heroId === s.round.activeHeroId).actionsUsed, 2);
  const snapshot = await readBackup(r.host);
  const wrong = await scenarioInput(r.host, r.other, { kind: 'ack' });
  assert.equal(wrong.status, 403);
  const again = await command(
    r.host,
    r.player,
    { ...exploreIntent(s, to), expectedRevision: now.revision },
    now,
  );
  assert.equal(again.status, 409);
  assert.deepEqual((await readBackup(r.host)).payload, snapshot.payload);
});

test('two tiles reveal only their source-space nodes, cap reward for the explorer and preserve movement through returns', async (t) => {
  const { hash } = await import('./fixtures/map-freeze.mjs');
  const { finishExploration } = await import('./original-exploration-helper.mjs');
  const { sourceCatalog } = await import('./original-encounter-helper.mjs');
  const { command } = await import('./preparation-helper.mjs');
  const { readBackup } = await import('./skill-test-helper.mjs');
  const r = await readyExploration(
    t,
    () => {},
    (c) => {
      sourceCatalog(c);
      for (const h of c.heroes) h.stats.inspiration = 1;
    },
  );
  let s = await startTravel(r);
  const seed = (await readBackup(r.host)).payload.state.physical.cycle.seed;
  const explored = [];
  for (let n = 0; n < 2; n++) {
    if ((s.journey.travel?.remaining ?? 0) < 2) {
      const a = await command(
        r.host,
        r.player,
        {
          type: 'START_TRAVEL',
          mapId: s.journey.id,
          heroId: s.round.activeHeroId,
          roundId: s.round.id,
          turnId: s.round.turnId,
        },
        s,
      );
      assert.equal(a.status, 200, await a.text());
      s = await readSession(r.host);
    }
    const to = destinations(s)[0];
    assert.ok(to, 'second unexplored tile is reachable');
    explored.push(to.tileSource);
    const expected = s.mapGeneration.projection.spaces
      .filter((x) => x.tileSource === to.tileSource)
      .sort((a, b) => a.index - b.index)
      .map((x) => s.scenario.instances.find((i) => i.kind === 'encounter' && i.spaceId === x.id))
      .filter(Boolean)
      .map((i) => i.id);
    const count = s.scenario.events.length,
      remaining = s.journey.travel.remaining;
    const a = await explore(r, to);
    assert.equal(a.status, 200, await a.text());
    s = await finishExploration(r);
    assert.equal(s.journey.travel.remaining, remaining - 1);
    assert.deepEqual(
      s.scenario.events
        .slice(count)
        .filter((e) => e.event === 'REVEALED')
        .flatMap((e) => e.receivers),
      expected,
    );
    for (const id of expected) {
      const i = s.scenario.instances.find((i) => i.id === id);
      assert.equal(i.visible, true);
      assert.equal(i.processing, 0);
      assert.equal(i.settled, true);
    }
    assert.equal(s.scenario.explorations.attempts[n].reward, 0);
    assert.equal(s.scenario.explorations.attempts[n].returned, true);
  }
  assert.equal(new Set(explored).size, 2);
  assert.equal(s.scenario.explorations.attempts.length, 2);
  assert.deepEqual((await readBackup(r.host)).payload.state.physical.cycle.seed, seed);
  assert.equal(s.scenario.completedSetup.length, 4);
  const hidden = s.scenario.instances.find((i) => i.variables.gate === false);
  assert.equal(hidden.visible, false);
  const nonplayable = s.scenario.instances.find(
    (i) =>
      i.kind === 'encounter' &&
      i.visible &&
      !s.scenario.pack.manifest.playablePrefabs.includes(i.prefab),
  );
  const bad = await command(
    r.host,
    r.player,
    {
      type: 'INTERACT_SCENARIO',
      scenarioId: s.scenario.id,
      packFingerprint: s.scenario.packFingerprint,
      projectionFingerprint: s.scenario.projectionFingerprint,
      instanceId: nonplayable.id,
      heroId: s.round.activeHeroId,
      roundId: s.round.id,
      turnId: s.round.turnId,
      sourceFingerprint: hash(nonplayable),
    },
    s,
  );
  assert.equal(bad.status, 409);
  assert.equal((await bad.json()).error.code, 'SCENARIO_CAPABILITY');
});

test('a genuine adjacent-section handler runs and releases before exploration returns; a declared event alone does nothing', async (t) => {
  const { state, action, text } = await import('./fixtures/scenario.mjs');
  const { finishExploration } = await import('./original-exploration-helper.mjs');
  const r = await readyExploration(t, (pack) => {
    const p = pack.definitions.find((d) => d.source === pack.principal);
    p.variables.push({ name: 'nearby', type: 'int', value: -1 });
    p.handlers.NEARBY_EXPLORED = 40;
    p.states.push(
      state(
        40,
        [
          action(0, 'section', {
            sectionId: 2,
            text: text('Colloca la tessera adiacente inventata {tile}'),
          }),
          action(1, 'release'),
        ],
        { FINISHED: 0 },
      ),
    );
    pack.manifest.exploration.adjacent.variable = { scope: 'local', name: 'nearby' };
  });
  let s = await startTravel(r),
    to = destinations(s)[0];
  const a = await explore(r, to);
  assert.equal(a.status, 200, await a.text());
  s = await finishExploration(r);
  const events = s.scenario.events.filter((e) => e.event === 'NEARBY_EXPLORED');
  assert.ok(events.length > 0);
  assert.ok(events.every((e) => e.receivers.length === 1 && e.receivers[0] === 'principal'));
  assert.equal(s.scenario.instances.find((i) => i.id === 'principal').processing, 0);
  const section = s.mapGeneration.projection.sections.find((x) => x.id === 2);
  assert.ok(
    section.tiles.every((t) =>
      s.scenario.tiles.some((v) => v.source === t.source && v.visible && !v.explored),
    ),
  );
  assert.ok(s.scenario.explorations.attempts[0].returned);
});

test('an unavailable reveal and an exhausted movement budget reject exploration before cost', async (t) => {
  const { hash } = await import('./fixtures/map-freeze.mjs');
  const { command } = await import('./preparation-helper.mjs');
  const { readBackup } = await import('./skill-test-helper.mjs');
  const r = await readyExploration(t, (pack, frozen) => {
    for (const a of frozen.mapGeneration.projection.assignments) {
      const sp = frozen.mapGeneration.projection.spaces.find((s) => s.id === a.spaceId);
      if (sp.sectionId !== 1) continue;
      const m = pack.manifest.prefabs.find((p) => p.source === a.prefab.source),
        d = pack.definitions.find((d) => d.source === m.fsmSource);
      d.handlers = {};
      d.deferredHandlers = { REVEALED: 'unimplemented-reveal' };
    }
  });
  let s = await startTravel(r),
    to = destinations(s)[0];
  const sourceFingerprint = hash({
    scenarioId: s.scenario.id,
    packFingerprint: s.scenario.packFingerprint,
    projectionFingerprint: s.scenario.projectionFingerprint,
    template: s.scenario.pack.manifest.exploration.definition,
    tile: s.scenario.tiles.find((t) => t.source === to.tileSource),
  });
  const before = await readBackup(r.host),
    blocked = await explore(r, to, r.player, { sourceFingerprint }, s);
  assert.equal(blocked.status, 409);
  assert.equal((await blocked.json()).error.code, 'EXPLORATION_CAPABILITY');
  assert.deepEqual((await readBackup(r.host)).payload, before.payload);
  // Use legal ordinary moves only until no movement remains.
  while (s.journey.travel.remaining) {
    const origin = s.journey.heroes.find((h) => h.heroId === s.round.activeHeroId).spaceId;
    const next = s.journey.definition.connections
      .flatMap(([a, b]) => (a === origin ? [b] : b === origin ? [a] : []))
      .find((id) => {
        const src = s.scenario.spaceBindings.find((b) => b.id === id).sourceId,
          sp = s.mapGeneration.projection.spaces.find((x) => x.id === src);
        return s.scenario.tiles.some((t) => t.source === sp.tileSource && t.visible && t.explored);
      });
    const move = await command(
      r.host,
      r.player,
      {
        type: 'MOVE_HERO',
        mapId: s.journey.id,
        roundId: s.round.id,
        turnId: s.round.turnId,
        heroId: s.round.activeHeroId,
        fromSpaceId: origin,
        destinationSpaceId: next,
      },
      s,
    );
    assert.equal(move.status, 200, await move.text());
    s = await readSession(r.host);
  }
  assert.equal(s.journey.travel.remaining, 0);
  const r2 = await readyExploration(t),
    at = await startTravel(r2),
    target = destinations(at)[0];
  let current = at;
  while (current.journey.travel.remaining) {
    const origin = current.journey.heroes[0].spaceId,
      neighbor =
        current.journey.definition.startSpaceId === origin
          ? current.journey.definition.connections
              .find(([a, b]) => a === origin || b === origin)
              .find((x) => x !== origin)
          : current.journey.definition.startSpaceId;
    const move = await command(
      r2.host,
      r2.player,
      {
        type: 'MOVE_HERO',
        mapId: current.journey.id,
        roundId: current.round.id,
        turnId: current.round.turnId,
        heroId: current.round.activeHeroId,
        fromSpaceId: origin,
        destinationSpaceId: neighbor,
      },
      current,
    );
    assert.equal(move.status, 200, await move.text());
    current = await readSession(r2.host);
  }
  const exhausted = await explore(r2, target);
  assert.equal(exhausted.status, 409);
  assert.equal((await exhausted.json()).error.code, 'NO_MOVES');
});
