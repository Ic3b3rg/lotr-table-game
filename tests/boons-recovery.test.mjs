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

test('boon concession, use, discard, test and parent return survive SIGKILL and packless restores; signed alterations fail', async (t) => {
  const ready = await readyBoonCombat(t);
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
  let r = await answerCycle(ready, { kind: 'physical-choice', option: 'hidden' });
  assert.equal(r.status, 200, await r.text());
  await drainCombat(ready);
  await checkpoint('acquired-return');
  let s = await readSession(host),
    offer = s.combat.attacks.find((o) => !o.reason);
  r = await command(
    host,
    ready.player,
    {
      type: 'START_ATTACK',
      roundId: s.round.id,
      turnId: s.round.turnId,
      heroId: offer.heroId,
      groupId: offer.groupId,
      itemCopies: offer.itemCopies,
      stat: offer.stat,
      replaceCopy: null,
      grantId: null,
    },
    s,
  );
  assert.equal(r.status, 200, await r.text());
  await checkpoint('revealed-test');
  s = await readSession(host);
  const option = s.physical.active.options.find((o) => o.id.includes('add-success'));
  assert.ok(option);
  r = await answerCycle(ready, { kind: 'physical-choice', option: option.id });
  assert.equal(r.status, 200, await r.text());
  await checkpoint('use-discard');
  r = await answerCycle(ready, { kind: 'physical-choice', option: 'resolve' });
  assert.equal(r.status, 200, await r.text());
  await checkpoint('test-result');
  await drainCombat(ready, (q) =>
    q.options?.some((o) => o.id === 'hidden') ? 'emboldened' : null,
  );
  await checkpoint('parent-return');
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
