import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { startHost, joinPlayer } from './host-helper.mjs';

test('il backup ripristina su un host vuoto partecipanti, esito e protezione dai reinvii', async (t) => {
  const original = await startHost();
  const destination = await startHost();
  t.after(async () => {
    await original.dispose();
    await destination.dispose();
  });
  const ada = await joinPlayer(original, 'Ada');
  const session = await (await original.request('/api/session')).json();
  const open = {
    type: 'OPEN_DEMO',
    requestId: randomUUID(),
    generation: session.generation,
    expectedDemoId: null,
  };
  const pending = (await (await original.request('/api/commands', open, ada.cookie)).json())
    .session;
  const command = {
    type: 'RESOLVE_DEMO',
    requestId: randomUUID(),
    generation: session.generation,
    demoId: pending.demo.id,
    choice: 'B',
    agreed: true,
  };
  const confirmed = await (await original.request('/api/commands', command, ada.cookie)).json();
  const response = await original.request('/api/backups', undefined, ada.cookie);
  assert.equal(response.status, 200);
  assert.ok(response.headers.get('content-disposition')?.includes('.json'));
  const backup = await response.json();
  const blank = await (await destination.request('/api/session')).json();
  const restored = await destination.request('/api/restores', {
    backup,
    generation: blank.generation,
    expectedRevision: blank.revision,
    confirmed: true,
  });
  assert.equal(restored.status, 200);
  const after = await (await destination.request('/api/session')).json();
  assert.deepEqual(after.players, confirmed.session.players);
  assert.deepEqual(after.demo, confirmed.session.demo);
  assert.notEqual(after.generation, session.generation);
  const recovery = await destination.request('/api/recover', {
    recoveryCode: ada.recoveryCode,
    generation: after.generation,
  });
  assert.equal(recovery.status, 200);
  const cookie = recovery.headers.get('set-cookie').split(';')[0];
  const stale = await destination.request('/api/commands', command, cookie);
  assert.equal(stale.status, 409);
  const replay = await destination.request(
    '/api/commands',
    { ...command, generation: after.generation },
    cookie,
  );
  assert.equal(replay.status, 200);
  assert.deepEqual((await replay.json()).receipt, confirmed.receipt);
  assert.deepEqual(await (await destination.request('/api/session')).json(), after);
});

test('file errati e conferme superate non sostituiscono il tavolo corrente', async (t) => {
  const host = await startHost();
  t.after(() => host.dispose());
  const ada = await joinPlayer(host, 'Ada');
  const before = await (await host.request('/api/session')).json();
  const backup = await (await host.request('/api/backups', undefined, ada.cookie)).json();
  const envelope = {
    generation: before.generation,
    expectedRevision: before.revision,
    confirmed: true,
  };
  for (const invalid of [
    { ...backup, formatVersion: 99 },
    { ...backup, checksum: '0'.repeat(64) },
    { unrelated: true },
  ]) {
    const response = await host.request(
      '/api/restores',
      { ...envelope, backup: invalid },
      ada.cookie,
    );
    assert.equal(response.status, 422);
    assert.deepEqual(await (await host.request('/api/session')).json(), before);
  }
  assert.equal(
    (await host.request('/api/restores', { ...envelope, backup, confirmed: false }, ada.cookie))
      .status,
    422,
  );
  await joinPlayer(host, 'Bilbo');
  const changed = await (await host.request('/api/session')).json();
  assert.equal(
    (await host.request('/api/restores', { ...envelope, backup }, ada.cookie)).status,
    409,
  );
  assert.deepEqual(await (await host.request('/api/session')).json(), changed);
  const restored = await host.request(
    '/api/restores',
    { ...envelope, expectedRevision: changed.revision, backup },
    ada.cookie,
  );
  assert.equal(restored.status, 200);
  assert.equal((await (await host.request('/api/me', undefined, ada.cookie)).json()).player, null);
});

test('esportazioni durante una conferma contengono sempre stato e ricevute della stessa revisione', async (t) => {
  const host = await startHost();
  t.after(() => host.dispose());
  const ada = await joinPlayer(host, 'Ada');
  const initial = await (await host.request('/api/session')).json();
  const pending = (
    await (
      await host.request(
        '/api/commands',
        {
          type: 'OPEN_DEMO',
          requestId: randomUUID(),
          generation: initial.generation,
          expectedDemoId: null,
        },
        ada.cookie,
      )
    ).json()
  ).session;
  const exports = Array.from({ length: 8 }, () =>
    host.request('/api/backups', undefined, ada.cookie),
  );
  const resolve = host.request(
    '/api/commands',
    {
      type: 'RESOLVE_DEMO',
      requestId: randomUUID(),
      generation: initial.generation,
      demoId: pending.demo.id,
      choice: 'A',
      agreed: true,
    },
    ada.cookie,
  );
  for (const response of await Promise.all(exports)) {
    const copy = await response.json();
    const { state, commands } = copy.payload;
    if (state.demo.choice === null) {
      assert.equal(state.revision, 2);
      assert.equal(commands.length, 1);
    } else {
      assert.equal(state.demo.choice, 'A');
      assert.equal(state.revision, 3);
      assert.equal(commands.length, 2);
    }
    assert.ok(commands.every((command) => command.receipt.appliedRevision <= state.revision));
  }
  assert.equal((await resolve).status, 200);
});
