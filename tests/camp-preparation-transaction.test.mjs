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
  readyGroupItemCamp,
  reachGroupCamp,
  readSession,
  readBackup,
  ok,
} from './camp-items-group-helper.mjs';
import { attachCampPreparation } from './fixtures/camp-preparation.mjs';
import { confirm, choice } from './camp-preparation-helper.mjs';
import { startHost } from './host-helper.mjs';
import { recoverSeat } from './last-stand-helper.mjs';
import { preparationEvidence } from './camp-preparation-evidence.mjs';

test('SIGKILL at the real final SQLite COMMIT rolls back next choices and full receipts, then retries and restores packless', async (t) => {
  const r = await readyGroupItemCamp(t, {
    edit(pack, _, catalog) {
      attachCampPreparation(pack, catalog);
    },
  });
  await reachGroupCamp(r);
  const dir = await mkdtemp(join(tmpdir(), 'lotr-camp-preparation-commit-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const worker = join(dir, 'worker.mjs'),
    marker = join(dir, 'candidate.json');
  await build({
    stdin: {
      resolveDir: process.cwd(),
      contents: `
import {Store,publicSession} from './src/server/store';import {performCommand} from './src/server/commands';import {CommandSchema} from './src/shared/protocol';
import {DatabaseSync} from 'node:sqlite';import {writeFileSync} from 'node:fs';
const store=new Store(process.argv[2]),originalExec=DatabaseSync.prototype.exec;
DatabaseSync.prototype.exec=function(sql){
 if(sql==='COMMIT' && this.isTransaction){
  const session=store.db.prepare('SELECT data FROM session WHERE id = 1').get();
  const sqlRows=store.db.prepare('SELECT player_id, request_id, fingerprint, result FROM commands ORDER BY player_id, request_id').all();
  if(sqlRows.some(row=>typeof row.result!=='string'))throw Error('Real SQL receipt is incomplete at final commit');
  const state=JSON.parse(session.data),commands=sqlRows.map(row=>({playerId:row.player_id,requestId:row.request_id,fingerprint:row.fingerprint,receipt:JSON.parse(row.result)}));
  writeFileSync(process.argv[5],JSON.stringify({payload:{state,commands},view:publicSession(state),sqlRows,sessionRow:session}));
  process.stdout.write('PREPARATION_BEFORE_REAL_COMMIT\\n');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0);
 }
 return originalExec.call(this,sql);
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
  const admin = (value, expected) => {
    const copy = structuredClone(value);
    for (const k of ['generation', 'revision', 'updatedAt']) copy[k] = expected[k];
    return copy;
  };
  let count = 0;
  async function cut(input, check) {
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
      const timer = setTimeout(() => reject(Error('Actual commit seam: ' + errors)), 10000);
      child.stdout.on('data', (b) => {
        if (String(b).includes('PREPARATION_BEFORE_REAL_COMMIT')) {
          clearTimeout(timer);
          resolve();
        }
      });
      child.once('exit', (code) => {
        clearTimeout(timer);
        reject(Error('Worker exited ' + code + ': ' + errors));
      });
    });
    const rawCandidate = JSON.parse(await readFile(marker, 'utf8')),
      candidate = structuredClone(rawCandidate.payload);
    check(candidate.state);
    const sql = rawCandidate.sqlRows.find((c) => c.request_id === intent.requestId);
    assert.ok(sql);
    assert.deepEqual(
      JSON.parse(sql.result),
      candidate.commands.find((c) => c.requestId === intent.requestId).receipt,
    );
    assert.deepEqual(JSON.parse(rawCandidate.sessionRow.data), candidate.state);
    assert.equal(candidate.commands.length, before.payload.commands.length + 1);
    assert.deepEqual(candidate.state.physical.cycle.seed, before.payload.state.physical.cycle.seed);
    const exited = once(child, 'exit');
    child.kill('SIGKILL');
    const [code, signal] = await exited;
    assert.equal(code, null);
    assert.equal(signal, 'SIGKILL');
    await preparationEvidence(
      'precommit-' + count + '-cut',
      { before, view, rawCandidate, intent, exit: { code, signal }, actualFinalCommit: true },
      host.dataDir,
    );
    r.host = await startHost({ LOTR_DATA_DIR: host.dataDir });
    t.after(() => r.host.stop());
    assert.deepEqual((await readBackup(r.host)).payload, before.payload);
    assert.deepEqual(await readSession(r.host), view);
    const result = await (
        await ok(r.host.request('/api/commands', intent, r.player.cookie))
      ).json(),
      committed = await readBackup(r.host),
      committedView = await readSession(r.host);
    candidate.state.updatedAt = committed.payload.state.updatedAt;
    assert.deepEqual(committed.payload, candidate);
    assert.deepEqual(admin(committedView, rawCandidate.view), rawCandidate.view);
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
      'scenario.json',
      'physical-content.json',
      'physical-fronts.json',
      'physical-last-stand.json',
      'catalog.json',
      'map-generator.json',
    ])
      await assert.rejects(access(join(dest.dataDir, file)));
    const empty = await readSession(dest);
    assert.equal(empty.players.length, 0);
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
    await preparationEvidence('precommit-' + count++, {
      before,
      view,
      rawCandidate,
      candidate,
      committed,
      committedView,
      restored,
      restoredView,
      intent,
      result,
      actualSQLRows: true,
      sigkill: true,
      packless: true,
    });
  }
  await cut({ kind: 'camp-prepare' }, (s) => {
    assert.equal(s.scenario.conclusion.stage, 'camp-preparation');
    assert.ok(
      s.scenario.conclusion.campaign.preparation.heroes.every((h) => h.confirmedRevision === null),
    );
  });
  await cut({ kind: 'camp-select-role', heroId: 'hero-1', roleId: 'role-2' }, (s) => {
    assert.equal(choice(s).recipe.roleId, 'role-2');
    assert.equal(choice(s, 'hero-2').recipe.roleId, null);
  });
  await cut({ kind: 'camp-accessory', heroId: 'hero-1', copy: 'trinket:1' }, (s) =>
    assert.equal(choice(s).accessory, 'trinket:1'),
  );
  await cut(confirm(await readSession(r.host)), (s) =>
    assert.equal(choice(s).confirmedRevision, s.revision),
  );
  assert.equal(count, 4);
  const final = await readSession(r.host);
  assert.equal(final.scenario.play.lore, 30);
  assert.equal(final.scenario.conclusion.campaign.inventory[0].copy, 'trinket:1');
  assert.equal(final.scenario.conclusion.campaign.next.status, 'requires-content');
});
