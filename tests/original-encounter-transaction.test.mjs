import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { build } from 'esbuild';
import { readyOriginal, playable } from './original-encounter-helper.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';
import { readBackup, readSession } from './skill-test-helper.mjs';
import { startHost } from './host-helper.mjs';
import { hash } from './fixtures/map-freeze.mjs';
for (const boundary of ['before', 'after'])
  test(`original confirmation SIGKILL ${boundary} commit preserves cost, cursor and one receipt`, async (t) => {
    const r = await readyOriginal(t);
    for (const type of ['START_TURN', 'START_TRAVEL']) {
      const res = await cycleCommand(r, type);
      assert.equal(res.status, 200, await res.text());
    }
    let s = await readSession(r.host);
    const node = playable(s),
      dest = s.scenario.spaceBindings.find((b) => b.sourceId === node.spaceId).id;
    const move = await cycleCommand(r, 'MOVE_HERO', {
      fromSpaceId: s.journey.heroes[0].spaceId,
      destinationSpaceId: dest,
    });
    assert.equal(move.status, 200, await move.text());
    s = await readSession(r.host);
    const before = await readBackup(r.host),
      intent = {
        type: 'INTERACT_SCENARIO',
        requestId: randomUUID(),
        generation: s.generation,
        expectedRevision: s.revision,
        scenarioId: s.scenario.id,
        packFingerprint: s.scenario.packFingerprint,
        projectionFingerprint: s.scenario.projectionFingerprint,
        instanceId: node.id,
        heroId: s.round.activeHeroId,
        roundId: s.round.id,
        turnId: s.round.turnId,
        sourceFingerprint: hash(playable(s)),
      };
    await r.host.stop();
    const dir = await mkdtemp(join(tmpdir(), 'lotr-encounter-commit-'));
    t.after(() => rm(dir, { recursive: true, force: true }));
    const worker = join(dir, 'worker.mjs'),
      marker = join(dir, 'marker.json');
    await build({
      stdin: {
        resolveDir: process.cwd(),
        contents: `
 import {Store} from './src/server/store.ts';import {performCommand} from './src/server/commands.ts';import {CommandSchema} from './src/shared/protocol.ts';import {DatabaseSync} from 'node:sqlite';import {writeFileSync} from 'node:fs';
 const store=new Store(process.argv[2]);
 function checkpoint(state){writeFileSync(process.argv[5],JSON.stringify({actions:state.round.heroes[0].actionsUsed,attempts:state.scenario.play.attempts.length,remaining:state.journey.travel.remaining}));process.stdout.write('ENCOUNTER_COMMIT_BOUNDARY\\n');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0);}
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
      const timer = setTimeout(() => reject(Error('Boundary not reached: ' + diagnostics)), 12000);
      child.stdout.on('data', (d) => {
        if (String(d).includes('ENCOUNTER_COMMIT_BOUNDARY')) {
          clearTimeout(timer);
          resolve();
        }
      });
      child.once('exit', (code) => {
        clearTimeout(timer);
        reject(Error('Worker exited ' + code + ': ' + diagnostics));
      });
    });
    assert.deepEqual(JSON.parse(await readFile(marker, 'utf8')), {
      actions: 2,
      attempts: 1,
      remaining: 1,
    });
    const exited = once(child, 'exit');
    child.kill('SIGKILL');
    await exited;
    const host = await startHost({ LOTR_DATA_DIR: r.host.dataDir });
    t.after(() => host.stop());
    const persisted = await readBackup(host);
    if (boundary === 'before') assert.deepEqual(persisted.payload, before.payload);
    else {
      assert.equal(persisted.payload.state.round.heroes[0].actionsUsed, 2);
      assert.equal(persisted.payload.state.scenario.play.attempts.length, 1);
    }
    const response = await host.request('/api/commands', intent, r.player.cookie);
    assert.equal(response.status, 200, await response.text());
    const final = await readBackup(host);
    assert.equal(final.payload.state.round.heroes[0].actionsUsed, 2);
    assert.equal(final.payload.state.journey.travel.remaining, 1);
    assert.equal(final.payload.commands.filter((c) => c.requestId === intent.requestId).length, 1);
    assert.equal(final.payload.state.scenario.play.attempts.length, 1);
  });
