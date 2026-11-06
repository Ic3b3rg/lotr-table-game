import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { readyStartup } from './startup-preparation-helper.mjs';
import { startScenario, scenarioInput } from './scenario-helper.mjs';
import {
  attachEncounter,
  interact,
  playable,
  finishPhysical,
} from './original-encounter-helper.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';
import { readSession, readBackup, signBackup } from './skill-test-helper.mjs';
import { inventedLastStand } from './fixtures/last-stand.mjs';
import { compileLastStand } from '../dist/physical-resolution-library.mjs';
import { startHost } from './host-helper.mjs';

async function ok(response) {
  const r = await response;
  assert.equal(r.status, 200, await r.text());
}

for (const prepare of [false, true])
  test(`attested startup with Scout preparation ${prepare} hands its bounded physical prefix to original play and preserves it through recovery`, async (t) => {
    const ready = await readyStartup(t, {
      edit: (pack) => attachEncounter(pack),
      catalogEdit: (catalog) => {
        for (const card of catalog.skills) {
          card.success = 1;
          card.fate = 0;
        }
      },
    });
    const { player, other, material } = ready;
    let host = ready.host;
    t.after(() => host.stop());
    await writeFile(
      join(host.dataDir, 'physical-last-stand.json'),
      JSON.stringify(compileLastStand(material.raw, inventedLastStand(material.raw))),
    );
    await ok(startScenario(host, player));
    let s = await readSession(host);
    for (let n = 0; n < 80 && s.scenario.pending; n++) {
      const q = s.scenario.pending,
        active = s.physical.active,
        actor = q.actorPlayerId === other.body.player.id ? other : player;
      await ok(
        scenarioInput(
          host,
          actor,
          q.kind !== 'physical'
            ? { kind: 'ack' }
            : active.mode === 'scout'
              ? {
                  kind: 'physical-scout',
                  prepare: prepare ? active.options[0].id : null,
                  discard: null,
                  top: active.options.slice(prepare ? 1 : 0).map((o) => o.id),
                  bottom: [],
                }
              : {
                  kind: 'physical-choice',
                  option: active.options.some((o) => o.id === 'reveal') ? 'reveal' : 'resolve',
                },
        ),
      );
      s = await readSession(host);
    }
    assert.equal(s.scenario.phase, 'action');
    const handoff = await readBackup(host),
      prefix = handoff.payload.state.physical.runs;
    assert.equal(handoff.payload.state.physical.cycle.version, 2);
    assert.equal(prefix.length, 5);
    assert.equal(s.scenario.completedSetup.length, 4);
    await ok(cycleCommand(ready, 'START_TURN'));
    await ok(cycleCommand(ready, 'START_TRAVEL'));
    s = await readSession(host);
    const instance = playable(s),
      heroId = s.preparation.heroes[0].heroId,
      destination = s.scenario.spaceBindings.find((b) => b.sourceId === instance.spaceId).id;
    await ok(
      cycleCommand(ready, 'MOVE_HERO', {
        fromSpaceId: s.journey.heroes.find((h) => h.heroId === heroId).spaceId,
        destinationSpaceId: destination,
      }),
    );
    await ok(interact(ready));
    s = await finishPhysical(ready);
    assert.equal(s.scenario.pending.kind, 'choice');
    assert.equal(playable(s).variables.seen, true);
    const before = await readBackup(host);
    assert.deepEqual(before.payload.state.physical.runs.slice(0, prefix.length), prefix);
    assert.ok(before.payload.state.physical.runs.length > prefix.length);
    await host.stop('SIGKILL');
    for (const path of [
      ready.scenarioPath,
      ready.physicalPath,
      ready.frontsPath,
      join(host.dataDir, 'physical-last-stand.json'),
    ])
      await rm(path);
    host = await startHost({ LOTR_DATA_DIR: host.dataDir });
    assert.deepEqual((await readBackup(host)).payload, before.payload);
    s = await readSession(host);
    const restore = await host.request('/api/restores', {
      backup: before,
      generation: s.generation,
      expectedRevision: s.revision,
      confirmed: true,
    });
    assert.equal(restore.status, 200, await restore.text());
    const restored = await readBackup(host);
    assert.deepEqual(restored.payload.state.physical, before.payload.state.physical);
    assert.deepEqual(restored.payload.commands, before.payload.commands);
    for (const edit of [
      (p) => p.runs.splice(0, 1),
      (p) => p.runs.splice(prefix.length, 0, structuredClone(p.runs[0])),
      (p) => p.runs[0].program.children.reverse(),
      (p) => p.runs[0].context.preparation.heroes[0].inspiration++,
    ]) {
      const forged = structuredClone(restored);
      edit(forged.payload.state.physical);
      signBackup(forged);
      s = await readSession(host);
      const r = await host.request('/api/restores', {
        backup: forged,
        generation: s.generation,
        expectedRevision: s.revision,
        confirmed: true,
      });
      assert.equal(r.status, 422, await r.text());
      assert.deepEqual((await readBackup(host)).payload, restored.payload);
    }
    const recovery = await host.request('/api/recover', {
      recoveryCode: player.recoveryCode,
      generation: restored.payload.state.generation,
    });
    assert.equal(recovery.status, 200, await recovery.clone().text());
    player.cookie = recovery.headers.get('set-cookie')?.split(';')[0];
    ready.host = host;
    await ok(scenarioInput(host, player, { kind: 'choice', event: 'OTHER' }));
    s = await finishPhysical(ready);
    assert.equal(s.scenario.pending, null);
    assert.equal(s.scenario.play.active, null);
    assert.equal(playable(s).variables.seen, true);
    assert.deepEqual(
      (await readBackup(host)).payload.state.physical.runs.slice(0, prefix.length),
      prefix,
    );
  });
