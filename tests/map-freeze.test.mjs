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
test('gli snapshot RNG congelati devono corrispondere a seed e ordinale anche dopo rehash', async () => {
  const { runGenerationAttempt, validateProjection } = await import(
    '../dist/map-freeze-library.mjs'
  );
  const state = company();
  const pack = parseGeneratorPack(generatorFixture(state.content));
  const context = deriveContext(pack, state);
  const { projection } = runGenerationAttempt(pack, context, {
    requestedSeed: 1,
    seed: 1,
    attempt: 0,
    incoming: pack.template.selection.incoming,
    attempts: [],
  });
  for (const checkpoint of ['geometry', 'final']) {
    const bad = structuredClone(projection);
    bad.rng[checkpoint].seedArray[1]++;
    const { fingerprint, ...data } = bad;
    bad.fingerprint = hash(data);
    assert.throws(() => validateProjection(bad), /RNG/, checkpoint);
  }
  const excessive = structuredClone(projection);
  const samples =
    excessive.policy.selectionOperations +
    excessive.policy.assemblyOperations +
    excessive.policy.encounterOperations +
    1;
  Object.assign(excessive.rng.final, {
    samples,
    inext: ((samples - 1) % 55) + 1,
    inextp: (((samples % 55) + 20) % 55) + 1,
  });
  const { fingerprint, ...data } = excessive;
  excessive.fingerprint = hash(data);
  assert.throws(() => validateProjection(excessive), /RNG.*budget/);
});
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

async function realization() {
  const { runGenerationAttempt } = await import('../dist/map-freeze-library.mjs');
  const state = company(),
    pack = parseGeneratorPack(generatorFixture(state.content)),
    context = deriveContext(pack, state);
  return runGenerationAttempt(pack, context, {
    requestedSeed: 1,
    seed: 1,
    attempt: 0,
    incoming: pack.template.selection.incoming,
    attempts: [],
  }).projection;
}
function rehash(p) {
  const { fingerprint, ...data } = p;
  p.fingerprint = hash(data);
  return p;
}
test('il validatore preserva il raggio cached fonte entro la precisione float32 dopo il movimento della sezione', async () => {
  const { validateProjection } = await import('../dist/map-freeze-library.mjs');
  const p = await realization(),
    radius = p.sections[0].boundingSphere.radius;
  p.sections[0].boundingSphere.radius = Math.fround(radius + Math.max(1, radius) * 1e-7);
  assert.equal(
    validateProjection(rehash(p)).sections[0].boundingSphere.radius,
    p.sections[0].boundingSphere.radius,
  );
});
test('mappe malformate restano invalide anche con fingerprint e checksum ricalcolati', async () => {
  const { validateProjection } = await import('../dist/map-freeze-library.mjs');
  const p = await realization();
  const mutations = [
    (x) => x.sections.pop(),
    (x) => x.sections[0].tiles[0].hexes[0].globalCoords[0]++,
    (x) => (x.sections[0].tiles[0].shape.hexes[0].space = 99),
    (x) => (x.sections[0].boundingSphere.radius += 1),
    (x) => (x.spaces[0].id = 'invented.assets:999/space/0'),
    (x) => (x.spaces[0].connected = []),
    (x) => x.movementGraph.edges.pop(),
    (x) => x.contacts.pop(),
    (x) => (x.assignments[0].prefab.resourceKey = 'invented/wrong'),
    (x) => (x.closure.selectedPrefabSources = []),
    (x) => x.history.usedEncounterIds.push(100000),
    (x) => (x.successfulSeed = 999),
    (x) => x.rng.final.samples++,
    (x) => (x.trace = []),
    (x) => (x.context.heroes[0].items[0].id = 987),
    (x) => (x.continuation.pending = []),
  ];
  for (const mutate of mutations) {
    const x = structuredClone(p);
    mutate(x);
    assert.throws(() => validateProjection(rehash(x)));
  }
});
test('la proiezione conserva e controlla requisiti fissi e origine delle assegnazioni', async () => {
  const { validateProjection } = await import('../dist/map-freeze-library.mjs');
  const p = await realization();
  assert.equal(p.encounterRequirements.sections[0].tileEncounters.length, 1);
  const x = structuredClone(p);
  x.assignments = [];
  x.selectedModels = [];
  x.spawnOrder = [];
  x.closure.selectedPrefabSources = [];
  x.spaces.forEach((s) => (s.encounterId = -1));
  x.history.usedEncounterIds = [];
  assert.throws(() => validateProjection(rehash(x)));
});

test('la ripresa ricostruisce dal seed richiesto i confini puliti e rifiuta pool alterati anche se rehashed', async () => {
  const { runGenerationAttempt, verifyPendingReplay, GENERATION_POLICY } = await import(
    '../dist/map-freeze-library.mjs'
  );
  const { addEncounter, synchronize } = await import('./fixtures/map-encounters.mjs');
  const state = company(),
    raw = generatorFixture(state.content),
    holder = { assembly: { selection: raw.template.selection }, placement: raw.template.placement };
  const section = raw.template.placement.sections[0];
  section.tileEncounters.push(structuredClone(section.tileEncounters[0]));
  addEncounter(holder, { type: 0 });
  synchronize(holder);
  const pack = parseGeneratorPack(raw),
    context = deriveContext(pack, state),
    failed = runGenerationAttempt(pack, context, {
      requestedSeed: 3,
      seed: 3,
      attempt: 0,
      incoming: pack.template.selection.incoming,
      attempts: [],
    });
  assert.equal(failed.status, 'failed');
  assert.equal(failed.retry, true);
  const job = {
    id: randomUUID(),
    packFingerprint: hash(pack),
    contextFingerprint: hash(context),
    context,
    requestedSeed: 3,
    seed: 4,
    attempt: 1,
    incoming: failed.incoming,
    attempts: [failed.record],
    policy: GENERATION_POLICY,
  };
  assert.equal(verifyPendingReplay(pack, job), true);
  const forged = structuredClone(job);
  forged.incoming.randomEncounterPool.push(raw.template.placement.models[0].source);
  forged.attempts[0].retainedFingerprint = hash(forged.incoming);
  assert.throws(() => verifyPendingReplay(pack, forged));
  const wrong = structuredClone(job);
  wrong.attempts[0].rng.seedArray[1]++;
  assert.throws(() => verifyPendingReplay(pack, wrong));
});

test('una realizzazione di nuova A1 non può importare una storia iniziale inventata con rehash', async () => {
  const { validateProjection } = await import('../dist/map-freeze-library.mjs');
  const p = await realization();
  p.context.usedEncounterIds.push(1234567);
  p.contextFingerprint = hash(p.context);
  p.history.usedEncounterIds.unshift(1234567);
  assert.throws(() => validateProjection(rehash(p)));
});
