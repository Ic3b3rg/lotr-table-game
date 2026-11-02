import assert from 'node:assert/strict';
import { command } from './preparation-helper.mjs';
import { readSession } from './skill-test-helper.mjs';

export async function enterShadow(host, player) {
  assert.equal((await command(host, player, { type: 'START_ROUNDS', agreed: true })).status, 200);
  let state = await readSession(host);
  for (const hero of state.round.heroes) {
    assert.equal(
      (
        await command(host, player, {
          type: 'START_TURN',
          roundId: state.round.id,
          heroId: hero.heroId,
          agreed: true,
        })
      ).status,
      200,
    );
    state = await readSession(host);
    assert.equal(
      (
        await command(host, player, {
          type: 'END_TURN',
          roundId: state.round.id,
          heroId: hero.heroId,
          turnId: state.round.turnId,
        })
      ).status,
      200,
    );
  }
  assert.equal(
    (
      await command(host, player, {
        type: 'BEGIN_SHADOW',
        roundId: state.round.id,
        agreed: true,
      })
    ).status,
    200,
  );
  return readSession(host);
}

export async function enterRally(host, player) {
  let state = await enterShadow(host, player);
  for (const step of ['enemies', 'darkness', 'threat']) {
    assert.equal(
      (
        await command(host, player, {
          type: 'CONFIRM_SHADOW_STEP',
          roundId: state.round.id,
          step,
          agreed: true,
        })
      ).status,
      200,
    );
    state = await readSession(host);
  }
  return state;
}

export async function resolveScout(host, player) {
  const { scout } = await readSession(host);
  assert.equal(
    (
      await command(host, player, {
        type: 'RESOLVE_SCOUT',
        scoutId: scout.id,
        prepareCopy: null,
        top: scout.revealed,
        bottom: [],
        discardPreparedCopy: null,
      })
    ).status,
    200,
  );
  return readSession(host);
}
