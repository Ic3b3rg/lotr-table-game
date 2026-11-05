// All identities, packets, quantities and pre-startup choices are invented.
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readyScenario } from './scenario-helper.mjs';
import { attachEncounter, sourceCatalog, finishPhysical } from './original-encounter-helper.mjs';
import { attachRounds } from './fixtures/source-rounds.mjs';
import { attachExploration } from './fixtures/exploration.mjs';
import { attachFailure } from './fixtures/adventure-failure.mjs';
import { attachBaseProducts, sealBaseProducts } from './fixtures/base-products.mjs';
import { diagnosticRaw, inventedFrontInput } from './fixtures/physical-fronts.mjs';
import { inventedLastStand } from './fixtures/last-stand.mjs';
import { compilePhysicalFronts, compileLastStand } from '../dist/physical-resolution-library.mjs';
import { startLinked, ok } from './linked-http-helper.mjs';
import { command } from './preparation-helper.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';
import { readSession } from './skill-test-helper.mjs';
export { ok, finishPhysical };

export async function prepareBase(
  t,
  {
    edit = () => {},
    catalogEdit = () => {},
    frontEdit = () => {},
    unexploredNeighbor = false,
  } = {},
) {
  const r = await readyScenario(
    t,
    (pack, frozen) => {
      const projection = frozen.mapGeneration.projection,
        firstTile = projection.sections.find((s) => s.id === 0).tiles[0].source;
      const atIndex = (index) =>
        pack.manifest.prefabs.find((p) =>
          projection.assignments.some(
            (a) =>
              a.prefab.source === p.source &&
              projection.spaces.some(
                (s) => s.id === a.spaceId && s.tileSource === firstTile && s.index === index,
              ),
          ),
        );
      const first = atIndex(1),
        target = atIndex(0);
      // Declare distinct owners at fixture construction, preserving every map assignment and pool.
      pack.manifest.prefabs = [first, ...pack.manifest.prefabs.filter((p) => p !== first)];
      attachEncounter(pack);
      attachRounds(pack, frozen.mapGeneration.projection);
      attachExploration(
        pack,
        frozen.mapGeneration.projection.sections.flatMap((s) => s.tiles).map((t) => t.source),
      );
      attachFailure(pack);
      attachBaseProducts(pack, target, 3);
      if (unexploredNeighbor)
        pack.definitions
          .find((d) => d.source === pack.principal)
          .states.find((s) => s.index === 7).actions = [];
      edit(pack, frozen);
      sealBaseProducts(pack);
    },
    (c) => {
      sourceCatalog(c);
      for (const h of c.heroes) {
        h.stats.wisdom = 2;
        h.stats.inspiration = 3;
      }
      for (const s of c.skills) {
        s.success = 1;
        s.fate = 1;
      }
      catalogEdit(c);
    },
    (raw) => {
      // Invented center/start and connected outer space, declared before generation.
      const tile = raw.template.geometry.tiles.find(
        (t) => t.source === raw.template.selection.standard[0].source,
      );
      tile.hexes.forEach((h, n) => (h.space = n === 0 ? 1 : 0));
    },
  );
  const raw = diagnosticRaw(),
    ir = inventedFrontInput(raw);
  for (const d of ir.definitions) d.body = [{ op: 'keep-faceup' }];
  frontEdit(ir, r.catalog, raw, r);
  for (const [name, value] of [
    ['physical-content', raw],
    ['physical-fronts', compilePhysicalFronts(raw, ir, r.catalog)],
    ['physical-last-stand', compileLastStand(raw, inventedLastStand(raw))],
  ])
    await writeFile(join(r.host.dataDir, name + '.json'), JSON.stringify(value));
  return r;
}
export async function readyBase(t, options = {}) {
  return startLinked(await prepareBase(t, options));
}
export function baseNode(s) {
  return s.scenario.instances.find(
    (i) => i.prefab === s.scenario.pack.manifest.baseProducts.prefab,
  );
}
export function baseIntent(s) {
  const sc = s.scenario,
    i = baseNode(s);
  return {
    type: 'INTERACT_SCENARIO',
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
export async function reachBase(r, actor = r.player) {
  let s = await readSession(r.host);
  if (!s.round.activeHeroId) {
    await ok(cycleCommand(r, 'START_TURN', {}, actor));
    s = await readSession(r.host);
  }
  const destinationSpaceId = s.scenario.spaceBindings.find(
    (b) => b.sourceId === baseNode(s).spaceId,
  ).id;
  const hero = s.preparation.heroes.find((h) => h.playerId === actor.body.player.id),
    fromSpaceId = s.journey.heroes.find((h) => h.heroId === hero.heroId).spaceId;
  if (fromSpaceId !== destinationSpaceId) {
    await ok(cycleCommand(r, 'START_TRAVEL', {}, actor));
    await ok(cycleCommand(r, 'MOVE_HERO', { fromSpaceId, destinationSpaceId }, actor));
  }
  return readSession(r.host);
}
export async function commitBase(r, actor = r.player, overrides = {}) {
  const s = await readSession(r.host);
  return command(r.host, actor, { ...baseIntent(s), ...overrides }, s);
}
