import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { buildSync } from 'esbuild';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { readyFailure, defeatHero, ok } from './adventure-failure-helper.mjs';
import { endTurns } from './original-round-helper.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';
import { readBackup, readSession } from './skill-test-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';
import { startHost } from './host-helper.mjs';
const built = buildSync({
  stdin: {
    contents:
      "export {BackupSchema,checksum} from './src/server/backup-format'; export {parseState} from './src/server/state';",
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const { BackupSchema, checksum, parseState } = await import(
  'data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].contents).toString('base64')
);

test('SIGKILL packless at loss, both source messages, rewards, campaign map/story and camp preserves the full journal and rejects resigned outputs', async (t) => {
  const r = await readyFailure(t);
  let host = r.host;
  t.after(() => host.stop());
  await defeatHero(r);
  await endTurns(r);
  const origin = (await readBackup(host)).payload.state.physical.cycle.seed;
  let packless = false,
    checks = 0;
  async function restart() {
    const before = (await readBackup(host)).payload;
    await host.stop('SIGKILL');
    if (!packless) {
      for (const path of [
        r.scenarioPath,
        ...['physical-content', 'physical-fronts', 'physical-last-stand'].map((name) =>
          join(host.dataDir, name + '.json'),
        ),
      ])
        await rm(path);
      packless = true;
    }
    host = await startHost({ LOTR_DATA_DIR: host.dataDir });
    r.host = host;
    assert.deepEqual((await readBackup(host)).payload, before);
    assert.deepEqual(before.state.physical.cycle.seed, origin);
    checks++;
  }
  await restart();
  await ok(cycleCommand(r, 'BEGIN_SHADOW', {}, r.other));
  await restart();
  for (let n = 0; n < 4; n++) {
    await ok(scenarioInput(host, r.other, { kind: 'ack' }));
    await restart();
  }
  let s = await readSession(host);
  assert.equal(s.scenario.conclusion.stage, 'camp');
  assert.equal(checks, 6);
  await ok(
    scenarioInput(host, r.player, {
      kind: 'camp-role',
      heroId: s.preparation.heroes[0].heroId,
      roleId: 'role-3',
    }),
  );
  await restart();
  const backup = await readBackup(host);
  const edits = [
    (b) => b.payload.state.scenario.conclusion.xp[0].amount++,
    (b) =>
      (b.payload.state.scenario.conclusion.cause.heroId =
        b.payload.state.preparation.heroes[1].heroId),
    (b) => b.payload.state.scenario.conclusion.nextAdventureId++,
    (b) => (b.payload.state.scenario.conclusion.completedAdventureIds = []),
    (b) => (b.payload.state.scenario.conclusion.campEntryCount = 0),
    (b) => (b.payload.state.scenario.conclusion.campaign.heroes[0].roleId = 'role-4'),
    (b) => b.payload.state.scenario.conclusion.suspendedPrincipal.entry++,
    (b) => b.payload.state.scenario.play.lore++,
    (b) => (b.payload.state.physical.cycle.seed.scenario.globals.inventedWon = false),
    (b) => (b.payload.commands.at(-1).receipt.pendingId = randomUUID()),
  ];
  for (const edit of edits) {
    const bad = structuredClone(backup);
    edit(bad);
    bad.checksum = checksum(bad.payload);
    assert.equal(BackupSchema.safeParse(bad).success, false);
  }
  const before = structuredClone(backup.payload.state);
  delete before.scenario.conclusion;
  before.scenario.pack.manifest.failure = undefined;
  // A published schema15 state may only migrate structurally, never acquire this new capability.
  const old = structuredClone(backup.payload.state);
  old.schemaVersion = 15;
  assert.throws(() => parseState(old), /schema storico/);
  await host.stop();
});
