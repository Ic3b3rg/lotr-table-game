import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { build } from 'esbuild';
import { readyTerrain, terrainTurn } from './battle-test-terrain-helper.mjs';
import {
  readSession,
  readBackup,
  command,
  attackIntent,
  drainBattle,
  ok,
} from './battle-combat-helper.mjs';
import { startHost } from './host-helper.mjs';
import { recoverSeat } from './last-stand-helper.mjs';
import { signBackup } from './skill-test-helper.mjs';
import { answerCycle } from './original-round-helper.mjs';
import { validatePhysical } from '../dist/physical-resolution-library.mjs';
import { parseScenarioPack } from '../dist/scenario-library.mjs';
import { digest } from '../dist/map-freeze-library.mjs';
import { runtime } from './camp-departure-runtime.mjs';

const inputFor = (s, option) => {
  const { type: _, ...binding } = s.physical.cycle.pending;
  return { type: 'CYCLE_INPUT', ...binding, input: { kind: 'physical-choice', option } };
};
const administrative = (payload, expected) => {
  const copy = structuredClone(payload);
  for (const k of ['generation', 'revision', 'updatedAt']) copy.state[k] = expected.state[k];
  return copy;
};
async function restore(t, r, backup, name) {
  const host = await startHost({ LOTR_DATA_DIR: join(r.directory, name) });
  t.after(() => host.stop());
  const s = await readSession(host);
  await ok(
    host.request('/api/restores', {
      backup,
      generation: s.generation,
      expectedRevision: s.revision,
      confirmed: true,
    }),
  );
  for (const a of r.actors) await recoverSeat(host, a);
  assert.deepEqual(
    administrative((await readBackup(host)).payload, backup.payload),
    backup.payload,
  );
  return host;
}
async function pending(t, kind) {
  const r = await readyTerrain(t, { kind });
  let s = await terrainTurn(r);
  await ok(command(r.host, r.player, attackIntent(s), s));
  s = await drainBattle(r, {
    pause: (s) => s.physical.sourceTest?.terrain?.kind === (kind === 'fire' ? 'attack' : 'negate'),
  });
  assert.ok(
    s.physical.active.options.some((o) =>
      o.id.startsWith(kind === 'fire' ? 'terrain:fire:' : 'terrain:boulder:'),
    ),
  );
  return { r, s };
}
async function restart(t, r, label) {
  t.diagnostic('SIGKILL/restart: ' + label);
  const before = await readBackup(r.host),
    dir = r.host.dataDir;
  await r.host.stop('SIGKILL');
  r.host = await startHost({ LOTR_DATA_DIR: dir });
  const owned = r.host;
  t.after(() => owned.stop());
  assert.deepEqual(
    (await readBackup(r.host)).payload,
    before.payload,
    label + ' full packless restart',
  );
  for (const a of r.actors) await recoverSeat(r.host, a);
  return before;
}

test('fire payment Store.once is atomic across SIGKILL before/after COMMIT, replay, child and ordinary return', async (t) => {
  const { r } = await pending(t, 'fire'),
    prefix = await readBackup(r.host);
  const worker = join(r.directory, 'terrain-commit-worker.mjs');
  await build({
    stdin: {
      resolveDir: process.cwd(),
      contents: `
import {Store} from './src/server/store';import {performCommand} from './src/server/commands';import {CommandSchema} from './src/shared/protocol';import {DatabaseSync} from 'node:sqlite';import {writeFileSync} from 'node:fs';
const store=new Store(process.argv[2]),original=DatabaseSync.prototype.exec;
DatabaseSync.prototype.exec=function(sql){if(sql!=='COMMIT')return original.call(this,sql);if(process.argv[6]==='after')original.call(this,sql);
const state=JSON.parse(this.prepare('SELECT data FROM session WHERE id=1').get().data),commands=this.prepare('SELECT player_id,request_id,fingerprint,result FROM commands ORDER BY player_id,request_id').all().map(r=>({playerId:r.player_id,requestId:r.request_id,fingerprint:r.fingerprint,receipt:JSON.parse(r.result)}));
writeFileSync(process.argv[5],JSON.stringify({state,commands}));process.stdout.write('TERRAIN_COMMIT_SEAM\\n');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0);};
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
    let host = await restore(t, r, prefix, 'payment-' + phase),
      s = await readSession(host),
      before = (await readBackup(host)).payload;
    const option = s.physical.active.options.find(
        (o) => o.id.startsWith('terrain:fire:') && o.id.endsWith(':smite'),
      ).id,
      intent = {
        ...inputFor(s, option),
        requestId: randomUUID(),
        generation: s.generation,
        expectedRevision: s.revision,
      },
      marker = join(r.directory, phase + '-payment.json');
    await host.stop();
    const child = spawn(
      process.execPath,
      [worker, host.dataDir, r.player.body.player.id, JSON.stringify(intent), marker, phase],
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
      const timer = setTimeout(() => reject(Error('Terrain COMMIT seam absent: ' + stderr)), 10000);
      child.stdout.on('data', (d) => {
        if (String(d).includes('TERRAIN_COMMIT_SEAM')) {
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
    assert.equal(
      candidate.state.physical.snapshot.resolution.sourceTest.terrain.fire.modifier,
      'smite',
    );
    assert.equal(candidate.commands.length, before.commands.length + 1);
    const exited = once(child, 'exit');
    child.kill('SIGKILL');
    const exit = await exited;
    assert.equal(exit[1], 'SIGKILL');
    t.diagnostic(JSON.stringify({ phase, stdout, stderr, exit }));
    if (process.env.TERRAIN_EVIDENCE_DIR) {
      await mkdir(process.env.TERRAIN_EVIDENCE_DIR, { recursive: true });
      await writeFile(
        join(process.env.TERRAIN_EVIDENCE_DIR, 'commit-' + phase + '.json'),
        JSON.stringify({ intent, before, candidate, stdout, stderr, exit }),
      );
    }
    host = await startHost({ LOTR_DATA_DIR: host.dataDir });
    const owned = host;
    t.after(() => owned.stop());
    assert.deepEqual((await readBackup(host)).payload, phase === 'before' ? before : candidate);
    for (const a of r.actors) await recoverSeat(host, a);
    const replies = await Promise.all([
      host.request('/api/commands', intent, r.player.cookie),
      host.request('/api/commands', intent, r.player.cookie),
      host.request('/api/commands', { ...intent, requestId: randomUUID() }, r.player.cookie),
    ]);
    assert.deepEqual(replies.map((r) => r.status).sort(), [200, 200, 409]);
    const receipts = await Promise.all(
      replies.filter((r) => r.status === 200).map((r) => r.json()),
    );
    assert.deepEqual(receipts[0], receipts[1]);
    const paid = (await readBackup(host)).payload;
    if (phase === 'after') assert.deepEqual(paid, candidate);
    else {
      const retry = structuredClone(paid);
      retry.state.updatedAt = candidate.state.updatedAt;
      assert.deepEqual(
        retry,
        candidate,
        'Only the wall-clock timestamp is regenerated after rollback',
      );
    }
    assert.equal(paid.commands.length, before.commands.length + 1);
    r.host = host;
  }
  for (const p of r.sourcePaths) await rm(p);
  const payment = await restart(t, r, 'paid exact fire copy');
  const restored = await restore(t, r, payment, 'empty-paid-fire');
  await r.host.stop();
  r.host = restored;
  let s = await readSession(r.host);
  assert.ok(!s.physical.active.options.some((o) => o.id.startsWith('terrain:fire:')));
  assert.equal(s.physical.sourceTest.cards.length, 2);
  assert.equal(s.physical.sourceTest.successes, 2);
  await drainBattle(r, {
    pause: (s) => s.combat.current?.stage === 'counterattack' && !!s.physical.active,
  });
  s = await readSession(r.host);
  assert.equal(s.combat.current.packet.executed, true);
  await restart(t, r, 'performed enemy reply child');
  await drainBattle(r);
  await restart(t, r, 'one ordinary source return');
  const complete = await readBackup(r.host);
  assert.equal(complete.payload.state.combat.attempts[0].returned, true);
  assert.deepEqual(complete.payload.state.combat.attempts[0].result.modifiers, ['smite']);
  assert.equal(complete.payload.state.round.heroes[0].actionsUsed, 2);
  assert.equal(complete.payload.state.journey.travel.remaining, 2);
  const reject = async (backup) => {
    const before = await readBackup(r.host),
      s = before.payload.state,
      response = await r.host.request('/api/restores', {
        backup: signBackup(backup),
        generation: s.generation,
        expectedRevision: s.revision,
        confirmed: true,
      });
    assert.equal(response.status, 422, await response.clone().text());
    assert.equal((await response.json()).error.code, 'INVALID_INPUT');
    assert.deepEqual((await readBackup(r.host)).payload, before.payload);
  };
  const context = structuredClone(complete);
  context.payload.state.physical.runs.find(
    (run) => run.spatial?.testTerrain,
  ).spatial.testTerrain.tokens[0].spaceId = 'forged-space';
  await reject(context);
  const source = structuredClone(complete);
  source.payload.state.scenario.pack.manifest.battleStartup.combat.testTerrain.rulesReference =
    '0'.repeat(64);
  await reject(source);
  // Two independently valid physical histories cannot be paired with the other
  // fixed ordinary origin, even when the backup checksum is recomputed.
  const alternate = await restore(t, r, prefix, 'alternate-fire-history'),
    alt = { ...r, host: alternate };
  s = await readSession(alternate);
  await ok(
    command(
      alternate,
      r.player,
      inputFor(
        s,
        s.physical.active.options.find(
          (o) => o.id.startsWith('terrain:fire:') && o.id.endsWith(':pierce'),
        ).id,
      ),
      s,
    ),
  );
  await drainBattle(alt);
  const other = await readBackup(alternate),
    paired = structuredClone(other);
  paired.payload.state.physical.cycle = structuredClone(complete.payload.state.physical.cycle);
  assert.notDeepEqual(other.payload.state.physical.runs, complete.payload.state.physical.runs);
  await reject(paired);
  const coherent = structuredClone(complete),
    state = coherent.payload.state;
  for (const sc of [state.scenario, state.physical.cycle.seed.scenario].filter(Boolean)) {
    sc.pack.manifest.battleStartup.combat.evidenceHash = digest(
      'coherently replaced source authority',
    );
    sc.packFingerprint = digest(sc.pack);
  }
  const replaced = state.scenario.pack.manifest.battleStartup.combat;
  state.physical.binding.packFingerprint = state.scenario.packFingerprint;
  for (const run of state.physical.runs)
    if (run.spatial?.testTerrain) run.spatial.testTerrain.capabilityFingerprint = digest(replaced);
  assert.doesNotThrow(
    () => parseScenarioPack(state.scenario.pack),
    'The replacement source is individually valid',
  );
  assert.doesNotThrow(
    () => validatePhysical(state.physical),
    'The paired physical history remains coherent',
  );
  assert.throws(
    () => runtime.validateEpisodeState(state),
    /Origine autonoma|Episodio2 non riconciliato/,
    'The fixed archived origin must reject paired replacement',
  );
  await reject(coherent);
});

test('boulder token allowance and exact fate identity survive pending selection, SIGKILL and empty packless restore', async (t) => {
  const { r } = await pending(t, 'rock');
  let s = await readSession(r.host);
  for (const p of r.sourcePaths) await rm(p);
  await restart(t, r, 'pending boulder offer');
  s = await readSession(r.host);
  const first = s.physical.active.options.find((o) => o.id.startsWith('terrain:boulder:')).id;
  await ok(command(r.host, r.player, inputFor(s, first), s));
  await restart(t, r, 'pending exact fate selection');
  s = await readSession(r.host);
  assert.equal(s.physical.active.mode, 'select');
  const selected = s.physical.active.options[0].id;
  await ok(answerCycle(r, { kind: 'physical-select', ids: [selected] }, s, r.player));
  const used = await restart(t, r, 'one token used');
  const empty = await restore(t, r, used, 'empty-boulder');
  await r.host.stop();
  r.host = empty;
  s = await readSession(r.host);
  assert.equal(s.physical.sourceTest.terrain.bouldersUsed.length, 1);
  assert.equal(
    s.physical.active.options.filter((o) => o.id.startsWith('terrain:boulder:')).length,
    0,
  );
  assert.ok(!s.physical.active.options.some((o) => o.id === first));
  const before = (await readBackup(r.host)).payload;
  const repeated = await command(r.host, r.player, inputFor(s, first), s);
  assert.equal(repeated.status, 409);
  assert.equal((await repeated.json()).error.code, 'PHYSICAL_ALLOCATION');
  assert.deepEqual((await readBackup(r.host)).payload, before);
  assert.equal(s.physical.sourceTest.terrain.bouldersUsed.length, 1);
  assert.ok(!s.physical.active.options.some((o) => o.id.startsWith('terrain:boulder:')));
  await drainBattle(r);
  await restart(t, r, 'boulder ordinary return');
  assert.equal((await readBackup(r.host)).payload.state.combat.attempts[0].returned, true);
});
