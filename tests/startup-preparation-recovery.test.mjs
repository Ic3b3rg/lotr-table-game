import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { readyStartup, revealStartupScout } from './startup-preparation-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';
import { readSession, readBackup, signBackup } from './skill-test-helper.mjs';
import { startHost } from './host-helper.mjs';

test('startup trigger retry, concurrency, SIGKILL and packless restore preserve the exact parent, copies and receipts', async (t) => {
  const ready = await readyStartup(t, { fear: 3 });
  let host = ready.host;
  t.after(() => host.stop());
  const scout = await revealStartupScout(ready),
    copies = scout.physical.active.options.map((o) => o.id);
  const prepare = await scenarioInput(host, ready.player, {
    kind: 'physical-scout',
    prepare: copies[0],
    discard: null,
    top: [],
    bottom: copies.slice(1),
  });
  assert.equal(prepare.status, 200, await prepare.text());
  const s = await readSession(host),
    requestId = randomUUID(),
    input = {
      kind: 'physical-select',
      ids: [s.physical.active.options[1].id],
    };
  assert.equal(s.scenario.completedSetup.length, 0);
  const pending = await readBackup(host);
  await host.stop('SIGKILL');
  for (const path of [ready.scenarioPath, ready.physicalPath, ready.frontsPath]) await rm(path);
  host = await startHost({ LOTR_DATA_DIR: host.dataDir });
  assert.deepEqual((await readBackup(host)).payload, pending.payload);
  const results = await Promise.all([
    scenarioInput(host, ready.player, input, { requestId }, s),
    scenarioInput(host, ready.player, input, { requestId }, s),
    scenarioInput(host, ready.player, input, { requestId: randomUUID() }, s),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 200, 409]);
  const bodies = await Promise.all(results.filter((r) => r.status === 200).map((r) => r.json()));
  assert.deepEqual(bodies[0].receipt, bodies[1].receipt);
  const committed = await readBackup(host);
  assert.equal(committed.payload.state.physical.runs[2].answers.length, 3);
  assert.equal(committed.payload.state.scenario.completedSetup.length, 1);
  assert.equal((await scenarioInput(host, ready.player, input, { requestId }, s)).status, 200);
  assert.equal(
    (
      await scenarioInput(
        host,
        ready.player,
        { kind: 'physical-select', ids: [] },
        { requestId },
        s,
      )
    ).status,
    409,
  );
  assert.deepEqual((await readBackup(host)).payload, committed.payload);
  const before = await readSession(host);
  for (const edit of [
    (b) => (b.payload.state.physical.runs[2].source.parameterHash = '0'.repeat(64)),
    (b) => (b.payload.state.physical.runs[2].answers[1].cursor = '0'.repeat(64)),
    (b) => (b.payload.state.physical.snapshot.parents[2].returnCount = 0),
    (b) => (b.payload.state.scenario.tasks[0].heroId = 'hero-1'),
    (b) => b.payload.state.scenario.completedSetup[0].revealed.reverse(),
    (b) => b.payload.state.physical.runs[0].context.preparation.heroes[0].inspiration++,
    (b) =>
      b.payload.state.physical.snapshot.resolution.resources.preparation.heroes[0].inspiration++,
    (b) => {
      const p = b.payload.state,
        id = p.physical.runs[2].answers[1].evidence.requestId;
      p.scenario.commands = p.scenario.commands.filter((c) => c.requestId !== id);
      b.payload.commands = b.payload.commands.filter((c) => c.requestId !== id);
    },
    (b) => {
      const p = b.payload.state,
        run = p.physical.runs[2];
      for (const a of run.answers) {
        p.scenario.commands = p.scenario.commands.filter(
          (c) => c.requestId !== a.evidence.requestId,
        );
        b.payload.commands = b.payload.commands.filter((c) => c.requestId !== a.evidence.requestId);
      }
      p.physical.runs.splice(2, 1);
      p.scenario.completedSetup = [];
    },
  ]) {
    const changed = structuredClone(committed);
    edit(changed);
    signBackup(changed);
    const r = await host.request('/api/restores', {
      backup: changed,
      generation: before.generation,
      expectedRevision: before.revision,
      confirmed: true,
    });
    assert.equal(r.status, 422, await r.text());
    assert.deepEqual((await readBackup(host)).payload, committed.payload);
  }
  const restored = await host.request('/api/restores', {
    backup: pending,
    generation: before.generation,
    expectedRevision: before.revision,
    confirmed: true,
  });
  assert.equal(restored.status, 200, await restored.text());
  const after = await readBackup(host);
  for (const key of ['physical', 'preparation', 'scenario', 'mapGeneration'])
    assert.deepEqual(after.payload.state[key], pending.payload.state[key]);
  assert.deepEqual(after.payload.commands, pending.payload.commands);
  const recovery = await host.request('/api/recover', {
    recoveryCode: ready.player.recoveryCode,
    generation: after.payload.state.generation,
  });
  assert.equal(recovery.status, 200, await recovery.clone().text());
  ready.player.cookie = recovery.headers.get('set-cookie')?.split(';')[0];
  const result = await scenarioInput(host, ready.player, input);
  assert.equal(result.status, 200, await result.text());
  const done = await readBackup(host);
  for (const key of ['areas', 'decks', 'random', 'rngCursor'])
    assert.deepEqual(
      done.payload.state.physical.snapshot[key],
      committed.payload.state.physical.snapshot[key],
    );
  assert.deepEqual(done.payload.state.preparation, committed.payload.state.preparation);
});
