import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readyItem, reachItem, itemIntent, itemNode, ok } from './item-http-helper.mjs';
import { readBackup } from './skill-test-helper.mjs';
import { startHost } from './host-helper.mjs';
import { hash } from './fixtures/map-freeze.mjs';

test('six pre-commit SIGKILLs roll back costs, cards, conversion, acquisition, custody and callback with their receipts', async (t) => {
  let r = await readyItem(t);
  await reachItem(r);
  const dir = await mkdtemp(join(tmpdir(), 'lotr-item-commit-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const worker = join(dir, 'worker.mjs'),
    marker = join(dir, 'candidate.json');
  await build({
    stdin: {
      resolveDir: process.cwd(),
      contents: `
import {Store} from './src/server/store';import {performCommand} from './src/server/commands';
import {CommandSchema} from './src/shared/protocol';import {DatabaseSync} from 'node:sqlite';import {writeFileSync} from 'node:fs';
const store=new Store(process.argv[2]),original=DatabaseSync.prototype.prepare;
DatabaseSync.prototype.prepare=function(sql){const stmt=original.call(this,sql);if(sql!=='UPDATE session SET data = ? WHERE id = 1')return stmt;
return new Proxy(stmt,{get(target,key){if(key==='run')return data=>{writeFileSync(process.argv[5],data);process.stdout.write('BASE_BEFORE_COMMIT\\n');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0);return target.run(data)};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});};
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
  let cuts = 0;
  async function cut(actor, make, check) {
    const host = r.host,
      before = await readBackup(host),
      s = before.payload.state;
    const c = {
      ...make(s),
      requestId: randomUUID(),
      generation: s.generation,
      expectedRevision: s.revision,
    };
    await host.stop();
    const child = spawn(
      process.execPath,
      [worker, host.dataDir, actor.body.player.id, JSON.stringify(c), marker],
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
        if (String(d).includes('BASE_BEFORE_COMMIT')) {
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
    check(candidate);
    const exited = once(child, 'exit');
    child.kill('SIGKILL');
    await exited;
    r.host = await startHost({ LOTR_DATA_DIR: host.dataDir });
    const resumedHost = r.host;
    t.after(() => resumedHost.stop());
    assert.deepEqual((await readBackup(r.host)).payload, before.payload);
    const reply = await ok(r.host.request('/api/commands', c, actor.cookie)),
      receipt = await reply.json();
    const actual = (await readBackup(r.host)).payload.state;
    candidate.updatedAt = actual.updatedAt;
    assert.deepEqual(actual, candidate, 'retry reconstructs the entire candidate');
    assert.deepEqual(
      await (await ok(r.host.request('/api/commands', c, actor.cookie))).json(),
      receipt,
    );
    cuts++;
  }
  const input = (value) => (s) => {
    const sc = s.scenario,
      q = sc.pending;
    return {
      type: 'SCENARIO_INPUT',
      scenarioId: sc.id,
      packFingerprint: sc.packFingerprint,
      projectionFingerprint: sc.projectionFingerprint,
      pendingId: q.id,
      sourceFingerprint: q.fingerprint,
      heroId: q.heroId,
      input: value,
    };
  };
  const intent = (s) => {
    const i = itemNode(s);
    return itemIntent({ ...s, encounterFingerprints: { [i.id]: hash(i) } });
  };
  await cut(r.player, intent, (s) => assert.equal(s.round.heroes[0].actionsUsed, 2));
  await cut(r.player, input({ kind: 'physical-choice', option: 'reveal' }), (s) =>
    assert.equal(s.physical.snapshot.resolution.revealed[0].cards.length, 2),
  );
  await cut(r.player, input({ kind: 'physical-choice', option: 'inspiration' }), (s) =>
    assert.equal(s.preparation.heroes[0].inspiration, 0),
  );
  await cut(r.player, input({ kind: 'physical-choice', option: 'resolve' }), (s) => {
    assert.equal(s.scenario.play.tests[0].successes, 3);
    assert.equal(s.preparation.heroes[0].inspiration, 0);
  });
  await cut(r.other, input({ kind: 'ack' }), (s) => {
    assert.equal(s.physical.snapshot.resolution.resources.itemCustody.length, 1);
    assert.equal(s.physical.snapshot.resolution.resources.depletion[0].remaining, 2);
    assert.equal(s.scenario.pending.kind, 'physical');
    assert.equal(itemNode(s).visible, true);
  });
  await cut(r.player, input({ kind: 'physical-choice', option: 'hero-1' }), (s) => {
    assert.equal(s.physical.snapshot.resolution.resources.itemCustody[0].heroId, 'hero-1');
    assert.equal(itemNode(s).stopped, true);
    assert.equal(s.scenario.play.active, null);
    assert.equal(s.journey.travel.remaining, 1);
  });
  assert.equal(cuts, 6);
});
