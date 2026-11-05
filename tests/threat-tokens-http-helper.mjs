// Invented pre-startup company, map, source programs and supplies only.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readyScenario, scenarioInput, startScenario } from './scenario-helper.mjs';
import { attachEncounter, sourceCatalog } from './original-encounter-helper.mjs';
import { attachRounds } from './fixtures/source-rounds.mjs';
import { attachExploration } from './fixtures/exploration.mjs';
import { attachFailure } from './fixtures/adventure-failure.mjs';
import { attachThreatTokens, sealThreatTokens } from './fixtures/threat-tokens.mjs';
import { diagnosticRaw, inventedFrontInput } from './fixtures/physical-fronts.mjs';
import { inventedLastStand } from './fixtures/last-stand.mjs';
import { compilePhysicalFronts, compileLastStand } from '../dist/physical-resolution-library.mjs';
import { startLinked, ok } from './linked-http-helper.mjs';
import { readSession } from './skill-test-helper.mjs';
import { command } from './preparation-helper.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';
import { parseScenarioPack } from '../dist/scenario-library.mjs';
import { hash } from './fixtures/map-freeze.mjs';
import { boonFixture } from './fixtures/boons.mjs';
import { compileBoons } from '../dist/physical-resolution-library.mjs';
export { ok };

export async function prepareThreatTokens(
  t,
  { edit = () => {}, catalogEdit = () => {}, frontEdit = () => {}, stockVerified = true } = {},
) {
  let catalogue;
  const boonData = boonFixture(stockVerified),
    boons = compileBoons(boonData.raw, boonData.boonInput);
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
      attachThreatTokens(pack, [first, target]);
      pack.manifest.boons = { version: 'source-boons-v1', fingerprint: boons.fingerprint };
      pack.preparedEffects = catalogue.skills.map((c) => ({
        skillId: c.id,
        cardHash: hash(c),
        effect: 'inspiration',
        amount: 1,
      }));
      edit(pack, frozen);
      sealThreatTokens(pack);
      parseScenarioPack(pack);
    },
    (c) => {
      catalogue = c;
      sourceCatalog(c);
      for (const h of c.heroes)
        Object.assign(h.stats, { wisdom: 2, spirit: 2, inspiration: 3, damage: 6, fear: 6 });
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
  const raw = boonData.raw,
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
    ['physical-boons', boons],
  ])
    await writeFile(join(r.host.dataDir, name + '.json'), JSON.stringify(value));
  return r;
}
export async function readyThreatTokens(t, options = {}) {
  const r = await prepareThreatTokens(t, options);
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
              prepareCopy: options.setupPrepare === false ? null : s.scout.revealed[0],
              top: options.setupPrepare === false ? s.scout.revealed : s.scout.revealed.slice(1),
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
export function threatTokenNode(s, role = 'retry') {
  const owner = s.scenario.pack.manifest.threatTokens.encounters.find((e) => e.role === role);
  return s.scenario.instances.find((i) => i.prefab === owner.prefab);
}
export function threatTokenIntent(s, role = 'retry') {
  const sc = s.scenario,
    i = threatTokenNode(s, role);
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
export async function reachThreatToken(r, role = 'retry', actor = r.player) {
  let s = await readSession(r.host);
  if (!s.round.activeHeroId) await ok(cycleCommand(r, 'START_TURN', {}, actor));
  s = await readSession(r.host);
  const hero = s.preparation.heroes.find((h) => h.playerId === actor.body.player.id),
    fromSpaceId = s.journey.heroes.find((h) => h.heroId === hero.heroId).spaceId,
    destinationSpaceId = s.scenario.spaceBindings.find(
      (b) => b.sourceId === threatTokenNode(s, role).spaceId,
    ).id;
  if (fromSpaceId !== destinationSpaceId) {
    if (!s.journey.travel?.remaining) await ok(cycleCommand(r, 'START_TRAVEL', {}, actor));
    await ok(cycleCommand(r, 'MOVE_HERO', { fromSpaceId, destinationSpaceId }, actor));
  }
  return readSession(r.host);
}
export async function commitThreatToken(r, role = 'retry', actor = r.player, overrides = {}) {
  const s = await readSession(r.host);
  return command(r.host, actor, { ...threatTokenIntent(s, role), ...overrides }, s);
}
export async function resolveThreatTest(r, converted, actor = r.player) {
  await ok(scenarioInput(r.host, actor, { kind: 'physical-choice', option: 'reveal' }));
  for (let n = 0; n < converted; n++) {
    await ok(scenarioInput(r.host, actor, { kind: 'physical-choice', option: 'inspiration' }));
    const q = (await readSession(r.host)).physical.active;
    if (q?.mode === 'select')
      await ok(scenarioInput(r.host, actor, { kind: 'physical-select', ids: [q.options[0].id] }));
  }
  await ok(scenarioInput(r.host, actor, { kind: 'physical-choice', option: 'resolve' }));
  return readSession(r.host);
}
