import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir, cp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { build } from 'esbuild';
import { startHost } from './host-helper.mjs';
import {
  readyLook,
  reachLook,
  interact,
  readSession,
  readBackup,
  scenarioInput,
  interactionIntent,
  ok,
  hash,
} from './interaction-look-helper.mjs';
import { state, action, text } from './fixtures/scenario.mjs';

for (const stage of ['order', 'look', 'child', 'callback'])
  test(`SIGKILL at ${stage} preserves the entire source domain and receipt atomically`, async (t) => {
    const r = await readyLook(t, {
      costs: 1,
      initialInspiration: 6,
      edit(pack) {
        const d = pack.definitions.find((d) => d.source === pack.manifest.prefabs[0].fsmSource);
        d.states.find((s) => s.index === 21).actions = [
          {
            index: 0,
            op: 'sourceTest',
            origin: {
              type: 'FFG.JIME.Actions.DisplayMessageCancelConfirm',
              parameterHash: hash('invented-test'),
              load: 'hash-match-positional',
            },
            text: text('Figlio inventato della stessa interazione'),
            stat: 'agility',
            target: 1,
            passEvent: 'DONE',
            failEvent: 'DONE',
          },
        ];
        d.states.find((s) => s.index === 21).transitions = { DONE: 22 };
        d.states.push(
          state(
            22,
            [
              action(0, 'message', {
                mode: 'ordinary',
                text: text('Ritorno fonte inventato'),
                ignoreLog: false,
              }),
            ],
            { FINISHED: 0 },
          ),
        );
      },
    });
    await reachLook(r);
    if (stage !== 'order') await ok(interact(r));
    if (stage === 'child' || stage === 'callback') {
      const state = (await readBackup(r.host)).payload.state;
      const spend = state.physical.snapshot.resolution.interactionWindow.remaining.find(
        (e) => e.kind === 'spend',
      );
      await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: spend.id }));
      await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'continue' }));
    }
    if (stage === 'callback') {
      await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'reveal' }));
      await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'resolve' }));
    }
    const before = await readBackup(r.host),
      s = await readSession(r.host);
    const input =
      stage === 'look'
        ? {
            kind: 'physical-choice',
            option:
              before.payload.state.physical.snapshot.resolution.interactionWindow.remaining.find(
                (e) => e.kind === 'spend',
              ).id,
          }
        : stage === 'child'
          ? { kind: 'physical-choice', option: 'reveal' }
          : { kind: 'ack' };
    const requestId = randomUUID();
    const intent =
      stage === 'order'
        ? interactionIntent(s, r, { requestId })
        : {
            type: 'SCENARIO_INPUT',
            requestId,
            generation: s.generation,
            expectedRevision: s.revision,
            scenarioId: s.scenario.id,
            packFingerprint: s.scenario.packFingerprint,
            projectionFingerprint: s.scenario.projectionFingerprint,
            pendingId: s.scenario.pending.id,
            sourceFingerprint: s.scenario.pending.fingerprint,
            heroId: s.scenario.pending.heroId,
            input,
          };
    await r.host.stop();
    const dir = await mkdtemp(join(tmpdir(), 'lotr-look-crash-'));
    t.after(() => rm(dir, { recursive: true, force: true }));
    const worker = join(dir, 'worker.mjs');
    await build({
      stdin: {
        resolveDir: process.cwd(),
        contents: `
    import {Store} from './src/server/store'; import {performCommand} from './src/server/commands';
    import {CommandSchema} from './src/shared/protocol'; import {DatabaseSync} from 'node:sqlite'; import {writeFileSync} from 'node:fs';
    const store=new Store(process.argv[2]);
    function checkpoint(){
      const db=Reflect.get(store,'db');
      const commands=db.prepare('SELECT player_id,request_id,fingerprint,result FROM commands ORDER BY player_id,request_id').all().map(r=>({playerId:r.player_id,requestId:r.request_id,fingerprint:r.fingerprint,receipt:JSON.parse(r.result)}));
      writeFileSync(process.argv[5],JSON.stringify({state:store.read(),commands}));
      process.stdout.write('LOOK_COMMIT_BOUNDARY\\n'); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0);
    }
    const original=DatabaseSync.prototype.exec;
    if(process.argv[6]==='before') DatabaseSync.prototype.exec=function(sql){if(sql.trim()==='COMMIT') checkpoint(); return original.call(this,sql);};
    performCommand(store,process.argv[3],CommandSchema.parse(JSON.parse(process.argv[4])));
    if(process.argv[6]==='after') checkpoint();
  `,
      },
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'node24',
      outfile: worker,
      logLevel: 'silent',
    });
    for (const boundary of ['before', 'after'])
      await t.test(boundary, async (t) => {
        const data = join(dir, boundary);
        await cp(r.host.dataDir, data, { recursive: true });
        const marker = join(dir, boundary + '.json');
        const child = spawn(
          process.execPath,
          [worker, data, r.player.body.player.id, JSON.stringify(intent), marker, boundary],
          { stdio: ['ignore', 'pipe', 'pipe'] },
        );
        t.after(() => {
          if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
        });
        let diagnostics = '';
        child.stderr.on('data', (d) => (diagnostics += d));
        await new Promise((resolve, reject) => {
          const timer = setTimeout(
            () => reject(Error('Boundary not reached: ' + diagnostics)),
            12000,
          );
          child.stdout.on('data', (d) => {
            if (String(d).includes('LOOK_COMMIT_BOUNDARY')) {
              clearTimeout(timer);
              resolve();
            }
          });
          child.once('exit', (code) => {
            clearTimeout(timer);
            reject(Error('Worker exited ' + code + ': ' + diagnostics));
          });
        });
        const candidate = JSON.parse(await readFile(marker, 'utf8'));
        const exited = once(child, 'exit');
        child.kill('SIGKILL');
        const exit = await exited;
        assert.equal(exit[1], 'SIGKILL');
        const host = await startHost({ LOTR_DATA_DIR: data });
        t.after(() => host.stop());
        const persisted = (await readBackup(host)).payload;
        assert.deepEqual(persisted, boundary === 'before' ? before.payload : candidate);
        const response = await host.request('/api/commands', intent, r.player.cookie);
        assert.equal(response.status, 200, await response.clone().text());
        const receipt = (await response.json()).receipt,
          expected = candidate.commands.find((c) => c.requestId === requestId).receipt;
        assert.deepEqual(receipt, expected);
        const final = (await readBackup(host)).payload;
        assert.equal(final.commands.filter((c) => c.requestId === requestId).length, 1);
        for (const key of Object.keys(candidate.state).filter((k) => k !== 'updatedAt'))
          assert.deepEqual(final.state[key], candidate.state[key], key);
        if (process.env.LOTR_LOOK_EVIDENCE_DIR) {
          const evidence = join(process.env.LOTR_LOOK_EVIDENCE_DIR, stage + '-' + boundary);
          await mkdir(evidence, { recursive: true });
          await writeFile(join(evidence, 'before.json'), JSON.stringify(before.payload));
          await writeFile(join(evidence, 'candidate.json'), JSON.stringify(candidate));
          await writeFile(join(evidence, 'persisted.json'), JSON.stringify(persisted));
          await writeFile(join(evidence, 'retried.json'), JSON.stringify(final));
          await writeFile(
            join(evidence, 'worker.json'),
            JSON.stringify({ pid: child.pid, exit, diagnostics, receipt }, null, 2),
          );
        }
      });
  });
