import { randomUUID } from 'node:crypto';
import { lairRuntime, driver } from './lair-victory-runtime-helper.mjs';
import { attachBaseProducts } from './fixtures/base-products.mjs';
import { hash } from './fixtures/map-freeze.mjs';

export function baseRuntime({ success = 0, fate = 1, inspiration = 3, edit = () => {} } = {}) {
  const f = lairRuntime({
      edit: (fixture, pack) => {
        attachBaseProducts(pack);
        for (const c of fixture.catalog.skills) {
          c.success = success;
          c.fate = fate;
        }
        for (const h of fixture.catalog.heroes) {
          h.stats.wisdom = 2;
          h.stats.inspiration = 3;
        }
        fixture.context.preparation.heroes[0].inspiration = inspiration;
        edit(fixture, pack);
      },
    }),
    { state: s, sc } = f,
    cap = sc.pack.manifest.baseProducts,
    p = sc.pack.manifest.prefabs.find((p) => p.source === cap.prefab),
    d = sc.pack.definitions.find((d) => d.source === p.fsmSource);
  const i = {
    id: 'invented-base-lantern',
    kind: 'encounter',
    definition: d.source,
    prefab: p.source,
    spaceId: 'source-space',
    state: d.initial,
    entry: 1,
    variables: {},
    started: [],
    completed: [],
    stopped: false,
    settled: true,
    processing: 0,
    visible: true,
  };
  sc.instances.push(i);
  sc.tiles = [{ source: 'example.assets:50000', visible: true, explored: true }];
  s.mapGeneration.projection.context = { ownedProductIds: [0] };
  s.journey.travel = { remaining: 1 };
  s.journey.definition.spaces = [
    { id: 'invented-space', label: 'Piazza inventata' },
    { id: 'invented-next', label: 'Ponte inventato' },
  ];
  s.journey.definition.connections = [['invented-space', 'invented-next']];
  sc.spaceBindings.push({ id: 'invented-next', sourceId: 'source-next' });
  s.mapGeneration.projection.spaces.push({
    id: 'source-next',
    index: 1,
    tileSource: 'example.assets:50000',
    hasDarkness: false,
    nodePosition: [1, 0, 0],
  });
  const intent = () => ({
    type: 'INTERACT_SCENARIO',
    requestId: randomUUID(),
    generation: s.generation,
    expectedRevision: s.revision,
    scenarioId: sc.id,
    packFingerprint: sc.packFingerprint,
    projectionFingerprint: sc.projectionFingerprint,
    instanceId: i.id,
    sourceFingerprint: hash(i),
    heroId: f.heroes[0].heroId,
    roundId: s.round.id,
    turnId: s.round.turnId,
  });
  const commit = () => driver.interactScenario(s, f.heroes[0].playerId, intent());
  return { ...f, i, intent, commit };
}
