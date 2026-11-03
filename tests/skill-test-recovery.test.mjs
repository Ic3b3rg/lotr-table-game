import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { startHost, joinPlayer } from './host-helper.mjs';
import { command, setup } from './preparation-helper.mjs';
import { catalogFixture } from './fixtures/catalog.mjs';
import {
  readyCompany,
  readSession,
  readBackup,
  signBackup,
  startTest,
} from './skill-test-helper.mjs';

async function recover(host, player) {
  const session = await readSession(host);
  const response = await host.request('/api/recover', {
    recoveryCode: player.recoveryCode,
    generation: session.generation,
  });
  assert.equal(response.status, 200);
  return { ...player, cookie: response.headers.get('set-cookie').split(';')[0] };
}

test('arresto durante la conversione e ripristino su altro PC conservano prova, carte e ricevute', async (t) => {
  const { host, player } = await readyCompany(t);
  assert.equal(
    (await command(host, player, { type: 'GAIN_INSPIRATION', heroId: 'hero-1' })).status,
    200,
  );
  assert.equal((await startTest(host, player)).status, 200);
  const opened = await readSession(host);
  const intent = { type: 'CONVERT_FATE', testId: opened.skillTest.id, requestId: randomUUID() };
  const response = await command(host, player, intent, opened);
  assert.equal(response.status, 200);
  const receipt = (await response.json()).receipt;
  const before = await readSession(host);
  const backup = await readBackup(host);
  await host.stop('SIGKILL');
  const restarted = await startHost({ LOTR_DATA_DIR: host.dataDir });
  t.after(() => restarted.stop());
  assert.deepEqual(await readSession(restarted), before);
  assert.deepEqual((await readBackup(restarted)).payload, backup.payload);
  const remembered = await restarted.request('/api/me', undefined, player.cookie);
  assert.equal((await remembered.json()).player.id, player.body.player.id);
  const recovered = await recover(restarted, player);
  const replay = await command(restarted, recovered, intent, opened);
  assert.equal(replay.status, 200);
  assert.deepEqual((await replay.json()).receipt, receipt);
  assert.deepEqual(await readSession(restarted), before);

  const destination = await startHost();
  t.after(() => destination.dispose());
  const blank = await readSession(destination);
  const restored = await destination.request('/api/restores', {
    backup,
    generation: blank.generation,
    expectedRevision: blank.revision,
    confirmed: true,
  });
  assert.equal(restored.status, 200);
  const after = await readSession(destination);
  assert.deepEqual(after.skillTest, before.skillTest);
  assert.deepEqual(after.preparation, before.preparation);
  const restoredPlayer = await recover(destination, player);
  assert.equal((await command(destination, restoredPlayer, intent, opened)).status, 409);
  const portableReplay = await command(destination, restoredPlayer, intent, {
    ...opened,
    generation: after.generation,
  });
  assert.equal(portableReplay.status, 200);
  assert.deepEqual((await portableReplay.json()).receipt, receipt);
  assert.deepEqual(await readSession(destination), after);
  assert.equal(
    (
      await command(destination, restoredPlayer, {
        type: 'RESOLVE_SKILL_TEST',
        testId: after.skillTest.id,
      })
    ).status,
    200,
  );
  const complete = await readSession(destination);
  assert.equal(complete.skillTest.successes, 1);
  assert.equal(complete.skillTest.outcome, 'fail');
  assert.equal(complete.preparation.heroes[0].discardCount, 3);
  assert.equal(complete.preparation.heroes[0].inspiration, 0);
});

test('salvataggi e backup schema 2 migrano senza rimescolare o perdere la compagnia', async (t) => {
  const { host, player } = await readyCompany(t);
  const backup = await readBackup(host);
  const initialPreparation = structuredClone(backup.payload.state.preparation);
  backup.payload.state.schemaVersion = 2;
  delete backup.payload.state.mapGeneration;
  delete backup.payload.state.scenario;
  delete backup.payload.state.physical;
  delete backup.payload.state.group;
  delete backup.payload.state.skillTest;
  delete backup.payload.state.scout;
  delete backup.payload.state.round;
  delete backup.payload.state.journey;
  for (const hero of backup.payload.state.preparation.heroes) delete hero.inspiration;
  signBackup(backup);
  await host.stop();
  const db = new DatabaseSync(join(host.dataDir, 'session.sqlite'));
  db.prepare('UPDATE session SET data=? WHERE id=1').run(JSON.stringify(backup.payload.state));
  db.close();
  const migrated = await startHost({ LOTR_DATA_DIR: host.dataDir });
  t.after(() => migrated.stop());
  const state = await readSession(migrated);
  assert.equal(state.schemaVersion, 15);
  assert.equal(state.skillTest, null);
  assert.deepEqual((await readBackup(migrated)).payload.state.preparation, initialPreparation);
  assert.deepEqual((await readBackup(migrated)).payload.commands, backup.payload.commands);
  const restore = await migrated.request('/api/restores', {
    backup,
    generation: state.generation,
    expectedRevision: state.revision,
    confirmed: true,
  });
  assert.equal(restore.status, 200);
  assert.deepEqual((await readBackup(migrated)).payload.state.preparation, initialPreparation);
  assert.equal((await startTest(migrated, await recover(migrated, player))).status, 200);
});

test('copie rivelate o ispirazione incoerenti non sostituiscono il tavolo anche con checksum valido', async (t) => {
  const { host, player } = await readyCompany(t);
  assert.equal((await startTest(host, player)).status, 200);
  const state = await readSession(host);
  const original = await readBackup(host);
  const invalidChanges = [
    (value) => {
      value.preparation.heroes[0].inspiration = 5;
    },
    (value) => {
      value.skillTest.revealed.pop();
    },
    (value) => {
      value.skillTest.revealed[1] = value.skillTest.revealed[0];
    },
    (value) => {
      value.skillTest.heroId = 'hero-missing';
    },
    (value) => {
      value.skillTest.converted = 4;
    },
    (value) => {
      value.skillTest.stat = 'wisdom';
    },
  ];
  for (const mutate of invalidChanges) {
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
  assert.equal(
    (await command(host, player, { type: 'RESOLVE_SKILL_TEST', testId: state.skillTest.id }))
      .status,
    200,
  );
  const resolved = await readSession(host),
    historical = await readBackup(host);
  historical.payload.state.schemaVersion = 13;
  historical.payload.state.skillTest.availableCount = 16;
  signBackup(historical);
  // Schema14's added-card budget must not loosen the published historical schema.
  const response = await host.request('/api/restores', {
    backup: historical,
    generation: resolved.generation,
    expectedRevision: resolved.revision,
    confirmed: true,
  });
  assert.equal(response.status, 422);
  assert.deepEqual(await readSession(host), resolved);
});

test('lo schema 2 del solo catalogo migra anche senza il campo della compagnia', async (t) => {
  const host = await setup(t, catalogFixture());
  const player = await joinPlayer(host, 'Frodo');
  const current = await readSession(host);
  const backup = await readBackup(host);
  backup.payload.state.schemaVersion = 2;
  delete backup.payload.state.mapGeneration;
  delete backup.payload.state.scenario;
  delete backup.payload.state.physical;
  delete backup.payload.state.group;
  delete backup.payload.state.preparation;
  delete backup.payload.state.skillTest;
  delete backup.payload.state.scout;
  delete backup.payload.state.round;
  delete backup.payload.state.journey;
  signBackup(backup);
  const response = await host.request('/api/restores', {
    backup,
    generation: current.generation,
    expectedRevision: current.revision,
    confirmed: true,
  });
  assert.equal(response.status, 200);
  const imported = await readSession(host);
  assert.equal(imported.schemaVersion, 15);
  assert.equal(imported.preparation, null);
  assert.equal(imported.skillTest, null);
  assert.deepEqual(imported.catalog, current.catalog);
  assert.deepEqual(imported.players, current.players);

  await host.stop();
  const db = new DatabaseSync(join(host.dataDir, 'session.sqlite'));
  db.prepare('UPDATE session SET data=? WHERE id=1').run(JSON.stringify(backup.payload.state));
  db.close();
  const restarted = await startHost({ LOTR_DATA_DIR: host.dataDir });
  t.after(() => restarted.stop());
  const migrated = await readSession(restarted);
  assert.equal(migrated.schemaVersion, 15);
  assert.equal(migrated.preparation, null);
  assert.deepEqual(migrated.catalog, current.catalog);
  await recover(restarted, player);
});
