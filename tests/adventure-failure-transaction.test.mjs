import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readyFailure, defeatHero, ok } from './adventure-failure-helper.mjs';
import { endTurns } from './original-round-helper.mjs';
import { readBackup } from './skill-test-helper.mjs';
import { startHost } from './host-helper.mjs';

test('SIGKILL before commit rolls back trigger, concurrent XP/lore and transition together with their authoritative receipt', async (t) => {
  const r = await readyFailure(t);
  let host = r.host;
  t.after(() => host.stop());
  await defeatHero(r);
  await endTurns(r);
  const dir = await mkdtemp(join(tmpdir(), 'lotr-failure-commit-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const worker = join(dir, 'worker.mjs'),
    marker = join(dir, 'marker.json');
  await build({
    stdin: {
      resolveDir: process.cwd(),
      contents: `
 import {Store} from './src/server/store'; import {performCommand} from './src/server/commands';
 import {CommandSchema} from './src/shared/protocol'; import {DatabaseSync} from 'node:sqlite'; import {writeFileSync} from 'node:fs';
 const store=new Store(process.argv[2]),original=DatabaseSync.prototype.prepare;
 DatabaseSync.prototype.prepare=function(sql){const stmt=original.call(this,sql);if(sql!=='UPDATE session SET data = ? WHERE id = 1')return stmt;
 return new Proxy(stmt,{get(target,key){if(key==='run')return data=>{const s=JSON.parse(data);writeFileSync(process.argv[5],JSON.stringify(s.scenario.conclusion));process.stdout.write('FAILURE_BEFORE_COMMIT\\n');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0);return target.run(data)};const v=Reflect.get(target,key);return typeof v==='function'?v.bind(target):v;}});};
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
  for (let n = 0; n < 3; n++) {
    const before = await readBackup(host),
      s = before.payload.state,
      sc = s.scenario,
      q = sc.pending;
    const input = {
      requestId: randomUUID(),
      generation: s.generation,
      expectedRevision: s.revision,
      ...(n === 0
        ? { type: 'BEGIN_SHADOW', roundId: s.round.id, agreed: true }
        : {
            type: 'SCENARIO_INPUT',
            scenarioId: sc.id,
            packFingerprint: sc.packFingerprint,
            projectionFingerprint: sc.projectionFingerprint,
            pendingId: q.id,
            sourceFingerprint: q.fingerprint,
            heroId: null,
            input: { kind: 'ack' },
          }),
    };
    await host.stop();
    const child = spawn(
      process.execPath,
      [worker, host.dataDir, r.other.body.player.id, JSON.stringify(input), marker],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    t.after(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    });
    let errors = '';
    child.stderr.on('data', (d) => (errors += d));
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Commit seam: ' + errors)), 10000);
      child.stdout.on('data', (d) => {
        if (String(d).includes('FAILURE_BEFORE_COMMIT')) {
          clearTimeout(timer);
          resolve();
        }
      });
      child.once('exit', (code) => {
        clearTimeout(timer);
        reject(Error('Worker exited ' + code + ': ' + errors));
      });
    });
    const candidate = JSON.parse(await readFile(marker, 'utf8'));
    assert.equal(candidate.stage, n === 2 ? 'campaign-map' : 'conclusion');
    assert.equal(candidate.xp.length, n === 0 ? 0 : 2);
    const exited = once(child, 'exit');
    child.kill('SIGKILL');
    await exited;
    host = await startHost({ LOTR_DATA_DIR: host.dataDir });
    r.host = host;
    assert.deepEqual((await readBackup(host)).payload, before.payload);
    await ok(host.request('/api/commands', input, r.other.cookie));
  }
  await host.stop();
});
