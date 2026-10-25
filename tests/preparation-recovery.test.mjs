import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { startHost, joinPlayer } from './host-helper.mjs';
import { setup, command } from './preparation-helper.mjs';

function signed(backup) {
  const ordered = (value) =>
    Array.isArray(value)
      ? value.map(ordered)
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.entries(value)
              .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
              .map(([key, item]) => [key, ordered(item)]),
          )
        : value;
  backup.checksum = createHash('sha256')
    .update(JSON.stringify(ordered(backup.payload)))
    .digest('hex');
  return backup;
}

test('la preparazione rispetta le quindici carte e le debolezze senza esporre l’ordine coperto', async (t) => {
  for (const count of [2, 3, 4]) {
    const host = await setup(t);
    const ada = await joinPlayer(host, 'Ada');
    await command(host, ada, {
      type: 'SELECT_HEROES',
      heroIds: Array.from({ length: count }, (_, i) => `hero-${i + 1}`),
    });
    const response = await command(host, ada, { type: 'PREPARE_COMPANY', agreed: true });
    assert.equal(response.status, 200);
    const state = (await response.json()).session;
    assert.equal(state.preparation.status, 'prepared');
    const all = [];
    for (const hero of state.preparation.heroes) {
      assert.equal(hero.deckCount, 14);
      assert.equal(hero.discardCount, 0);
      assert.equal(hero.prepared.length, 1);
      assert.equal(hero.composition.length, 15);
      assert.equal(hero.prepared[0], `${hero.roleId}-skill-1:1`);
      assert.equal(hero.composition.filter((copy) => copy.startsWith('basic-')).length, 6);
      assert.equal(
        hero.composition.filter((copy) => copy.startsWith(`${hero.heroId}-skill-`)).length,
        5,
      );
      assert.equal(
        hero.composition.filter((copy) => copy.startsWith(`${hero.roleId}-skill-`)).length,
        3,
      );
      assert.equal(hero.composition.filter((copy) => copy.startsWith('weak-')).length, 1);
      assert.equal('deck' in hero, false);
      assert.equal('discard' in hero, false);
      all.push(...hero.composition);
    }
    assert.equal(new Set(all).size, count * 15);
    assert.equal('weaknessDeck' in state.preparation, false);
    const backup = await (await host.request('/api/backups', undefined, ada.cookie)).json();
    assert.equal(backup.payload.state.preparation.weaknessDeck.length, 20 - count);
  }
});

test('la conferma richiede una compagnia completa e blocca nuovi posti conservando il recupero', async (t) => {
  const host = await setup(t);
  const ada = await joinPlayer(host, 'Ada');
  await command(host, ada, { type: 'SELECT_HEROES', heroIds: ['hero-1'] });
  assert.equal((await command(host, ada, { type: 'PREPARE_COMPANY', agreed: true })).status, 409);
  const bob = await joinPlayer(host, 'Bob');
  assert.equal((await command(host, ada, { type: 'PREPARE_COMPANY', agreed: true })).status, 409);
  await command(host, bob, { type: 'SELECT_HEROES', heroIds: ['hero-2'] });
  assert.equal((await command(host, bob, { type: 'PREPARE_COMPANY', agreed: true })).status, 200);
  const after = await (await host.request('/api/session')).json();
  assert.equal((await joinPlayer(host, 'Ciro')).status, 409);
  assert.equal(
    (
      await host.request('/api/recover', {
        recoveryCode: ada.recoveryCode,
        generation: after.generation,
      })
    ).status,
    200,
  );
  assert.equal((await command(host, ada, { type: 'SELECT_HEROES', heroIds: [] })).status, 409);
  assert.deepEqual(await (await host.request('/api/session')).json(), after);
});

test('conferme concorrenti e reinvio dopo arresto non creano un secondo mazzo', async (t) => {
  const first = await setup(t);
  const ada = await joinPlayer(first, 'Ada');
  await command(first, ada, { type: 'SELECT_HEROES', heroIds: ['hero-1', 'hero-2'] });
  const before = await (await first.request('/api/session')).json();
  const intent = { type: 'PREPARE_COMPANY', agreed: true, requestId: randomUUID() };
  const [a, b] = await Promise.all([
    command(first, ada, intent, before),
    command(first, ada, { ...intent, requestId: randomUUID() }, before),
  ]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  const receipt = a.status === 200 ? (await a.json()).receipt : (await b.json()).receipt;
  const accepted = { ...intent, requestId: receipt.requestId };
  const copy = await (await first.request('/api/backups', undefined, ada.cookie)).json();
  await first.stop('SIGKILL');
  const resumed = await startHost({ LOTR_DATA_DIR: first.dataDir });
  t.after(() => resumed.stop());
  const replay = await command(resumed, ada, accepted, before);
  assert.equal(replay.status, 200);
  assert.deepEqual((await replay.json()).receipt, receipt);
  const after = await (await resumed.request('/api/backups', undefined, ada.cookie)).json();
  assert.deepEqual(after.payload, copy.payload);
});

test('backup completo portabile senza pacchetto e riferimenti/copie incoerenti respinti atomicamente', async (t) => {
  const host = await setup(t);
  const ada = await joinPlayer(host, 'Ada');
  await command(host, ada, { type: 'SELECT_HEROES', heroIds: ['hero-1', 'hero-2'] });
  assert.equal((await command(host, ada, { type: 'PREPARE_COMPANY', agreed: true })).status, 200);
  const backup = await (await host.request('/api/backups', undefined, ada.cookie)).json();
  const empty = await startHost();
  t.after(() => empty.dispose());
  const state = await (await empty.request('/api/session')).json();
  const envelope = {
    generation: state.generation,
    expectedRevision: state.revision,
    confirmed: true,
  };
  for (const mutate of [
    (b) => {
      b.payload.state.preparation.heroes[0].deck[0] = 'missing:1';
    },
    (b) => {
      b.payload.state.preparation.heroes[1].deck[0] = b.payload.state.preparation.heroes[0].deck[0];
    },
    (b) => {
      b.payload.state.preparation.heroes[0].prepared = [];
    },
    (b) => {
      b.payload.state.preparation.heroes[0].roleId = b.payload.state.preparation.heroes[1].roleId;
    },
    (b) => {
      b.payload.state.schemaVersion = 99;
    },
  ]) {
    const invalid = structuredClone(backup);
    mutate(invalid);
    assert.equal(
      (await empty.request('/api/restores', { ...envelope, backup: signed(invalid) })).status,
      422,
    );
    assert.deepEqual(await (await empty.request('/api/session')).json(), state);
  }
  const restored = await empty.request('/api/restores', { ...envelope, backup });
  assert.equal(restored.status, 200);
  const after = await (await empty.request('/api/session')).json();
  assert.deepEqual(
    after.preparation,
    (await (await host.request('/api/session')).json()).preparation,
  );
  assert.deepEqual(
    await (await empty.request('/api/catalog')).json(),
    backup.payload.state.content,
  );
  assert.equal(
    (
      await host.request(
        '/api/commands',
        {
          type: 'PREPARE_COMPANY',
          requestId: randomUUID(),
          expectedRevision: after.revision,
          agreed: true,
          generation: after.generation,
        },
        ada.cookie,
      )
    ).status,
    409,
  );
});

test('sessioni e backup precedenti migrano conservando posti e codice personale', async (t) => {
  const first = await startHost();
  const ada = await joinPlayer(first, 'Ada');
  const backup = await (await first.request('/api/backups', undefined, ada.cookie)).json();
  delete backup.payload.state.content;
  delete backup.payload.state.preparation;
  backup.payload.state.schemaVersion = 1;
  signed(backup);
  await first.stop();
  const db = new DatabaseSync(join(first.dataDir, 'session.sqlite'));
  const unversioned = structuredClone(backup.payload.state);
  delete unversioned.schemaVersion;
  db.prepare('UPDATE session SET data=? WHERE id=1').run(JSON.stringify(unversioned));
  db.close();
  const host = await startHost({ LOTR_DATA_DIR: first.dataDir });
  t.after(async () => {
    await host.stop();
    await first.dispose();
  });
  const migrated = await (await host.request('/api/session')).json();
  assert.equal(migrated.schemaVersion, 2);
  assert.deepEqual(migrated.players, [{ id: ada.body.player.id, name: 'Ada' }]);
  assert.equal(migrated.catalog, null);
  assert.equal(migrated.preparation, null);
  const restore = await host.request('/api/restores', {
    backup,
    generation: migrated.generation,
    expectedRevision: migrated.revision,
    confirmed: true,
  });
  assert.equal(restore.status, 200);
  const state = (await restore.json()).session;
  assert.equal(
    (
      await host.request('/api/recover', {
        generation: state.generation,
        recoveryCode: ada.recoveryCode,
      })
    ).status,
    200,
  );
});
