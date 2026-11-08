import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseGeneratorPack,
  deriveContext,
  runGenerationAttempt,
  validateProjection,
} from '../dist/map-freeze-library.mjs';
import { hash } from './fixtures/map-freeze.mjs';
import { catalogFixture } from './fixtures/catalog.mjs';
import { adventure3Generator } from './fixtures/adventure3-startup.mjs';
import { attachAdventure3 } from './fixtures/adventure3-startup.mjs';
import { departureFixture } from './fixtures/camp-departure.mjs';
import { attachBattleCombat } from './fixtures/battle-combat.mjs';
import { attachBattleRounds } from './fixtures/battle-rounds.mjs';
import { certificates } from './fixtures/exploration.mjs';
import { runtime } from './adventure3-startup-runtime.mjs';

export async function journeyAuthority() {
  const f = await departureFixture();
  attachBattleCombat(
    f.input.pack,
    { preparation: { heroes: f.catalog.heroes.slice(0, 3).map((h) => ({ heroId: h.id })) } },
    f.catalog,
    (dep, src, pack, frozen, catalog) => {
      dep.combat.terminal.failure.next = { id: 3, source: 'example.assets:990' };
      for (const s of dep.combat.terminal.definition.states)
        for (const a of s.actions)
          if (a.op === 'nextAdventure') {
            a.id = 3;
            a.source = 'example.assets:990';
          }
      dep.combat.terminal.certificate = certificates({
        definitions: [dep.combat.terminal.definition],
      })[0];
      attachAdventure3(dep, src, pack, frozen, catalog);
      attachBattleRounds(dep, src, pack, frozen, catalog);
    },
  );
  return f.cap;
}

test('prospective journey authority compiles every startup owner and shared encounter prefab', async () => {
  const dep = await journeyAuthority(),
    checked = runtime.validateJourneyDepartureSource(dep.continuation);
  assert.equal(checked.startup.pack.identity.adventureId, 3);
  assert.equal(checked.startup.pack.manifest.prefabs.length, 4);
  assert.equal(new Set(checked.startup.pack.manifest.prefabs.map((p) => p.source)).size, 2);
});

test('A3 runs every section through selection, assembly, encounters and replay with the entire ordered bucket', async () => {
  const content = catalogFixture(),
    pack = parseGeneratorPack(adventure3Generator(content)),
    context = deriveContext(pack, {
      content,
      preparation: {
        status: 'prepared',
        heroes: [1, 2, 3].map((n) => ({
          heroId: `hero-${n}`,
          roleId: `role-${n}`,
          itemCopies: [],
          playerId: `00000000-0000-4000-8000-00000000000${n}`,
        })),
        weaknessDeck: [],
      },
    });
  context.usedEncounterIds = [100001, 100002];
  context.usedGroupIds = [90099];
  const result = runGenerationAttempt(pack, context, {
    requestedSeed: 1,
    seed: 1,
    attempt: 0,
    incoming: pack.template.selection.incoming,
    attempts: [],
  });
  assert.equal(result.status, 'frozen', JSON.stringify(result.record));
  validateProjection(result.projection);
  assert.equal(result.projection.sections.length, 7);
  assert.ok(result.projection.sections.every((s) => s.tiles.length));
  assert.equal(result.projection.assignments.length, 4);
  assert.deepEqual(result.projection.context.usedEncounterIds, [100001, 100002]);
  assert.equal(result.projection.algorithm, 'frozen-A3-v1');
  const cap = (await journeyAuthority()).continuation,
    bound = runtime.bindJourneyStartup(cap, result.projection);
  runtime.validateScenarioBinding(bound.pack, result.projection);
  assert.equal(
    bound.pack.manifest.followup.explorationNodes.length,
    result.projection.sections.flatMap((s) => s.tiles).length,
  );
  const bad = structuredClone(result.projection);
  bad.sections[6].tiles[0].worldPosition[0] += 1;
  const { fingerprint, ...data } = bad;
  bad.fingerprint = hash(data);
  assert.throws(() => validateProjection(bad));
});

test('re-signed prospective sources reject missing owners, altered counters, old geometry and narrowed pools', async () => {
  const original = (await journeyAuthority()).continuation;
  for (const edit of [
    (c) => c.generator.template.selection.standard.pop(),
    (c) => (c.generator.template.geometry.mapPosition = [0, 0, 0]),
    (c) => c.startup.pack.manifest.prefabs.pop(),
    (c) => (c.startup.pack.manifest.rounds.threat.limit = 39),
    (c) => (c.startup.pack.manifest.journeyStartup.reserved[0].count = 0),
    (c) => (c.startup.pack.definitions[0].states[2].actions[0].scoutCount = 2),
    (c) => delete c.startup.pack.manifest.startupPreparation,
  ]) {
    const changed = structuredClone(original);
    edit(changed);
    changed.generatorHash = hash(changed.generator);
    changed.startupHash = hash(changed.startup);
    assert.throws(() => runtime.validateJourneyDepartureSource(changed));
  }
});

test('prospective A3 accepts the complete seven-section recipe without reinterpreting the four-section A1 format', () => {
  const raw = adventure3Generator(catalogFixture());
  const parsed = parseGeneratorPack(raw);
  assert.equal(parsed.identity.adventureId, 3);
  assert.equal(parsed.template.selection.standard.length, 120);
  assert.deepEqual(
    parsed.template.selection.sections.map((s) => s.index),
    [0, 1, 2, 3, 4, 5, 6],
  );
  assert.deepEqual(parsed.template.selection.requiredConnections, [
    [0, 1],
    [1, 3],
    [1, 4],
    [1, 5],
    [1, 6],
    [1, 2],
  ]);
  const disguised = structuredClone(raw);
  disguised.algorithm = 'session-A1-generator-pack-v1';
  disguised.identity.adventureId = 1;
  assert.throws(() => parseGeneratorPack(disguised));
});
