import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { reachPhysical } from './physical-helper.mjs';
import { readyFronts } from './physical-front-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';
import { readSession, readBackup } from './skill-test-helper.mjs';
import { inventedFrontInput, diagnosticRaw, hash } from './fixtures/physical-fronts.mjs';
import { suffer } from './fixtures/physical-resolution.mjs';
import { compilePhysicalFronts } from '../dist/physical-resolution-library.mjs';
test('P1 HTTP source resolves real resource choices and reconciles receipts through the normal scenario consumer', async (t) => {
  const ready = await readyFronts(t);
  const { host, player, other } = ready;
  const s = await reachPhysical(ready);
  assert.equal(s.schemaVersion, 12);
  assert.equal(s.physical.active.kind, 'decision');
  assert.equal(s.physical.active.mode, 'choose');
  assert.equal(s.physical.fronts.length, 1);
  assert.equal(
    (await scenarioInput(host, other, { kind: 'physical-choice', option: '0' })).status,
    403,
  );
  assert.equal((await scenarioInput(host, player, { kind: 'ack' })).status, 409);
  const before = await readBackup(host);
  assert.equal(
    (
      await scenarioInput(
        host,
        player,
        { kind: 'physical-choice', option: '0' },
        { sourceFingerprint: '0'.repeat(64) },
      )
    ).status,
    409,
  );
  assert.deepEqual((await readBackup(host)).payload, before.payload);
  const r = await scenarioInput(host, player, { kind: 'physical-choice', option: '0' });
  assert.equal(r.status, 200, await r.text());
  const done = await readSession(host),
    privateState = (await readBackup(host)).payload.state;
  assert.equal(done.physical.parents[0].returnCount, 1);
  assert.equal(done.preparation.heroes[0].prepared.length, 0);
  assert.equal(done.physical.heroes[0].facedown.fear, 1);
  assert.equal(privateState.physical.runs[0].answers.length, 1);
  assert.equal(done.scenario.pending.kind, 'objective');
  for (const forbidden of [
    'entropy',
    'rngCursor',
    'population',
    'cardHash',
    'originalHash',
    'invented-fear-',
  ])
    assert.ok(!JSON.stringify(done).includes(forbidden), forbidden);
});
