import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  readySearches,
  reachSearch,
  searchIntent,
  searchNode,
  commitSearch,
  resolveCount,
  ok,
} from './search-http-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';
import { readBackup } from './skill-test-helper.mjs';
import { startHost } from './host-helper.mjs';
import { hash } from './fixtures/map-freeze.mjs';

test('pre-commit SIGKILLs roll back paid choices, count conversions, card disposition, discard preparation and cleanup with the exact retry candidate', async (t) => {
  let r = await readySearches(t);
  await reachSearch(r);
  const dir = await mkdtemp(join(tmpdir(), 'lotr-search-commit-'));
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
return new Proxy(stmt,{get(target,key){if(key==='run')return data=>{writeFileSync(process.argv[5],data);process.stdout.write('SEARCH_BEFORE_COMMIT\\n');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0);return target.run(data)};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});};
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
        if (String(d).includes('SEARCH_BEFORE_COMMIT')) {
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
    if (process.env.LOTR_SEARCH_EVIDENCE) {
      const { mkdir, writeFile } = await import('node:fs/promises');
      await mkdir(process.env.LOTR_SEARCH_EVIDENCE, { recursive: true });
      await writeFile(
        join(process.env.LOTR_SEARCH_EVIDENCE, 'precommit-' + cuts + '.json'),
        JSON.stringify({ before, candidate, command: c }),
      );
    }
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
      input: typeof value === 'function' ? value(s) : value,
    };
  };
  const intent = (role) => (s) => {
    const i = searchNode(s, role);
    return searchIntent({ ...s, encounterFingerprints: { [i.id]: hash(i) } }, role);
  };
  await cut(r.player, intent('choice'), (s) => assert.equal(s.scenario.pending.kind, 'choice'));
  await cut(r.player, input({ kind: 'choice', event: 'STUDY' }), (s) =>
    assert.equal(s.physical.snapshot.active.mode, 'scout'),
  );
  await cut(
    r.player,
    input((s) => {
      const q = s.physical.snapshot.active;
      return {
        kind: 'physical-scout',
        prepare: q.options[0].id,
        top: [],
        bottom: [q.options[1].id],
        discard: null,
      };
    }),
    (s) => assert.equal(s.scenario.pending.kind, 'message'),
  );
  await cut(r.player, input({ kind: 'ack' }), (s) => assert.equal(searchNode(s).stopped, true));
  await r.host.stop();
  r = await readySearches(t);
  await reachSearch(r, 'challenge');
  await cut(r.player, intent('challenge'), (s) =>
    assert.equal(s.scenario.pending.kind, 'physical'),
  );
  for (const option of ['reveal', 'inspiration', 'inspiration'])
    await cut(r.player, input({ kind: 'physical-choice', option }), (s) =>
      assert.equal(s.physical.snapshot.active.kind, 'decision'),
    );
  await cut(r.player, input({ kind: 'physical-choice', option: 'resolve' }), (s) =>
    assert.equal(searchNode(s, 'challenge').variables.tally, 2),
  );
  await cut(r.player, input({ kind: 'physical-choice', option: 'prepare-discard' }), (s) =>
    assert.equal(s.physical.snapshot.active.mode, 'select'),
  );
  await cut(
    r.player,
    input((s) => ({ kind: 'physical-select', ids: [s.physical.snapshot.active.options[0].id] })),
    (s) => assert.equal(s.scenario.pending.kind, 'message'),
  );
  await cut(r.player, input({ kind: 'ack' }), (s) =>
    assert.equal(searchNode(s, 'challenge').stopped, true),
  );
  await r.host.stop();
  r = await readySearches(t);
  await reachSearch(r, 'challenge');
  await ok(commitSearch(r, 'challenge'));
  await resolveCount(r, 1);
  await cut(
    r.player,
    input((s) => ({
      kind: 'physical-scout',
      prepare: null,
      discard: null,
      top: s.physical.snapshot.active.options.map((o) => o.id).reverse(),
      bottom: [],
    })),
    (s) => assert.equal(s.scenario.pending.kind, 'message'),
  );
  await cut(r.player, input({ kind: 'ack' }), (s) =>
    assert.equal(searchNode(s, 'challenge').stopped, true),
  );
  assert.equal(cuts, 14);
});
