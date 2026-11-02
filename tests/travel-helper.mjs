import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { journeyMapFixture } from './fixtures/journey-map.mjs';
import { readyCompany, readSession } from './skill-test-helper.mjs';
import { command } from './preparation-helper.mjs';

export async function readyMap(t, multiplayer = false, definition = journeyMapFixture()) {
  const directory = await mkdtemp(join(tmpdir(), 'lotr-map-test-'));
  const path = join(directory, 'journey-map.json');
  await writeFile(path, JSON.stringify(definition));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return {
    ...(await readyCompany(t, undefined, multiplayer, { LOTR_MAP_PACK: path })),
    mapPath: path,
  };
}

export async function openMap(host, player) {
  const { definition, hash } = await (await host.request('/api/journey-map-plan')).json();
  const response = await command(host, player, {
    type: 'OPEN_JOURNEY_MAP',
    planId: definition.id,
    planHash: hash,
    agreed: true,
  });
  assert.equal(response.status, 200);
  return readSession(host);
}

export async function startMapTurn(host, player, heroId = 'hero-1') {
  if (!(await readSession(host)).journey) await openMap(host, player);
  if (!(await readSession(host)).round)
    assert.equal((await command(host, player, { type: 'START_ROUNDS', agreed: true })).status, 200);
  let state = await readSession(host);
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
  return readSession(host);
}

export const travelIntent = (state) => ({
  mapId: state.journey.id,
  roundId: state.round.id,
  turnId: state.round.turnId,
  heroId: state.round.activeHeroId,
});
