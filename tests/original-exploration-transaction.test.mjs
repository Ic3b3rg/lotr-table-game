import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { build } from 'esbuild';
import {
  readyExploration,
  startTravel,
  destinations,
  explore,
  exploreIntent,
} from './original-exploration-helper.mjs';
import { readSession, readBackup } from './skill-test-helper.mjs';
import { startHost } from './host-helper.mjs';
for (const phase of ['entry', 'reward'])
  for (const boundary of ['before', 'after'])
    test(`exploration ${phase} SIGKILL ${boundary} commit preserves one move, reward and receipt`, async (t) => {
      const r = await readyExploration(t);
      let s = await startTravel(r);
      const to = destinations(s)[0];
      if (phase === 'reward') {
        const res = await explore(r, to);
        assert.equal(res.status, 200, await res.text());
        s = await readSession(r.host);
      }
      const q = s.scenario.pending,
        intent = {
          ...(phase === 'entry'
            ? exploreIntent(s, to)
            : {
                type: 'SCENARIO_INPUT',
                scenarioId: s.scenario.id,
                packFingerprint: s.scenario.packFingerprint,
                projectionFingerprint: s.scenario.projectionFingerprint,
                pendingId: q.id,
                sourceFingerprint: q.fingerprint,
                heroId: q.heroId,
                input: { kind: 'ack' },
              }),
          generation: s.generation,
          expectedRevision: s.revision,
          requestId: randomUUID(),
        };
      const before = await readBackup(r.host);
      await r.host.stop();
      const dir = await mkdtemp(join(tmpdir(), 'lotr-exploration-commit-'));
      t.after(() => rm(dir, { recursive: true, force: true }));
      const worker = join(dir, 'worker.mjs'),
        marker = join(dir, 'marker.json');
      await build({
        stdin: {
          resolveDir: process.cwd(),
          contents: `
 import {Store} from './src/server/store.ts';import{performCommand}from './src/server/commands.ts';import{CommandSchema}from './src/shared/protocol.ts';import{DatabaseSync}from 'node:sqlite';import{writeFileSync}from 'node:fs';
 const store=new Store(process.argv[2]);
 function checkpoint(state){writeFileSync(process.argv[5],JSON.stringify({actions:state.round.heroes[0].actionsUsed,attempts:state.scenario.explorations.attempts.length,remaining:state.journey.travel.remaining,inspiration:state.preparation.heroes[0].inspiration,pending:state.scenario.pending.kind}));process.stdout.write('EXPLORATION_COMMIT_BOUNDARY\\n');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0);}
 if(process.argv[6]==='before'){const original=DatabaseSync.prototype.prepare;DatabaseSync.prototype.prepare=function(sql){const st=original.call(this,sql);if(sql!=='UPDATE session SET data = ? WHERE id = 1')return st;return new Proxy(st,{get(target,key){if(key==='run')return(data)=>{checkpoint(JSON.parse(data));return target.run(data);};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});};}
 performCommand(store,process.argv[3],CommandSchema.parse(JSON.parse(process.argv[4])));if(process.argv[6]==='after')checkpoint(store.read());
 `,
        },
        bundle: true,
        platform: 'node',
        format: 'esm',
        target: 'node24',
        outfile: worker,
        logLevel: 'silent',
      });
      const child = spawn(
        process.execPath,
        [worker, r.host.dataDir, r.player.body.player.id, JSON.stringify(intent), marker, boundary],
        { stdio: ['ignore', 'pipe', 'pipe'] },
      );
      t.after(() => {
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      });
      let diagnostics = '';
      child.stderr.on('data', (d) => (diagnostics += d));
      await new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(Error('Boundary not reached: ' + diagnostics)),
          15000,
        );
        child.stdout.on('data', (d) => {
          if (String(d).includes('EXPLORATION_COMMIT_BOUNDARY')) {
            clearTimeout(timer);
            resolve();
          }
        });
        child.once('exit', (code) => {
          clearTimeout(timer);
          reject(Error('Worker exited ' + code + ': ' + diagnostics));
        });
      });
      const markerData = JSON.parse(await readFile(marker, 'utf8'));
      assert.equal(markerData.actions, s.round.heroes[0].actionsUsed);
      assert.equal(markerData.attempts, 1);
      assert.equal(markerData.remaining, s.journey.travel.remaining - (phase === 'entry' ? 1 : 0));
      const exited = once(child, 'exit');
      child.kill('SIGKILL');
      await exited;
      const host = await startHost({ LOTR_DATA_DIR: r.host.dataDir });
      t.after(() => host.stop());
      const persisted = await readBackup(host);
      if (boundary === 'before') assert.deepEqual(persisted.payload, before.payload);
      else assert.equal(persisted.payload.state.scenario.explorations.attempts.length, 1);
      const res = await host.request('/api/commands', intent, r.player.cookie);
      assert.equal(res.status, 200, await res.text());
      const after = await readBackup(host);
      assert.equal(after.payload.state.journey.travel.remaining, markerData.remaining);
      assert.equal(after.payload.state.preparation.heroes[0].inspiration, markerData.inspiration);
      assert.equal(after.payload.state.scenario.explorations.attempts.length, 1);
      assert.equal(
        after.payload.commands.filter((c) => c.requestId === intent.requestId).length,
        1,
      );
    });
