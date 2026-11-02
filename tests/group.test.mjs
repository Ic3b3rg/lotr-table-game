import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setup, command } from './preparation-helper.mjs';
import { joinPlayer } from './host-helper.mjs';
import { readSession } from './skill-test-helper.mjs';

test('un gruppo da tre aspetta tutti e assegna un solo eroe anche al primo arrivato', async (t) => {
  const host = await setup(t);
  const anna = await joinPlayer(host, 'Anna');
  const intent = { type: 'SET_GROUP_SIZE', playerCount: 3, agreed: true, requestId: randomUUID() };
  const before = await readSession(host);
  const r = await command(host, anna, intent, before);
  assert.equal(r.status, 200);
  const receipt = (await r.json()).receipt;
  const replay = await command(host, anna, intent, before);
  assert.equal(replay.status, 200);
  assert.deepEqual((await replay.json()).receipt, receipt);
  assert.deepEqual((await readSession(host)).group, { expectedPlayers: 3 });
  assert.equal(
    (await command(host, anna, { type: 'SELECT_HEROES', heroIds: ['hero-1', 'hero-2'] })).status,
    409,
  );
  assert.equal(
    (await command(host, anna, { type: 'SELECT_HEROES', heroIds: ['hero-1'] })).status,
    200,
  );
  assert.equal((await command(host, anna, { type: 'PREPARE_COMPANY', agreed: true })).status, 409);
  const bruno = await joinPlayer(host, 'Bruno');
  const carla = await joinPlayer(host, 'Carla');
  assert.equal(bruno.status, 201);
  assert.equal(carla.status, 201);
  assert.equal(
    (await command(host, bruno, { type: 'SELECT_HEROES', heroIds: ['hero-2'] })).status,
    200,
  );
  assert.equal(
    (await command(host, carla, { type: 'SELECT_HEROES', heroIds: ['hero-3'] })).status,
    200,
  );
  assert.equal((await command(host, anna, { type: 'PREPARE_COMPANY', agreed: true })).status, 200);
  const state = await readSession(host);
  assert.equal(state.preparation.heroes.length, 3);
  assert.equal(state.preparation.status, 'prepared');
  assert.equal(
    (await command(host, anna, { type: 'SET_GROUP_SIZE', playerCount: 4, agreed: true })).status,
    409,
  );
  assert.equal((await command(host, anna, { type: 'START_ROUNDS', agreed: true })).status, 409);
  assert.equal((await joinPlayer(host, 'Quarto')).status, 409);
});

test('numero, consenso e revisioni non cancellano le scelte o superano i posti previsti', async (t) => {
  const host = await setup(t);
  const anna = await joinPlayer(host, 'Anna');
  assert.equal(
    (await command(host, anna, { type: 'SET_GROUP_SIZE', playerCount: 0, agreed: true })).status,
    422,
  );
  assert.equal(
    (await command(host, anna, { type: 'SET_GROUP_SIZE', playerCount: 6, agreed: true })).status,
    422,
  );
  assert.equal(
    (await command(host, anna, { type: 'SET_GROUP_SIZE', playerCount: 3, agreed: false })).status,
    422,
  );
  assert.equal(
    (await command(host, anna, { type: 'SELECT_HEROES', heroIds: ['hero-1', 'hero-2'] })).status,
    200,
  );
  const before = await readSession(host);
  assert.equal(
    (await command(host, anna, { type: 'SET_GROUP_SIZE', playerCount: 3, agreed: true })).status,
    409,
  );
  assert.deepEqual(await readSession(host), before);
  assert.equal(
    (await command(host, anna, { type: 'SELECT_HEROES', heroIds: ['hero-1'] })).status,
    200,
  );
  const start = await readSession(host);
  const configs = [3, 4].map((playerCount) => ({
    type: 'SET_GROUP_SIZE',
    playerCount,
    agreed: true,
  }));
  const responses = await Promise.all(configs.map((intent) => command(host, anna, intent, start)));
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
  assert.equal(
    (await command(host, anna, { type: 'SET_GROUP_SIZE', playerCount: 3, agreed: true })).status,
    200,
  );
  assert.equal((await joinPlayer(host, 'Bruno')).status, 201);
  assert.equal((await joinPlayer(host, 'Carla')).status, 201);
  assert.equal((await joinPlayer(host, 'Quarto')).status, 409);
  assert.equal(
    (await command(host, anna, { type: 'SET_GROUP_SIZE', playerCount: 2, agreed: true })).status,
    409,
  );
  const state = await readSession(host);
  assert.equal((await host.request('/api/players', anna.input)).status, 201);
  assert.equal(
    (
      await host.request('/api/recover', {
        recoveryCode: anna.recoveryCode,
        generation: state.generation,
      })
    ).status,
    200,
  );
  assert.deepEqual(await readSession(host), state);
});
