import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  readyCamp,
  reachCamp,
  buyInput,
  training,
  scenarioInput,
  readSession,
  readBackup,
  ok,
} from './camp-skills-helper.mjs';
import { recoverSeat } from './last-stand-helper.mjs';
import { startHost } from './host-helper.mjs';
import { campEvidence } from './camp-skills-evidence.mjs';

test('SIGKILL before the real SQLite commit rolls back purchases, refund and role change with whole candidate payload and winning receipt comparisons, then restores packless', async (t) => {
  const r = await readyCamp(t);
  await reachCamp(r);
  const dir = await mkdtemp(join(tmpdir(), 'lotr-camp-commit-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const worker = join(dir, 'worker.mjs'),
    marker = join(dir, 'candidate.json');
  await build({
    stdin: {
      resolveDir: process.cwd(),
      contents: `
import {Store} from './src/server/store';import {performCommand} from './src/server/commands';
import {CommandSchema} from './src/shared/protocol';import {DatabaseSync} from 'node:sqlite';import {writeFileSync} from 'node:fs';
const store=new Store(process.argv[2]),originalOnce=store.once,originalPrepare=DatabaseSync.prototype.prepare;let computed;
store.once=function(playerId,requestId,generation,fingerprint,apply){return originalOnce.call(this,playerId,requestId,generation,fingerprint,state=>{const receipt=apply(state);computed={playerId,requestId,fingerprint,receipt};return receipt;});};
DatabaseSync.prototype.prepare=function(sql){const statement=originalPrepare.call(this,sql);if(sql!=='UPDATE session SET data = ? WHERE id = 1')return statement;
return new Proxy(statement,{get(target,key){if(key==='run')return data=>{const rows=originalPrepare.call(store.db,'SELECT player_id, request_id, fingerprint, result FROM commands ORDER BY player_id, request_id').all();const commands=rows.map(row=>{if(row.result===null){if(row.player_id!==computed.playerId||row.request_id!==computed.requestId||row.fingerprint!==computed.fingerprint)throw Error('Unexpected pending SQL row');return computed;}return{playerId:row.player_id,requestId:row.request_id,fingerprint:row.fingerprint,receipt:JSON.parse(row.result)};});writeFileSync(process.argv[5],JSON.stringify({state:JSON.parse(data),commands}));process.stdout.write('CAMP_BEFORE_COMMIT\\n');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0);return target.run(data);};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});};
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
  function admin(value, expected) {
    const copy = structuredClone(value);
    for (const k of ['generation', 'revision', 'updatedAt']) copy[k] = expected[k];
    return copy;
  }
  async function cut(input, expectedXP) {
    const host = r.host,
      before = await readBackup(host),
      view = await readSession(host),
      s = before.payload.state,
      q = s.scenario.pending;
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
      input,
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
    let errors = '';
    child.stderr.on('data', (b) => (errors += b));
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Commit seam: ' + errors)), 10000);
      child.stdout.on('data', (b) => {
        if (String(b).includes('CAMP_BEFORE_COMMIT')) {
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
    assert.equal(
      candidate.state.scenario.conclusion.campaign.training.balances[0].availableXP,
      expectedXP,
    );
    const exit = once(child, 'exit');
    child.kill('SIGKILL');
    await exit;
    r.host = await startHost({ LOTR_DATA_DIR: host.dataDir });
    t.after(() => r.host.stop());
    assert.deepEqual((await readBackup(r.host)).payload, before.payload);
    assert.deepEqual(await readSession(r.host), view);
    const result = await (
      await ok(r.host.request('/api/commands', intent, r.player.cookie))
    ).json();
    const committed = await readBackup(r.host),
      committedView = await readSession(r.host);
    const rawCandidate = structuredClone(candidate);
    candidate.state.updatedAt = committed.payload.state.updatedAt;
    assert.deepEqual(committed.payload, candidate);
    assert.deepEqual(
      result.receipt,
      candidate.commands.find((c) => c.requestId === intent.requestId).receipt,
    );
    assert.deepEqual(
      await (await ok(r.host.request('/api/commands', intent, r.player.cookie))).json(),
      result,
    );
    await r.host.stop('SIGKILL');
    const dest = await startHost();
    t.after(() => dest.dispose());
    for (const file of [
      'scenario-pack',
      'physical-content',
      'physical-fronts',
      'physical-last-stand',
    ])
      await assert.rejects(access(join(dest.dataDir, file + '.json')));
    const empty = await readSession(dest);
    await ok(
      dest.request('/api/restores', {
        backup: committed,
        generation: empty.generation,
        expectedRevision: empty.revision,
        confirmed: true,
      }),
    );
    const restored = await readBackup(dest),
      restoredView = await readSession(dest);
    assert.deepEqual(
      { ...restored.payload, state: admin(restored.payload.state, committed.payload.state) },
      committed.payload,
    );
    assert.deepEqual(admin(restoredView, committedView), committedView);
    await recoverSeat(dest, r.player);
    await recoverSeat(dest, r.other);
    r.host = dest;
    await campEvidence('precommit-' + cuts++, {
      before,
      view,
      candidate,
      rawCandidate,
      committed,
      committedView,
      restored,
      restoredView,
      sigkill: true,
      rollbackWhole: true,
      packless: true,
    });
  }
  let s = await readSession(r.host);
  const first = buyInput(s);
  await cut(first, 4);
  await cut({ ...first, operation: 'sell' }, 6);
  s = await readSession(r.host);
  await cut(buyInput(s, { n: 1 }), 2);
  await cut({ kind: 'camp-role', heroId: 'hero-1', roleId: 'role-3' }, 2);
  assert.equal(cuts, 4);
  assert.equal(training(await readSession(r.host)).balances[0].availableXP, 2);
});
