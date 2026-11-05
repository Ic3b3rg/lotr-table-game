import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { buildSync } from 'esbuild';
import {
  readyLair,
  reachLair,
  commitLair,
  finishPhysical,
  ok,
  lair,
} from './lair-victory-http-helper.mjs';
import { readBackup, readSession, signBackup } from './skill-test-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';
import { recoverSeat } from './last-stand-helper.mjs';
import { startHost } from './host-helper.mjs';
const built = buildSync({
  stdin: {
    contents: "export { BackupSchema } from './src/server/backup-format';",
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const { BackupSchema } = await import(
  'data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].contents).toString('base64')
);
const admin = (value, expected) => {
  const out = structuredClone(value);
  for (const k of ['generation', 'revision', 'updatedAt']) out[k] = expected[k];
  return out;
};

test('eleven SIGKILLs restore to empty packless hosts before/after cards, failure, retry, victory rewards, transition and camp; whole payloads and views survive', async (t) => {
  const r = await readyLair(t);
  let count = 0,
    origin;
  async function restore() {
    const host = r.host,
      before = await readBackup(host),
      view = await readSession(host);
    origin ??= before.payload.state.physical.cycle.seed;
    assert.deepEqual(before.payload.state.physical.cycle.seed, origin);
    await host.stop('SIGKILL');
    const dest = await startHost();
    t.after(() => dest.dispose());
    for (const name of [
      'scenario-pack',
      'physical-content',
      'physical-fronts',
      'physical-last-stand',
    ])
      await assert.rejects(access(join(dest.dataDir, name + '.json')));
    const empty = await readSession(dest);
    await ok(
      dest.request('/api/restores', {
        backup: before,
        generation: empty.generation,
        expectedRevision: empty.revision,
        confirmed: true,
      }),
    );
    const after = (await readBackup(dest)).payload;
    assert.deepEqual({ ...after, state: admin(after.state, before.payload.state) }, before.payload);
    assert.deepEqual(admin(await readSession(dest), view), view);
    await recoverSeat(dest, r.player);
    await recoverSeat(dest, r.other);
    r.host = dest;
    count++;
  }
  await reachLair(r);
  await restore();
  await ok(commitLair(r));
  await restore();
  await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'reveal' }));
  await restore();
  await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'resolve' }));
  await restore();
  assert.equal(lair(await readSession(r.host)).state, 103);
  await ok(scenarioInput(r.host, r.other, { kind: 'ack' }));
  await restore();
  await ok(cycleCommand(r, 'END_TURN'));
  await reachLair(r, r.other);
  await ok(commitLair(r, r.other));
  await restore();
  await ok(scenarioInput(r.host, r.other, { kind: 'physical-choice', option: 'reveal' }));
  await restore();
  await ok(scenarioInput(r.host, r.other, { kind: 'physical-choice', option: 'resolve' }));
  await restore();
  assert.equal(lair(await readSession(r.host)).state, 104);
  await ok(scenarioInput(r.host, r.player, { kind: 'ack' }));
  await restore();
  await ok(scenarioInput(r.host, r.other, { kind: 'ack' }));
  await restore();
  await ok(scenarioInput(r.host, r.player, { kind: 'ack' }));
  await restore();
  const final = await readBackup(r.host);
  assert.equal(count, 11);
  assert.equal(final.payload.state.scenario.conclusion.stage, 'camp');
  const edits = [
    (b) => b.payload.state.scenario.conclusion.xp[0].amount++,
    (b) => b.payload.state.scenario.conclusion.bonusLore++,
    (b) => (b.payload.state.scenario.conclusion.transitionCount = 0),
    (b) => (b.payload.state.scenario.conclusion.campEntryCount = 0),
    (b) => (b.payload.state.scenario.conclusion.cause.playerId = randomUUID()),
    (b) => (b.payload.state.scenario.conclusion.cause.attemptId = randomUUID()),
    (b) => (b.payload.state.scenario.conclusion.cause.effectId += 'foreign'),
    (b) => (b.payload.state.scenario.conclusion.triggerRequestId = randomUUID()),
    (b) => b.payload.state.scenario.play.tests[1].total++,
    (b) => (b.payload.state.scenario.play.attempts[1].returned = false),
    (b) => (b.payload.state.scenario.pack.manifest.lair.definitionHash = 'e'.repeat(64)),
    (b) => (b.payload.state.physical.cycle.seed.scenario.globals.inventedWon = true),
    (b) => (b.payload.commands.at(-1).receipt.pendingId = randomUUID()),
  ];
  for (const edit of edits) {
    const bad = structuredClone(final);
    edit(bad);
    signBackup(bad);
    assert.equal(BackupSchema.safeParse(bad).success, false);
  }
  const bad = structuredClone(final);
  edits[4](bad);
  signBackup(bad);
  const before = (await readBackup(r.host)).payload,
    at = await readSession(r.host);
  assert.equal(
    (
      await r.host.request('/api/restores', {
        backup: bad,
        generation: at.generation,
        expectedRevision: at.revision,
        confirmed: true,
      })
    ).status,
    422,
  );
  assert.deepEqual((await readBackup(r.host)).payload, before);
});
