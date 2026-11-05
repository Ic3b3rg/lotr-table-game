import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { startHost } from './host-helper.mjs';
import { command } from './preparation-helper.mjs';
import {
  readyCompany,
  readSession,
  readBackup,
  signBackup,
  startTest,
} from './skill-test-helper.mjs';
import { startScout, finishScout } from './scouting-helper.mjs';

async function recover(host, player) {
  const state = await readSession(host);
  const response = await host.request('/api/recover', {
    recoveryCode: player.recoveryCode,
    generation: state.generation,
  });
  assert.equal(response.status, 200);
  return { ...player, cookie: response.headers.get('set-cookie').split(';')[0] };
}

test('Scoperta interrotta sopravvive a SIGKILL e backup, conservando ordine e reinvii', async (t) => {
  const { host, player } = await readyCompany(t);
  const initial = await readSession(host);
  const intent = { type: 'START_SCOUT', heroId: 'hero-1', count: 4, requestId: randomUUID() };
  const response = await command(host, player, intent, initial);
  assert.equal(response.status, 200);
  const receipt = (await response.json()).receipt;
  const pending = await readSession(host);
  const backup = await readBackup(host);
  await host.stop('SIGKILL');
  const restarted = await startHost({ LOTR_DATA_DIR: host.dataDir });
  t.after(() => restarted.stop());
  assert.deepEqual(await readSession(restarted), pending);
  assert.deepEqual((await readBackup(restarted)).payload, backup.payload);
  const recovered = await recover(restarted, player);
  const replay = await command(restarted, recovered, intent, initial);
  assert.equal(replay.status, 200);
  assert.deepEqual((await replay.json()).receipt, receipt);
  assert.deepEqual(await readSession(restarted), pending);

  const destination = await startHost();
  t.after(() => destination.dispose());
  const blank = await readSession(destination);
  assert.equal(
    (
      await destination.request('/api/restores', {
        backup,
        generation: blank.generation,
        expectedRevision: blank.revision,
        confirmed: true,
      })
    ).status,
    200,
  );
  const restored = await readSession(destination);
  assert.deepEqual(restored.scout, pending.scout);
  assert.deepEqual(restored.preparation, pending.preparation);
  const owner = await recover(destination, player);
  assert.equal((await command(destination, owner, intent, initial)).status, 409);
  const importedReplay = await command(destination, owner, intent, {
    ...initial,
    generation: restored.generation,
  });
  assert.equal(importedReplay.status, 200);
  assert.deepEqual((await importedReplay.json()).receipt, receipt);
  const [a, b, c, d] = restored.scout.revealed;
  const overrides = { top: [d], bottom: [b, a], requestId: randomUUID() };
  const done = await finishScout(destination, owner, restored.scout, c, overrides, restored);
  assert.equal(done.status, 200);
  const doneReceipt = (await done.json()).receipt;
  const repeated = await finishScout(destination, owner, restored.scout, c, overrides, restored);
  assert.equal(repeated.status, 200);
  assert.deepEqual((await repeated.json()).receipt, doneReceipt);
  const after = await readBackup(destination);
  assert.equal(after.payload.state.scout, null);
  assert.deepEqual(after.payload.state.preparation.heroes[0].deck, [
    d,
    ...backup.payload.state.preparation.heroes[0].deck,
    b,
    a,
  ]);
});

test('schema 3 con prova aperta migra su avvio e importazione senza ripescare', async (t) => {
  const { host, player } = await readyCompany(t);
  assert.equal((await startTest(host, player)).status, 200);
  const before = await readSession(host);
  const backup = await readBackup(host);
  backup.payload.state.schemaVersion = 3;
  delete backup.payload.state.mapGeneration;
  delete backup.payload.state.scenario;
  delete backup.payload.state.physical;
  delete backup.payload.state.group;
  delete backup.payload.state.scout;
  delete backup.payload.state.round;
  delete backup.payload.state.journey;
  delete backup.payload.state.skillTest.availableCount;
  signBackup(backup);
  await host.stop();
  const db = new DatabaseSync(join(host.dataDir, 'session.sqlite'));
  db.prepare('UPDATE session SET data=? WHERE id=1').run(JSON.stringify(backup.payload.state));
  db.close();
  const restarted = await startHost({ LOTR_DATA_DIR: host.dataDir });
  t.after(() => restarted.stop());
  const migrated = await readSession(restarted);
  assert.equal(migrated.schemaVersion, 23);
  assert.equal(migrated.scout, null);
  assert.deepEqual(migrated.skillTest, before.skillTest);
  assert.deepEqual(migrated.preparation, before.preparation);
  assert.deepEqual((await readBackup(restarted)).payload.commands, backup.payload.commands);
  const destination = await startHost();
  t.after(() => destination.dispose());
  const blank = await readSession(destination);
  assert.equal(
    (
      await destination.request('/api/restores', {
        backup,
        generation: blank.generation,
        expectedRevision: blank.revision,
        confirmed: true,
      })
    ).status,
    200,
  );
  assert.deepEqual((await readSession(destination)).skillTest, before.skillTest);
  const owner = await recover(destination, player);
  assert.equal(
    (await command(destination, owner, { type: 'RESOLVE_SKILL_TEST', testId: before.skillTest.id }))
      .status,
    200,
  );
  assert.equal((await startScout(destination, owner)).status, 200);
});

test('backup con Scoperta incoerente non sovrascrive il tavolo neppure con checksum valido', async (t) => {
  const { host, player } = await readyCompany(t);
  assert.equal((await startScout(host, player, 4)).status, 200);
  const state = await readSession(host);
  const original = await readBackup(host);
  const changes = [
    (s) => {
      s.scout.count = 5;
    },
    (s) => {
      s.scout.revealed[1] = s.scout.revealed[0];
    },
    (s) => {
      s.scout.revealed[0] = 'role-2-skill-1:1';
    },
    (s) => {
      s.scout.heroId = 'hero-missing';
    },
    (s) => {
      s.scout.resetBefore = true;
    },
    (s) => {
      s.scout.revealed.pop();
    },
    (s) => {
      s.skillTest = {
        id: randomUUID(),
        heroId: 'hero-1',
        stat: 'might',
        modifier: 0,
        availableCount: 14,
        target: 1,
        revealed: s.scout.revealed.slice(0, 3),
        converted: 0,
        status: 'converting',
      };
    },
  ];
  for (const mutate of changes) {
    const backup = structuredClone(original);
    mutate(backup.payload.state);
    signBackup(backup);
    const response = await host.request('/api/restores', {
      backup,
      generation: state.generation,
      expectedRevision: state.revision,
      confirmed: true,
    });
    assert.equal(response.status, 422);
    assert.deepEqual(await readSession(host), state);
  }
});
