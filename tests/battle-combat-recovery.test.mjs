import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { build } from 'esbuild';
import {
  readyBattle,
  departBattle,
  enterAdjacentEnemy,
  readBackup,
  readSession,
  ok,
  command,
  attackIntent,
  stepBattle,
  drainBattle,
} from './battle-combat-helper.mjs';
import { startHost } from './host-helper.mjs';
import { recoverSeat } from './last-stand-helper.mjs';
import { signBackup } from './skill-test-helper.mjs';

async function restoredHost(t, r, backup, name) {
  const host = await startHost({ LOTR_DATA_DIR: join(r.directory, name) });
  t.after(() => host.stop());
  const empty = await readSession(host);
  await ok(
    host.request('/api/restores', {
      backup,
      generation: empty.generation,
      expectedRevision: empty.revision,
      confirmed: true,
    }),
  );
  for (const actor of r.actors) await recoverSeat(host, actor);
  return host;
}
const administrative = (payload, expected) => {
  const actual = structuredClone(payload);
  for (const k of ['generation', 'revision', 'updatedAt']) actual.state[k] = expected.state[k];
  return actual;
};

test('A2 Store.once survives SIGKILL before/after COMMIT and pending attack/reply/return with full packless receipts', async (t) => {
  const r = await readyBattle(t);
  t.after(() => t.diagnostic(r.host.diagnostics()));
  await departBattle(r);
  const location = await enterAdjacentEnemy(r),
    prefix = await readBackup(r.host);
  await r.host.stop();
  const worker = join(r.directory, 'battle-commit-worker.mjs');
  await build({
    stdin: {
      resolveDir: process.cwd(),
      contents: `
import {Store} from './src/server/store';import {performCommand} from './src/server/commands';import {CommandSchema} from './src/shared/protocol';import {DatabaseSync} from 'node:sqlite';import {writeFileSync} from 'node:fs';
const store=new Store(process.argv[2]),original=DatabaseSync.prototype.exec;
DatabaseSync.prototype.exec=function(sql){if(sql!=='COMMIT')return original.call(this,sql);if(process.argv[6]==='after')original.call(this,sql);
const state=JSON.parse(this.prepare('SELECT data FROM session WHERE id=1').get().data),commands=this.prepare('SELECT player_id,request_id,fingerprint,result FROM commands ORDER BY player_id,request_id').all().map(r=>({playerId:r.player_id,requestId:r.request_id,fingerprint:r.fingerprint,receipt:JSON.parse(r.result)}));
writeFileSync(process.argv[5],JSON.stringify({state,commands}));process.stdout.write('BATTLE_COMMIT_SEAM\\n');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0);};
performCommand(store,process.argv[3],CommandSchema.parse(JSON.parse(process.argv[4])));`,
    },
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    outfile: worker,
    logLevel: 'silent',
  });
  for (const phase of ['before', 'after']) {
    let host = await restoredHost(t, r, prefix, 'commit-' + phase),
      at = await readSession(host),
      before = (await readBackup(host)).payload;
    const intent = {
      ...attackIntent(
        at,
        at.combat.attacks.find((o) => o.groupId === location.group.id && !o.reason),
      ),
      requestId: randomUUID(),
      generation: at.generation,
      expectedRevision: at.revision,
    };
    await host.stop();
    const marker = join(r.directory, 'battle-' + phase + '.json'),
      child = spawn(
        process.execPath,
        [worker, host.dataDir, r.player.body.player.id, JSON.stringify(intent), marker, phase],
        { stdio: ['ignore', 'pipe', 'pipe'] },
      );
    t.after(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    });
    let errors = '';
    child.stderr.on('data', (d) => (errors += d));
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Battle commit seam absent: ' + errors)), 10000);
      child.stdout.on('data', (d) => {
        if (String(d).includes('BATTLE_COMMIT_SEAM')) {
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
    assert.equal(candidate.state.combat.attempts.length, 1);
    assert.equal(candidate.state.round.heroes[0].actionsUsed, 2);
    assert.ok(candidate.state.physical.snapshot.active);
    assert.equal(candidate.commands.filter((c) => c.requestId === intent.requestId).length, 1);
    const exited = once(child, 'exit');
    child.kill('SIGKILL');
    const killed = await exited;
    assert.equal(killed[1], 'SIGKILL');
    host = await startHost({ LOTR_DATA_DIR: host.dataDir });
    const owned = host;
    t.after(() => owned.stop());
    assert.deepEqual((await readBackup(host)).payload, phase === 'before' ? before : candidate);
    const replies = await Promise.all([
      host.request('/api/commands', intent, r.player.cookie),
      host.request('/api/commands', intent, r.player.cookie),
      host.request('/api/commands', { ...intent, requestId: randomUUID() }, r.player.cookie),
    ]);
    assert.deepEqual(replies.map((x) => x.status).sort(), [200, 200, 409]);
    const receipts = await Promise.all(
      replies.filter((x) => x.status === 200).map((x) => x.json()),
    );
    assert.deepEqual(receipts[0], receipts[1]);
    const committed = (await readBackup(host)).payload;
    assert.equal(committed.commands.length, before.commands.length + 1);
    assert.equal(committed.state.combat.attempts.length, 1);
    assert.equal(
      committed.state.physical.cycle.records.filter((x) => x.intent.type === 'START_ATTACK').length,
      1,
    );
    if (phase === 'after') assert.deepEqual(committed, candidate);
    t.diagnostic(
      phase + ' COMMIT: SIGKILL, full payload and concurrent complete receipts verified',
    );
    r.host = host;
  }
  for (const path of r.sourcePaths) await rm(path);
  const restart = async (label) => {
    const before = await readBackup(r.host),
      old = r.host;
    await old.stop('SIGKILL');
    r.host = await startHost({ LOTR_DATA_DIR: old.dataDir });
    const owned = r.host;
    t.after(() => owned.stop());
    assert.deepEqual(
      (await readBackup(r.host)).payload,
      before.payload,
      label + ' packless restart',
    );
    return before;
  };
  await restart('pending attack');
  let reply;
  for (let n = 0; n < 100; n++) {
    const s = await readSession(r.host);
    if (s.combat.current?.stage === 'counterattack' && s.physical.active) {
      reply = s;
      break;
    }
    await stepBattle(r, s);
  }
  assert.ok(reply?.combat.current.packet.executed, 'An actual physical enemy reply is required');
  const pending = await restart('pending enemy physical reply');
  const empty = await restoredHost(t, r, pending, 'empty-reply');
  assert.deepEqual(
    administrative((await readBackup(empty)).payload, pending.payload),
    pending.payload,
    'Full source, both episodes, deck/copy orientation and every receipt survive empty restore',
  );
  await r.host.stop();
  r.host = empty;
  await drainBattle(r);
  await restart('ordinary return');
  const complete = await readBackup(r.host);
  assert.equal(complete.payload.state.combat.attempts[0].returned, true);
  assert.equal(complete.payload.state.journey.travel.remaining, 1);
  const reject = async (backup) => {
    const before = await readBackup(r.host),
      s = before.payload.state,
      result = await r.host.request('/api/restores', {
        backup: signBackup(backup),
        generation: s.generation,
        expectedRevision: s.revision,
        confirmed: true,
      });
    assert.equal(result.status, 422, await result.clone().text());
    assert.equal((await result.json()).error.code, 'INVALID_INPUT');
    assert.deepEqual((await readBackup(r.host)).payload, before.payload);
  };
  const source = structuredClone(complete);
  source.payload.state.scenario.pack.manifest.combat.source.projectionFingerprint = '0'.repeat(64);
  await reject(source);
  const callback = structuredClone(complete);
  callback.payload.state.scenario.pack.manifest.failure.next.id = 19;
  await reject(callback);
  // Export order is player/request UUID order, not episode order. Select
  // replay-owned receipts from their recorded intents, never an arbitrary
  // preparation/generation receipt from before the source episode.
  const receiptCases = new Map();
  for (const record of complete.payload.state.physical.cycle.records) {
    const stored = complete.payload.commands.find(
      (c) => c.playerId === record.playerId && c.requestId === record.requestId,
    );
    assert.ok(stored, 'Every recorded episode intent retains its receipt');
    if (
      !receiptCases.has(record.intent.type) &&
      stored.receipt.appliedRevision < complete.payload.state.revision
    )
      receiptCases.set(record.intent.type, record);
  }
  for (const type of ['START_ATTACK', 'CYCLE_INPUT', 'SCENARIO_INPUT'])
    assert.ok(receiptCases.has(type), `The real episode must exercise ${type}`);
  for (const [type, record] of receiptCases) {
    const receipt = structuredClone(complete),
      stored = receipt.payload.commands.find(
        (c) => c.playerId === record.playerId && c.requestId === record.requestId,
      );
    stored.receipt.appliedRevision++;
    assert.ok(
      stored.receipt.appliedRevision <= receipt.payload.state.revision,
      'Rejection must reconcile the receipt, rather than only reject a future revision',
    );
    await reject(receipt);
    t.diagnostic(`${type}: replay-owned receipt alteration rejected with full payload unchanged`);
  }
  // Construct a second, individually valid physical history through ordinary
  // commands, then pair it with the first frozen ordinary journal. Neither
  // a checksum nor agreement of the alternative physical snapshots is authority.
  const alternative = await restoredHost(t, r, prefix, 'alternative-history'),
    alt = { ...r, host: alternative };
  let at = await readSession(alternative);
  await ok(
    command(
      alternative,
      r.player,
      attackIntent(
        at,
        at.combat.attacks.find((o) => o.groupId === location.group.id && !o.reason),
      ),
      at,
    ),
  );
  let converted = false;
  await drainBattle(alt, {
    choose: (q, s) => {
      if (
        !converted &&
        s.combat.current?.stage === 'attack-test' &&
        q.options.some((o) => o.id === 'inspiration' && !o.unavailable)
      ) {
        converted = true;
        return 'inspiration';
      }
      return null;
    },
  });
  assert.equal(converted, true);
  const other = await readBackup(alternative),
    paired = structuredClone(other);
  paired.payload.state.physical.cycle = structuredClone(complete.payload.state.physical.cycle);
  assert.notDeepEqual(other.payload.state.physical.runs, complete.payload.state.physical.runs);
  await reject(paired);
});
