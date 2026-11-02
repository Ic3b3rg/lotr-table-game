import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { generatorFixture, hash } from './fixtures/map-freeze.mjs';
import { catalogFixture } from './fixtures/catalog.mjs';
import {
  parseGeneratorPack,
  deriveContext,
  buildAttemptInput,
} from '../dist/map-freeze-library.mjs';
function company() {
  const content = catalogFixture();
  content.heroes.forEach((h) => (h.maxHands = 2));
  return {
    content,
    preparation: {
      status: 'prepared',
      heroes: [
        {
          heroId: 'hero-4',
          playerId: randomUUID(),
          roleId: 'role-4',
          itemCopies: ['bow:1', 'armor:1'],
        },
        {
          heroId: 'hero-2',
          playerId: randomUUID(),
          roleId: 'role-2',
          itemCopies: ['sword:1', 'rare-armor:1'],
        },
      ],
      weaknessDeck: [],
    },
  };
}
test('il contesto A1 usa ordine e inventario effettivi della compagnia, senza un contesto fixture nel pack', () => {
  const state = company();
  const pack = parseGeneratorPack(generatorFixture(state.content));
  assert.equal('context' in pack.template.selection, false);
  const context = deriveContext(pack, state);
  assert.equal(context.heroCount, 2);
  assert.deepEqual(
    context.heroes.map((h) => h.catalogId),
    ['hero-4', 'hero-2'],
  );
  assert.deepEqual(
    context.heroes[0].items.map((i) => i.copy),
    ['bow:1', 'armor:1'],
  );
  assert.deepEqual(context.heroes[0].itemIds, [70002, 70003]);
  const input = buildAttemptInput(pack, context, -17, pack.template.selection.incoming, 0);
  assert.equal(input.assembly.selection.context.seed, -17);
  assert.equal(input.assembly.selection.context.heroCount, 2);
  assert.deepEqual(input.assembly.selection.context.heroes[0].itemIds, [70002, 70003]);
  assert.deepEqual(context.usedEncounterIds, []);
  assert.equal(hash(context).length, 64);
});
test('mapping incompleti, catalogo cambiato, upgrade e provenienza incoerenti sono rifiutati', () => {
  const state = company();
  const raw = generatorFixture(state.content);
  const missing = structuredClone(raw);
  missing.mapping.items.pop();
  assert.throws(() => deriveContext(parseGeneratorPack(missing), state));
  const changed = structuredClone(state);
  changed.content.items[0].quantity = 6;
  assert.throws(() => deriveContext(parseGeneratorPack(raw), changed));
  const mapped = structuredClone(raw);
  mapped.mapping.items[0].id = 987654;
  assert.throws(() => parseGeneratorPack(mapped));
  const contaminated = structuredClone(raw);
  contaminated.template.selection.context = { heroCount: 3 };
  assert.throws(() => parseGeneratorPack(contaminated));
  const upgrade = structuredClone(state);
  upgrade.content.items[0].upgrades = ['advanced'];
  const bad = generatorFixture(upgrade.content);
  bad.template.selection.items[0].upgradeSources = [];
  assert.throws(() => deriveContext(parseGeneratorPack(bad), upgrade));
});

test('la pipeline grezza congela geometria, movimento e incontri al confine pre-startup senza diagnostici', async () => {
  const { runGenerationAttempt, validateProjection } = await import(
    '../dist/map-freeze-library.mjs'
  );
  const state = company(),
    pack = parseGeneratorPack(generatorFixture(state.content)),
    context = deriveContext(pack, state);
  const result = runGenerationAttempt(pack, context, {
    requestedSeed: 1,
    seed: 1,
    attempt: 0,
    incoming: pack.template.selection.incoming,
    attempts: [],
  });
  assert.equal(result.status, 'frozen');
  const p = validateProjection(result.projection);
  assert.equal(p.sections.length, 4);
  assert.equal(p.sections.flatMap((s) => s.tiles).length, 8);
  assert.equal(p.spaces.length, 16);
  assert.equal(p.movementGraph.components.length, 1);
  assert.equal(p.assignments.length, 1);
  assert.deepEqual(p.history.usedEncounterIds, [100000]);
  assert.equal(p.continuation.boundary, 'before-BeginAdventure(false)');
  assert.equal(p.continuation.status, 'pending-startup');
  assert.equal(p.continuation.gameplayRng, null);
  assert.equal(p.closure.status, 'pending-prefab-execution');
  assert.equal(p.requestedSeed, 1);
  assert.equal(p.successfulSeed, 1);
  assert.ok(JSON.stringify(p).length < 350000);
  assert.equal('trace' in p, false);
  assert.equal('candidates' in p, false);
  assert.equal('positions' in p.continuation, false);
  assert.deepEqual(validateProjection(JSON.parse(JSON.stringify(p))), p);
  assert.deepEqual(
    runGenerationAttempt(pack, context, {
      requestedSeed: 1,
      seed: 1,
      attempt: 0,
      incoming: pack.template.selection.incoming,
      attempts: [],
    }).projection,
    p,
  );
});
