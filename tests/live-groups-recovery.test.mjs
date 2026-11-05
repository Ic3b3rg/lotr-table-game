import test from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { readyLiveGroups, endTurns, untilLive, answerLive } from './live-groups-helper.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';
import { readBackup, readSession, signBackup } from './skill-test-helper.mjs';
import { startHost } from './host-helper.mjs';
import { runtime } from './threat-helper.mjs';

test('new defeat, reassigned choice and survivor trial survive SIGKILL and packless restore, with resigned alterations rejected', async (t) => {
  const r = await readyLiveGroups(t);
  let host = r.host;
  t.after(() => host.stop());
  const ok = async (p) => {
    const x = await p;
    assert.equal(x.status, 200, await x.text());
  };
  await endTurns(r);
  await ok(cycleCommand(r, 'BEGIN_SHADOW'));
  let checkpoints = 0;
  async function checkpoint(label) {
    const before = await readBackup(host),
      view = await readSession(host);
    await host.stop('SIGKILL');
    host = await startHost({ LOTR_DATA_DIR: host.dataDir });
    r.host = host;
    assert.deepEqual(
      (await readBackup(host)).payload,
      before.payload,
      label + ': entire crash payload',
    );
    assert.deepEqual(await readSession(host), view, label + ': entire public view');
    const target = await startHost();
    try {
      const at = await readSession(target);
      await ok(
        target.request('/api/restores', {
          backup: before,
          generation: at.generation,
          expectedRevision: at.revision,
          confirmed: true,
        }),
      );
      const actual = (await readBackup(target)).payload,
        expected = structuredClone(before.payload);
      for (const k of ['generation', 'revision', 'updatedAt']) {
        delete actual.state[k];
        delete expected.state[k];
      }
      assert.deepEqual(actual, expected, label + ': entire packless restore');
    } finally {
      await target.dispose();
    }
    checkpoints++;
    return before;
  }
  for (const p of [
    r.scenarioPath,
    ...['physical-content', 'physical-fronts', 'physical-last-stand'].map((n) =>
      join(host.dataDir, n + '.json'),
    ),
  ])
    await rm(p);
  await untilLive(r, (s) => s.physical.active?.mode === 'allocate');
  await checkpoint('before-defeat');
  await untilLive(r, (s) => s.physical.lastStand.heroes[0].defeated);
  await checkpoint('live-chooser-after-darkness-defeat');
  await untilLive(r, (s) => !s.physical.active);
  await ok(cycleCommand(r, 'CONFIRM_SHADOW_STEP', { step: 'threat' }));
  let s = await untilLive(r, (s) => s.scenario.pending?.kind === 'physical');
  const trial = await checkpoint('survivor-trial-before-reveal');
  await ok(answerLive(r, s));
  s = await readSession(host);
  await checkpoint('survivor-trial-after-reveal');
  await untilLive(r, (s) => s.scenario.pending?.kind !== 'physical');
  const done = await checkpoint('one-return-to-deployment');
  assert.equal(checkpoints, 5);
  const changes = [
    (b) => {
      delete b.payload.state.physical.runs.at(-1).program.groupRules;
    },
    (b) => {
      b.payload.state.physical.runs.at(-1).program.children[0].heroes = [0];
    },
    (b) => {
      b.payload.state.physical.snapshot.active.actorHeroId = 'hero-1';
    },
    (b) => {
      b.payload.state.physical.snapshot.active.actorPlayerId = b.payload.state.players[0].id;
    },
    (b) => {
      b.payload.state.physical.snapshot.lastStand.heroes[0].defeated = false;
    },
    (b) => {
      delete b.payload.state.scenario.pack.manifest.liveGroups;
    },
    (b) => {
      delete b.payload.state.physical.cycle.seed.scenario.pack.manifest.liveGroups;
    },
    (b) => {
      b.payload.commands.at(-1).receipt.pendingId = randomUUID();
    },
  ];
  for (const change of changes) {
    const bad = structuredClone(trial);
    change(bad);
    signBackup(bad);
    assert.equal(runtime.BackupSchema.safeParse(bad).success, false);
  }
  const bad = structuredClone(done);
  bad.payload.state.physical.snapshot.parents.at(-1).returnCount = 0;
  signBackup(bad);
  assert.equal(runtime.BackupSchema.safeParse(bad).success, false);
  const before = await readBackup(host),
    at = await readSession(host);
  const denied = await host.request('/api/restores', {
    backup: bad,
    generation: at.generation,
    expectedRevision: at.revision,
    confirmed: true,
  });
  assert.equal(denied.status, 422);
  assert.deepEqual((await readBackup(host)).payload, before.payload);
});
