import test from 'node:test';
import assert from 'node:assert/strict';
import { materializeCampDecks } from '../dist/camp-decks-library.mjs';
import { projectCampDeckSource } from '../dist/scenario-library.mjs';
import {
  readyDeparture,
  confirmedCamp,
  scenarioInput,
  readSession,
  readBackup,
  ok,
  command,
  automaticInput,
  finishSetup,
} from './camp-departure-helper.mjs';

test('battle Scout3 consumes exactly the new top-first deck and hands off to a real wall-respecting turn', async (t) => {
  const r = await readyDeparture(t),
    camp = await confirmedCamp(r),
    before = (await readBackup(r.host)).payload;
  const ok = async (p) => {
    const response = await p;
    assert.equal(response.status, 200, `${await response.clone().text()}\n${r.host.diagnostics()}`);
    return response;
  };
  await ok(
    scenarioInput(r.host, r.player, {
      kind: 'camp-depart',
      offerFingerprint: camp.campDeparture.fingerprint,
      agreed: true,
    }),
  );
  const activated = (await readBackup(r.host)).payload;
  assert.deepEqual(activated.state.episodes[0].scenario, before.state.scenario);
  assert.deepEqual(activated.state.episodes[0].physical, before.state.physical);
  assert.deepEqual(
    activated.commands.slice().filter((c) => c.receipt.appliedRevision <= before.state.revision),
    before.commands,
  );
  const seed = activated.state.physical.cycle.seed.departure.entropy;
  const cap = before.state.scenario.pack.manifest.campDeparture,
    expected = materializeCampDecks(projectCampDeckSource(before.state, cap), { seed });
  for (let n = 0; n < 10; n++) {
    const s = await readSession(r.host);
    if (s.physical.active?.mode === 'scout') break;
    const actor =
      r.actors.find((a) => a.body.player.id === s.scenario.pending.actorPlayerId) ?? r.player;
    await ok(scenarioInput(r.host, actor, automaticInput(s)));
  }
  const scout = await readSession(r.host);
  assert.equal(scout.physical.active.mode, 'scout');
  assert.deepEqual(
    scout.physical.active.options.map((o) => o.id),
    expected.materialized.heroes[0].deck.slice(0, 3),
  );
  const unchanged = await readBackup(r.host);
  const wrong = await scenarioInput(r.host, r.actors[1], automaticInput(scout));
  assert.equal(wrong.status, 403);
  assert.deepEqual((await readBackup(r.host)).payload, unchanged.payload);
  await finishSetup(r);
  const active = await readSession(r.host);
  assert.equal(active.scenario.phase, 'action');
  assert.equal(active.round.number, 1);
  assert.equal(active.round.phase, 'action');
  assert.equal(active.scenario.completedSetup.length, 3);
  assert.ok(
    active.scenario.completedSetup.every((c) => c.kind === 'scout' && c.revealed.length === 3),
  );
  assert.equal(active.scenario.battle.placements.length, 10);
  assert.equal(active.journey.definition.topology, 'battle');
  assert.equal(active.journey.definition.spaces.length, 10);
  assert.equal(active.journey.definition.connections.length, 16);
  assert.equal(active.scenario.globals.battleThreshold, 9);
  assert.equal(active.scenario.globals.battleLimit, 39);
  assert.equal(active.scenario.battle.campaign.lore, before.state.scenario.play.lore + 2);
  assert.equal(active.scenario.enemies.attempts.length, 3);
  assert.equal(active.scenario.handoffCount, 1);
  const hero = active.preparation.heroes[0],
    from = active.journey.heroes.find((h) => h.heroId === hero.heroId).spaceId;
  await ok(
    command(r.host, r.player, {
      type: 'START_TURN',
      roundId: active.round.id,
      heroId: hero.heroId,
      agreed: true,
    }),
  );
  let s = await readSession(r.host);
  await ok(
    command(r.host, r.player, {
      type: 'START_TRAVEL',
      roundId: s.round.id,
      turnId: s.round.turnId,
      mapId: s.journey.id,
      heroId: hero.heroId,
    }),
  );
  s = await readSession(r.host);
  const edge = s.journey.definition.connections.find((e) => e.includes(from)),
    to = edge.find((id) => id !== from);
  await ok(
    command(r.host, r.player, {
      type: 'MOVE_HERO',
      roundId: s.round.id,
      turnId: s.round.turnId,
      mapId: s.journey.id,
      heroId: hero.heroId,
      fromSpaceId: from,
      destinationSpaceId: to,
    }),
  );
  s = await readSession(r.host);
  assert.equal(s.journey.heroes.find((h) => h.heroId === hero.heroId).spaceId, to);
  assert.equal(s.round.heroes[0].actionsUsed, 1);
});
