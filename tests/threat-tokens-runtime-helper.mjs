import { randomUUID } from 'node:crypto';
import { baseRuntime } from './base-products-runtime-helper.mjs';
import { driver } from './lair-victory-runtime-helper.mjs';
import { attachThreatTokens, sealThreatTokens } from './fixtures/threat-tokens.mjs';
import { boonFixture } from './fixtures/boons.mjs';
import { hash } from './fixtures/map-freeze.mjs';
import {
  compileBoons,
  compilePhysicalFronts,
  compileLastStand,
  freezePhysical,
} from '../dist/physical-resolution-library.mjs';
export function threatTokenRuntime({
  role = 'retry',
  verified = true,
  threat = 9,
  edit = () => {},
  ...options
} = {}) {
  let rawFixture, boons;
  const f = baseRuntime({
    ...options,
    edit: (raw, pack) => {
      const b = boonFixture(verified);
      raw.raw.cards = raw.raw.cards.map((c) =>
        c.family === 'boon' ? structuredClone(b.raw.cards.find((x) => x.id === c.id)) : c,
      );
      boons = compileBoons(raw.raw, b.boonInput);
      pack.manifest.boons = { version: 'source-boons-v1', fingerprint: boons.fingerprint };
      attachThreatTokens(pack);
      pack.globals.find((v) => v.name === 'inventedThreat').value = threat;
      for (const h of raw.catalog.heroes) h.stats.spirit = 2;
      edit(raw, pack);
      sealThreatTokens(pack);
      rawFixture = raw;
    },
  });
  const p = freezePhysical(
    rawFixture.raw,
    f.physical.binding,
    f.heroes,
    '1'.repeat(64),
    undefined,
    {
      artifact: compilePhysicalFronts(rawFixture.raw, rawFixture.ir, rawFixture.catalog),
      catalog: rawFixture.catalog,
    },
    compileLastStand(rawFixture.raw, rawFixture.lastStandInput),
    boons,
  );
  p.version = 3;
  Object.assign(f.physical, p);
  const owner = f.sc.pack.manifest.threatTokens.encounters.find((o) => o.role === role),
    prefab = f.sc.pack.manifest.prefabs.find((p) => p.source === owner.prefab),
    d = f.sc.pack.definitions.find((d) => d.source === prefab.fsmSource),
    i = {
      ...structuredClone(f.i),
      id: `invented-threat-${role}`,
      definition: d.source,
      prefab: prefab.source,
      state: d.initial,
      variables: {},
    };
  f.sc.instances.push(i);
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
    commit: () => driver.interactScenario(f.state, f.heroes[0].playerId, intent()),
  };
}
export function finishThreatTest(f, converted = 0) {
  f.answer({ kind: 'physical-choice', option: 'reveal' });
  for (let n = 0; n < converted; n++) {
    f.answer({ kind: 'physical-choice', option: 'inspiration' });
    const q = f.physical.snapshot.active;
    if (q?.mode === 'select') f.answer({ kind: 'physical-select', ids: [q.options[0].id] });
  }
  f.answer({ kind: 'physical-choice', option: 'resolve' });
}
