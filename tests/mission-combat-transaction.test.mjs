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
  readyMission,
  reachMission,
  missionIntent,
  ok,
  strongInventedWeapons,
} from './mission-combat-helper.mjs';
import { readSession } from './skill-test-helper.mjs';
import { drainCombat } from './combat-controller-helper.mjs';
import { readBackup } from './skill-test-helper.mjs';
import { startHost } from './host-helper.mjs';
import { hash } from './fixtures/map-freeze.mjs';

test('pre-commit SIGKILLs roll back mission cost, cards, conversion, benefit, spawn, optional attack and its source callback with stable receipts', async (t) => {
  let r = await readyMission(t, { fate: 1, edit: strongInventedWeapons });
  await reachMission(r);
  const dir = await mkdtemp(join(tmpdir(), 'lotr-mission-commit-'));
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
  const intent = (s) => missionIntent(r, s, 'PUSH');
  await cut(r.player, intent, (s) => assert.equal(s.scenario.play.attempts.length, 1));
  await cut(r.player, input({ kind: 'physical-choice', option: 'reveal' }), (s) =>
    assert.equal(s.physical.snapshot.resolution.revealed[0].cards.length, 3),
  );
  await cut(r.player, input({ kind: 'physical-choice', option: 'inspiration' }), (s) =>
    assert.equal(s.physical.snapshot.active.mode, 'select'),
  );
  const selection = (await readSession(r.host)).physical.active;
  await cut(
    r.player,
    input({
      kind: 'physical-select',
      ids: selection.options.slice(0, selection.minimum).map((o) => o.id),
    }),
    (s) => assert.equal(s.preparation.heroes[0].inspiration, 0),
  );
  await cut(r.player, input({ kind: 'physical-choice', option: 'resolve' }), (s) => {
    assert.equal(s.scenario.play.tests[0].total, 4);
    assert.equal(s.physical.snapshot.resolution.resources.boonCustody[0].kind, 'emboldened');
  });
  await cut(r.player, input({ kind: 'ack' }), (s) => {
    assert.equal(s.scenario.firstCombat.spawns.length, 1);
    assert.equal(s.scenario.enemies.groups.at(-1).figures.length, 2);
    assert.equal(s.scenario.pending.kind, 'deployment');
    assert.equal(s.scenario.enemies.groups.at(-1).placed, true);
    assert.equal(s.scenario.firstCombat.spawns[0].returned, false);
  });
  await cut(r.player, input({ kind: 'ack' }), (s) => {
    assert.equal(s.scenario.objective.id, 4);
  });
  await cut(r.player, input({ kind: 'ack' }), (s) => {
    assert.equal(s.scenario.firstCombat.spawns[0].grant, 'offered');
    assert.equal(s.scenario.pending.kind, 'source-attack');
  });
  const at = await readSession(r.host),
    offer = at.combat.attacks.find((a) => !a.reason);
  await cut(
    r.player,
    (s) => ({
      type: 'START_ATTACK',
      roundId: s.round.id,
      turnId: s.round.turnId,
      heroId: offer.heroId,
      groupId: offer.groupId,
      itemCopies: offer.itemCopies,
      stat: offer.stat,
      replaceCopy: null,
      grantId: at.combat.grant.id,
    }),
    (s) => {
      assert.equal(s.scenario.firstCombat.spawns[0].grant, 'used');
      assert.equal(s.combat.attempts.at(-1).cost, 'grant');
    },
  );
  await drainCombat(
    r,
    (q) => q.options?.find((o) => o.id.startsWith('slot:') && !o.unavailable)?.id ?? null,
    (s) => s.combat.current?.stage === 'reward',
  );
  const reward = (await readSession(r.host)).combat.pending;
  await cut(
    r.player,
    (s) => {
      const q = s.combat;
      // The saved state owns the attempt; the public controller owns the pending cursor.
      const a = q.attempts.find((a) => a.id === q.active);
      return {
        type: 'COMBAT_INPUT',
        combatId: a.id,
        pendingId: reward.id,
        sourceFingerprint: reward.sourceFingerprint,
        choice: reward.options[0].id,
      };
    },
    (s) => assert.equal(s.scenario.firstCombat.callbacks[0].cause, 'defeated'),
  );
  while ((await readSession(r.host)).scenario.pending) {
    const view = await readSession(r.host),
      q = view.scenario.pending;
    assert.notEqual(q.kind, 'physical');
    await cut(
      q.actorPlayerId === r.other.body.player.id ? r.other : r.player,
      input({ kind: 'ack' }),
      (s) => assert.equal(s.scenario.firstCombat.callbacks.length, 1),
    );
  }
  await drainCombat(r);
  const final = (await readBackup(r.host)).payload.state;
  assert.ok(cuts >= 10);
  assert.equal(final.scenario.firstCombat.callbacks[0].returned, true);
  assert.equal(final.scenario.firstCombat.spawns[0].returned, true);
  assert.equal(final.scenario.play.active, null);
});
