import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { build } from 'esbuild';
import { waitingLastStand } from './last-stand-helper.mjs';
import { readBackup, readSession } from './skill-test-helper.mjs';
import { startHost } from './host-helper.mjs';

test('SIGKILL before and after real P2 fate costs and rewards preserves a single atomic receipt', async (t) => {
  const ready = await waitingLastStand(t);
  let host = ready.host;
  t.after(() => host.stop());
  const directory = await mkdtemp(join(tmpdir(), 'lotr-last-stand-commit-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const worker = join(directory, 'worker.mjs'),
    marker = join(directory, 'before-commit.json');
  await build({
    stdin: {
      resolveDir: process.cwd(),
      contents: `
    import { Store } from './src/server/store.ts';
    import { performCommand } from './src/server/commands.ts';
    import { CommandSchema } from './src/shared/protocol.ts';
    import { DatabaseSync } from 'node:sqlite';
    import { writeFileSync } from 'node:fs';
    const store = new Store(process.argv[2]);
    const original = DatabaseSync.prototype.prepare;
    DatabaseSync.prototype.prepare = function(sql) {
      const statement = original.call(this, sql);
      if (sql !== 'UPDATE session SET data = ? WHERE id = 1') return statement;
      return new Proxy(statement, { get(target, key) {
        if (key === 'run') return (data) => {
          const state = JSON.parse(data), p = state.physical, selected = p.snapshot.lastStand.selections[0];
          writeFileSync(process.argv[5], JSON.stringify({inspiration:state.preparation.heroes[0].inspiration,returned:selected.returned,outcome:selected.outcome,answers:p.runs[0].answers.length,returns:p.snapshot.parents[0].returnCount}));
          process.stdout.write('LAST_STAND_BEFORE_COMMIT\\n');
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
          return target.run(data);
        };
        const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
      }});
    };
    performCommand(store, process.argv[3], CommandSchema.parse(JSON.parse(process.argv[4])));
  `,
    },
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    outfile: worker,
    logLevel: 'silent',
  });
  for (const option of ['inspiration', 'resolve']) {
    const before = await readBackup(host),
      s = await readSession(host),
      q = s.scenario.pending;
    const intent = {
      requestId: randomUUID(),
      generation: s.generation,
      expectedRevision: s.revision,
      type: 'SCENARIO_INPUT',
      scenarioId: s.scenario.id,
      packFingerprint: s.scenario.packFingerprint,
      projectionFingerprint: s.scenario.projectionFingerprint,
      pendingId: q.id,
      sourceFingerprint: q.fingerprint,
      heroId: q.heroId,
      input: { kind: 'physical-choice', option },
    };
    await host.stop();
    const child = spawn(
      process.execPath,
      [worker, host.dataDir, ready.player.body.player.id, JSON.stringify(intent), marker],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    t.after(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    });
    let diagnostics = '';
    child.stderr.on('data', (d) => {
      diagnostics += d;
    });
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(Error(`P2 commit seam not reached: ${diagnostics}`)),
        10000,
      );
      child.stdout.on('data', (d) => {
        if (String(d).includes('LAST_STAND_BEFORE_COMMIT')) {
          clearTimeout(timeout);
          resolve();
        }
      });
      child.once('exit', (code) => {
        clearTimeout(timeout);
        reject(Error(`Worker exited ${code}: ${diagnostics}`));
      });
    });
    assert.deepEqual(
      JSON.parse(await readFile(marker, 'utf8')),
      option === 'inspiration'
        ? { inspiration: 0, returned: 0, outcome: null, answers: 2, returns: 0 }
        : { inspiration: 1, returned: 5, outcome: 'pass', answers: 3, returns: 1 },
    );
    const exited = once(child, 'exit');
    child.kill('SIGKILL');
    await exited;
    host = await startHost({ LOTR_DATA_DIR: host.dataDir });
    assert.deepEqual((await readBackup(host)).payload, before.payload);
    const r = await host.request('/api/commands', intent, ready.player.cookie);
    assert.equal(r.status, 200, await r.clone().text());
    const receipt = (await r.json()).receipt,
      committed = await readBackup(host);
    await host.stop('SIGKILL');
    host = await startHost({ LOTR_DATA_DIR: host.dataDir });
    assert.deepEqual((await readBackup(host)).payload, committed.payload);
    const retry = await host.request('/api/commands', intent, ready.player.cookie);
    assert.equal(retry.status, 200);
    assert.deepEqual((await retry.json()).receipt, receipt);
    assert.equal(
      committed.payload.commands.filter((c) => c.requestId === intent.requestId).length,
      1,
    );
  }
});
