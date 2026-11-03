import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { build } from 'esbuild';
import { waitingCycle } from './physical-cycle-helper.mjs';
import { readBackup } from './skill-test-helper.mjs';
import { startHost } from './host-helper.mjs';

test('ordinary child SIGKILL before commit rolls back its real Guard cost, turn completion and receipt', async (t) => {
  const ready = await waitingCycle(t),
    { host, other } = ready;
  const before = await readBackup(host),
    s = before.payload.state;
  const publicState = await (await host.request('/api/session')).json();
  const { type: _, ...binding } = publicState.physical.cycle.pending;
  const intent = {
    requestId: randomUUID(),
    generation: s.generation,
    expectedRevision: s.revision,
    type: 'CYCLE_INPUT',
    ...binding,
    input: { kind: 'physical-allocate', ability: ready.offer, damage: 0, fear: 1 },
  };
  await host.stop();
  const directory = await mkdtemp(join(tmpdir(), 'lotr-physical-commit-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const worker = join(directory, 'worker.mjs'),
    marker = join(directory, 'before-commit.json');
  // Test-only persistence observation seam; the actual Store.once and command service run unchanged.
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
          const state = JSON.parse(data), p = state.physical;
          writeFileSync(process.argv[5], JSON.stringify({answers:p.runs.at(-1).answers.length, prepared:p.snapshot.resolution.resources.preparation.heroes[1].prepared.length, ended:state.round.heroes[0].turnEnded}));
          process.stdout.write('PHYSICAL_BEFORE_COMMIT\\n');
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
  const child = spawn(
    process.execPath,
    [worker, host.dataDir, other.body.player.id, JSON.stringify(intent), marker],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  t.after(() => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  });
  let diagnostics = '';
  child.stderr.on('data', (data) => {
    diagnostics += data;
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(Error(`Commit seam not reached: ${diagnostics}`)),
      10000,
    );
    child.stdout.on('data', (data) => {
      if (String(data).includes('PHYSICAL_BEFORE_COMMIT')) {
        clearTimeout(timeout);
        resolve();
      }
    });
    child.once('exit', (code) => {
      clearTimeout(timeout);
      reject(Error(`Worker exited ${code}: ${diagnostics}`));
    });
  });
  assert.deepEqual(JSON.parse(await readFile(marker, 'utf8')), {
    answers: 2,
    prepared: 0,
    ended: true,
  });
  const exited = once(child, 'exit');
  child.kill('SIGKILL');
  await exited;
  const restarted = await startHost({ LOTR_DATA_DIR: host.dataDir });
  t.after(() => restarted.stop());
  assert.deepEqual((await readBackup(restarted)).payload, before.payload);
  const retry = await restarted.request('/api/commands', intent, other.cookie);
  assert.equal(retry.status, 200, await retry.text());
  const committed = await readBackup(restarted);
  assert.equal(committed.payload.state.physical.runs.at(-1).answers.length, 2);
  assert.equal(
    committed.payload.commands.filter((c) => c.requestId === intent.requestId).length,
    1,
  );
});
