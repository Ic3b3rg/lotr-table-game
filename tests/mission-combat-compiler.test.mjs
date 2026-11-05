import test from 'node:test';
import assert from 'node:assert/strict';
import { compileScenarioPack, parseScenarioPack } from '../dist/scenario-library.mjs';
import { missionCompilation, sealMission } from './fixtures/mission-combat.mjs';
import { hash } from './fixtures/map-freeze.mjs';

test('a complete source mission freezes owners, exact model, normal context, realized pose and receivers before startup', () => {
  const input = missionCompilation(),
    result = compileScenarioPack(input);
  assert.deepEqual(parseScenarioPack(result.pack).pack, result.pack);
  const c = result.pack.manifest.firstCombat;
  assert.equal(c.definitions.length, 4);
  assert.deepEqual(c.configuration.ownedProductIds, [0]);
  assert.equal(c.configuration.physicalInventoryPerType, null);
  assert.equal(
    result.pack.definitions
      .flatMap((d) => d.states.flatMap((s) => s.actions))
      .filter((a) => a.op === 'spawnFixed').length,
    2,
  );
});

test('mission compiler rejects incomplete certificates and coherently resigned owner, grant, timer and model changes', () => {
  const input = missionCompilation();
  for (const edit of [
    (i) => delete i.firstCombatCertificate,
    (i) => delete i.pack.manifest.firstCombat,
    (i) => i.pack.manifest.firstCombat.configuration.ownedProductIds.push(5),
    (i) =>
      i.pack.manifest.firstCombat.configuration.initialReserved.push({
        source: 'fixture.assets:10',
        count: 1,
      }),
    (i) => (i.pack.manifest.firstCombat.pose.index = 1),
    (i) => (i.pack.manifest.firstCombat.definitions[3].source = i.pack.principal),
    (i) =>
      i.certificates
        .find((c) => c.source === i.pack.manifest.firstCombat.definitions[0].source)
        .states.pop(),
    (i) => {
      const d = i.pack.definitions.find((d) => d.source === i.pack.principal);
      d.states.find((s) => s.index === 170).actions[0].grant = true;
      sealMission(i.pack);
      i.firstCombatCertificate.instructionHash = hash(i.pack.manifest.firstCombat);
    },
    (i) => {
      i.pack.definitions
        .find((d) => d.source === i.pack.manifest.firstCombat.definitions[0].source)
        .states.find((s) => s.index === 12).actions[0].sum = { scope: 'local', name: 'Result' };
      sealMission(i.pack);
      i.firstCombatCertificate.instructionHash = hash(i.pack.manifest.firstCombat);
    },
  ]) {
    const bad = structuredClone(input);
    edit(bad);
    assert.throws(() => compileScenarioPack(bad));
  }
});

test('resigned packets retain the exact upper bounds, physical outcomes and unique hidden receiver sets', () => {
  const admitted = [
    (p) => {
      const d = p.definitions.find(
        (d) => d.source === p.manifest.firstCombat.definitions[0].source,
      );
      d.states.find((s) => s.index === 12).actions[0].bounds[1].maximum = 1;
    },
    (p) => {
      const d = p.definitions.find(
        (d) => d.source === p.manifest.firstCombat.definitions[0].source,
      );
      d.states.find((s) => s.index === 14).actions[0].consequence.family = 'damage';
    },
    (p) => {
      const extra = p.definitions.find((d) => d.source === 'example.assets:99700');
      extra.handlers[p.manifest.firstCombat.events.arm] = extra.initial;
    },
  ].map((edit) => {
    const { pack } = missionCompilation();
    edit(pack);
    sealMission(pack);
    try {
      parseScenarioPack(pack);
      return true;
    } catch {
      return false;
    }
  });
  assert.deepEqual(admitted, [false, false, false]);
});
