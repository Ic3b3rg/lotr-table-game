import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { startHost, joinPlayer } from './host-helper.mjs';

test('tentativi ripetuti di recupero vengono limitati senza cambiare la sessione', async (t) => {
  const host = await startHost();
  t.after(() => host.dispose());
  await joinPlayer(host, 'Ada');
  const before = await (await host.request('/api/session')).json();
  let last;
  for (let attempt = 0; attempt < 35; attempt++)
    last = await host.request('/api/recover', {
      generation: before.generation,
      recoveryCode: 'F'.repeat(24),
    });
  assert.equal(last.status, 429);
  assert.deepEqual(await (await host.request('/api/session')).json(), before);
});

test('input non valido e richieste da un’altra origine non modificano il tavolo', async (t) => {
  const host = await startHost();
  t.after(() => host.dispose());
  const ada = await joinPlayer(host, 'Ada');
  const before = await (await host.request('/api/session')).json();
  assert.equal((await host.request('/api/players', { ...ada.input, name: '\u0000' })).status, 422);
  const crossOrigin = await fetch(host.url + '/api/recover', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://example.com' },
    body: JSON.stringify({ generation: before.generation, recoveryCode: ada.recoveryCode }),
  });
  assert.equal(crossOrigin.status, 403);
  const wrongHostStatus = await new Promise((resolve, reject) => {
    const request = httpRequest(
      host.url + '/api/session',
      { headers: { Host: 'example.com' } },
      (response) => {
        response.resume();
        resolve(response.statusCode);
      },
    );
    request.on('error', reject);
    request.end();
  });
  assert.equal(wrongHostStatus, 403);
  assert.deepEqual(await (await host.request('/api/session')).json(), before);
});
