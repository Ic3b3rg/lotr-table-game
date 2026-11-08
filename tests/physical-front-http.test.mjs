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
import { catalogFixture } from './fixtures/catalog.mjs';
import { compilePhysicalFronts } from '../dist/physical-resolution-library.mjs';
test('P1 HTTP source resolves real resource choices and reconciles receipts through the normal scenario consumer', async (t) => {
  const ready = await readyFronts(t);
  const { host, player, other } = ready;
  const s = await reachPhysical(ready);
  assert.equal(s.schemaVersion, 34);
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

test('P1 successive Scout children preserve their cards through the normal consumer', async (t) => {
  const ready = await readyFronts(t, (_pack, pr) => {
    pr.children = Array.from({ length: 6 }, () => ({ kind: 'scout', hero: 1, count: 5 }));
  });
  let s = await reachPhysical(ready);
  const { host, other } = ready;
  for (let n = 0; n < 6; n++) {
    assert.equal(s.physical.active.mode, 'scout');
    const r = await scenarioInput(host, other, {
      kind: 'physical-scout',
      prepare: null,
      discard: null,
      top: [],
      bottom: s.physical.active.options.map((o) => o.id),
    });
    assert.equal(r.status, 200, await r.text());
    s = await readSession(host);
  }
  assert.equal(s.physical.parents[0].returnCount, 1);
});

test('P1 can discard an initially rewarded prepared card and restore its historical trigger', async (t) => {
  const ready = await readyFronts(t, (pack) => {
    const card = catalogFixture().skills.find((c) => c.id === 'role-1-skill-1');
    pack.preparedEffects = [
      { skillId: card.id, cardHash: hash(card), effect: 'inspiration', amount: 1 },
    ];
  });
  const { host, player } = ready;
  const initial = await reachPhysical(ready);
  assert.equal(initial.scenario.cardEffects[0].source, 'initial');
  assert.equal(initial.scenario.cardEffects[0].reward, 1);
  const result = await scenarioInput(host, player, { kind: 'physical-choice', option: '0' });
  assert.equal(result.status, 200, await result.text());
  const backup = await readBackup(host);
  assert.ok(backup.payload.state.preparation.heroes[0].discard.includes('role-1-skill-1:1'));
  const current = await readSession(host);
  const restored = await host.request('/api/restores', {
    backup,
    generation: current.generation,
    expectedRevision: current.revision,
    confirmed: true,
  });
  assert.equal(restored.status, 200, await restored.text());
  const after = await readBackup(host);
  for (const key of ['physical', 'preparation', 'scenario'])
    assert.deepEqual(after.payload.state[key], backup.payload.state[key]);
  assert.deepEqual(after.payload.commands, backup.payload.commands);
});

test('P1 tests reconcile a completed legacy reveal while a descendant holds those copies after refill', async (t) => {
  const ready = await readyFronts(t, (pack, pr) => {
    const card = catalogFixture().skills.find((c) => c.id === 'role-2-skill-1');
    pack.preparedEffects = [
      { skillId: card.id, cardHash: hash(card), effect: 'inspiration', amount: 1 },
    ];
    pr.children = Array.from({ length: 9 }, () => ({ ...suffer(1, 1, 0), negate: 'might' }));
  });
  const { host, other } = ready;
  let s = await reachPhysical(ready);
  for (let n = 0; n < 9; n++) {
    assert.equal(s.physical.active.mode, 'choose');
    const r = await scenarioInput(host, other, { kind: 'physical-choice', option: 'resolve' });
    assert.equal(r.status, 200, await r.text());
    s = await readSession(host);
  }
  assert.equal(s.physical.active.reason, 'last-stand-unavailable');
  assert.equal(s.physical.parents[0].returnCount, 0);
});
