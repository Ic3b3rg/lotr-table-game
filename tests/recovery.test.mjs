import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startHost, joinPlayer } from './host-helper.mjs';

test('una conferma di ingresso sopravvive a un arresto improvviso e il codice recupera lo stesso posto', async t => {
  const first = await startHost();
  let current = first;
  t.after(async () => { await current.stop(); await first.dispose(); });
  const player = await joinPlayer(first, 'Ada');
  assert.equal(player.status, 201);
  const before = await (await first.request('/api/session')).json();
  await first.stop('SIGKILL');
  current = await startHost({ LOTR_DATA_DIR: first.dataDir });
  const after = await (await current.request('/api/session')).json();
  assert.deepEqual(after, before);
  const me = await (await current.request('/api/me', undefined, player.cookie)).json();
  assert.equal(me.player.id, player.body.player.id);
  const recovered = await current.request('/api/recover', { recoveryCode: player.recoveryCode.toLowerCase(), generation: after.generation });
  assert.equal(recovered.status, 200);
  assert.equal((await recovered.json()).player.id, player.body.player.id);
  assert.ok(recovered.headers.get('set-cookie')?.includes('HttpOnly'));
  assert.ok(recovered.headers.get('set-cookie')?.includes('SameSite=Strict'));
  assert.equal(JSON.stringify(after).includes(player.recoveryCode), false);
  assert.equal(JSON.stringify(after).includes('recoveryHash'), false);
});

test('recuperare a tavolo pieno e ripetere un ingresso non aggiunge giocatori', async t => {
  const host = await startHost();
  t.after(() => host.dispose());
  const first = await joinPlayer(host, 'Ada');
  for (const name of ['Ada', 'Ciro', 'Dora', 'Elio']) assert.equal((await joinPlayer(host, name)).status, 201);
  const replay = await host.request('/api/players', first.input);
  assert.equal(replay.status, 201);
  assert.equal((await replay.json()).player.id, first.body.player.id);
  const before = await (await host.request('/api/session')).json();
  const invalid = await host.request('/api/recover', { recoveryCode: 'F'.repeat(24), generation: before.generation });
  assert.equal(invalid.status, 401);
  const recovered = await host.request('/api/recover', { recoveryCode: first.recoveryCode, generation: before.generation });
  assert.equal(recovered.status, 200);
  assert.equal((await recovered.json()).player.id, first.body.player.id);
  const after = await (await host.request('/api/session')).json();
  assert.deepEqual(after, before);
  const changedIntent = await host.request('/api/players', { ...first.input, name: 'Altro nome' });
  assert.equal(changedIntent.status, 409);
});

test('un cookie malformato non provoca un errore del server o accesso a un giocatore', async t => {
  const host = await startHost();
  t.after(() => host.dispose());
  const player = await joinPlayer(host, 'Ada');
  const malformed = `lotr-seat=${player.body.player.id}.${'é'.repeat(43)}`;
  const response = await host.request('/api/me', undefined, malformed);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).player, null);
});
