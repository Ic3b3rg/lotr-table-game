import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { joinPlayer } from './host-helper.mjs';
import { setup, command } from './preparation-helper.mjs';
import { catalogFixture } from './fixtures/catalog.mjs';

test('un solitario sceglie fino a quattro eroi e può cambiare ruolo e oggetti prima di preparare', async (t) => {
  const host = await setup(t);
  const ada = await joinPlayer(host, 'Ada');
  for (const heroIds of [
    ['hero-1', 'hero-2'],
    ['hero-1', 'hero-2', 'hero-3'],
    ['hero-1', 'hero-2', 'hero-3', 'hero-4'],
  ]) {
    const response = await command(host, ada, { type: 'SELECT_HEROES', heroIds });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.session.preparation.heroes.length, heroIds.length);
    assert.ok(
      result.session.preparation.heroes.every((hero) => hero.playerId === ada.body.player.id),
    );
  }
  const response = await command(host, ada, {
    type: 'CONFIGURE_HERO',
    heroId: 'hero-1',
    roleId: 'role-6',
    itemCopies: ['bow:1', 'armor:1'],
  });
  assert.equal(response.status, 200);
  const hero = (await response.json()).session.preparation.heroes.find(
    (h) => h.heroId === 'hero-1',
  );
  assert.equal(hero.roleId, 'role-6');
  assert.deepEqual(hero.itemCopies, ['bow:1', 'armor:1']);
  const before = await (await host.request('/api/session')).json();
  const recovered = await host.request('/api/recover', {
    recoveryCode: ada.recoveryCode,
    generation: before.generation,
  });
  assert.equal(recovered.status, 200);
  assert.deepEqual(await (await host.request('/api/session')).json(), before);
});

test('cinque partecipanti controllano eroi distinti e un ingresso non cancella una selezione solitaria', async (t) => {
  const host = await setup(t);
  const players = [await joinPlayer(host, 'Ada')];
  assert.equal(
    (await command(host, players[0], { type: 'SELECT_HEROES', heroIds: ['hero-1', 'hero-2'] }))
      .status,
    200,
  );
  players.push(await joinPlayer(host, 'Berto'));
  assert.equal((await (await host.request('/api/session')).json()).preparation.heroes.length, 2);
  assert.equal(
    (await command(host, players[0], { type: 'SELECT_HEROES', heroIds: ['hero-1'] })).status,
    200,
  );
  for (const name of ['Ciro', 'Dora', 'Elio']) players.push(await joinPlayer(host, name));
  for (let i = 1; i < 5; i++)
    assert.equal(
      (await command(host, players[i], { type: 'SELECT_HEROES', heroIds: [`hero-${i + 1}`] }))
        .status,
      200,
    );
  const state = await (await host.request('/api/session')).json();
  assert.equal(state.preparation.heroes.length, 5);
  assert.equal(new Set(state.preparation.heroes.map((hero) => hero.heroId)).size, 5);
  const invalid = await command(host, players[1], {
    type: 'CONFIGURE_HERO',
    heroId: 'hero-1',
    roleId: 'role-6',
    itemCopies: [],
  });
  assert.equal(invalid.status, 403);
  assert.deepEqual(await (await host.request('/api/session')).json(), state);
});

test('stesso eroe, ruolo o ultima copia non possono essere assegnati da due telefoni', async (t) => {
  const host = await setup(t);
  const ada = await joinPlayer(host, 'Ada');
  const bob = await joinPlayer(host, 'Bob');
  const state = await (await host.request('/api/session')).json();
  const results = await Promise.all(
    [ada, bob].map((p) => command(host, p, { type: 'SELECT_HEROES', heroIds: ['hero-1'] }, state)),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  const owner = results[0].status === 200 ? ada : bob;
  const other = owner === ada ? bob : ada;
  assert.equal(
    (await command(host, other, { type: 'SELECT_HEROES', heroIds: ['hero-2'] })).status,
    200,
  );
  assert.equal(
    (
      await command(host, other, {
        type: 'CONFIGURE_HERO',
        heroId: 'hero-2',
        roleId: 'role-1',
        itemCopies: [],
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await command(host, owner, {
        type: 'CONFIGURE_HERO',
        heroId: 'hero-1',
        roleId: 'role-1',
        itemCopies: ['sword:1', 'shield:1'],
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await command(host, other, {
        type: 'CONFIGURE_HERO',
        heroId: 'hero-2',
        roleId: 'role-2',
        itemCopies: ['shield:1'],
      })
    ).status,
    409,
  );
});

test('rango, mani, armatura e riferimenti errati vengono rifiutati senza aggiornamenti parziali', async (t) => {
  const host = await setup(t);
  const ada = await joinPlayer(host, 'Ada');
  await command(host, ada, { type: 'SELECT_HEROES', heroIds: ['hero-1', 'hero-2'] });
  const before = await (await host.request('/api/session')).json();
  for (const itemCopies of [
    ['advanced:1'],
    ['bow:1', 'shield:1'],
    ['armor:1', 'rare-armor:1'],
    ['trinket:1'],
    ['sword:6'],
    ['missing:1'],
    ['sword:1', 'sword:1'],
  ]) {
    assert.equal(
      (
        await command(host, ada, {
          type: 'CONFIGURE_HERO',
          heroId: 'hero-1',
          roleId: 'role-1',
          itemCopies,
        })
      ).status,
      409,
    );
    assert.deepEqual(await (await host.request('/api/session')).json(), before);
  }
  const intent = {
    type: 'CONFIGURE_HERO',
    requestId: randomUUID(),
    heroId: 'hero-1',
    roleId: 'role-6',
    itemCopies: [],
  };
  assert.equal((await command(host, ada, intent, before)).status, 200);
  const after = await (await host.request('/api/session')).json();
  assert.equal((await command(host, ada, intent, before)).status, 200);
  assert.equal((await command(host, ada, { ...intent, roleId: 'role-5' }, before)).status, 409);
  assert.deepEqual(await (await host.request('/api/session')).json(), after);
});

test('aggiungere un eroe prima di uno già configurato conserva le sue copie riservate', async (t) => {
  const host = await setup(t);
  const ada = await joinPlayer(host, 'Ada');
  assert.equal(
    (await command(host, ada, { type: 'SELECT_HEROES', heroIds: ['hero-1'] })).status,
    200,
  );
  assert.equal(
    (await command(host, ada, { type: 'SELECT_HEROES', heroIds: ['hero-2', 'hero-1'] })).status,
    200,
  );
  const heroes = (await (await host.request('/api/session')).json()).preparation.heroes;
  assert.deepEqual(heroes.find((hero) => hero.heroId === 'hero-1').itemCopies, [
    'sword:1',
    'armor:1',
  ]);
  assert.deepEqual(heroes.find((hero) => hero.heroId === 'hero-2').itemCopies, [
    'sword:2',
    'armor:2',
  ]);
});

test('il limite individuale di una mano impedisce di assegnare una seconda mano o un’arma a due mani', async (t) => {
  const catalog = catalogFixture();
  catalog.heroes[2].maxHands = 1;
  const host = await setup(t, catalog);
  const ada = await joinPlayer(host, 'Ada');
  assert.equal(
    (await command(host, ada, { type: 'SELECT_HEROES', heroIds: ['hero-3', 'hero-4'] })).status,
    200,
  );
  const before = await (await host.request('/api/session')).json();
  for (const itemCopies of [['bow:1'], ['sword:1', 'shield:1']]) {
    const response = await command(host, ada, {
      type: 'CONFIGURE_HERO',
      heroId: 'hero-3',
      roleId: 'role-3',
      itemCopies,
    });
    assert.equal(response.status, 409);
    assert.deepEqual(await (await host.request('/api/session')).json(), before);
  }
});
