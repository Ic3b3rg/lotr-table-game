// Synthetic preconditions are applied only before startup; no conclusion is seeded.
import assert from 'node:assert/strict';
import { readyOriginal, sourceCatalog, finishPhysical } from './original-encounter-helper.mjs';
import { attachRounds } from './fixtures/source-rounds.mjs';
import { attachFollowup } from './fixtures/shadow-followup.mjs';
import { attachExploration } from './fixtures/exploration.mjs';
import { attachClues } from './clue-progression-http-helper.mjs';
import { attachLair, sealLair } from './fixtures/lair-victory.mjs';
import { fixed, addEncounter } from './fixtures/map-encounters.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';
import { command } from './preparation-helper.mjs';
import { readSession } from './skill-test-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';
export function readyLair(
  t,
  { edit = () => {}, catalogEdit = () => {}, frontEdit = () => {} } = {},
) {
  return readyOriginal(
    t,
    (pack, frozen) => {
      attachRounds(pack, frozen.mapGeneration.projection);
      attachFollowup(pack, frozen);
      attachExploration(
        pack,
        frozen.mapGeneration.projection.sections.flatMap((s) => s.tiles).map((t) => t.source),
      );
      attachClues(pack, frozen);
      attachLair(pack);
      // Declared synthetic precondition: the marker is already known at startup,
      // without a clue reward or a pre-seeded conclusion.
      pack.globals.find((v) => v.name === 'clueTotal').value = 0;
      const fort = pack.manifest.prefabs.find((p) => p.source === pack.manifest.lair.prefab);
      const d = pack.definitions.find((d) => d.source === fort.fsmSource);
      d.states.find((s) => s.index === 3).actions = d.states
        .find((s) => s.index === 3)
        .actions.filter((a) => a.op !== 'lore');
      edit(pack, frozen);
      sealLair(pack);
    },
    (c) => {
      sourceCatalog(c);
      catalogEdit(c);
    },
    frontEdit,
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
export async function ok(p) {
  const r = await p;
  assert.equal(r.status, 200, await r.clone().text());
  return r;
}
export function lair(s) {
  return s.scenario.instances.find((i) => i.prefab === s.scenario.pack.manifest.lair.prefab);
}
export function lairIntent(s, requestId) {
  const sc = s.scenario,
    i = lair(s);
  return {
    type: 'INTERACT_SCENARIO',
    ...(requestId ? { requestId } : {}),
    scenarioId: sc.id,
    packFingerprint: sc.packFingerprint,
    projectionFingerprint: sc.projectionFingerprint,
    instanceId: i.id,
    sourceFingerprint: s.encounterFingerprints[i.id],
    heroId: s.round.activeHeroId,
    roundId: s.round.id,
    turnId: s.round.turnId,
  };
}
export async function reachLair(r, actor = r.player) {
  await ok(cycleCommand(r, 'START_TURN', {}, actor));
  await ok(cycleCommand(r, 'START_TRAVEL', {}, actor));
  const s = await readSession(r.host),
    i = lair(s),
    to = s.scenario.spaceBindings.find((b) => b.sourceId === i.spaceId).id;
  const h = s.preparation.heroes.find((h) => h.playerId === actor.body.player.id),
    from = s.journey.heroes.find((p) => p.heroId === h.heroId).spaceId;
  if (from !== to)
    await ok(cycleCommand(r, 'MOVE_HERO', { fromSpaceId: from, destinationSpaceId: to }, actor));
  return readSession(r.host);
}
export async function commitLair(r, actor = r.player, requestId) {
  const s = await readSession(r.host);
  return command(r.host, actor, lairIntent(s, requestId), s);
}
export async function failFirstLair(r) {
  await reachLair(r);
  await ok(commitLair(r));
  let s = await finishPhysical(r);
  assert.equal(lair(s).state, 103);
  await ok(scenarioInput(r.host, r.other, { kind: 'ack' }));
  s = await readSession(r.host);
  assert.equal(lair(s).state, 107);
  return s;
}
export { finishPhysical };
