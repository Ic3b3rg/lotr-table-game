import { randomUUID } from 'node:crypto';
import { baseRuntime } from './base-products-runtime-helper.mjs';
import { driver } from './lair-victory-runtime-helper.mjs';
import { attachSearches, sealSearches } from './fixtures/search-encounters.mjs';
import { hash } from './fixtures/map-freeze.mjs';

export function searchRuntime({ role = 'choice', edit = () => {}, ...options } = {}) {
  const f = baseRuntime({
    ...options,
    edit: (fixture, pack) => {
      attachSearches(pack);
      edit(fixture, pack);
      sealSearches(pack);
    },
  });
  const { state: s, sc } = f,
    owner = sc.pack.manifest.searches.encounters.find((e) => e.role === role),
    p = sc.pack.manifest.prefabs.find((p) => p.source === owner.prefab),
    d = sc.pack.definitions.find((d) => d.source === p.fsmSource),
    i = {
      ...structuredClone(f.i),
      id: `invented-search-${role}`,
      definition: d.source,
      prefab: p.source,
      state: d.initial,
      variables: Object.fromEntries(d.variables.map((v) => [v.name, v.value])),
    };
  sc.instances.push(i);
  const intent = () => ({
    ...f.intent(),
    requestId: randomUUID(),
    instanceId: i.id,
    sourceFingerprint: hash(i),
  });
  return {
    ...f,
    i,
    intent,
    commit: () => driver.interactScenario(s, f.heroes[0].playerId, intent()),
  };
}
