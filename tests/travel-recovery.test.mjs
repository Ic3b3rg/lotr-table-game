import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { journeyMapFixture } from './fixtures/journey-map.mjs';
import { startHost } from './host-helper.mjs';
import { command } from './preparation-helper.mjs';
import { readyCompany, readSession, readBackup, signBackup } from './skill-test-helper.mjs';
import { readyMap, startMapTurn, travelIntent } from './travel-helper.mjs';

async function recover(host, player) {
  const state = await readSession(host);
  const r = await host.request('/api/recover', {
    recoveryCode: player.recoveryCode,
    generation: state.generation,
  });
  assert.equal(r.status, 200);
  return { ...player, cookie: r.headers.get('set-cookie').split(';')[0] };
}

test('SIGKILL e backup conservano il movimento interrotto, anche senza il pacchetto mappa', async (t) => {
  const { host, player, mapPath } = await readyMap(t);
  let state = await startMapTurn(host, player);
  assert.equal(
    (await command(host, player, { type: 'START_TRAVEL', ...travelIntent(state) })).status,
    200,
  );
  const before = await readSession(host);
  const intent = {
    type: 'MOVE_HERO',
    ...travelIntent(before),
    fromSpaceId: 'a',
    destinationSpaceId: 'b',
    requestId: randomUUID(),
  };
  const applied = await command(host, player, intent, before);
  assert.equal(applied.status, 200);
  const receipt = (await applied.json()).receipt;
  const pending = await readSession(host);
  const backup = await readBackup(host);
  await host.stop('SIGKILL');
  await writeFile(mapPath, JSON.stringify({ changed: 'invalid external file' }));
  const restarted = await startHost({ LOTR_DATA_DIR: host.dataDir, LOTR_MAP_PACK: mapPath });
  t.after(() => restarted.stop());
  assert.deepEqual(await readSession(restarted), pending);
  assert.deepEqual((await readBackup(restarted)).payload, backup.payload);
  assert.deepEqual(
    (await (await restarted.request('/api/journey-map-plan')).json()).definition,
    pending.journey.definition,
  );
  const recovered = await recover(restarted, player);
  const replay = await command(restarted, recovered, intent, before);
  assert.equal(replay.status, 200);
  assert.deepEqual((await replay.json()).receipt, receipt);
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
  assert.deepEqual(restored.journey, pending.journey);
  const owner = await recover(destination, player);
  assert.equal((await command(destination, owner, intent, before)).status, 409);
  const repeated = await command(destination, owner, intent, {
    ...before,
    generation: restored.generation,
  });
  assert.equal(repeated.status, 200);
  assert.deepEqual((await repeated.json()).receipt, receipt);
  assert.equal(
    (
      await command(destination, owner, {
        type: 'MOVE_HERO',
        ...travelIntent(restored),
        fromSpaceId: 'b',
        destinationSpaceId: 'c',
      })
    ).status,
    200,
  );
  const after = await readSession(destination);
  assert.equal(after.journey.travel.remaining, 0);
  assert.equal(after.journey.heroes[0].spaceId, 'c');
  assert.equal(after.round.heroes[0].actionsUsed, 1);
});

test('schema 5 con turno e prova aperti migra senza perdere azioni, rivelate o ricevute', async (t) => {
  const { host, player } = await readyCompany(t);
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
  backup.payload.state.schemaVersion = 5;
  delete backup.payload.state.mapGeneration;
  delete backup.payload.state.scenario;
  delete backup.payload.state.physical;
  delete backup.payload.state.group;
  delete backup.payload.state.journey;
  signBackup(backup);
  await host.stop();
  const db = new DatabaseSync(join(host.dataDir, 'session.sqlite'));
  db.prepare('UPDATE session SET data=? WHERE id=1').run(JSON.stringify(backup.payload.state));
  db.close();
  const restarted = await startHost({ LOTR_DATA_DIR: host.dataDir });
  t.after(() => restarted.stop());
  const migrated = await readSession(restarted);
  assert.equal(migrated.schemaVersion, 18);
  assert.equal(migrated.journey, null);
  for (const key of ['round', 'preparation', 'skillTest', 'scout'])
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
  assert.deepEqual((await readSession(destination)).round, before.round);
  const owner = await recover(destination, player);
  assert.equal(
    (await command(destination, owner, { type: 'RESOLVE_SKILL_TEST', testId: before.skillTest.id }))
      .status,
    200,
  );
});

test('geometria, grafo, roster e residui incoerenti non sostituiscono il tavolo', async (t) => {
  const { host, player } = await readyMap(t);
  let state = await startMapTurn(host, player);
  assert.equal(
    (await command(host, player, { type: 'START_TRAVEL', ...travelIntent(state) })).status,
    200,
  );
  state = await readSession(host);
  const original = await readBackup(host);
  const changes = [
    (s) => {
      s.journey.definition.spaces[1].id = 'a';
    },
    (s) => {
      s.journey.definition.startSpaceId = 'missing';
    },
    (s) => {
      s.journey.definition.connections.push(['a', 'missing']);
    },
    (s) => {
      s.journey.definition.connections.push(['b', 'a']);
    },
    (s) => {
      s.journey.definition.connections.push(['a', 'a']);
    },
    (s) => {
      s.journey.definition.spaces[0].x = 1001;
    },
    (s) => {
      s.journey.definition.image = '../private.png';
    },
    (s) => {
      s.journey.heroes[1].heroId = 'hero-1';
    },
    (s) => {
      s.journey.heroes[0].spaceId = 'missing';
    },
    (s) => {
      s.journey.travel.turnId = randomUUID();
    },
    (s) => {
      s.journey.travel.roundId = randomUUID();
    },
    (s) => {
      s.journey.travel.heroId = 'hero-2';
    },
    (s) => {
      s.journey.travel.remaining = 3;
    },
    (s) => {
      s.round.heroes[0].actionsUsed = 0;
    },
    (s) => {
      s.round.activeHeroId = null;
      s.round.turnId = null;
    },
  ];
  for (const mutate of changes) {
    const backup = structuredClone(original);
    mutate(backup.payload.state);
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
});

test('un’interazione non permette di gonfiare il residuo in un backup o nel salvataggio locale', async (t) => {
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
  state = await readSession(host);
  assert.equal(
    (await command(host, player, { type: 'RESOLVE_SKILL_TEST', testId: state.skillTest.id }))
      .status,
    200,
  );
  state = await readSession(host);
  assert.equal(state.round.heroes[0].actionsUsed, 2);
  assert.equal(state.journey.travel.remaining, 2);
  const backup = await readBackup(host);
  backup.payload.state.journey.travel.remaining = 4;
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
  await host.stop();
  const db = new DatabaseSync(join(host.dataDir, 'session.sqlite'));
  db.prepare('UPDATE session SET data=? WHERE id=1').run(JSON.stringify(backup.payload.state));
  db.close();
  await assert.rejects(
    startHost({ LOTR_DATA_DIR: host.dataDir }),
    /Movimenti residui non coerenti/,
  );
});

test('le immagini mappa ammettono soltanto PNG dichiarate nel pacchetto e dentro assets', async (t) => {
  const definition = { ...journeyMapFixture(), image: 'tile.png' };
  const { host, mapPath } = await readyMap(t, false, definition);
  const directory = dirname(mapPath);
  await mkdir(join(directory, 'assets'));
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jA1sAAAAASUVORK5CYII=',
    'base64',
  );
  await writeFile(join(directory, 'assets/tile.png'), png);
  const response = await host.request('/api/map-content/tile.png');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), png);
  await writeFile(join(directory, 'assets/unlisted.png'), png);
  assert.equal((await host.request('/api/map-content/unlisted.png')).status, 404);
  assert.equal((await host.request('/api/map-content/%2e%2e%2fjourney-map.json')).status, 404);
  await writeFile(join(directory, 'assets/tile.png'), 'not a PNG');
  assert.equal((await host.request('/api/map-content/tile.png')).status, 404);
  await rm(join(directory, 'assets/tile.png'));
  await writeFile(join(directory, 'outside.png'), png);
  await symlink(join(directory, 'outside.png'), join(directory, 'assets/tile.png'));
  assert.equal((await host.request('/api/map-content/tile.png')).status, 404);
});
