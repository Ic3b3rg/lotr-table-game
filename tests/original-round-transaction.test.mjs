import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { build } from 'esbuild';
import { readyRounds, endTurns } from './original-round-helper.mjs';
import { readBackup } from './skill-test-helper.mjs';
import { startHost } from './host-helper.mjs';

test('SIGKILL before Store.once commit rolls back both timer dispatch and threat/deck reset with their receipts', async (t) => {
  const r = await readyRounds(t);
  await endTurns(r);
  let host = r.host;
  t.after(() => host.stop());
  const directory = await mkdtemp(join(tmpdir(), 'lotr-source-round-commit-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const worker = join(directory, 'worker.mjs'),
    marker = join(directory, 'marker.json');
  await build({
    stdin: {
      resolveDir: process.cwd(),
      contents: `
    import {Store} from './src/server/store.ts';
    import {performCommand} from './src/server/commands.ts';
    import {CommandSchema} from './src/shared/protocol.ts';
    import {DatabaseSync} from 'node:sqlite';
    import {writeFileSync} from 'node:fs';
    const store=new Store(process.argv[2]),prepare=DatabaseSync.prototype.prepare;
    DatabaseSync.prototype.prepare=function(sql){const statement=prepare.call(this,sql);
      if(sql!=='UPDATE session SET data = ? WHERE id = 1')return statement;
      return new Proxy(statement,{get(target,key){if(key==='run')return data=>{
        const s=JSON.parse(data);writeFileSync(process.argv[5],JSON.stringify({phase:s.round.phase,
          timer:s.scenario.instances.find(i=>i.kind==='timer').variables.remaining,
          threat:s.scenario.globals.pressure,discard:s.preparation.heroes.map(h=>h.discard.length)}));
        process.stdout.write('ROUND_BEFORE_COMMIT\\n');
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0);
        return target.run(data);
      };const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});
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
  for (const type of ['BEGIN_SHADOW', 'CONFIRM_SHADOW_STEP']) {
    const before = await readBackup(host),
      s = before.payload.state;
    const intent = {
      requestId: randomUUID(),
      generation: s.generation,
      expectedRevision: s.revision,
      type,
      roundId: s.round.id,
      agreed: true,
      ...(type === 'CONFIRM_SHADOW_STEP' ? { step: 'threat' } : {}),
    };
    await host.stop();
    const child = spawn(
      process.execPath,
      [worker, host.dataDir, r.player.body.player.id, JSON.stringify(intent), marker],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    t.after(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    });
    let diagnostics = '';
    child.stderr.on('data', (d) => (diagnostics += d));
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(Error('Commit seam not reached: ' + diagnostics)),
        10000,
      );
      child.stdout.on('data', (d) => {
        if (String(d).includes('ROUND_BEFORE_COMMIT')) {
          clearTimeout(timer);
          resolve();
        }
      });
      child.once('exit', (code) => {
        clearTimeout(timer);
        reject(Error('Worker exited ' + code + ': ' + diagnostics));
      });
    });
    const observed = JSON.parse(await readFile(marker));
    assert.equal(observed.timer, 3);
    assert.equal(observed.phase, type === 'BEGIN_SHADOW' ? 'shadow' : 'rally');
    if (type === 'CONFIRM_SHADOW_STEP') {
      assert.ok(observed.threat > 0);
      assert.deepEqual(observed.discard, [0, 0]);
    }
    const exited = once(child, 'exit');
    child.kill('SIGKILL');
    await exited;
    host = await startHost({ LOTR_DATA_DIR: host.dataDir });
    r.host = host;
    assert.deepEqual((await readBackup(host)).payload, before.payload);
    const retry = await host.request('/api/commands', intent, r.player.cookie);
    assert.equal(retry.status, 200, await retry.text());
    const committed = await readBackup(host);
    assert.equal(
      committed.payload.commands.filter((c) => c.requestId === intent.requestId).length,
      1,
    );
  }
});
