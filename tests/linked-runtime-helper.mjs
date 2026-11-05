import { randomUUID } from 'node:crypto';
import { lairRuntime, driver } from './lair-victory-runtime-helper.mjs';
import { attachLinked, linkedTitle } from './fixtures/linked-encounters.mjs';
import { hash } from './fixtures/map-freeze.mjs';

export function linkedRuntime({
  explored = true,
  wisdom = 2,
  agility = 3,
  wit = 3,
  edit = () => {},
} = {}) {
  const f = lairRuntime({
    edit: (fixture, pack) => {
      for (const h of fixture.catalog.heroes) Object.assign(h.stats, { wisdom, agility, wit });
      attachLinked(pack, linkedTitle(fixture.raw));
      edit(fixture, pack);
    },
  });
  const { state: s, sc } = f;
  const nodes = sc.pack.manifest.linked.encounters.map((e, n) => {
    const p = sc.pack.manifest.prefabs.find((p) => p.source === e.prefab);
    const d = sc.pack.definitions.find((d) => d.source === p.fsmSource);
    return {
      id: `invented-linked-${n}`,
      kind: 'encounter',
      definition: d.source,
      prefab: e.prefab,
      spaceId: 'source-space',
      state: n ? d.handlers.PRE_REVEAL : d.initial,
      entry: 1,
      variables: Object.fromEntries(d.variables.map((v) => [v.name, structuredClone(v.value)])),
      started: [],
      completed: [],
      settled: false,
      processing: 1,
      stopped: false,
      visible: n === 0,
    };
  });
  sc.instances.push(...nodes);
  sc.tiles = [{ source: 'example.assets:50000', visible: true, explored }];
  sc.explorationMarkers = [
    { source: 'example.assets:12345', tileSource: 'example.assets:50000', visible: !explored },
  ];
  driver.pumpPhaseEvent(s);
  const intent = (n = 0, hero = 0, choiceEvent) => ({
    type: 'INTERACT_SCENARIO',
    requestId: randomUUID(),
    generation: s.generation,
    expectedRevision: s.revision,
    scenarioId: sc.id,
    packFingerprint: sc.packFingerprint,
    projectionFingerprint: sc.projectionFingerprint,
    instanceId: nodes[n].id,
    sourceFingerprint: hash(nodes[n]),
    heroId: f.heroes[hero].heroId,
    roundId: s.round.id,
    turnId: s.round.turnId,
    ...(choiceEvent ? { choiceEvent } : {}),
  });
  const commit = (n = 0, hero = 0, choiceEvent) => {
    s.round.activeHeroId = f.heroes[hero].heroId;
    driver.interactScenario(s, f.heroes[hero].playerId, intent(n, hero, choiceEvent));
  };
  return { ...f, nodes, intent, commit };
}
export function leaveFirst(f) {
  f.commit();
  f.finishPhysical();
  f.answer({ kind: 'choice', event: 'LEAVE' });
  if (f.sc.pending) f.answer({ kind: 'ack' });
}
