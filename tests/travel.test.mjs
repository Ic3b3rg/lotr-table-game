import test from 'node:test';
import assert from 'node:assert/strict';
import { readyMap, openMap, startMapTurn, travelIntent } from './travel-helper.mjs';
import { readSession, readBackup } from './skill-test-helper.mjs';
import { command } from './preparation-helper.mjs';
import { randomUUID } from 'node:crypto';

test('il gruppo apre una mappa verificabile con la stessa posizione iniziale per ogni eroe', async (t) => {
  const { host, player } = await readyMap(t);
  const response = await host.request('/api/journey-map-plan');
  assert.equal(response.status, 200);
  const plan = await response.json();
  let state = await readSession(host);
  assert.equal(state.schemaVersion, 32);
  assert.equal(state.journey, null);
  const intent = {
    type: 'OPEN_JOURNEY_MAP',
    planId: plan.definition.id,
    planHash: plan.hash,
    agreed: true,
  };
  assert.equal((await command(host, player, { ...intent, agreed: false })).status, 422);
  assert.equal((await command(host, player, { ...intent, planHash: 'f'.repeat(64) })).status, 409);
  assert.equal((await command(host, player, intent)).status, 200);
  state = await readSession(host);
  assert.deepEqual(state.journey.definition, plan.definition);
  assert.deepEqual(state.journey.heroes, [
    { heroId: 'hero-1', spaceId: 'a' },
    { heroId: 'hero-2', spaceId: 'a' },
  ]);
  assert.equal(state.journey.travel, null);
  assert.equal((await command(host, player, intent)).status, 409);
  assert.deepEqual((await readBackup(host)).payload.state.journey, state.journey);
});

test('proprietà, identificativi e concorrenza proteggono la posizione e il movimento residuo', async (t) => {
  const { host, player, other } = await readyMap(t, true);
  let state = await startMapTurn(host, player);
  const intent = { type: 'START_TRAVEL', ...travelIntent(state) };
  assert.equal((await command(host, other, intent)).status, 403);
  for (const key of ['mapId', 'roundId', 'turnId'])
    assert.equal((await command(host, player, { ...intent, [key]: randomUUID() })).status, 409);
  assert.deepEqual(await readSession(host), state);
  assert.equal((await command(host, player, intent)).status, 200);
  state = await readSession(host);
  const move = {
    type: 'MOVE_HERO',
    ...travelIntent(state),
    fromSpaceId: 'a',
    destinationSpaceId: 'b',
    requestId: randomUUID(),
  };
  assert.equal((await command(host, other, move)).status, 403);
  assert.equal((await command(host, player, { ...move, fromSpaceId: 'c' })).status, 409);
  const intents = [move, { ...move, requestId: randomUUID() }];
  const responses = await Promise.all(
    intents.map((intent) => command(host, player, intent, state)),
  );
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
  const after = await readSession(host);
  assert.equal(after.journey.travel.remaining, 1);
  assert.equal(after.journey.heroes[0].spaceId, 'b');
  const accepted = responses.findIndex((response) => response.status === 200);
  const receipt = (await responses[accepted].json()).receipt;
  const replay = await command(host, player, intents[accepted], state);
  assert.equal(replay.status, 200);
  assert.deepEqual((await replay.json()).receipt, receipt);
  assert.deepEqual(await readSession(host), after);
});

test('la mappa si apre prima dei turni e i viaggi richiedono mappa e rivelazioni concluse', async (t) => {
  const { host, player } = await readyMap(t);
  assert.equal((await command(host, player, { type: 'START_ROUNDS', agreed: true })).status, 200);
  let state = await readSession(host);
  assert.equal(
    (
      await command(host, player, {
        type: 'START_TURN',
        roundId: state.round.id,
        heroId: 'hero-1',
        agreed: true,
      })
    ).status,
    200,
  );
  state = await readSession(host);
  assert.equal(
    (
      await command(host, player, {
        type: 'START_TRAVEL',
        mapId: randomUUID(),
        roundId: state.round.id,
        turnId: state.round.turnId,
        heroId: 'hero-1',
      })
    ).status,
    409,
  );
  assert.equal((await readSession(host)).round.heroes[0].actionsUsed, 0);
  const { definition, hash } = await (await host.request('/api/journey-map-plan')).json();
  assert.equal(
    (
      await command(host, player, {
        type: 'OPEN_JOURNEY_MAP',
        planId: definition.id,
        planHash: hash,
        agreed: true,
      })
    ).status,
    409,
  );
  assert.equal((await readSession(host)).journey, null);
});

test('viaggio concede due movimenti e conserva il secondo attraverso un’interazione', async (t) => {
  const { host, player } = await readyMap(t);
  const before = await startMapTurn(host, player);
  const intent = { type: 'START_TRAVEL', ...travelIntent(before), requestId: randomUUID() };
  const response = await command(host, player, intent, before);
  assert.equal(response.status, 200);
  const receipt = (await response.json()).receipt;
  assert.equal((await command(host, player, intent, before)).status, 200);
  let state = await readSession(host);
  assert.equal(state.round.heroes[0].actionsUsed, 1);
  assert.equal(state.journey.travel.remaining, 2);
  assert.equal(receipt.movesRemaining, 2);
  const move = {
    type: 'MOVE_HERO',
    ...travelIntent(state),
    fromSpaceId: 'a',
    destinationSpaceId: 'b',
  };
  for (const destinationSpaceId of ['a', 'c', 'd', 'missing'])
    assert.equal((await command(host, player, { ...move, destinationSpaceId })).status, 409);
  assert.deepEqual(await readSession(host), state);
  assert.equal((await command(host, player, move)).status, 200);
  state = await readSession(host);
  assert.equal(state.journey.heroes[0].spaceId, 'b');
  assert.equal(state.journey.travel.remaining, 1);
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
  state = await readSession(host);
  const secondMove = { ...move, fromSpaceId: 'b', destinationSpaceId: 'c' };
  assert.equal((await command(host, player, secondMove)).status, 409);
  assert.equal(
    (await command(host, player, { type: 'RESOLVE_SKILL_TEST', testId: state.skillTest.id }))
      .status,
    200,
  );
  assert.equal((await command(host, player, secondMove)).status, 200);
  state = await readSession(host);
  assert.equal(state.round.heroes[0].actionsUsed, 2);
  assert.equal(state.journey.travel.remaining, 0);
  assert.equal(state.journey.heroes[0].spaceId, 'c');
  assert.equal((await command(host, player, { ...move, fromSpaceId: 'c' })).status, 409);
  assert.equal((await command(host, player, { ...intent, requestId: randomUUID() })).status, 409);
  assert.deepEqual(await readSession(host), state);
});

test('due viaggi permettono quattro movimenti e fine turno rinuncia ai residui', async (t) => {
  const { host, player } = await readyMap(t);
  let state = await startMapTurn(host, player);
  const start = { type: 'START_TRAVEL', ...travelIntent(state) };
  assert.equal((await command(host, player, start)).status, 200);
  assert.equal((await command(host, player, start)).status, 200);
  state = await readSession(host);
  assert.equal(state.round.heroes[0].actionsUsed, 2);
  assert.equal(state.journey.travel.remaining, 4);
  for (const [fromSpaceId, destinationSpaceId] of [
    ['a', 'b'],
    ['b', 'c'],
    ['c', 'b'],
    ['b', 'a'],
  ]) {
    assert.equal(
      (
        await command(host, player, {
          type: 'MOVE_HERO',
          ...travelIntent(state),
          fromSpaceId,
          destinationSpaceId,
        })
      ).status,
      200,
    );
  }
  assert.equal(
    (
      await command(host, player, {
        type: 'END_TURN',
        roundId: state.round.id,
        turnId: state.round.turnId,
        heroId: 'hero-1',
      })
    ).status,
    200,
  );
  state = await readSession(host);
  assert.equal(state.journey.travel, null);
  assert.equal(
    (
      await command(host, player, {
        type: 'START_TURN',
        roundId: state.round.id,
        heroId: 'hero-2',
        agreed: true,
      })
    ).status,
    200,
  );
  state = await readSession(host);
  assert.equal(
    (
      await command(host, player, {
        type: 'MOVE_HERO',
        ...travelIntent(state),
        fromSpaceId: 'a',
        destinationSpaceId: 'b',
      })
    ).status,
    409,
  );
  assert.equal(
    (await command(host, player, { type: 'START_TRAVEL', ...travelIntent(state) })).status,
    200,
  );
  assert.equal(
    (
      await command(host, player, {
        type: 'END_TURN',
        roundId: state.round.id,
        turnId: state.round.turnId,
        heroId: 'hero-2',
      })
    ).status,
    200,
  );
  state = await readSession(host);
  assert.equal(state.journey.travel, null);
  assert.equal(state.round.heroes[1].actionsUsed, 1);
  assert.deepEqual(
    state.journey.heroes.map((hero) => hero.spaceId),
    ['a', 'a'],
  );
});
