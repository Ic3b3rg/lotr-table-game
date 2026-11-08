import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { build } from 'esbuild';
import {
  readyAdventure3,
  reachSecondCamp,
  confirmSecondCamp,
  readSession,
  readBackup,
  scenarioInput,
  ok,
  cycleCommand,
  saveCheckpoint,
  firstJourneyMove,
} from './adventure3-startup-helper.mjs';
import { automaticInput } from './camp-departure-helper.mjs';
import { startHost as startFixtureHost } from './host-helper.mjs';
import { recoverSeat } from './last-stand-helper.mjs';
import { runtime } from './adventure3-startup-runtime.mjs';
import { runtime as legacyRuntime } from './camp-departure-runtime.mjs';
import { hash } from './fixtures/map-freeze.mjs';
import { signBackup } from './skill-test-helper.mjs';

// A cold host verifies both complete archived histories before becoming ready.
// Keep the legacy fixture budget unchanged; allow this deeper replay a bounded minute.
const startHost = (env) => startFixtureHost(env, { startupTimeoutMs: 60000 });

test('A3 linear chain survives COMMIT SIGKILL, pending owners, packless restore and re-signed attacks', async (t) => {
  const r = await readyAdventure3(t, { outcome: 'failure', roleScout: true });
  await reachSecondCamp(r);
  await confirmSecondCamp(r);
  await saveCheckpoint(r, 'recovery-second-camp-confirmed');
  const original = await readBackup(r.host),
    worker = join(r.directory, 'a3-commit-worker.mjs');
  await build({
    stdin: {
      resolveDir: process.cwd(),
      contents: `
    import {Store} from './src/server/store';
    import {performCommand} from './src/server/commands';
    import {CommandSchema} from './src/shared/protocol';
    import {DatabaseSync} from 'node:sqlite';
    import {writeFileSync,writeSync} from 'node:fs';
    const store=new Store(process.argv[2]), original=DatabaseSync.prototype.exec;
    writeSync(1,'A3_STORE_READY\\n');
    DatabaseSync.prototype.exec=function(sql){
      if(sql!=='COMMIT')return original.call(this,sql);
      if(process.argv[6]==='after')original.call(this,sql);
      const state=JSON.parse(this.prepare('SELECT data FROM session WHERE id=1').get().data);
      const commands=this.prepare('SELECT player_id,request_id,fingerprint,result FROM commands ORDER BY player_id,request_id').all().map(r=>({playerId:r.player_id,requestId:r.request_id,fingerprint:r.fingerprint,receipt:JSON.parse(r.result)}));
      writeFileSync(process.argv[5],JSON.stringify({state,commands}));
      writeSync(1,'A3_COMMIT_SEAM\\n');
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0);
    };
    performCommand(store,process.argv[3],CommandSchema.parse(JSON.parse(process.argv[4])));
  `,
    },
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    outfile: worker,
    logLevel: 'silent',
  });
  let active;
  for (const phase of ['before', 'after']) {
    t.diagnostic('A3 COMMIT crash phase: ' + phase);
    let host = await startHost({ LOTR_DATA_DIR: join(r.directory, 'a3-transaction-' + phase) });
    t.after(() => host.stop());
    const empty = await readSession(host),
      result = await host.request('/api/restores', {
        backup: original,
        generation: empty.generation,
        expectedRevision: empty.revision,
        confirmed: true,
      });
    assert.equal(result.status, 200, await result.text());
    for (const actor of r.actors) await recoverSeat(host, actor);
    const s = await readSession(host),
      q = s.scenario.pending,
      before = (await readBackup(host)).payload;
    const intent = {
      type: 'SCENARIO_INPUT',
      requestId: randomUUID(),
      generation: s.generation,
      expectedRevision: s.revision,
      scenarioId: s.scenario.id,
      packFingerprint: s.scenario.packFingerprint,
      projectionFingerprint: s.scenario.projectionFingerprint,
      pendingId: q.id,
      sourceFingerprint: q.fingerprint,
      heroId: null,
      input: { kind: 'camp-depart', offerFingerprint: s.campDeparture.fingerprint, agreed: true },
    };
    await host.stop();
    const marker = join(r.directory, `a3-commit-${phase}.json`),
      child = spawn(
        process.execPath,
        [worker, host.dataDir, r.player.body.player.id, JSON.stringify(intent), marker, phase],
        { stdio: ['ignore', 'pipe', 'pipe'] },
      );
    t.after(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    });
    let diagnostics = '';
    child.stderr.on('data', (b) => (diagnostics += b));
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('A3 COMMIT seam absent: ' + diagnostics)), 60000);
      child.stdout.on('data', (b) => {
        diagnostics += String(b);
        if (String(b).includes('A3_COMMIT_SEAM')) {
          clearTimeout(timer);
          resolve();
        }
      });
      child.once('exit', (code) => {
        clearTimeout(timer);
        reject(Error(`Worker exited ${code}: ${diagnostics}`));
      });
    });
    const observed = JSON.parse(await readFile(marker, 'utf8'));
    assert.equal(observed.state.episodes.length, 2);
    const exited = once(child, 'exit');
    child.kill('SIGKILL');
    await exited;
    t.diagnostic('A3 worker killed at COMMIT: ' + phase);
    host = await startHost({ LOTR_DATA_DIR: host.dataDir });
    assert.deepEqual((await readBackup(host)).payload, phase === 'before' ? before : observed);
    const replies = await Promise.all([
      host.request('/api/commands', intent, r.player.cookie),
      host.request('/api/commands', intent, r.player.cookie),
      host.request('/api/commands', { ...intent, requestId: randomUUID() }, r.player.cookie),
    ]);
    assert.deepEqual(replies.map((r) => r.status).sort(), [200, 200, 409]);
    const receipts = await Promise.all(
      replies.filter((r) => r.status === 200).map((r) => r.json()),
    );
    assert.deepEqual(receipts[0], receipts[1]);
    const payload = (await readBackup(host)).payload;
    assert.equal(payload.commands.length, before.commands.length + 1);
    assert.deepEqual(payload.state.episodes[0], before.state.episodes[0]);
    assert.deepEqual(payload.state.episodes[1].scenario, before.state.scenario);
    assert.deepEqual(
      payload.commands.filter((c) => c.requestId !== intent.requestId),
      before.commands,
    );
    if (phase === 'after') assert.deepEqual(payload, observed);
    active = host;
  }
  await r.host.stop();
  r.host = active;
  for (const path of r.sourcePaths) await rm(path);
  let restores = 0;
  const resume = async (label) => {
    t.diagnostic('A3 packless recovery: ' + label);
    const before = await readBackup(r.host),
      old = r.host;
    await old.stop('SIGKILL');
    r.host = await startHost({ LOTR_DATA_DIR: old.dataDir });
    t.after(() => r.host.stop());
    assert.deepEqual((await readBackup(r.host)).payload, before.payload, label + ' restart');
    const empty = await startHost({ LOTR_DATA_DIR: join(r.directory, 'a3-empty-' + restores++) });
    t.after(() => empty.stop());
    const s = await readSession(empty),
      response = await empty.request('/api/restores', {
        backup: before,
        generation: s.generation,
        expectedRevision: s.revision,
        confirmed: true,
      });
    assert.equal(response.status, 200, await response.text());
    const restored = (await readBackup(empty)).payload,
      expected = structuredClone(before.payload);
    for (const key of ['generation', 'revision', 'updatedAt'])
      expected.state[key] = restored.state[key];
    assert.deepEqual(restored, expected, label + ' empty restore');
    await r.host.stop();
    r.host = empty;
    for (const actor of r.actors) await recoverSeat(empty, actor);
  };
  await resume('initial preparation child');
  let scout = false,
    objective = false,
    fear = false;
  for (let n = 0; n < 180; n++) {
    let s = await readSession(r.host),
      q = s.scenario.pending;
    if (!q) break;
    if (!scout && s.physical.active?.mode === 'scout') {
      const before = (await readBackup(r.host)).payload,
        actor = r.actors.find((a) => a.body.player.id === q.actorPlayerId),
        other = r.actors.find((a) => a !== actor);
      assert.equal((await scenarioInput(r.host, other, automaticInput(s))).status, 403);
      assert.deepEqual((await readBackup(r.host)).payload, before);
      await resume('another owner Scout child');
      scout = true;
      s = await readSession(r.host);
      q = s.scenario.pending;
    }
    if (!fear && s.scenario.effects.some((e) => e.op === 'physical' && e.state === 13)) {
      // Unprevented facedown cards return atomically without an invented ACK.
      const physical = (await readBackup(r.host)).payload.state.physical;
      assert.deepEqual(
        physical.snapshot.areas.map((h) => h.fear.length),
        [1, 1, 1],
      );
      await resume('A1 loss facedown Fear return');
      fear = true;
      s = await readSession(r.host);
      q = s.scenario.pending;
    }
    if (!objective && q.kind === 'handoff') {
      await resume('objective and first-turn boundary');
      objective = true;
      s = await readSession(r.host);
      q = s.scenario.pending;
    }
    const actor = r.actors.find((a) => a.body.player.id === q.actorPlayerId) ?? r.player;
    await ok(scenarioInput(r.host, actor, automaticInput(s)));
  }
  assert.ok(scout && objective && fear);
  await ok(cycleCommand(r, 'START_TURN'));
  await ok(cycleCommand(r, 'START_TRAVEL'));
  await firstJourneyMove(r);
  await resume('first legal travel');
  const stable = await readBackup(r.host),
    s = await readSession(r.host);
  legacyRuntime.BackupSchema.parse(stable);
  assert.equal(stable.payload.state.episodes.length, 2);
  assert.equal(s.round.heroes[0].actionsUsed, 1);
  assert.ok(
    Buffer.byteLength(JSON.stringify(stable)) < 16 * 1024 * 1024,
    'The demonstrated legitimate backup must fit the existing bounded restore policy',
  );
  for (const [label, edit] of [
    [
      'A1 output',
      (b) =>
        (b.payload.state.episodes[0].scenario.globals.inventedWon =
          !b.payload.state.episodes[0].scenario.globals.inventedWon),
    ],
    [
      'A2 output',
      (b) =>
        (b.payload.state.episodes[1].scenario.globals.battleWon =
          !b.payload.state.episodes[1].scenario.globals.battleWon),
    ],
    [
      'duplicate archive',
      (b) => (b.payload.state.episodes[1] = structuredClone(b.payload.state.episodes[0])),
    ],
    ['recursive State', (b) => (b.payload.state.episodes[1].episodes = [])],
    ['generation omitted', (b) => delete b.payload.state.physical.cycle.records.at(-1).generation],
    [
      'generation rewritten',
      (b) => (b.payload.state.physical.cycle.records.at(-1).generation = randomUUID()),
    ],
    [
      'current authority',
      (b) => (b.payload.state.scenario.pack.manifest.journeyStartup.generatorHash = '0'.repeat(64)),
    ],
    [
      'start random draw',
      (b) => (b.payload.state.scenario.journeyStartup.startSpaceDraw.value ^= 1),
    ],
    [
      'departure twice',
      (b) =>
        b.payload.state.physical.cycle.records.push(
          structuredClone(b.payload.state.physical.cycle.records[0]),
        ),
    ],
    [
      'archive re-signed',
      (b) => {
        const state = b.payload.state;
        state.episodes[1].preparation.heroes[0].inspiration++;
        const a = hash(state.episodes[1]);
        state.physical.cycle.seed.departure.archiveFingerprint = a;
        state.physical.cycle.seed.departure.receipt.archiveFingerprint = a;
        state.physical.cycle.seed.departure.chainFingerprint = hash(state.episodes);
        state.physical.cycle.seed.departure.receipt.chainFingerprint = hash(state.episodes);
      },
    ],
    [
      'A2 departure receipt missing',
      (b) => {
        const id = b.payload.state.episodes[1].physical.cycle.seed.departure.requestId;
        b.payload.commands = b.payload.commands.filter((c) => c.requestId !== id);
      },
    ],
  ]) {
    const bad = structuredClone(stable);
    edit(bad);
    signBackup(bad);
    assert.equal(legacyRuntime.BackupSchema.safeParse(bad).success, false, label);
    assert.deepEqual((await readBackup(r.host)).payload, stable.payload);
  }
  const prior = structuredClone(original.payload.state);
  for (const edit of [
    (s) => s.scenario.pack.manifest.campDeparture.windows.pop(),
    (s) =>
      (s.scenario.pack.manifest.campDeparture.quantities = {
        status: 'unverified',
        values: [null, null, null],
      }),
    (s) => (s.scenario.conclusion.campaign.preparation.heroes[0].confirmedRevision = null),
  ]) {
    const state = structuredClone(prior);
    edit(state);
    const before = structuredClone(state),
      q = state.scenario.pending;
    let draws = 0;
    assert.throws(() =>
      runtime.beginCampDeparture(
        state,
        {
          playerId: r.player.body.player.id,
          requestId: randomUUID(),
          pendingId: q.id,
          sourceFingerprint: q.fingerprint,
        },
        { kind: 'camp-depart', agreed: true, offerFingerprint: '0'.repeat(64) },
        state.scenario.pack.manifest.campDeparture,
        () => {
          draws++;
          return 'a'.repeat(64);
        },
      ),
    );
    assert.equal(draws, 0);
    assert.deepEqual(state, before);
  }
});
