import test from 'node:test';
import assert from 'node:assert/strict';
import { readyCompany, readSession, readBackup, startTest } from './skill-test-helper.mjs';
import { command } from './preparation-helper.mjs';
import { randomUUID } from 'node:crypto';
import { enterShadow, resolveScout } from './rounds-helper.mjs';

test('il gruppo sceglie l’ordine degli eroi e un turno termina prima del successivo', async (t) => {
  const { host, player } = await readyCompany(t);
  const started = await command(host, player, { type: 'START_ROUNDS', agreed: true });
  assert.equal(started.status, 200);
  let state = await readSession(host);
  assert.equal(state.round.number, 1);
  assert.equal(state.round.phase, 'action');
  const roundId = state.round.id;
  assert.equal(
    (await command(host, player, { type: 'START_TURN', roundId, heroId: 'hero-2', agreed: true }))
      .status,
    200,
  );
  state = await readSession(host);
  assert.equal(state.round.activeHeroId, 'hero-2');
  assert.equal(
    (await command(host, player, { type: 'START_TURN', roundId, heroId: 'hero-1', agreed: true }))
      .status,
    409,
  );
  assert.equal(
    (await command(host, player, { type: 'BEGIN_SHADOW', roundId, agreed: true })).status,
    409,
  );
  assert.equal(
    (
      await command(host, player, {
        type: 'END_TURN',
        roundId,
        turnId: state.round.turnId,
        heroId: 'hero-2',
      })
    ).status,
    200,
  );
  state = await readSession(host);
  assert.equal(state.round.heroes.find((hero) => hero.heroId === 'hero-2').actionsUsed, 0);
  assert.equal(state.round.heroes.find((hero) => hero.heroId === 'hero-2').turnEnded, true);
  assert.equal(
    (await command(host, player, { type: 'START_TURN', roundId, heroId: 'hero-2', agreed: true }))
      .status,
    409,
  );
  assert.equal(
    (await command(host, player, { type: 'START_TURN', roundId, heroId: 'hero-1', agreed: true }))
      .status,
    200,
  );
  state = await readSession(host);
  assert.equal(
    (
      await command(host, player, {
        type: 'END_TURN',
        roundId,
        turnId: state.round.turnId,
        heroId: 'hero-1',
      })
    ).status,
    200,
  );
  assert.equal(
    (await command(host, player, { type: 'BEGIN_SHADOW', roundId, agreed: true })).status,
    200,
  );
  state = await readSession(host);
  assert.equal(state.round.phase, 'shadow');
  assert.equal(state.round.shadowStep, 'enemies');
});

test('due interazioni consumano due azioni, mentre reinvii ed effetti non ne consumano altre', async (t) => {
  const { host, player } = await readyCompany(t);
  assert.equal((await command(host, player, { type: 'START_ROUNDS', agreed: true })).status, 200);
  let state = await readSession(host);
  const roundId = state.round.id;
  assert.equal(
    (await command(host, player, { type: 'START_TURN', roundId, heroId: 'hero-1', agreed: true }))
      .status,
    200,
  );
  const before = await readSession(host);
  const intent = {
    type: 'START_INTERACTION_TEST',
    roundId,
    turnId: before.round.turnId,
    heroId: 'hero-1',
    stat: 'might',
    modifier: 0,
    target: 1,
    requestId: randomUUID(),
  };
  assert.equal((await command(host, player, { ...intent, target: 0 })).status, 422);
  assert.equal((await readSession(host)).round.heroes[0].actionsUsed, 0);
  const response = await command(host, player, intent, before);
  assert.equal(response.status, 200);
  const receipt = (await response.json()).receipt;
  const replay = await command(host, player, intent, before);
  assert.equal(replay.status, 200);
  assert.deepEqual((await replay.json()).receipt, receipt);
  state = await readSession(host);
  assert.equal(state.round.heroes[0].actionsUsed, 1);
  assert.equal(
    (
      await command(host, player, {
        type: 'END_TURN',
        roundId,
        turnId: before.round.turnId,
        heroId: 'hero-1',
      })
    ).status,
    409,
  );
  assert.equal(
    (await command(host, player, { type: 'RESOLVE_SKILL_TEST', testId: state.skillTest.id }))
      .status,
    200,
  );
  assert.equal((await command(host, player, { ...intent, requestId: randomUUID() })).status, 200);
  state = await readSession(host);
  assert.equal(
    (await command(host, player, { type: 'RESOLVE_SKILL_TEST', testId: state.skillTest.id }))
      .status,
    200,
  );
  const exhausted = await readSession(host);
  assert.equal(exhausted.round.heroes[0].actionsUsed, 2);
  assert.equal((await command(host, player, { ...intent, requestId: randomUUID() })).status, 409);
  assert.deepEqual(await readSession(host), exhausted);
  assert.equal(
    (
      await command(host, player, {
        type: 'START_SKILL_TEST',
        heroId: 'hero-1',
        stat: 'spirit',
        modifier: 0,
        target: null,
      })
    ).status,
    200,
  );
  state = await readSession(host);
  assert.equal(state.round.heroes[0].actionsUsed, 2);
});

test('Ombra segue tre passaggi e ricompone tutti i mazzi prima di Scoperta 2 una volta per eroe', async (t) => {
  const { host, player } = await readyCompany(t);
  for (const heroId of ['hero-1', 'hero-2']) {
    assert.equal((await startTest(host, player, { heroId })).status, 200);
    const { skillTest } = await readSession(host);
    assert.equal(
      (await command(host, player, { type: 'RESOLVE_SKILL_TEST', testId: skillTest.id })).status,
      200,
    );
  }
  const before = (await readBackup(host)).payload.state.preparation.heroes;
  assert.ok(before.every((hero) => hero.discard.length > 0));
  let state = await enterShadow(host, player);
  const roundId = state.round.id;
  const confirm = (step) =>
    command(host, player, { type: 'CONFIRM_SHADOW_STEP', roundId, step, agreed: true });
  assert.equal((await confirm('threat')).status, 409);
  assert.equal(
    (await command(host, player, { type: 'START_RALLY_SCOUT', roundId, heroId: 'hero-1' })).status,
    409,
  );
  assert.equal((await confirm('enemies')).status, 200);
  assert.equal((await confirm('enemies')).status, 409);
  // Prove da effetto restano possibili in Ombra e bloccano il cambio di passaggio.
  assert.equal((await startTest(host, player)).status, 200);
  state = await readSession(host);
  assert.equal((await confirm('darkness')).status, 409);
  assert.equal(
    (await command(host, player, { type: 'RESOLVE_SKILL_TEST', testId: state.skillTest.id }))
      .status,
    200,
  );
  assert.equal((await confirm('darkness')).status, 200);
  const threatState = await readSession(host);
  const intent = {
    type: 'CONFIRM_SHADOW_STEP',
    roundId,
    step: 'threat',
    agreed: true,
    requestId: randomUUID(),
  };
  const first = await command(host, player, intent, threatState);
  assert.equal(first.status, 200);
  const reset = (await readBackup(host)).payload.state;
  assert.equal(reset.round.phase, 'rally');
  assert.equal(reset.scout, null);
  for (const hero of reset.preparation.heroes) {
    const original = before.find((entry) => entry.heroId === hero.heroId);
    assert.deepEqual([...hero.deck].sort(), [...original.deck, ...original.discard].sort());
    assert.deepEqual(hero.prepared, original.prepared);
    assert.deepEqual(hero.discard, []);
  }
  assert.equal((await command(host, player, intent, threatState)).status, 200);
  assert.deepEqual((await readBackup(host)).payload.state, reset);
  assert.equal((await startTest(host, player)).status, 409);
  assert.equal(
    (await command(host, player, { type: 'START_SCOUT', heroId: 'hero-1', count: 1 })).status,
    409,
  );
  assert.equal(
    (
      await command(host, player, {
        type: 'DISCARD_PREPARED_SKILL',
        heroId: 'hero-1',
        copy: reset.preparation.heroes[0].prepared[0],
      })
    ).status,
    409,
  );
  assert.equal(
    (await command(host, player, { type: 'END_RALLY', roundId, agreed: true })).status,
    409,
  );
  for (const heroId of ['hero-2', 'hero-1']) {
    assert.equal(
      (await command(host, player, { type: 'START_RALLY_SCOUT', roundId: randomUUID(), heroId }))
        .status,
      409,
    );
    assert.equal(
      (await command(host, player, { type: 'START_RALLY_SCOUT', roundId, heroId })).status,
      200,
    );
    state = await readSession(host);
    const deck = reset.preparation.heroes.find((hero) => hero.heroId === heroId).deck;
    assert.deepEqual(state.scout.revealed, deck.slice(0, 2));
    assert.equal(state.scout.roundId, roundId);
    assert.equal(state.scout.resetBefore, false);
    assert.equal(
      (await command(host, player, { type: 'END_RALLY', roundId, agreed: true })).status,
      409,
    );
    state = await resolveScout(host, player);
    assert.equal(state.round.heroes.find((hero) => hero.heroId === heroId).rallyDone, true);
    assert.deepEqual(
      (await readBackup(host)).payload.state.preparation.heroes.find(
        (hero) => hero.heroId === heroId,
      ).deck,
      deck,
    );
    assert.equal(
      (await command(host, player, { type: 'START_RALLY_SCOUT', roundId, heroId })).status,
      409,
    );
  }
  assert.equal(
    (await command(host, player, { type: 'END_RALLY', roundId, agreed: true })).status,
    200,
  );
  state = await readSession(host);
  assert.equal(state.round.number, 2);
  assert.notEqual(state.round.id, roundId);
  assert.equal(state.round.phase, 'action');
  assert.ok(
    state.round.heroes.every(
      (hero) => !hero.turnEnded && !hero.rallyDone && hero.actionsUsed === 0,
    ),
  );
  assert.equal(
    (await command(host, player, { type: 'BEGIN_SHADOW', roundId, agreed: true })).status,
    409,
  );
});

test('proprietà, concorrenza e identificativi impediscono turni o azioni assegnati da un altro dispositivo', async (t) => {
  const { host, player, other } = await readyCompany(t, undefined, true);
  assert.equal((await command(host, player, { type: 'START_ROUNDS', agreed: false })).status, 422);
  assert.equal((await command(host, player, { type: 'START_ROUNDS', agreed: true })).status, 200);
  let state = await readSession(host);
  const roundId = state.round.id;
  assert.equal(
    (await command(host, other, { type: 'START_TURN', roundId, heroId: 'hero-1', agreed: true }))
      .status,
    403,
  );
  const [first, second] = await Promise.all([
    command(host, player, { type: 'START_TURN', roundId, heroId: 'hero-1', agreed: true }, state),
    command(host, other, { type: 'START_TURN', roundId, heroId: 'hero-2', agreed: true }, state),
  ]);
  assert.deepEqual([first.status, second.status].sort(), [200, 409]);
  state = await readSession(host);
  const owner = state.round.activeHeroId === 'hero-1' ? player : other;
  const stranger = owner === player ? other : player;
  const intent = {
    type: 'START_INTERACTION_TEST',
    roundId,
    turnId: state.round.turnId,
    heroId: state.round.activeHeroId,
    stat: 'might',
    modifier: 0,
    target: null,
  };
  assert.equal((await command(host, stranger, intent)).status, 403);
  assert.equal((await command(host, owner, { ...intent, turnId: randomUUID() })).status, 409);
  assert.equal((await command(host, owner, { ...intent, roundId: randomUUID() })).status, 409);
  assert.deepEqual(await readSession(host), state);
  assert.equal((await command(host, owner, intent)).status, 200);
  const pending = await readSession(host);
  assert.equal(
    (await command(host, owner, { type: 'RESOLVE_SKILL_TEST', testId: pending.skillTest.id }))
      .status,
    200,
  );
  assert.equal(
    (
      await command(host, stranger, {
        type: 'END_TURN',
        roundId,
        turnId: state.round.turnId,
        heroId: state.round.activeHeroId,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await command(host, owner, {
        type: 'END_TURN',
        roundId,
        turnId: state.round.turnId,
        heroId: state.round.activeHeroId,
      })
    ).status,
    200,
  );
  state = await readSession(host);
  assert.equal(state.round.heroes.find((hero) => hero.turnEnded).actionsUsed, 1);
  assert.equal((await command(host, owner, intent)).status, 409);
});
