import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { startHost, joinPlayer } from './host-helper.mjs';

test('due telefoni confermano una scelta concordata una sola volta', async t => {
  const host = await startHost();
  t.after(() => host.dispose());
  const ada = await joinPlayer(host, 'Ada');
  const bilbo = await joinPlayer(host, 'Bilbo');
  const session = await (await host.request('/api/session')).json();
  const opened = await host.request('/api/commands', { type: 'OPEN_DEMO', requestId: randomUUID(), generation: session.generation, expectedDemoId: null }, ada.cookie);
  assert.equal(opened.status, 200);
  const { session: pending } = await opened.json();
  const base = { type: 'RESOLVE_DEMO', generation: session.generation, demoId: pending.demo.id, agreed: true };
  const responses = await Promise.all([
    host.request('/api/commands', { ...base, requestId: randomUUID(), choice: 'A' }, ada.cookie),
    host.request('/api/commands', { ...base, requestId: randomUUID(), choice: 'B' }, bilbo.cookie),
  ]);
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
  const resolved = await (await host.request('/api/session')).json();
  assert.equal(resolved.revision, pending.revision + 1);
  assert.ok(['A', 'B'].includes(resolved.demo.choice));
  assert.ok([ada.body.player.id, bilbo.body.player.id].includes(resolved.demo.resolvedBy));
});

test('il reinvio dopo riavvio ripete la ricevuta, senza applicarsi a una nuova richiesta', async t => {
  const first = await startHost();
  let host = first;
  t.after(async () => { await host.stop(); await first.dispose(); });
  const ada = await joinPlayer(host, 'Ada');
  const initial = await (await host.request('/api/session')).json();
  const open = await host.request('/api/commands', { type: 'OPEN_DEMO', requestId: randomUUID(), generation: initial.generation, expectedDemoId: null }, ada.cookie);
  const { session: pending } = await open.json();
  const command = { type: 'RESOLVE_DEMO', generation: initial.generation, requestId: randomUUID(), demoId: pending.demo.id, choice: 'A', agreed: true };
  // Discard the response: the caller does not learn its receipt before restart.
  assert.equal((await host.request('/api/commands', command, ada.cookie)).status, 200);
  await host.stop('SIGKILL');
  host = await startHost({ LOTR_DATA_DIR: first.dataDir });
  const retries = await Promise.all([
    host.request('/api/commands', command, ada.cookie),
    host.request('/api/commands', command, ada.cookie),
  ]);
  const receipts = await Promise.all(retries.map(response => response.json()));
  assert.deepEqual(receipts[0].receipt, receipts[1].receipt);
  assert.equal(receipts[0].receipt.appliedRevision, pending.revision + 1);
  const another = await host.request('/api/commands', { type: 'OPEN_DEMO', requestId: randomUUID(), generation: initial.generation, expectedDemoId: pending.demo.id }, ada.cookie);
  const { session: next } = await another.json();
  assert.equal(next.demo.choice, null);
  assert.notEqual(next.demo.id, pending.demo.id);
  assert.equal((await host.request('/api/commands', command, ada.cookie)).status, 200);
  const stale = await host.request('/api/commands', { ...command, requestId: randomUUID() }, ada.cookie);
  assert.equal(stale.status, 409);
  const changed = await host.request('/api/commands', { ...command, choice: 'B' }, ada.cookie);
  assert.equal(changed.status, 409);
  assert.deepEqual(await (await host.request('/api/session')).json(), next);
});

test('solo un partecipante può confermare e la prova richiede la scelta concordata dal gruppo', async t => {
  const host = await startHost();
  t.after(() => host.dispose());
  const ada = await joinPlayer(host, 'Ada');
  const before = await (await host.request('/api/session')).json();
  const command = { type: 'OPEN_DEMO', requestId: randomUUID(), generation: before.generation, expectedDemoId: null };
  assert.equal((await host.request('/api/commands', command)).status, 401);
  const pending = (await (await host.request('/api/commands', command, ada.cookie)).json()).session;
  const unagreed = { type: 'RESOLVE_DEMO', requestId: randomUUID(), generation: before.generation, demoId: pending.demo.id, choice: 'A', agreed: false };
  assert.equal((await host.request('/api/commands', unagreed, ada.cookie)).status, 422);
  assert.deepEqual(await (await host.request('/api/session')).json(), pending);
});
