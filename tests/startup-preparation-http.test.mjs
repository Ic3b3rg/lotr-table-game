import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readyStartup, revealStartupScout } from './startup-preparation-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';
import { readSession, readBackup } from './skill-test-helper.mjs';
import { writeFile, rm } from 'node:fs/promises';
import { startScenario } from './scenario-helper.mjs';
import { command } from './preparation-helper.mjs';

for (const fear of [1, 3])
  test(`startup preparation with ${fear} faceup fear uses the owner selection and resumes the same source`, async (t) => {
    const ready = await readyStartup(t, {
      fear,
      catalogEdit: (c) => c.heroes.forEach((h) => (h.stats.inspiration = 1)),
    });
    const { host, player, other } = ready;
    const s = await revealStartupScout(ready),
      copies = s.physical.active.options.map((o) => o.id);
    assert.equal(s.preparation.heroes[0].inspiration, 1);
    const r = await scenarioInput(host, player, {
      kind: 'physical-scout',
      prepare: copies[0],
      discard: null,
      top: [],
      bottom: copies.slice(1),
    });
    assert.equal(r.status, 200, await r.text());
    let after = await readSession(host);
    if (fear > 1) {
      assert.equal(after.physical.active.mode, 'select');
      assert.equal(after.physical.active.options.length, fear);
      assert.equal(after.scenario.pending.instanceId, s.scenario.pending.instanceId);
      assert.equal(after.scenario.pending.entry, s.scenario.pending.entry);
      assert.equal(after.scenario.pending.action, s.scenario.pending.action);
      assert.equal(after.scenario.completedSetup.length, 0);
      const input = { kind: 'physical-select', ids: [after.physical.active.options[1].id] };
      const before = await readBackup(host);
      assert.equal((await scenarioInput(host, other, input)).status, 403);
      assert.equal(
        (await scenarioInput(host, player, input, { sourceFingerprint: '0'.repeat(64) })).status,
        409,
      );
      assert.equal(
        (await scenarioInput(host, player, input, {}, { ...after, revision: 0 })).status,
        409,
      );
      assert.deepEqual((await readBackup(host)).payload, before.payload);
      const done = await scenarioInput(host, player, input);
      assert.equal(done.status, 200, await done.text());
      after = await readSession(host);
    }
    assert.equal(after.physical.heroes[0].facedown.fear, 1);
    assert.equal(after.physical.fronts.length, fear - 1);
    assert.equal(after.preparation.heroes[0].inspiration, 1);
    assert.equal(after.scenario.completedSetup.length, 1);
    const frozen = (await readBackup(host)).payload.state.physical;
    assert.equal(frozen.snapshot.areas[0].fear.length, fear);
    assert.equal(frozen.snapshot.parents[2].returnCount, 1);
    assert.equal(frozen.runs[2].answers.length, fear === 1 ? 2 : 3);
    assert.ok(!JSON.stringify(after).includes('invented-fear-'));
  });

for (const failure of ['missing', 'fingerprint', 'policy', 'catalog'])
  test(`startup rejects ${failure} physical preparation authority before mutation`, async (t) => {
    const ready = await readyStartup(t),
      { host, player, material } = ready;
    if (failure === 'missing') await rm(ready.frontsPath);
    if (failure === 'fingerprint') {
      ready.pack.manifest.startupPreparation.frontsFingerprint = '0'.repeat(64);
      await writeFile(ready.scenarioPath, JSON.stringify(ready.pack));
    }
    if (failure === 'policy') {
      material.fronts.policies[0].definitionHash = '0'.repeat(64);
      await writeFile(ready.frontsPath, JSON.stringify(material.fronts));
    }
    if (failure === 'catalog') {
      ready.pack.manifest.startupPreparation.catalogHash = '0'.repeat(64);
      await writeFile(ready.scenarioPath, JSON.stringify(ready.pack));
    }
    const before = await readBackup(host),
      r = await startScenario(host, player);
    assert.equal(r.status, 409, await r.text());
    assert.deepEqual((await readBackup(host)).payload, before.payload);
  });

test('normal startup physical services complete all heroes, the source handoff, and the first legal turn', async (t) => {
  const ready = await readyStartup(t),
    { host, player, other } = ready;
  let s = await revealStartupScout(ready);
  for (let n = 0; n < 80 && s.scenario.pending; n++) {
    const q = s.scenario.pending,
      active = s.physical.active,
      actor = q.actorPlayerId === other.body.player.id ? other : player;
    const input =
      q.kind !== 'physical'
        ? { kind: 'ack' }
        : active.mode === 'scout'
          ? {
              kind: 'physical-scout',
              prepare: null,
              discard: null,
              top: active.options.map((o) => o.id),
              bottom: [],
            }
          : {
              kind: 'physical-choice',
              option: active.options.some((o) => o.id === 'reveal')
                ? 'reveal'
                : active.options.some((o) => o.id === 'inspiration')
                  ? 'inspiration'
                  : 'resolve',
            };
    const r = await scenarioInput(host, actor, input);
    assert.equal(r.status, 200, await r.text());
    s = await readSession(host);
  }
  assert.equal(s.scenario.phase, 'action');
  assert.equal(s.scenario.handoffCount, 1);
  assert.equal(s.scenario.completedSetup.length, 4);
  assert.equal(s.scenario.objective.id, 0);
  assert.equal(s.physical.parents.length, 5);
  assert.ok(s.physical.parents.every((p) => p.returnCount === 1));
  const heroId = s.preparation.heroes[0].heroId;
  const r = await command(host, player, {
    type: 'START_TURN',
    roundId: s.round.id,
    heroId,
    agreed: true,
  });
  assert.equal(r.status, 200, await r.text());
  assert.equal((await readSession(host)).round.activeHeroId, heroId);
});

test('historical startup still gates a compiled preparation trigger before changing Scout cards', async (t) => {
  const ready = await readyStartup(t, { legacy: true });
  const s = await revealStartupScout(ready),
    copies = s.scout.revealed;
  const before = await readBackup(ready.host);
  const r = await scenarioInput(ready.host, ready.player, {
    kind: 'scout-resolve',
    prepareCopy: copies[0],
    top: copies.slice(1),
    bottom: [],
    discardPreparedCopy: null,
  });
  assert.equal(r.status, 409, await r.clone().text());
  assert.equal((await r.json()).error.code, 'SCENARIO_PHYSICAL_CAPABILITY');
  assert.deepEqual((await readBackup(ready.host)).payload, before.payload);
});

test('attested startup executes compiled afterPrepare with no fear and returns to the next hero once', async (t) => {
  const ready = await readyStartup(t);
  const s = await revealStartupScout(ready);
  assert.equal(s.physical.active.mode, 'scout');
  const copies = s.physical.active.options.map((o) => o.id);
  const r = await scenarioInput(ready.host, ready.player, {
    kind: 'physical-scout',
    prepare: copies[0],
    discard: null,
    top: copies.slice(1),
    bottom: [],
  });
  assert.equal(r.status, 200, await r.text());
  const after = await readSession(ready.host);
  assert.equal(after.preparation.heroes[0].inspiration, 2);
  assert.ok(after.preparation.heroes[0].prepared.includes(copies[0]));
  assert.equal(after.scenario.completedSetup.length, 1);
  assert.equal(after.scenario.pending.actorPlayerId, ready.other.body.player.id);
  const p = (await readBackup(ready.host)).payload.state.physical;
  assert.equal(p.snapshot.parents[1].returnCount, 1);
  assert.equal(p.runs[1].answers.length, 2);
  assert.deepEqual(p.snapshot.areas[0].fear, []);
});
