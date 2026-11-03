import assert from 'node:assert/strict';
import { readyOriginal } from './original-encounter-helper.mjs';
import { attachExploration } from './fixtures/exploration.mjs';
import { readSession } from './skill-test-helper.mjs';
import { command } from './preparation-helper.mjs';
import { fixed, addEncounter } from './fixtures/map-encounters.mjs';
export async function readyExploration(t, edit = () => {}, catalogEdit) {
  return readyOriginal(
    t,
    (pack, frozen) => {
      attachExploration(
        pack,
        frozen.mapGeneration.projection.sections.find((s) => s.id === 1).tiles.map((t) => t.source),
      );
      edit(pack, frozen);
    },
    catalogEdit,
    () => {},
    (raw) => {
      const input = {
        assembly: { selection: raw.template.selection },
        placement: raw.template.placement,
      };
      for (const tile of [2, 3])
        for (const space of [0, 1]) fixed(input, 1, tile, addEncounter(input), space);
    },
  );
}
export function destinations(s) {
  const g = s.mapGeneration.projection,
    sc = s.scenario,
    origin = s.journey.heroes.find((h) => h.heroId === s.round.activeHeroId).spaceId;
  return g.spaces
    .filter((sp) => sc.tiles.some((t) => t.source === sp.tileSource && t.visible && !t.explored))
    .flatMap((sp) => {
      const id = sc.spaceBindings.find((b) => b.sourceId === sp.id).id;
      return s.journey.definition.connections.some(
        ([a, b]) => (a === origin && b === id) || (b === origin && a === id),
      )
        ? [{ ...sp, id }]
        : [];
    });
}
export async function startTravel(ready, actor = ready.player) {
  let s = await readSession(ready.host);
  const heroId = s.preparation.heroes.find((h) => h.playerId === actor.body.player.id).heroId;
  for (const c of [
    { type: 'START_TURN', agreed: true },
    { type: 'START_TRAVEL', mapId: s.journey.id },
  ]) {
    const r = await command(
      ready.host,
      actor,
      {
        ...c,
        heroId,
        roundId: s.round.id,
        ...(c.type === 'START_TRAVEL' ? { turnId: s.round.turnId } : {}),
      },
      s,
    );
    assert.equal(r.status, 200, await r.text());
    s = await readSession(ready.host);
  }
  // A normal move toward the unexplored frontier, when needed.
  for (let n = 0; n < 2 && !destinations(s).length; n++) {
    const sc = s.scenario,
      g = s.mapGeneration.projection,
      pos = s.journey.heroes.find((h) => h.heroId === heroId);
    const target = g.spaces.find((sp) =>
      sc.tiles.some((t) => t.source === sp.tileSource && t.visible && !t.explored),
    );
    const goal = sc.spaceBindings.find((b) => b.sourceId === target.id).id;
    const queue = [[pos.spaceId]],
      seen = new Set();
    let path;
    while (queue.length) {
      const p = queue.shift(),
        x = p.at(-1);
      if (x === goal) {
        path = p;
        break;
      }
      if (seen.has(x)) continue;
      seen.add(x);
      for (const [a, b] of s.journey.definition.connections)
        if (a === x || b === x) queue.push([...p, a === x ? b : a]);
    }
    assert.ok(path?.length > 1);
    const r = await command(
      ready.host,
      actor,
      {
        type: 'MOVE_HERO',
        mapId: s.journey.id,
        heroId,
        roundId: s.round.id,
        turnId: s.round.turnId,
        fromSpaceId: pos.spaceId,
        destinationSpaceId: path[1],
      },
      s,
    );
    assert.equal(r.status, 200, await r.text());
    s = await readSession(ready.host);
  }
  return s;
}
export async function explore(ready, destination, actor = ready.player, extra = {}, at) {
  const s = at ?? (await readSession(ready.host)),
    heroId = s.round.activeHeroId;
  return command(
    ready.host,
    actor,
    {
      type: 'EXPLORE_SCENARIO',
      scenarioId: s.scenario.id,
      packFingerprint: s.scenario.packFingerprint,
      projectionFingerprint: s.scenario.projectionFingerprint,
      mapId: s.journey.id,
      roundId: s.round.id,
      turnId: s.round.turnId,
      heroId,
      fromSpaceId: s.journey.heroes.find((h) => h.heroId === heroId).spaceId,
      destinationSpaceId: destination.id,
      sourceFingerprint: s.explorationFingerprints?.[destination.id] ?? 'a'.repeat(64),
      ...extra,
    },
    { ...s, revision: extra.expectedRevision ?? s.revision },
  );
}
export async function finishExploration(ready) {
  const { scenarioInput } = await import('./scenario-helper.mjs');
  for (let n = 0; n < 30; n++) {
    const s = await readSession(ready.host),
      q = s.scenario.pending;
    if (!q) return s;
    const actor = q.actorPlayerId === ready.other.body.player.id ? ready.other : ready.player;
    const r = await scenarioInput(ready.host, actor, { kind: 'ack' });
    assert.equal(r.status, 200, await r.text());
  }
  assert.fail('exploration did not return');
}
export function exploreIntent(s, to) {
  const heroId = s.round.activeHeroId;
  return {
    type: 'EXPLORE_SCENARIO',
    scenarioId: s.scenario.id,
    packFingerprint: s.scenario.packFingerprint,
    projectionFingerprint: s.scenario.projectionFingerprint,
    mapId: s.journey.id,
    roundId: s.round.id,
    turnId: s.round.turnId,
    heroId,
    fromSpaceId: s.journey.heroes.find((h) => h.heroId === heroId).spaceId,
    destinationSpaceId: to.id,
    sourceFingerprint: s.explorationFingerprints[to.id],
  };
}
