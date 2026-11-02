import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { catalogFixture } from './fixtures/catalog.mjs';
import { journeyMapFixture } from './fixtures/journey-map.mjs';
import { setup, command } from './preparation-helper.mjs';
import { joinPlayer } from './host-helper.mjs';
import { readSession } from './skill-test-helper.mjs';
import { openMap } from './travel-helper.mjs';

export const ARAGORN = 'base-hero-aragorn';

export async function aragornParty(t, { map = true, aragorn = true } = {}) {
  const catalog = catalogFixture();
  if (aragorn) {
    catalog.heroes[0].id = ARAGORN;
    for (const skill of catalog.skills) if (skill.ownerId === 'hero-1') skill.ownerId = ARAGORN;
    // Identity, not the translated name or text, selects the implemented effect.
    catalog.heroes[0].name.text = 'Eroe di prova';
    catalog.heroes[0].ability.text = 'Testo inventato; effetto selezionato per identità.';
  } else catalog.heroes[0].name.text = 'Aragorn';
  const directory = await mkdtemp(join(tmpdir(), 'lotr-aragorn-map-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'journey-map.json');
  await writeFile(path, JSON.stringify(journeyMapFixture()));
  const host = await setup(t, catalog, map ? { LOTR_MAP_PACK: path } : {});
  const players = [];
  for (const name of ['Uno', 'Due', 'Tre']) players.push(await joinPlayer(host, name));
  const heroIds = [aragorn ? ARAGORN : 'hero-1', 'hero-2', 'hero-3'];
  for (const [index, player] of players.entries())
    assert.equal(
      (await command(host, player, { type: 'SELECT_HEROES', heroIds: [heroIds[index]] })).status,
      200,
    );
  assert.equal(
    (await command(host, players[0], { type: 'PREPARE_COMPANY', agreed: true })).status,
    200,
  );
  if (map) await openMap(host, players[0]);
  return { host, players, heroIds };
}

export async function partyRally(host, players, paths = {}) {
  let state = await readSession(host);
  if (!state.round)
    assert.equal(
      (await command(host, players[0], { type: 'START_ROUNDS', agreed: true })).status,
      200,
    );
  state = await readSession(host);
  for (const player of players) {
    const heroId = state.preparation.heroes.find(
      (hero) => hero.playerId === player.body.player.id,
    ).heroId;
    assert.equal(
      (
        await command(host, player, {
          type: 'START_TURN',
          roundId: state.round.id,
          heroId,
          agreed: true,
        })
      ).status,
      200,
    );
    state = await readSession(host);
    if (paths[heroId]?.length) {
      const ids = {
        mapId: state.journey.id,
        roundId: state.round.id,
        turnId: state.round.turnId,
        heroId,
      };
      assert.equal((await command(host, player, { type: 'START_TRAVEL', ...ids })).status, 200);
      for (const destinationSpaceId of paths[heroId]) {
        const fromSpaceId = state.journey.heroes.find((hero) => hero.heroId === heroId).spaceId;
        assert.equal(
          (
            await command(host, player, {
              type: 'MOVE_HERO',
              ...ids,
              fromSpaceId,
              destinationSpaceId,
            })
          ).status,
          200,
        );
        state = await readSession(host);
      }
    }
    assert.equal(
      (
        await command(host, player, {
          type: 'END_TURN',
          roundId: state.round.id,
          turnId: state.round.turnId,
          heroId,
        })
      ).status,
      200,
    );
    state = await readSession(host);
  }
  assert.equal(
    (
      await command(host, players[0], {
        type: 'BEGIN_SHADOW',
        roundId: state.round.id,
        agreed: true,
      })
    ).status,
    200,
  );
  for (const step of ['enemies', 'darkness', 'threat'])
    assert.equal(
      (
        await command(host, players[0], {
          type: 'CONFIRM_SHADOW_STEP',
          roundId: state.round.id,
          step,
          agreed: true,
        })
      ).status,
      200,
    );
  return readSession(host);
}
