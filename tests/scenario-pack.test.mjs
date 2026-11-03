import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startHost } from './host-helper.mjs';
import { hash } from './fixtures/map-freeze.mjs';
import { scenarioFixture } from './fixtures/scenario.mjs';
const lib = await import('../dist/scenario-library.mjs').catch(() => null);
test('schema10 aggiunge scenario null senza attivare un consumer', async (t) => {
  const host = await startHost();
  t.after(() => host.dispose());
  const state = await (await host.request('/api/session')).json();
  assert.equal(state.schemaVersion, 10);
  assert.equal(state.scenario, null);
});
test('IR stretta: digest, transizioni, variabili, source e azioni sconosciute sono verificati', () => {
  assert.ok(lib, 'Scenario library must be built');
  const raw = scenarioFixture();
  assert.equal(lib.parseScenarioPack(raw).fingerprint, hash(raw));
  for (const edit of [
    (p) => p.definitions[0].states[0].actions.push({ op: 'eval', index: 9, code: 'true' }),
    (p) => (p.definitions[0].states[0].transitions.FINISHED = 999),
    (p) => (p.definitions[0].initial = 999),
    (p) => (p.definitions[0].states[0].actions[0].target = { scope: 'local', name: 'missing' }),
    (p) => (p.manifest.prefabs[0].fsmSource = 'example.assets:999'),
  ]) {
    const bad = structuredClone(raw);
    edit(bad);
    assert.throws(() => lib.parseScenarioPack(bad));
  }
});
test('adattatore usa poligoni interi e movementGraph, senza mutare freeze o RNG', async (t) => {
  const { readyGenerator, generate, waitGeneration } = await import('./map-generation-helper.mjs');
  const { host, player } = await readyGenerator(t, (raw) => {
    for (const tile of raw.template.geometry.tiles)
      for (const h of tile.hexes) {
        h.render.polygon = Array.from({ length: 6 }, (_, i) => [
          Math.fround(Math.cos((i * Math.PI) / 3)),
          Math.fround(Math.sin((i * Math.PI) / 3)),
          0,
        ]);
        h.render.uv = Array.from({ length: 6 }, () => [0, 0]);
      }
  });
  assert.equal((await generate(host, player)).status, 200);
  const p = (await waitGeneration(host)).mapGeneration.projection;
  const before = structuredClone(p);
  assert.equal(typeof lib?.projectionToJourney, 'function');
  const start = p.spaces.find((s) => s.sectionId === 0);
  const { definition, bindings } = lib.projectionToJourney(p, start.id, 'Mappa inventata');
  assert.equal(definition.spaces.length, p.spaces.length);
  assert.equal(definition.connections.length, p.movementGraph.edges.length);
  assert.equal(new Set(bindings.map((b) => b.id)).size, p.spaces.length);
  assert.deepEqual(p, before);
  for (const s of definition.spaces)
    for (const h of s.hexes)
      for (const pt of h.polygon) {
        assert.ok(
          pt.x >= 8 && pt.y >= 8 && pt.x <= definition.width - 8 && pt.y <= definition.height - 8,
        );
      }
  const raw = scenarioFixture();
  raw.identity.adventureSource = p.context.adventureSource;
  raw.sources = p.provenance.files;
  raw.manifest.prefabs = p.assignments.map((a) => ({
    ...raw.manifest.prefabs[0],
    source: a.prefab.source,
    modelSource: a.modelSource,
    encounterId: a.encounterId,
  }));
  const pack = lib.parseScenarioPack(raw).pack;
  lib.validateScenarioBinding(pack, p);
  const missing = structuredClone(pack);
  missing.sources = [{ file: 'unrelated.assets', sha256: 'a'.repeat(64) }];
  assert.throws(() => lib.validateScenarioBinding(missing, p), /source|fonte|hash/i);
  const bad = structuredClone(pack);
  bad.manifest.prefabs[0].source = 'example.assets:999';
  assert.throws(() => lib.validateScenarioBinding(bad, p), /Prefab/);
  bad.manifest.prefabs = pack.manifest.prefabs;
  bad.sources[0].sha256 = '0'.repeat(64);
  assert.throws(() => lib.validateScenarioBinding(bad, p), /hash/);
});
test('vista mappa scenario filtra soltanto tessere rivelate e conserva grafo e ID', async (t) => {
  const { readyScenario, startScenario, scenarioInput } = await import('./scenario-helper.mjs');
  const { readSession } = await import('./skill-test-helper.mjs');
  const { host, player } = await readyScenario(t);
  await startScenario(host, player);
  await scenarioInput(host, player, { kind: 'ack' });
  await scenarioInput(host, player, { kind: 'ack' });
  const s = await readSession(host);
  assert.equal(typeof lib.scenarioMapView, 'function');
  const view = lib.scenarioMapView(s);
  const p = s.mapGeneration.projection,
    start = p.sections[0].tiles[0];
  assert.equal(
    view.definition.spaces.length,
    p.spaces.filter((x) => x.tileSource === start.source).length,
  );
  assert.equal(view.unexplored.length, view.definition.spaces.length);
  assert.equal(view.nodes.length, 0);
  assert.deepEqual(
    view.definition.connections,
    s.journey.definition.connections.filter(
      ([a, b]) =>
        view.definition.spaces.some((s) => s.id === a) &&
        view.definition.spaces.some((s) => s.id === b),
    ),
  );
});
