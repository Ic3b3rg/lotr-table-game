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
  readyThreatTokens,
  reachThreatToken,
  threatTokenIntent,
  threatTokenNode,
  commitThreatToken,
  resolveThreatTest,
  ok,
} from './threat-tokens-http-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';
import { readBackup } from './skill-test-helper.mjs';
import { startHost } from './host-helper.mjs';
import { hash } from './fixtures/map-freeze.mjs';

test('pre-commit SIGKILLs roll back source costs, failure/retry, fate selection, benefit/floor, fear/P2 and cleanup with an exact retry candidate', async (t) => {
  let r = await readyThreatTokens(t);
  await reachThreatToken(r);
  const dir = await mkdtemp(join(tmpdir(), 'lotr-token-commit-'));
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
return new Proxy(stmt,{get(target,key){if(key==='run')return data=>{writeFileSync(process.argv[5],data);process.stdout.write('TOKEN_BEFORE_COMMIT\\n');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0);return target.run(data)};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});};
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
        if (String(d).includes('TOKEN_BEFORE_COMMIT')) {
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
    if (process.env.LOTR_THREAT_TOKEN_EVIDENCE) {
      const { mkdir, writeFile } = await import('node:fs/promises');
      await mkdir(process.env.LOTR_THREAT_TOKEN_EVIDENCE, { recursive: true });
      await writeFile(
        join(process.env.LOTR_THREAT_TOKEN_EVIDENCE, 'precommit-' + cuts + '.json'),
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
    const i = threatTokenNode(s, role);
    return threatTokenIntent({ ...s, encounterFingerprints: { [i.id]: hash(i) } }, role);
  };
  await cut(r.player, intent('retry'), (s) => assert.equal(s.scenario.pending.kind, 'physical'));
  await cut(r.player, input({ kind: 'physical-choice', option: 'reveal' }), (s) =>
    assert.equal(s.physical.snapshot.active.kind, 'decision'),
  );
  await cut(r.player, input({ kind: 'physical-choice', option: 'resolve' }), (s) =>
    assert.equal(s.scenario.pending.kind, 'message'),
  );
  await cut(r.player, input({ kind: 'ack' }), (s) => {
    assert.equal(threatTokenNode(s).visible, true);
    assert.equal(s.scenario.play.active, null);
  });
  await cut(r.player, intent('retry'), (s) => assert.equal(s.round.heroes[0].actionsUsed, 2));
  await cut(r.player, input({ kind: 'physical-choice', option: 'reveal' }), (s) =>
    assert.equal(s.physical.snapshot.active.kind, 'decision'),
  );
  for (let n = 0; n < 2; n++) {
    await cut(r.player, input({ kind: 'physical-choice', option: 'inspiration' }), (s) =>
      assert.equal(s.physical.snapshot.active.kind, 'decision'),
    );
    if ((await readBackup(r.host)).payload.state.physical.snapshot.active.mode === 'select')
      await cut(
        r.player,
        input((s) => ({
          kind: 'physical-select',
          ids: [s.physical.snapshot.active.options[0].id],
        })),
        (s) => assert.equal(s.physical.snapshot.active.mode, 'choose'),
      );
  }
  await cut(r.player, input({ kind: 'physical-choice', option: 'resolve' }), (s) => {
    assert.equal(s.physical.snapshot.resolution.resources.boonCustody.length, 1);
    assert.equal(s.scenario.pending.kind, 'message');
  });
  await cut(r.player, input({ kind: 'ack' }), (s) =>
    assert.equal(threatTokenNode(s).stopped, true),
  );
  await r.host.stop();
  r = await readyThreatTokens(t, {
    catalogEdit: (c) => {
      for (const h of c.heroes) h.stats.fear = 1;
    },
  });
  await reachThreatToken(r, 'null-product');
  await cut(r.player, intent('null-product'), (s) =>
    assert.equal(s.scenario.pending.kind, 'physical'),
  );
  await cut(r.player, input({ kind: 'physical-choice', option: 'reveal' }), (s) =>
    assert.equal(s.physical.snapshot.active.kind, 'decision'),
  );
  await cut(r.player, input({ kind: 'physical-choice', option: 'resolve' }), (s) =>
    assert.equal(s.physical.snapshot.active.kind, 'decision'),
  );
  for (let n = 0; (await readBackup(r.host)).payload.state.scenario.pending && n < 40; n++) {
    await cut(
      r.player,
      input((s) => {
        const q = s.physical.snapshot.active;
        const option =
          ['force-fail', 'resolve', 'close', 'reveal'].find((id) =>
            q.options.some((o) => o.id === id),
          ) ?? q.options[0].id;
        return { kind: 'physical-choice', option };
      }),
      (s) => assert.equal(s.scenario.play.tests[0].successes, 0),
    );
  }
  const final = (await readBackup(r.host)).payload.state;
  assert.equal(final.physical.snapshot.lastStand.heroes[0].defeated, true);
  assert.equal(final.scenario.play.attempts[0].returned, true);
  assert.equal(threatTokenNode(final, 'null-product').stopped, true);
  assert.equal(cuts, 16);
});
