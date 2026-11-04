import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { readyThreats, endTurns, runtime, answerThreat } from './threat-helper.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';
import { readBackup, readSession, signBackup } from './skill-test-helper.mjs';
import { startHost } from './host-helper.mjs';

test('new threshold callbacks, global darkness and typed loss survive SIGKILL and packless whole-payload restore with once-only receipts', async (t) => {
  const r = await readyThreats(t);
  let host = r.host,
    count = 0;
  t.after(() => host.stop());
  await endTurns(r);
  const origin = (await readBackup(host)).payload.state.physical.cycle.seed;
  const ok = async (p) => {
    const x = await p;
    assert.equal(x.status, 200, await x.text());
    return x;
  };
  await ok(cycleCommand(r, 'BEGIN_SHADOW'));
  for (const p of [
    r.scenarioPath,
    ...['physical-content', 'physical-fronts', 'physical-last-stand'].map((n) =>
      join(host.dataDir, n + '.json'),
    ),
  ])
    await rm(p);
  async function checkpoint(label) {
    const before = await readBackup(host);
    await host.stop('SIGKILL');
    host = await startHost({ LOTR_DATA_DIR: host.dataDir });
    r.host = host;
    assert.deepEqual((await readBackup(host)).payload, before.payload, label + ': crash');
    assert.deepEqual(before.payload.state.physical.cycle.seed, origin);
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
      const actual = structuredClone((await readBackup(target)).payload),
        expected = structuredClone(before.payload);
      for (const k of ['generation', 'revision', 'updatedAt']) {
        delete actual.state[k];
        delete expected.state[k];
      }
      assert.deepEqual(actual, expected, label + ': entire restored gameplay and receipts');
    } finally {
      await target.dispose();
    }
    count++;
  }
  await checkpoint('before-applied-increase');
  await ok(cycleCommand(r, 'CONFIRM_SHADOW_STEP', { step: 'threat' }));
  const observed = new Set();
  let concurrent = false,
    actorChecked = false,
    allocationChecked = false;
  for (let n = 0; n < 160; n++) {
    const s = await readSession(host),
      q = s.scenario.pending,
      frame = s.scenario.rounds.frames.at(-1);
    if (s.scenario.conclusion) break;
    assert.ok(q);
    const newRow = s.scenario.pack.manifest.threatContinuations.thresholds.find(
      (t) => t.source === frame.threshold,
    );
    if (newRow && !observed.has(newRow.source)) {
      assert.equal(q.kind, newRow.form === 'spawn-register' ? 'physical' : 'deployment-intro');
      assert.equal(
        s.scenario.threats.some((t) => t.source === newRow.source),
        true,
        'current receiver remains until callback completion',
      );
      await checkpoint(newRow.form);
      observed.add(newRow.source);
    }
    if (
      newRow?.form === 'spawn-register' &&
      s.physical.active?.mode === 'allocate' &&
      !allocationChecked
    ) {
      await checkpoint('source-negation-allocation');
      allocationChecked = true;
    }
    if (newRow && q.actorPlayerId && !actorChecked) {
      const wrong = [r.player, r.other].find((p) => p.body.player.id !== q.actorPlayerId);
      const before = await readBackup(host);
      const denied = await scenarioInput(
        host,
        wrong,
        { kind: 'physical-choice', option: 'reveal' },
        {},
        s,
      );
      assert.equal(denied.status, 403);
      assert.deepEqual((await readBackup(host)).payload, before.payload);
      actorChecked = true;
    }
    if (newRow && q.kind !== 'physical' && !concurrent) {
      const requestId = randomUUID();
      const responses = await Promise.all(
        [0, 1].map(() => scenarioInput(host, r.other, { kind: 'ack' }, { requestId }, s)),
      );
      assert.deepEqual(
        responses.map((r) => r.status),
        [200, 200],
      );
      assert.deepEqual((await responses[0].json()).receipt, (await responses[1].json()).receipt);
      const before = await readBackup(host);
      const stale = await scenarioInput(
        host,
        r.other,
        { kind: 'ack' },
        { requestId: randomUUID() },
        s,
      );
      assert.equal(stale.status, 409);
      assert.deepEqual((await readBackup(host)).payload, before.payload);
      concurrent = true;
    } else await ok(answerThreat(r, s));
  }
  assert.equal(observed.size, 3);
  assert.equal(concurrent, true);
  assert.equal(actorChecked, true);
  let s = await readSession(host);
  assert.equal(s.scenario.conclusion.timing, 'threat-increase');
  await checkpoint('typed-threat-loss');
  await ok(scenarioInput(host, r.player, { kind: 'ack' }));
  await checkpoint('concurrent-rewards');
  for (let n = 0; n < 3; n++) await ok(scenarioInput(host, r.other, { kind: 'ack' }));
  await checkpoint('camp');
  assert.equal(count, 8);
  assert.equal(allocationChecked, true);
  s = await readSession(host);
  assert.equal(s.scenario.conclusion.stage, 'camp');
  const backup = await readBackup(host);
  const changes = [
    (b) => b.payload.state.scenario.conclusion.cause.after++,
    (b) => b.payload.state.scenario.conclusion.cause.limit++,
    (b) => (b.payload.state.scenario.conclusion.cause.controllerHash = 'f'.repeat(64)),
    (b) => b.payload.state.scenario.rounds.frames.at(-1).handled.reverse(),
    (b) => (b.payload.state.scenario.rounds.frames.at(-1).threatRequestId = randomUUID()),
    (b) => (b.payload.state.scenario.rounds.frames.at(-1).stage = 'reset'),
    (b) => (b.payload.state.scenario.globals.night = false),
    (b) => b.payload.state.scenario.enemies.cursor++,
    (b) => b.payload.state.scenario.conclusion.xp[0].amount++,
    (b) => (b.payload.state.scenario.conclusion.campEntryCount = 0),
    (b) => (b.payload.commands.at(-1).receipt.pendingId = randomUUID()),
  ];
  for (const change of changes) {
    const bad = structuredClone(backup);
    change(bad);
    signBackup(bad);
    assert.equal(runtime.BackupSchema.safeParse(bad).success, false);
  }
  const bad = structuredClone(backup);
  changes[0](bad);
  signBackup(bad);
  const denied = await host.request('/api/restores', {
    backup: bad,
    generation: s.generation,
    expectedRevision: s.revision,
    confirmed: true,
  });
  assert.equal(denied.status, 422);
  assert.deepEqual((await readBackup(host)).payload, backup.payload);
  const historical = structuredClone(backup.payload.state);
  historical.schemaVersion = 17;
  assert.throws(() => runtime.parseState(historical), /schema storico/);
  await host.stop();
});
