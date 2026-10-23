import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startHost, joinPlayer } from './host-helper.mjs';

test('la vista condivisa non occupa posti e possono entrare cinque giocatori', async t => {
  const host = await startHost();
  t.after(() => host.dispose());
  const initial = await (await host.request('/api/session')).json();
  assert.deepEqual(initial.players, []);
  for (const name of ['Ada', 'Bilbo', 'Ciro', 'Dora', 'Elio']) {
    const response = await joinPlayer(host, name);
    assert.equal(response.status, 201);
  }
  const full = await (await host.request('/api/session')).json();
  assert.deepEqual(full.players.map(player => player.name), ['Ada', 'Bilbo', 'Ciro', 'Dora', 'Elio']);
  const sixth = await joinPlayer(host, 'Frodo');
  assert.equal(sixth.status, 409);
  assert.equal(sixth.body.error.code, 'TABLE_FULL');
});
