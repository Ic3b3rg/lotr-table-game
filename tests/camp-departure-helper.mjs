import { parseScenarioPack } from '../dist/scenario-library.mjs';
import { attachDeparture } from './fixtures/camp-departure.mjs';
// Entirely invented source and catalog. Three owners; no conclusion/camp is seeded.
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { catalogFixture } from './fixtures/catalog.mjs';
import { generatorFixture, hash } from './fixtures/map-freeze.mjs';
import { fixed, addEncounter } from './fixtures/map-encounters.mjs';
import { setup, command } from './preparation-helper.mjs';
import { joinPlayer } from './host-helper.mjs';
import { generate, waitGeneration } from './map-generation-helper.mjs';
import { scenarioFor, startScenario, scenarioInput } from './scenario-helper.mjs';
import { sourceCatalog, attachEncounter } from './original-encounter-helper.mjs';
import { attachRounds } from './fixtures/source-rounds.mjs';
import { attachFollowup } from './fixtures/shadow-followup.mjs';
import { attachExploration } from './fixtures/exploration.mjs';
import { attachClues } from './clue-progression-http-helper.mjs';
import { attachLair, sealLair } from './fixtures/lair-victory.mjs';
import { attachCampSkills } from './fixtures/camp-skills.mjs';
import { attachCampItems, addCampItemCards } from './fixtures/camp-items.mjs';
import { attachCampPreparation } from './fixtures/camp-preparation.mjs';
import { diagnosticRaw, inventedFrontInput } from './fixtures/physical-fronts.mjs';
import { inventedLastStand } from './fixtures/last-stand.mjs';
import { compilePhysicalFronts, compileLastStand } from '../dist/physical-resolution-library.mjs';
import { readSession, readBackup } from './skill-test-helper.mjs';
import { reachLair, commitLair, ok } from './lair-victory-http-helper.mjs';

export async function readyDeparture(
  t,
  { edit = () => {}, catalogEdit = () => {}, outcome = 'win' } = {},
) {
  const directory = await mkdtemp(join(tmpdir(), 'lotr-departure-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const catalog = catalogFixture();
  sourceCatalog(catalog);
  addCampItemCards(catalog);
  for (const h of catalog.heroes) {
    h.maxHands = 2;
    h.stats.wit = 6;
  }
  if (outcome === 'loss') {
    catalog.heroes[0].stats.wit = 0;
    catalog.heroes[0].stats.fear = 1;
  }
  catalogEdit(catalog);
  const raw = generatorFixture(catalog),
    input = { assembly: { selection: raw.template.selection }, placement: raw.template.placement };
  fixed(input, 0, 0, addEncounter(input), 1);
  fixed(input, 0, 1, addEncounter(input), 0);
  for (const tile of [2, 3])
    for (const space of [0, 1]) fixed(input, 1, tile, addEncounter(input), space);
  for (const tile of raw.template.geometry.tiles)
    for (const h of tile.hexes) {
      h.render.polygon = Array.from({ length: 6 }, (_, i) => [
        Math.fround(Math.cos((i * Math.PI) / 3)),
        Math.fround(Math.sin((i * Math.PI) / 3)),
        0,
      ]);
      h.render.uv = Array.from({ length: 6 }, () => [0, 0]);
    }
  const generatorPath = join(directory, 'generator.json'),
    scenarioPath = join(directory, 'scenario.json');
  await writeFile(generatorPath, JSON.stringify(raw));
  const host = await setup(t, catalog, {
    LOTR_GENERATOR_PACK: generatorPath,
    LOTR_SCENARIO_PACK: scenarioPath,
  });
  const actors = [];
  for (const name of ['Ada inventata', 'Bruno inventato', 'Carla inventata'])
    actors.push(await joinPlayer(host, name));
  for (const [i, actor] of actors.entries())
    await ok(command(host, actor, { type: 'SELECT_HEROES', heroIds: [`hero-${i + 1}`] }));
  await ok(command(host, actors[0], { type: 'PREPARE_COMPANY', agreed: true }));
  await ok(generate(host, actors[0]));
  const frozen = await waitGeneration(host),
    pack = scenarioFor(frozen.mapGeneration.projection);
  pack.name = 'Partenza a tre · episodio interamente inventato';
  attachEncounter(pack);
  attachRounds(pack, frozen.mapGeneration.projection);
  attachFollowup(pack, frozen);
  attachExploration(
    pack,
    frozen.mapGeneration.projection.sections.flatMap((s) => s.tiles).map((t) => t.source),
  );
  attachClues(pack, frozen);
  attachLair(pack);
  pack.globals.find((v) => v.name === 'clueTotal').value = 0;
  const fort = pack.manifest.prefabs.find((p) => p.source === pack.manifest.lair.prefab);
  const lair = pack.definitions.find((d) => d.source === fort.fsmSource);
  lair.states.find((s) => s.index === 3).actions = lair.states
    .find((s) => s.index === 3)
    .actions.filter((a) => a.op !== 'lore');
  attachCampSkills(pack).catalogFingerprint = hash(catalog);
  attachCampItems(pack, catalog);
  attachCampPreparation(pack, catalog);
  if (outcome === 'loss')
    lair.states.find((s) => s.index === 103).actions[0].consequence = {
      family: 'fear',
      amount: 2,
      face: 'faceup',
    };
  const physical = diagnosticRaw(),
    frontInput = inventedFrontInput(physical);
  if (outcome === 'loss')
    for (const d of frontInput.definitions.filter((d) => d.cardId.includes('fear')))
      d.body = [{ op: 'keep-faceup' }];
  attachDeparture(pack, catalog, physical, frontInput);
  edit(pack, frozen, catalog, frontInput);
  sealLair(pack);
  parseScenarioPack(pack);
  await writeFile(scenarioPath, JSON.stringify(pack));
  await writeFile(join(host.dataDir, 'physical-content.json'), JSON.stringify(physical));
  await writeFile(
    join(host.dataDir, 'physical-fronts.json'),
    JSON.stringify(compilePhysicalFronts(physical, frontInput, catalog)),
  );
  await writeFile(
    join(host.dataDir, 'physical-last-stand.json'),
    JSON.stringify(compileLastStand(physical, inventedLastStand(physical))),
  );
  const r = {
    host,
    outcome,
    actors,
    player: actors[0],
    other: actors[1],
    catalog,
    pack,
    scenarioPath,
    frozen,
  };
  await ok(startScenario(host, r.player));
  await finishSetup(r);
  return r;
}
export async function finishSetup(r) {
  for (let n = 0; n < 120; n++) {
    const s = await readSession(r.host),
      q = s.scenario.pending;
    if (!q) return s;
    const actor = r.actors.find((a) => a.body.player.id === q.actorPlayerId) ?? r.player;
    const input = automaticInput(s);
    await ok(scenarioInput(r.host, actor, input));
  }
  assert.fail('Invented setup did not return');
}
export function automaticInput(s) {
  const q = s.scenario.pending,
    p = s.physical.active;
  if (q.kind === 'scout')
    return q.stage === 'ready'
      ? { kind: 'scout-reveal' }
      : {
          kind: 'scout-resolve',
          prepareCopy: null,
          top: s.scout.revealed,
          bottom: [],
          discardPreparedCopy: null,
        };
  if (q.kind === 'test') return { kind: q.stage === 'ready' ? 'test-reveal' : 'test-resolve' };
  if (q.kind !== 'physical') return { kind: 'ack' };
  if (p.mode === 'scout')
    return {
      kind: 'physical-scout',
      prepare: null,
      top: p.options.map((o) => o.id),
      bottom: [],
      discard: null,
    };
  if (p.mode === 'select')
    return { kind: 'physical-select', ids: p.options.slice(0, p.minimum).map((o) => o.id) };
  if (p.mode === 'allocate')
    return { kind: 'physical-allocate', ability: p.options[0]?.id ?? null, damage: 0, fear: 0 };
  return {
    kind: 'physical-choice',
    option:
      ['reveal', 'resolve', 'close', 'close-rest'].find((id) =>
        p.options.some((o) => o.id === id),
      ) ?? p.options[0].id,
  };
}
export async function reachDepartureCamp(r) {
  await reachLair(r);
  await ok(commitLair(r));
  for (let n = 0; n < 130; n++) {
    const s = await readSession(r.host),
      q = s.scenario.pending;
    if (s.scenario.conclusion?.stage === 'camp') return s;
    if (!q && r.outcome === 'loss' && !s.scenario.conclusion) {
      const { cycleCommand } = await import('./physical-cycle-helper.mjs');
      for (const h of s.preparation.heroes) {
        const at = await readSession(r.host);
        if (at.round.heroes.find((p) => p.heroId === h.heroId).turnEnded) continue;
        const actor = r.actors.find((a) => a.body.player.id === h.playerId);
        if (at.round.activeHeroId !== h.heroId)
          await ok(cycleCommand(r, 'START_TURN', { heroId: h.heroId }, actor));
        await ok(cycleCommand(r, 'END_TURN', { heroId: h.heroId }, actor));
      }
      await ok(cycleCommand(r, 'BEGIN_SHADOW', {}, r.actors[1]));
      continue;
    }
    assert.ok(q, 'Source conclusion is required');
    const actor = r.actors.find((a) => a.body.player.id === q.actorPlayerId) ?? r.player;
    await ok(scenarioInput(r.host, actor, automaticInput(s)));
  }
  assert.fail('Real conclusion did not reach camp');
}
export async function confirmedCamp(r) {
  await reachDepartureCamp(r);
  await ok(scenarioInput(r.host, r.player, { kind: 'camp-prepare' }));
  for (const actor of r.actors) {
    const s = await readSession(r.host),
      hero = s.preparation.heroes.find((h) => h.playerId === actor.body.player.id),
      choice = s.scenario.conclusion.campaign.preparation.heroes.find(
        (h) => h.heroId === hero.heroId,
      );
    await ok(
      scenarioInput(r.host, actor, {
        kind: 'camp-confirm',
        heroId: hero.heroId,
        summaryHash: choice.summaryHash,
      }),
    );
  }
  return readSession(r.host);
}
export { scenarioInput, readSession, readBackup, ok, command };
