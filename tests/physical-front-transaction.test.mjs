import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { build } from 'esbuild';
import { reachPhysical } from './physical-helper.mjs';
import { readyFronts } from './physical-front-helper.mjs';
import { readBackup } from './skill-test-helper.mjs';
import { startHost } from './host-helper.mjs';

test('P1 SIGKILL after a real resource mutation but before the Store.once write rolls back the claim and every effect', async (t) => {
  const ready = await readyFronts(t),
    { host, player: other } = ready;
  const s = await reachPhysical(ready),
    q = s.scenario.pending,
    before = await readBackup(host);
  const intent = {
    requestId: randomUUID(),
    generation: s.generation,
    type: 'SCENARIO_INPUT',
    expectedRevision: s.revision,
    scenarioId: s.scenario.id,
    packFingerprint: s.scenario.packFingerprint,
    projectionFingerprint: s.scenario.projectionFingerprint,
    pendingId: q.id,
    sourceFingerprint: q.fingerprint,
    heroId: q.heroId,
    input: { kind: 'physical-choice', option: '0' },
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
          const p = JSON.parse(data).physical;
          writeFileSync(process.argv[5], JSON.stringify({answers:p.runs[0].answers.length, prepared:p.snapshot.resolution.resources.preparation.heroes[0].prepared.length, damage:p.snapshot.areas[0].damage.length, fear:p.snapshot.areas[0].fear.length}));
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
    answers: 1,
    prepared: 0,
    damage: 0,
    fear: 1,
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
  assert.equal(committed.payload.state.physical.runs[0].answers.length, 1);
  assert.equal(
    committed.payload.commands.filter((c) => c.requestId === intent.requestId).length,
    1,
  );
});
