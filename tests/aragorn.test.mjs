import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { aragornParty, partyRally, ARAGORN } from './aragorn-helper.mjs';
import { command } from './preparation-helper.mjs';
import { readSession, readBackup } from './skill-test-helper.mjs';
import { resolveScout } from './rounds-helper.mjs';

test('Aragorn assegna una carta a sé e agli eroi nella stessa casella, senza costi o ricomposizioni aggiuntive', async (t) => {
  const { host, players, heroIds } = await aragornParty(t);
  await partyRally(host, players);
  const reset = (await readBackup(host)).payload.state;
  for (const [index, heroId] of heroIds.entries()) {
    const before = await readSession(host);
    const intent = {
      type: 'START_RALLY_SCOUT',
      heroId,
      roundId: before.round.id,
      requestId: randomUUID(),
    };
    const first = await command(host, players[index], intent, before);
    assert.equal(first.status, 200);
    const state = await readSession(host);
    assert.equal(state.scout.count, 3);
    assert.equal(state.scout.revealed.length, 3);
    const hero = reset.preparation.heroes.find((entry) => entry.heroId === heroId);
    assert.deepEqual(state.scout.revealed, hero.deck.slice(0, 3));
    assert.equal(state.scout.resetBefore, false);
    assert.deepEqual(state.round, before.round);
    assert.equal(
      state.preparation.heroes[index].inspiration,
      before.preparation.heroes[index].inspiration,
    );
    assert.equal((await command(host, players[index], intent, before)).status, 200);
    assert.deepEqual(await readSession(host), state);
    assert.equal(
      (
        await command(host, players[(index + 1) % 3], {
          type: 'RESOLVE_SCOUT',
          scoutId: state.scout.id,
          prepareCopy: null,
          top: state.scout.revealed,
          bottom: [],
          discardPreparedCopy: null,
        })
      ).status,
      403,
    );
    await resolveScout(host, players[index]);
    assert.deepEqual(
      (await readBackup(host)).payload.state.preparation.heroes[index].deck,
      hero.deck,
    );
  }
});

test('la vicinanza usa il grafo: adiacente tre, distanza due due; il nome da solo non abilita il bonus', async (t) => {
  const { host, players, heroIds } = await aragornParty(t);
  await partyRally(host, players, { [ARAGORN]: ['b'], 'hero-3': ['b', 'c'] });
  for (const [index, heroId] of heroIds.entries()) {
    const state = await readSession(host);
    assert.equal(
      (
        await command(host, players[index], {
          type: 'START_RALLY_SCOUT',
          heroId,
          roundId: state.round.id,
        })
      ).status,
      200,
    );
    assert.equal((await readSession(host)).scout.count, 3);
    await resolveScout(host, players[index]);
  }
  // Move Aragorn to C while the second hero remains A; hero3 remains C.
  let state = await readSession(host);
  assert.equal(
    (await command(host, players[0], { type: 'END_RALLY', roundId: state.round.id, agreed: true }))
      .status,
    200,
  );
  await partyRally(host, players, { [ARAGORN]: ['c'] });
  for (const [index, heroId] of heroIds.entries()) {
    state = await readSession(host);
    assert.equal(
      (
        await command(host, players[index], {
          type: 'START_RALLY_SCOUT',
          heroId,
          roundId: state.round.id,
        })
      ).status,
      200,
    );
    assert.equal((await readSession(host)).scout.count, index === 1 ? 2 : 3);
    await resolveScout(host, players[index]);
  }
  const other = await aragornParty(t, { aragorn: false });
  state = await partyRally(other.host, other.players);
  assert.equal(
    (
      await command(other.host, other.players[0], {
        type: 'START_RALLY_SCOUT',
        heroId: 'hero-1',
        roundId: state.round.id,
      })
    ).status,
    200,
  );
  assert.equal((await readSession(other.host)).scout.count, 2);
});

test('prima dei round non applica bonus; senza posizioni il legacy richiede una vicinanza esplicita, non modificabile con mappa nota', async (t) => {
  const { host, players } = await aragornParty(t, { map: false });
  assert.equal(
    (await command(host, players[0], { type: 'START_RALLY_SCOUT', heroId: ARAGORN })).status,
    200,
  );
  assert.equal((await readSession(host)).scout.count, 2);
  await resolveScout(host, players[0]);
  let state = await partyRally(host, players);
  assert.equal(
    (
      await command(host, players[0], {
        type: 'START_RALLY_SCOUT',
        heroId: ARAGORN,
        roundId: state.round.id,
      })
    ).status,
    200,
  );
  assert.equal((await readSession(host)).scout.count, 3);
  await resolveScout(host, players[0]);
  const unchanged = await readSession(host);
  assert.equal(
    (
      await command(host, players[1], {
        type: 'START_RALLY_SCOUT',
        heroId: 'hero-2',
        roundId: state.round.id,
      })
    ).status,
    409,
  );
  assert.deepEqual(await readSession(host), unchanged);
  for (const [index, proximity, count] of [
    [1, 'near', 3],
    [2, 'far', 2],
  ]) {
    assert.equal(
      (
        await command(host, players[index], {
          type: 'START_RALLY_SCOUT',
          heroId: `hero-${index + 1}`,
          roundId: state.round.id,
          proximity,
        })
      ).status,
      200,
    );
    assert.equal((await readSession(host)).scout.count, count);
    await resolveScout(host, players[index]);
  }
  const mapped = await aragornParty(t);
  state = await partyRally(mapped.host, mapped.players);
  const before = await readSession(mapped.host);
  assert.equal(
    (
      await command(mapped.host, mapped.players[1], {
        type: 'START_RALLY_SCOUT',
        heroId: 'hero-2',
        roundId: state.round.id,
        proximity: 'far',
      })
    ).status,
    409,
  );
  assert.deepEqual(await readSession(mapped.host), before);
});
