// Declared invented source recipe; group inventory is acquired through its real consumer.
import assert from 'node:assert/strict';
import { readyOriginal, sourceCatalog, finishPhysical } from './original-encounter-helper.mjs';
import { attachRounds } from './fixtures/source-rounds.mjs';
import { attachFollowup } from './fixtures/shadow-followup.mjs';
import { attachExploration } from './fixtures/exploration.mjs';
import { attachClues } from './clue-progression-http-helper.mjs';
import { attachLair, sealLair } from './fixtures/lair-victory.mjs';
import { attachCampSkills } from './fixtures/camp-skills.mjs';
import { attachItem, sealItem, itemPolicy } from './fixtures/item-encounter.mjs';
import { addCampItemCards, addGroupCampCards, attachCampItems } from './fixtures/camp-items.mjs';
import { fixed, addEncounter } from './fixtures/map-encounters.mjs';
import { commitItem } from './item-http-helper.mjs';
import { reachLair, commitLair } from './lair-victory-http-helper.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';
import { readSession, readBackup } from './skill-test-helper.mjs';
import { ok } from './lair-victory-http-helper.mjs';

export function readyGroupItemCamp(t, { lore = 30, edit = () => {} } = {}) {
  let catalog;
  return readyOriginal(
    t,
    (pack, frozen) => {
      const p = frozen.mapGeneration.projection;
      attachRounds(pack, p);
      attachFollowup(pack, frozen);
      attachExploration(
        pack,
        p.sections.flatMap((s) => s.tiles).map((t) => t.source),
      );
      attachClues(pack, frozen);
      attachLair(pack);
      pack.globals.find((v) => v.name === 'clueTotal').value = 0;
      const fort = pack.manifest.prefabs.find((p) => p.source === pack.manifest.lair.prefab);
      pack.definitions
        .find((d) => d.source === fort.fsmSource)
        .states.find((s) => s.index === 3).actions = pack.definitions
        .find((d) => d.source === fort.fsmSource)
        .states.find((s) => s.index === 3)
        .actions.filter((a) => a.op !== 'lore');
      const first = p.sections.find((s) => s.id === 0).tiles[1].source;
      const target = pack.manifest.prefabs.find((m) =>
        p.assignments.some(
          (a) =>
            a.prefab.source === m.source &&
            p.spaces.some((s) => s.id === a.spaceId && s.tileSource === first && s.index === 0),
        ),
      );
      assert.ok(
        target &&
          target.source !== fort.source &&
          !pack.manifest.playablePrefabs.includes(target.source),
      );
      attachItem(pack, catalog, target, 2);
      pack.definitions
        .find((d) => d.source === pack.principal)
        .states.find((s) => s.index === 90)
        .actions.find((a) => a.op === 'lore').amount = lore;
      attachCampSkills(pack, catalog);
      attachCampItems(pack, catalog);
      edit(pack, frozen, catalog);
      sealItem(pack);
      sealLair(pack);
    },
    (c) => {
      sourceCatalog(c);
      addCampItemCards(c);
      addGroupCampCards(c);
      for (const h of c.heroes) {
        h.maxHands = 2;
        h.stats.wit = 6;
        h.stats.wisdom = 6;
      }
      catalog = structuredClone(c);
    },
    (fronts) => {
      fronts.policies.push(itemPolicy(catalog));
    },
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
export async function reachGroupCamp(r) {
  await ok(cycleCommand(r, 'START_TURN'));
  let position = await readSession(r.host);
  const node = position.scenario.instances.find(
    (i) => i.prefab === position.scenario.pack.manifest.items.prefab,
  );
  const destination = position.scenario.spaceBindings.find((b) => b.sourceId === node.spaceId).id;
  const start = position.journey.heroes.find((h) => h.heroId === 'hero-1').spaceId;
  const queue = [[start]],
    visited = new Set([start]);
  let route;
  while (queue.length) {
    const path = queue.shift(),
      here = path.at(-1);
    if (here === destination) {
      route = path;
      break;
    }
    for (const next of position.journey.definition.connections.flatMap(([a, b]) =>
      a === here ? [b] : b === here ? [a] : [],
    ))
      if (!visited.has(next)) {
        visited.add(next);
        queue.push([...path, next]);
      }
  }
  assert.ok(route && route.length <= 3, 'invented group item reachable with one travel action');
  if (route.length > 1) await ok(cycleCommand(r, 'START_TRAVEL'));
  for (let n = 1; n < route.length; n++)
    await ok(
      cycleCommand(r, 'MOVE_HERO', { fromSpaceId: route[n - 1], destinationSpaceId: route[n] }),
    );
  await ok(commitItem(r));
  let s = await finishPhysical(r);
  if (s.scenario.pending?.kind === 'message')
    await ok(scenarioInput(r.host, r.player, { kind: 'ack' }));
  s = await finishPhysical(r);
  assert.equal(s.physical.inventory[0].copy, 'trinket:1');
  assert.equal(s.scenario.play.active, null);
  await ok(cycleCommand(r, 'END_TURN', {}, r.player));
  await reachLair(r, r.other);
  await ok(commitLair(r, r.other));
  s = await finishPhysical(r);
  for (let n = 0; n < 3; n++) await ok(scenarioInput(r.host, r.player, { kind: 'ack' }));
  s = await readSession(r.host);
  assert.equal(s.scenario.conclusion.outcome, 'victory');
  assert.equal(s.scenario.conclusion.stage, 'camp');
  assert.deepEqual(
    s.scenario.conclusion.campaign.inventory.map((i) => i.copy),
    ['trinket:1'],
  );
  return s;
}
export { scenarioInput, readSession, readBackup, ok };
