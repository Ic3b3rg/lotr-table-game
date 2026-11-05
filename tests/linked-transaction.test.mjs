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
  readyLinked,
  reachLinked,
  linkedIntent,
  commitLinked,
  linkedNode,
  nextLinkedRound,
  finishPhysical,
  ok,
} from './linked-http-helper.mjs';
import { readBackup } from './skill-test-helper.mjs';
import { startHost } from './host-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';
import { hash } from './fixtures/map-freeze.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';

test('SIGKILL at SQLite commit rolls back linked costs, choices, cards, broadcasts, return and source title with their receipts', async (t) => {
  const r = await readyLinked(t);
  await ok(cycleCommand(r, 'START_TURN'));
  const dir = await mkdtemp(join(tmpdir(), 'lotr-linked-commit-'));
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
return new Proxy(stmt,{get(target,key){if(key==='run')return data=>{writeFileSync(process.argv[5],data);process.stdout.write('LINKED_BEFORE_COMMIT\\n');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0);return target.run(data)};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});};
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
        if (String(d).includes('LINKED_BEFORE_COMMIT')) {
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
    t.after(() => r.host.stop());
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
  const input = (kind) => (s) => {
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
      input: { kind },
    };
  };
  const physical = (option) => (s) => ({
    ...input('physical-choice')(s),
    input: { kind: 'physical-choice', option },
  });
  const intent = (s, choiceEvent) => {
    const i = linkedNode(s);
    return linkedIntent({ ...s, encounterFingerprints: { [i.id]: hash(i) } }, 0, choiceEvent);
  };
  const choice = (event) => (s) => ({ ...input('choice')(s), input: { kind: 'choice', event } });
  await cut(
    r.player,
    (s) => intent(s),
    (s) => {
      assert.equal(s.round.heroes[0].actionsUsed, 1);
      assert.equal(s.scenario.pending.kind, 'choice');
    },
  );
  await finishPhysical(r);
  await cut(r.player, choice('STUDY'), (s) => assert.equal(s.scenario.pending.kind, 'physical'));
  await cut(r.player, physical('reveal'), (s) =>
    assert.ok(s.physical.snapshot.resolution.revealed.some((r) => r.cards.length === 2)),
  );
  await cut(r.player, physical('resolve'), (s) =>
    assert.equal(s.scenario.play.tests[0].successes, 2),
  );
  await cut(r.other, input('ack'), (s) => {
    assert.equal(linkedNode(s).variables.seen, true);
    assert.equal(linkedNode(s, 1).visible, true);
  });
  await cut(r.other, input('ack'), (s) => assert.equal(s.scenario.play.active, null));
  await ok(cycleCommand(r, 'END_TURN'));
  await reachLinked(r);
  await ok(commitLinked(r, 1, r.other));
  await finishPhysical(r);
  await ok(scenarioInput(r.host, r.other, { kind: 'choice', event: 'SOLVE' }));
  await finishPhysical(r);
  await ok(scenarioInput(r.host, r.player, { kind: 'ack' }));
  await nextLinkedRound(r);
  await ok(cycleCommand(r, 'START_TURN'));
  await cut(
    r.player,
    (s) => intent(s, 'DELIVER'),
    (s) => {
      assert.equal(s.round.heroes[0].actionsUsed, 1);
      assert.equal(linkedNode(s).variables.supplied, true);
    },
  );
  await finishPhysical(r);
  await cut(r.other, input('ack'), (s) => assert.equal(s.scenario.pending.kind, 'hero-choice'));
  await cut(
    r.player,
    (s) => ({ ...input('choose-hero')(s), input: { kind: 'choose-hero', heroId: 'hero-2' } }),
    (s) => {
      assert.equal(s.physical.snapshot.lastStand.titles.length, 1);
      assert.equal(s.physical.snapshot.lastStand.titles[0].heroId, 'hero-2');
      assert.equal(linkedNode(s).visible, false);
      assert.equal(s.scenario.play.active, null);
    },
  );
  assert.equal(cuts, 9);
});
