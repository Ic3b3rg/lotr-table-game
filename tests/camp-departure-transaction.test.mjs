import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { build } from 'esbuild';
import {
  readyDeparture,
  confirmedCamp,
  readBackup,
  readSession,
} from './camp-departure-helper.mjs';
import { startHost } from './host-helper.mjs';
import { recoverSeat } from './last-stand-helper.mjs';

test('departure Store.once is atomic across SIGKILL before/after COMMIT and conserves concurrent receipts', async (t) => {
  const r = await readyDeparture(t);
  await confirmedCamp(r);
  const original = await readBackup(r.host),
    worker = join(r.directory, 'transaction-worker.mjs');
  // Observation only: unchanged production Store.once and command service. No SQL progress fixture.
  await build({
    stdin: {
      resolveDir: process.cwd(),
      contents: `
    import {Store} from './src/server/store';
    import {performCommand} from './src/server/commands';
    import {CommandSchema} from './src/shared/protocol';
    import {DatabaseSync} from 'node:sqlite';
    import {writeFileSync} from 'node:fs';
    const store=new Store(process.argv[2]), original=DatabaseSync.prototype.exec;
    DatabaseSync.prototype.exec=function(sql){
      if(sql!=='COMMIT')return original.call(this,sql);
      if(process.argv[6]==='after')original.call(this,sql);
      const state=JSON.parse(this.prepare('SELECT data FROM session WHERE id=1').get().data);
      const commands=this.prepare('SELECT player_id,request_id,fingerprint,result FROM commands ORDER BY player_id,request_id').all().map(r=>({playerId:r.player_id,requestId:r.request_id,fingerprint:r.fingerprint,receipt:JSON.parse(r.result)}));
      writeFileSync(process.argv[5],JSON.stringify({state,commands}));
      process.stdout.write('DEPARTURE_COMMIT_SEAM\\n');
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
  for (const phase of ['before', 'after'])
    await t.test(phase + ' commit', async () => {
      let host = await startHost({ LOTR_DATA_DIR: join(r.directory, 'transaction-' + phase) });
      t.after(() => host.stop());
      const empty = await readSession(host);
      const restore = await host.request('/api/restores', {
        backup: original,
        generation: empty.generation,
        expectedRevision: empty.revision,
        confirmed: true,
      });
      assert.equal(restore.status, 200, await restore.text());
      for (const actor of r.actors) await recoverSeat(host, actor);
      const at = await readSession(host),
        before = (await readBackup(host)).payload,
        q = at.scenario.pending;
      const intent = {
        type: 'SCENARIO_INPUT',
        requestId: randomUUID(),
        generation: at.generation,
        expectedRevision: at.revision,
        scenarioId: at.scenario.id,
        packFingerprint: at.scenario.packFingerprint,
        projectionFingerprint: at.scenario.projectionFingerprint,
        pendingId: q.id,
        sourceFingerprint: q.fingerprint,
        heroId: null,
        input: {
          kind: 'camp-depart',
          offerFingerprint: at.campDeparture.fingerprint,
          agreed: true,
        },
      };
      await host.stop();
      const marker = join(r.directory, `commit-${phase}.json`);
      const child = spawn(
        process.execPath,
        [worker, host.dataDir, r.player.body.player.id, JSON.stringify(intent), marker, phase],
        { stdio: ['ignore', 'pipe', 'pipe'] },
      );
      t.after(() => {
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      });
      let diagnostics = '';
      child.stderr.on('data', (chunk) => (diagnostics += chunk));
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(Error('Commit seam absent: ' + diagnostics)), 10000);
        child.stdout.on('data', (data) => {
          if (String(data).includes('DEPARTURE_COMMIT_SEAM')) {
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
      assert.equal(observed.state.episodes.length, 1);
      assert.equal(observed.state.scenario.pack.identity.adventureId, 2);
      assert.equal(observed.commands.filter((c) => c.requestId === intent.requestId).length, 1);
      const exited = once(child, 'exit');
      child.kill('SIGKILL');
      await exited;
      host = await startHost({ LOTR_DATA_DIR: host.dataDir });
      assert.deepEqual((await readBackup(host)).payload, phase === 'before' ? before : observed);
      const results = await Promise.all([
        host.request('/api/commands', intent, r.player.cookie),
        host.request('/api/commands', intent, r.player.cookie),
        host.request('/api/commands', { ...intent, requestId: randomUUID() }, r.player.cookie),
      ]);
      assert.deepEqual(results.map((r) => r.status).sort(), [200, 200, 409]);
      const replies = await Promise.all(
        results.filter((r) => r.status === 200).map((r) => r.json()),
      );
      assert.deepEqual(replies[0], replies[1]);
      const committed = (await readBackup(host)).payload,
        departure = committed.commands.find((c) => c.requestId === intent.requestId);
      assert.deepEqual(replies[0].receipt, departure.receipt);
      assert.equal(committed.commands.length, before.commands.length + 1);
      assert.equal(committed.state.episodes.length, 1);
      assert.deepEqual(committed.state.episodes[0].scenario, before.state.scenario);
      assert.deepEqual(
        committed.commands.filter((c) => c.requestId !== intent.requestId),
        before.commands,
      );
      assert.deepEqual(
        committed.state.physical.cycle.seed.departure.receipt,
        departure.receipt.departure,
      );
      if (phase === 'after') assert.deepEqual(committed, observed);
    });
});
