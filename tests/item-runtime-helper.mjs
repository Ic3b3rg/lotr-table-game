import { randomUUID } from 'node:crypto';
import { baseRuntime } from './base-products-runtime-helper.mjs';
import { driver } from './lair-victory-runtime-helper.mjs';
import { attachItem, itemPolicy } from './fixtures/item-encounter.mjs';
import { hash } from './fixtures/map-freeze.mjs';
export function itemRuntime(options = {}) {
  const f = baseRuntime({
      ...options,
      edit: (fixture, pack) => {
        attachItem(pack, fixture.catalog);
        fixture.ir.policies.push(itemPolicy(fixture.catalog));
        options.edit?.(fixture, pack);
      },
    }),
    s = f.state,
    sc = f.sc,
    cap = sc.pack.manifest.items,
    p = sc.pack.manifest.prefabs.find((p) => p.source === cap.prefab),
    d = sc.pack.definitions.find((d) => d.source === p.fsmSource),
    i = {
      ...structuredClone(f.i),
      id: 'invented-item-cache',
      definition: d.source,
      prefab: p.source,
      state: d.initial,
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
