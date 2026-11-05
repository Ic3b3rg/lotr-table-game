// Invented pre-startup company, map, source programs and supplies only.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readyScenario, scenarioInput, startScenario } from './scenario-helper.mjs';
import { attachEncounter, sourceCatalog } from './original-encounter-helper.mjs';
import { attachRounds } from './fixtures/source-rounds.mjs';
import { attachExploration } from './fixtures/exploration.mjs';
import { attachFailure } from './fixtures/adventure-failure.mjs';
import { attachSearches, sealSearches } from './fixtures/search-encounters.mjs';
import { diagnosticRaw, inventedFrontInput } from './fixtures/physical-fronts.mjs';
import { inventedLastStand } from './fixtures/last-stand.mjs';
import { compilePhysicalFronts, compileLastStand } from '../dist/physical-resolution-library.mjs';
import { startLinked, ok } from './linked-http-helper.mjs';
import { readSession } from './skill-test-helper.mjs';
import { command } from './preparation-helper.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';
import { parseScenarioPack } from '../dist/scenario-library.mjs';
import { hash } from './fixtures/map-freeze.mjs';
export { ok };

export async function prepareSearches(
  t,
  { edit = () => {}, catalogEdit = () => {}, frontEdit = () => {} } = {},
) {
  let catalogue;
  const r = await readyScenario(
    t,
    (pack, frozen) => {
      const projection = frozen.mapGeneration.projection,
        tile = projection.sections.find((s) => s.id === 0).tiles[0].source,
        at = (index) =>
          pack.manifest.prefabs.find((p) =>
            projection.assignments.some(
              (a) =>
                a.prefab.source === p.source &&
                projection.spaces.some(
                  (s) => s.id === a.spaceId && s.tileSource === tile && s.index === index,
                ),
            ),
          ),
        first = at(1),
        target = at(0),
        third = pack.manifest.prefabs.find((p) => p !== first && p !== target);
      assert.ok(first && target && third);
      for (const p of [target, first])
        p.nodeSource = `${p.modelSource.split(':')[0]}:${p.nodeSource.split(':')[1]}`;
      // All generated assignments and pools are retained. Programs are declared before startup.
      pack.manifest.prefabs = [third, ...pack.manifest.prefabs.filter((p) => p !== third)];
      attachEncounter(pack);
      attachRounds(pack, projection);
      attachExploration(
        pack,
        projection.sections.flatMap((s) => s.tiles).map((t) => t.source),
      );
      attachFailure(pack);
      attachSearches(pack, [target, first]);
      pack.preparedEffects = catalogue.skills.map((c) => ({
        skillId: c.id,
        cardHash: hash(c),
        effect: 'inspiration',
        amount: 1,
      }));
      edit(pack, frozen);
      sealSearches(pack);
      parseScenarioPack(pack);
    },
    (c) => {
      catalogue = c;
      sourceCatalog(c);
      for (const h of c.heroes)
        Object.assign(h.stats, { wisdom: 2, inspiration: 3, damage: 6, fear: 6 });
      for (const s of c.skills) Object.assign(s, { success: 0, fate: 1 });
      catalogEdit(c);
    },
    (raw) => {
      const tile = raw.template.geometry.tiles.find(
        (t) => t.source === raw.template.selection.standard[0].source,
      );
      tile.hexes.forEach((h, n) => (h.space = n === 0 ? 1 : 0));
    },
  );
  const raw = diagnosticRaw(),
    ir = inventedFrontInput(raw);
  for (const d of ir.definitions) d.body = [{ op: 'keep-faceup' }];
  for (const card of r.catalog.skills)
    ir.policies.push({
      id: card.id,
      kind: 'skill',
      definitionHash: hash(card),
      source: { sourceId: 'invented-search', locator: 'invented prepared skill' },
      effects: [{ op: 'after-prepare-inspiration' }],
    });
  frontEdit(ir, r.catalog, raw, r);
  for (const [name, value] of [
    ['physical-content', raw],
    ['physical-fronts', compilePhysicalFronts(raw, ir, r.catalog)],
    ['physical-last-stand', compileLastStand(raw, inventedLastStand(raw))],
  ])
    await writeFile(join(r.host.dataDir, name + '.json'), JSON.stringify(value));
  return r;
}
export async function readySearches(t, options = {}) {
  const r = await prepareSearches(t, options);
  await ok(startScenario(r.host, r.player));
  for (let n = 0; n < 60; n++) {
    const s = await readSession(r.host),
      q = s.scenario.pending;
    if (!q) return r;
    const actor = q.actorPlayerId === r.other.body.player.id ? r.other : r.player;
    const input =
      q.kind === 'scout'
        ? q.stage === 'ready'
          ? { kind: 'scout-reveal' }
          : {
              kind: 'scout-resolve',
              prepareCopy: s.scout.revealed[0],
              top: s.scout.revealed.slice(1),
              bottom: [],
              discardPreparedCopy: null,
            }
        : q.kind === 'test'
          ? { kind: q.stage === 'ready' ? 'test-reveal' : 'test-resolve' }
          : { kind: 'ack' };
    await ok(scenarioInput(r.host, actor, input));
  }
  assert.fail('invented search startup did not complete');
}
export function searchNode(s, role = 'choice') {
  const owner = s.scenario.pack.manifest.searches.encounters.find((e) => e.role === role);
  return s.scenario.instances.find((i) => i.prefab === owner.prefab);
}
export function searchIntent(s, role = 'choice') {
  const sc = s.scenario,
    i = searchNode(s, role);
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
export async function reachSearch(r, role = 'choice', actor = r.player) {
  let s = await readSession(r.host);
  if (!s.round.activeHeroId) await ok(cycleCommand(r, 'START_TURN', {}, actor));
  s = await readSession(r.host);
  const hero = s.preparation.heroes.find((h) => h.playerId === actor.body.player.id),
    fromSpaceId = s.journey.heroes.find((h) => h.heroId === hero.heroId).spaceId,
    destinationSpaceId = s.scenario.spaceBindings.find(
      (b) => b.sourceId === searchNode(s, role).spaceId,
    ).id;
  if (!s.journey.travel?.remaining) await ok(cycleCommand(r, 'START_TRAVEL', {}, actor));
  if (fromSpaceId !== destinationSpaceId) {
    await ok(cycleCommand(r, 'MOVE_HERO', { fromSpaceId, destinationSpaceId }, actor));
  }
  return readSession(r.host);
}
export async function commitSearch(r, role = 'choice', actor = r.player, overrides = {}) {
  const s = await readSession(r.host);
  return command(r.host, actor, { ...searchIntent(s, role), ...overrides }, s);
}
export async function resolveCount(r, converted, actor = r.player) {
  await ok(scenarioInput(r.host, actor, { kind: 'physical-choice', option: 'reveal' }));
  for (let n = 0; n < converted; n++)
    await ok(scenarioInput(r.host, actor, { kind: 'physical-choice', option: 'inspiration' }));
  await ok(scenarioInput(r.host, actor, { kind: 'physical-choice', option: 'resolve' }));
  return readSession(r.host);
}
