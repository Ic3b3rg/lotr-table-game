import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { setup, command } from './preparation-helper.mjs';
import { startHost, joinPlayer } from './host-helper.mjs';
import { readyCompany, readSession, readBackup, signBackup } from './skill-test-helper.mjs';
import { readyMap, startMapTurn, travelIntent } from './travel-helper.mjs';

test('gruppo atteso sopravvive ad arresto, backup e recupero senza chiudere i posti mancanti', async (t) => {
  const host = await setup(t);
  const anna = await joinPlayer(host, 'Anna');
  const before = await readSession(host);
  const intent = { type: 'SET_GROUP_SIZE', playerCount: 3, agreed: true, requestId: randomUUID() };
  const r = await command(host, anna, intent, before);
  assert.equal(r.status, 200);
  const receipt = (await r.json()).receipt;
  await joinPlayer(host, 'Bruno');
  assert.equal(
    (await command(host, anna, { type: 'SELECT_HEROES', heroIds: ['hero-1'] })).status,
    200,
  );
  const state = await readSession(host);
  const backup = await readBackup(host);
  await host.stop('SIGKILL');
  const restarted = await startHost({ LOTR_DATA_DIR: host.dataDir });
  t.after(() => restarted.stop());
  assert.deepEqual(await readSession(restarted), state);
  assert.deepEqual((await readBackup(restarted)).payload, backup.payload);
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
  assert.deepEqual(restored.group, { expectedPlayers: 3 });
  const recovered = await destination.request('/api/recover', {
    recoveryCode: anna.recoveryCode,
    generation: restored.generation,
  });
  const owner = { ...anna, cookie: recovered.headers.get('set-cookie').split(';')[0] };
  const replay = await command(destination, owner, intent, {
    ...before,
    generation: restored.generation,
  });
  assert.equal(replay.status, 200);
  assert.deepEqual((await replay.json()).receipt, receipt);
  assert.equal((await joinPlayer(destination, 'Carla')).status, 201);
  assert.equal((await joinPlayer(destination, 'Quarto')).status, 409);
});

test('schema 6 conserva round, viaggio e prova attivi senza imporre una nuova configurazione', async (t) => {
  const { host, player } = await readyMap(t);
  let state = await startMapTurn(host, player);
  assert.equal(
    (await command(host, player, { type: 'START_TRAVEL', ...travelIntent(state) })).status,
    200,
  );
  assert.equal(
    (
      await command(host, player, {
        type: 'START_INTERACTION_TEST',
        roundId: state.round.id,
        turnId: state.round.turnId,
        heroId: 'hero-1',
        stat: 'might',
        modifier: 0,
        target: 1,
      })
    ).status,
    200,
  );
  const before = await readSession(host);
  const backup = await readBackup(host);
  backup.payload.state.schemaVersion = 6;
  delete backup.payload.state.mapGeneration;
  delete backup.payload.state.scenario;
  delete backup.payload.state.physical;
  delete backup.payload.state.group;
  signBackup(backup);
  await host.stop();
  const db = new DatabaseSync(join(host.dataDir, 'session.sqlite'));
  db.prepare('UPDATE session SET data=? WHERE id=1').run(JSON.stringify(backup.payload.state));
  db.close();
  const restarted = await startHost({ LOTR_DATA_DIR: host.dataDir });
  t.after(() => restarted.stop());
  const migrated = await readSession(restarted);
  assert.equal(migrated.schemaVersion, 26);
  assert.equal(migrated.group, null);
  for (const key of ['preparation', 'round', 'journey', 'skillTest', 'scout'])
    assert.deepEqual(migrated[key], before[key]);
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
  assert.deepEqual((await readSession(destination)).journey, before.journey);
});

test('backup con gruppo incompatibile non sovrascrive la compagnia', async (t) => {
  const { host, player } = await readyCompany(t);
  const state = await readSession(host);
  const original = await readBackup(host);
  for (const expectedPlayers of [0, 2, 3, 6]) {
    const backup = structuredClone(original);
    backup.payload.state.group = { expectedPlayers };
    signBackup(backup);
    assert.equal(
      (
        await host.request('/api/restores', {
          backup,
          generation: state.generation,
          expectedRevision: state.revision,
          confirmed: true,
        })
      ).status,
      422,
    );
    assert.deepEqual(await readSession(host), state);
  }
  assert.equal((await command(host, player, { type: 'START_ROUNDS', agreed: true })).status, 200);
  const active = await readSession(host);
  const withoutMap = await readBackup(host);
  withoutMap.payload.state.group = { expectedPlayers: 1 };
  signBackup(withoutMap);
  assert.equal(
    (
      await host.request('/api/restores', {
        backup: withoutMap,
        generation: active.generation,
        expectedRevision: active.revision,
        confirmed: true,
      })
    ).status,
    422,
  );
  assert.deepEqual(await readSession(host), active);
});
