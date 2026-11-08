import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { aragornParty, partyRally, ARAGORN } from './aragorn-helper.mjs';
import { command } from './preparation-helper.mjs';
import { readSession, readBackup, signBackup } from './skill-test-helper.mjs';
import { startHost } from './host-helper.mjs';
import { resolveScout } from './rounds-helper.mjs';

test('Scoperta 3 sopravvive a SIGKILL, backup e recupero senza pescare o mescolare di nuovo', async (t) => {
  const { host, players } = await aragornParty(t);
  const rally = await partyRally(host, players);
  assert.equal(
    (
      await command(host, players[0], {
        type: 'START_RALLY_SCOUT',
        heroId: ARAGORN,
        roundId: rally.round.id,
      })
    ).status,
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
  assert.deepEqual(restored.scout, state.scout);
  const recovered = await destination.request('/api/recover', {
    recoveryCode: players[0].recoveryCode,
    generation: restored.generation,
  });
  assert.equal(recovered.status, 200);
  const owner = { ...players[0], cookie: recovered.headers.get('set-cookie').split(';')[0] };
  await resolveScout(destination, owner);
  const after = (await readBackup(destination)).payload.state;
  assert.deepEqual(after.preparation.heroes[0].deck, [
    ...state.scout.revealed,
    ...backup.payload.state.preparation.heroes[0].deck,
  ]);
  assert.equal(after.round.heroes[0].rallyDone, true);
});

test('schema 7 con Scoperta 2 aperta resta esattamente quella pesca e conserva gruppo e ricevute', async (t) => {
  const { host, players } = await aragornParty(t);
  await partyRally(host, players);
  const backup = await readBackup(host);
  const state = backup.payload.state;
  const hero = state.preparation.heroes[0];
  state.schemaVersion = 7;
  delete state.mapGeneration;
  delete state.scenario;
  delete state.physical;
  state.group = { expectedPlayers: 3 };
  state.scout = {
    id: state.round.id,
    heroId: ARAGORN,
    roundId: state.round.id,
    count: 2,
    resetBefore: false,
    revealed: hero.deck.splice(0, 2),
  };
  signBackup(backup);
  await host.stop();
  const db = new DatabaseSync(join(host.dataDir, 'session.sqlite'));
  db.prepare('UPDATE session SET data=? WHERE id=1').run(JSON.stringify(state));
  db.close();
  const restarted = await startHost({ LOTR_DATA_DIR: host.dataDir });
  t.after(() => restarted.stop());
  const migrated = await readSession(restarted);
  assert.equal(migrated.schemaVersion, 35);
  assert.deepEqual(migrated.scout, state.scout);
  assert.deepEqual(migrated.group, state.group);
  assert.deepEqual((await readBackup(restarted)).payload.commands, backup.payload.commands);
  await resolveScout(restarted, players[0]);
  assert.equal((await readSession(restarted)).round.heroes[0].rallyDone, true);
  assert.deepEqual((await readBackup(restarted)).payload.state.preparation.heroes[0].deck, [
    ...state.scout.revealed,
    ...hero.deck,
  ]);
});

test('casella visivamente vicina ma senza collegamento non dà bonus; un backup non può forzare tre carte lontano da Aragorn', async (t) => {
  const { host, players } = await aragornParty(t);
  const original = await readBackup(host);
  const altered = structuredClone(original);
  altered.payload.state.journey.heroes[2].spaceId = 'd';
  signBackup(altered);
  const before = await readSession(host);
  const restored = await host.request('/api/restores', {
    backup: altered,
    generation: before.generation,
    expectedRevision: before.revision,
    confirmed: true,
  });
  assert.equal(restored.status, 200);
  const generation = (await readSession(host)).generation;
  const recovered = [];
  for (const player of players) {
    const r = await host.request('/api/recover', { recoveryCode: player.recoveryCode, generation });
    recovered.push({ ...player, cookie: r.headers.get('set-cookie').split(';')[0] });
  }
  const rally = await partyRally(host, recovered);
  assert.equal(
    (
      await command(host, recovered[2], {
        type: 'START_RALLY_SCOUT',
        heroId: 'hero-3',
        roundId: rally.round.id,
      })
    ).status,
    200,
  );
  assert.equal((await readSession(host)).scout.count, 2);
  const bad = await readBackup(host);
  const raw = bad.payload.state;
  raw.scout.count = 3;
  raw.scout.revealed.push(raw.preparation.heroes[2].deck.shift());
  signBackup(bad);
  const current = await readSession(host);
  assert.equal(
    (
      await host.request('/api/restores', {
        backup: bad,
        generation: current.generation,
        expectedRevision: current.revision,
        confirmed: true,
      })
    ).status,
    422,
  );
  assert.deepEqual(await readSession(host), current);
});
