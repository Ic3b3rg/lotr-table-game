import { battleRuntime } from './battle-combat-runtime.mjs';
import { parseScenarioPack } from '../dist/scenario-library.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import {
  readyBattleRounds,
  endBattleTurns,
  drainPhase,
  completeRally,
  physicalInput,
} from './battle-rounds-helper.mjs';
import { departBattle, readSession, readBackup, command, ok } from './battle-combat-helper.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';
import { startHost } from './host-helper.mjs';
import { recoverSeat } from './last-stand-helper.mjs';
import { signBackup } from './skill-test-helper.mjs';

const administrative = (payload, original) => {
  const copy = structuredClone(payload);
  for (const key of ['generation', 'revision', 'updatedAt']) copy.state[key] = original.state[key];
  return copy;
};

test('battle phase, physical, threshold, Scout and next-turn checkpoints survive packless SIGKILL/empty restore with every domain and receipt field', async (t) => {
  const r = await readyBattleRounds(t);
  await departBattle(r);
  await endBattleTurns(r);
  const at = await readSession(r.host),
    intent = { type: 'BEGIN_SHADOW', roundId: at.round.id, agreed: true, requestId: randomUUID() };
  await ok(command(r.host, r.other, intent, at));
  for (const file of [
    r.scenarioPath,
    r.catalogPath,
    r.generatorPath,
    ...['physical-content.json', 'physical-fronts.json', 'physical-last-stand.json'].map((f) =>
      join(r.host.dataDir, f),
    ),
  ].filter(Boolean))
    await rm(file, { force: true });
  let index = 0;
  async function checkpoint(label) {
    t.diagnostic('Full checkpoint: ' + label);
    const before = await readBackup(r.host),
      dir = r.host.dataDir;
    await mkdir('.scratch/battle-rounds142/recovery', { recursive: true });
    await writeFile(
      '.scratch/battle-rounds142/recovery/' + index + '-' + before.payload.state.id + '.json',
      JSON.stringify(before),
    );
    await r.host.stop('SIGKILL');
    r.host = await startHost({ LOTR_DATA_DIR: dir });
    const restarted = r.host;
    t.after(() => restarted.stop());
    assert.deepEqual(
      (await readBackup(r.host)).payload,
      before.payload,
      label + ': complete restart',
    );
    for (const actor of r.actors) await recoverSeat(r.host, actor);
    const empty = await startHost({
      LOTR_DATA_DIR: join(r.directory, `battle-phase-empty-${index++}`),
    });
    t.after(() => empty.stop());
    const fresh = await readSession(empty);
    await ok(
      empty.request('/api/restores', {
        backup: before,
        generation: fresh.generation,
        expectedRevision: fresh.revision,
        confirmed: true,
      }),
    );
    assert.deepEqual(
      administrative((await readBackup(empty)).payload, before.payload),
      before.payload,
      label + ': entire empty restore',
    );
    await r.host.stop();
    r.host = empty;
    for (const actor of r.actors) await recoverSeat(r.host, actor);
    return before;
  }
  const opening = await checkpoint('source activation selection and source RNG cursor');
  let s = await drainPhase(r, { pause: (s) => !!s.physical.active });
  assert.ok(s.physical.active);
  const child = await checkpoint('actual pending enemy physical child and exact card/test cursor');
  const wrong = r.actors.find((a) => a.body.player.id !== s.physical.active.actorPlayerId);
  const q = (await readSession(r.host)).physical.cycle.pending;
  const stable = (await readBackup(r.host)).payload;
  const denied = await command(r.host, wrong, {
    type: 'CYCLE_INPUT',
    ...Object.fromEntries(Object.entries(q).filter(([k]) => k !== 'type')),
    input: physicalInput((await readSession(r.host)).physical.active),
  });
  assert.equal(denied.status, 403);
  assert.deepEqual((await readBackup(r.host)).payload, stable);
  await drainPhase(r);
  await checkpoint('darkness/events returned; real threat presentation');
  await ok(cycleCommand(r, 'CONFIRM_SHADOW_STEP', { step: 'threat', agreed: true }));
  await checkpoint('refreshed figures and all recomposed decks before any Scout');
  const scoutAt = await readSession(r.host),
    hero = scoutAt.preparation.heroes[0];
  await ok(cycleCommand(r, 'START_RALLY_SCOUT', { heroId: hero.heroId }, r.player));
  await checkpoint('pending actual Rally Scout and opaque choices');
  await drainPhase(r);
  await completeRally(r);
  await checkpoint('one source ROUND_START return and legal new-round turn boundary');
  await endBattleTurns(r);
  await ok(cycleCommand(r, 'BEGIN_SHADOW', { agreed: true }));
  await drainPhase(r);
  await ok(cycleCommand(r, 'CONFIRM_SHADOW_STEP', { step: 'threat', agreed: true }));
  s = await readSession(r.host);
  assert.ok(s.scenario.pending, 'The first reached source threshold must own a real instruction');
  await checkpoint('registered threshold and pending source message');
  await drainPhase(r);
  const final = await checkpoint(
    'threshold source spawns, retained points and one refresh/reset return',
  );
  assert.equal(final.payload.state.scenario.globals.battleEnemyPoints, 15);
  assert.deepEqual(
    final.payload.state.scenario.threats.map((t) => t.threshold),
    [18],
  );
  assert.equal(final.payload.state.scenario.rounds.frames.length, 2);
  for (const edit of [
    (p) => {
      p.state.scenario.rounds.frames[1].threat.delta++;
    },
    (p) => {
      p.state.scenario.enemies.cursor++;
    },
    (p) => {
      p.state.scenario.rounds.battle.bannerPools.elite.push(99);
    },
    (p) => {
      p.state.physical.cycle.records.find((r) => r.intent.type === 'BEGIN_SHADOW').playerId =
        r.player.body.player.id;
    },
    (p) => {
      const c = p.commands.find((c) => c.receipt.type === 'BEGIN_SHADOW');
      c.receipt.completed = !c.receipt.completed;
    },
    (p) => {
      p.state.scenario.pack.manifest.battleStartup.battleRounds.points[0].owner =
        'example.assets:991';
    },
  ]) {
    const bad = structuredClone(final);
    edit(bad.payload);
    const now = await readSession(r.host),
      before = (await readBackup(r.host)).payload;
    const response = await r.host.request('/api/restores', {
      backup: signBackup(bad),
      generation: now.generation,
      expectedRevision: now.revision,
      confirmed: true,
    });
    assert.equal(
      response.status,
      422,
      'Schema and complete episode reconstruction reject re-signed phase/domain/receipt/source changes',
    );
    assert.equal((await response.json()).error.code, 'INVALID_INPUT');
    assert.deepEqual((await readBackup(r.host)).payload, before);
  }
  const swapped = structuredClone(final),
    sc = swapped.payload.state.scenario,
    source = structuredClone(sc.pack.manifest.battleStartup),
    oldFingerprint = sc.packFingerprint;
  source.battleRounds.points[0].owner = 'example.assets:992';
  sc.pack = battleRuntime.battleRoundsPack(source, sc.pack);
  const certified = parseScenarioPack(sc.pack);
  assert.equal(
    certified.pack.manifest.battleStartup.battleRounds.points[0].owner,
    'example.assets:992',
  );
  sc.packFingerprint = certified.fingerprint;
  const remap = (v) =>
    JSON.parse(JSON.stringify(v).replaceAll(oldFingerprint, certified.fingerprint));
  swapped.payload.state.physical = remap(swapped.payload.state.physical);
  assert.deepEqual(
    swapped.payload.state.episodes,
    final.payload.state.episodes,
    'The A1 genesis is unchanged',
  );
  assert.deepEqual(
    swapped.payload.state.physical.cycle.seed.departure,
    final.payload.state.physical.cycle.seed.departure,
  );
  const swapAt = await readSession(r.host),
    stableSwap = (await readBackup(r.host)).payload;
  const rejectedSwap = await r.host.request('/api/restores', {
    backup: signBackup(swapped),
    generation: swapAt.generation,
    expectedRevision: swapAt.revision,
    confirmed: true,
  });
  assert.equal(
    rejectedSwap.status,
    422,
    'A valid recompiled current authority cannot replace the source derived from unchanged A1',
  );
  assert.deepEqual((await readBackup(r.host)).payload, stableSwap);
  assert.ok(opening.payload.commands.length && child.payload.commands.length);
});

test('valid source unknown-benefit closure rejects the real HTTP phase before any effect, reveal, receipt or entropy', async (t) => {
  const r = await readyBattleRounds(t, {
    sourceEdit: (_d, source) => {
      source.additions[0].effect = { op: 'gain-boon', boon: 'hidden' };
      source.additions[0].predicate = 'always';
    },
  });
  await departBattle(r);
  await endBattleTurns(r);
  const at = await readSession(r.host),
    before = (await readBackup(r.host)).payload;
  assert.equal(at.physical.nextShadow.enabled, false);
  const response = await cycleCommand(r, 'BEGIN_SHADOW', { agreed: true });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, 'ROUND_SOURCE_CAPABILITY');
  assert.deepEqual((await readBackup(r.host)).payload, before);
});

import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { build } from 'esbuild';

test('actual BEGIN_SHADOW Store.once rolls back before COMMIT and survives after COMMIT with one identical receipt', async (t) => {
  const r = await readyBattleRounds(t);
  await departBattle(r);
  await endBattleTurns(r);
  const prefix = await readBackup(r.host),
    worker = join(r.directory, 'battle-phase-commit-worker.mjs');
  await build({
    stdin: {
      resolveDir: process.cwd(),
      contents: `
import {Store} from './src/server/store';import {performCommand} from './src/server/commands';import {CommandSchema} from './src/shared/protocol';import {DatabaseSync} from 'node:sqlite';import {writeFileSync} from 'node:fs';
const store=new Store(process.argv[2]),original=DatabaseSync.prototype.exec;
DatabaseSync.prototype.exec=function(sql){if(sql!=='COMMIT')return original.call(this,sql);if(process.argv[6]==='after')original.call(this,sql);
const state=JSON.parse(this.prepare('SELECT data FROM session WHERE id=1').get().data),commands=this.prepare('SELECT player_id,request_id,fingerprint,result FROM commands ORDER BY player_id,request_id').all().map(r=>({playerId:r.player_id,requestId:r.request_id,fingerprint:r.fingerprint,receipt:JSON.parse(r.result)}));
writeFileSync(process.argv[5],JSON.stringify({state,commands}));process.stdout.write('BATTLE_PHASE_COMMIT_SEAM\\n');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0);};
performCommand(store,process.argv[3],CommandSchema.parse(JSON.parse(process.argv[4])));`,
    },
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    outfile: worker,
    logLevel: 'silent',
  });
  await r.host.stop();
  for (const phase of ['before', 'after']) {
    let host = await startHost({ LOTR_DATA_DIR: join(r.directory, 'commit-' + phase) });
    t.after(() => host.stop());
    let at = await readSession(host);
    await ok(
      host.request('/api/restores', {
        backup: prefix,
        generation: at.generation,
        expectedRevision: at.revision,
        confirmed: true,
      }),
    );
    for (const a of r.actors) await recoverSeat(host, a);
    at = await readSession(host);
    const before = (await readBackup(host)).payload,
      intent = {
        type: 'BEGIN_SHADOW',
        roundId: at.round.id,
        agreed: true,
        requestId: randomUUID(),
        generation: at.generation,
        expectedRevision: at.revision,
      },
      marker = join(r.directory, 'commit-' + phase + '.json');
    await host.stop();
    const child = spawn(
      process.execPath,
      [worker, host.dataDir, r.other.body.player.id, JSON.stringify(intent), marker, phase],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    t.after(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    });
    let stdout = '',
      stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Phase COMMIT seam absent: ' + stderr)), 10000);
      child.stdout.on('data', (d) => {
        if (String(d).includes('BATTLE_PHASE_COMMIT_SEAM')) {
          clearTimeout(timer);
          resolve();
        }
      });
      child.once('exit', (code) => {
        clearTimeout(timer);
        reject(Error('Worker exit ' + code + ': ' + stderr));
      });
    });
    const candidate = JSON.parse(await readFile(marker, 'utf8'));
    assert.equal(candidate.state.scenario.rounds.frames.length, 1);
    assert.equal(candidate.commands.length, before.commands.length + 1);
    assert.ok(candidate.state.combat.active);
    const exited = once(child, 'exit');
    child.kill('SIGKILL');
    const exit = await exited;
    assert.equal(exit[1], 'SIGKILL');
    await mkdir('.scratch/battle-rounds142/commit', { recursive: true });
    await writeFile(
      '.scratch/battle-rounds142/commit/' + phase + '-' + intent.requestId + '.json',
      JSON.stringify({ intent, before, candidate, stdout, stderr, exit }),
      { flag: 'wx' },
    );
    host = await startHost({ LOTR_DATA_DIR: host.dataDir });
    assert.deepEqual((await readBackup(host)).payload, phase === 'before' ? before : candidate);
    for (const a of r.actors) await recoverSeat(host, a);
    const replies = await Promise.all([
      host.request('/api/commands', intent, r.other.cookie),
      host.request('/api/commands', intent, r.other.cookie),
      host.request('/api/commands', { ...intent, requestId: randomUUID() }, r.other.cookie),
    ]);
    assert.deepEqual(replies.map((r) => r.status).sort(), [200, 200, 409]);
    const receipts = await Promise.all(
      replies.filter((r) => r.status === 200).map((r) => r.json()),
    );
    assert.deepEqual(receipts[0], receipts[1]);
    const actual = (await readBackup(host)).payload;
    if (phase === 'after') assert.deepEqual(actual, candidate);
    else {
      // Entropy drawn in the rolled-back transaction was never committed. The retry
      // records its own draw; compare that entire accepted payload across restart.
      assert.deepEqual(actual.state.episodes, before.state.episodes);
      assert.equal(actual.state.scenario.rounds.frames.length, 1);
      assert.equal(
        actual.state.physical.cycle.records.length,
        before.state.physical.cycle.records.length + 1,
      );
      await host.stop('SIGKILL');
      host = await startHost({ LOTR_DATA_DIR: host.dataDir });
      assert.deepEqual((await readBackup(host)).payload, actual);
      for (const a of r.actors) await recoverSeat(host, a);
    }
    assert.equal(actual.commands.length, before.commands.length + 1);
    r.host = host;
    await drainPhase(r);
    assert.equal((await readSession(host)).round.shadowStep, 'threat');
    await host.stop();
  }
});
