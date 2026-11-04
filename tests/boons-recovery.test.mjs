import test from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { readyBoonCombat, attackToBoon } from './boons-http-helper.mjs';
import { drainCombat } from './combat-controller-helper.mjs';
import { answerCycle } from './original-round-helper.mjs';
import { readBackup, readSession, signBackup } from './skill-test-helper.mjs';
import { command } from './preparation-helper.mjs';
import { startHost } from './host-helper.mjs';
import { digest } from '../dist/map-freeze-library.mjs';

test('boon concession, use, discard, test and parent return survive SIGKILL and packless restores; signed alterations fail', async (t) => {
  const ready = await readyBoonCombat(t, true, (src) => {
    for (const a of src.assets.filter((a) => a.cls === 'EnemyActivationModel')) {
      for (const row of a.data.Damage) {
        row.Physical = 6;
        row.Fear = 0;
      }
      a.dataHash = digest(a.data);
    }
  });
  let host = ready.host;
  t.after(() => host.stop());
  await attackToBoon(ready);
  for (const path of [
    ready.scenarioPath,
    ...[
      'physical-content.json',
      'physical-fronts.json',
      'physical-last-stand.json',
      'physical-boons.json',
    ].map((p) => join(host.dataDir, p)),
  ])
    await rm(path);
  async function checkpoint(label) {
    const before = await readBackup(host);
    await host.stop('SIGKILL');
    host = await startHost({ LOTR_DATA_DIR: host.dataDir });
    ready.host = host;
    assert.deepEqual((await readBackup(host)).payload, before.payload, label + ': SIGKILL');
    const target = await startHost();
    try {
      const at = await readSession(target);
      const response = await target.request('/api/restores', {
        backup: before,
        generation: at.generation,
        expectedRevision: at.revision,
        confirmed: true,
      });
      assert.equal(response.status, 200, await response.text());
      const imported = await readBackup(target),
        actual = structuredClone(imported.payload),
        expected = structuredClone(before.payload);
      for (const key of ['generation', 'revision', 'updatedAt'])
        (delete actual.state[key], delete expected.state[key]);
      assert.deepEqual(actual, expected, label + ': full restored gameplay and receipts');
    } finally {
      await target.dispose();
    }
  }
  await checkpoint('concession');
  let r = await answerCycle(ready, { kind: 'physical-choice', option: 'determined' });
  assert.equal(r.status, 200, await r.text());
  await checkpoint('acquired-before-mandatory-child-test');
  r = await answerCycle(ready, { kind: 'physical-choice', option: 'reveal' });
  assert.equal(r.status, 200, await r.text());
  await checkpoint('revealed-test');
  let s = await readSession(host);
  const option = s.physical.active.options.find((o) => o.id.includes('exchange-test-cards'));
  assert.ok(option);
  r = await answerCycle(ready, { kind: 'physical-choice', option: option.id });
  assert.equal(r.status, 200, await r.text());
  await checkpoint('use-discard');
  s = await readSession(host);
  r = await answerCycle(ready, { kind: 'physical-select', ids: [s.physical.active.options[0].id] });
  assert.equal(r.status, 200, await r.text());
  await checkpoint('replacement-revealed');
  r = await answerCycle(ready, { kind: 'physical-choice', option: 'resolve' });
  assert.equal(r.status, 200, await r.text());
  await drainCombat(ready);
  await checkpoint('test-result-and-parent-return');
  const before = await readBackup(host);
  for (const edit of [
    (b) => {
      b.payload.state.schemaVersion = 16;
    },
    (b) => {
      delete b.payload.state.physical.boons;
    },
    (b) => {
      b.payload.state.physical.snapshot.resolution.boonEvents[0].heroId = 'hero-2';
    },
    (b) => {
      b.payload.state.physical.snapshot.resolution.boonEvents[0].source = 'invented-forged-origin';
    },
    (b) => {
      b.payload.state.combat.attempts[0].outcome.suffered.damage++;
    },
    (b) => {
      b.payload.state.physical.cycle.seed.round.number++;
    },
  ]) {
    const changed = structuredClone(before);
    edit(changed);
    signBackup(changed);
    const at = await readSession(host);
    r = await host.request('/api/restores', {
      backup: changed,
      generation: at.generation,
      expectedRevision: at.revision,
      confirmed: true,
    });
    assert.equal(r.status, 422, await r.text());
    assert.deepEqual((await readBackup(host)).payload, before.payload);
  }
});
