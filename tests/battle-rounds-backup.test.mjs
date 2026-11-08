import test from 'node:test';
import assert from 'node:assert/strict';
import { startHost } from './host-helper.mjs';
import { readBackup, readSession } from './battle-combat-helper.mjs';

test('phase backup transport accepts a bounded 5 MiB JSON body while ordinary commands retain 4 MiB and 17 MiB restores fail unchanged', async (t) => {
  const host = await startHost();
  t.after(() => host.dispose());
  const original = await readBackup(host),
    at = await readSession(host);
  const restore = JSON.stringify({
    backup: original,
    generation: at.generation,
    expectedRevision: at.revision,
    confirmed: true,
  });
  const send = (path, body) =>
    fetch(host.url + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', connection: 'close' },
      body,
    });
  const accepted = await send('/api/restores', ' '.repeat(5 * 1024 * 1024) + restore);
  assert.equal(accepted.status, 200);
  const after = (await readBackup(host)).payload,
    expected = structuredClone(original.payload);
  for (const key of ['generation', 'revision', 'updatedAt']) expected.state[key] = after.state[key];
  assert.deepEqual(after, expected);
  const command = await send('/api/players', ' '.repeat(5 * 1024 * 1024) + '{}');
  assert.equal(command.status, 413);
  assert.equal((await command.json()).error.code, 'TOO_LARGE');
  assert.deepEqual((await readBackup(host)).payload, after);
  const oversized = await send('/api/restores', ' '.repeat(17 * 1024 * 1024) + restore);
  assert.equal(oversized.status, 413);
  assert.equal((await oversized.json()).error.code, 'TOO_LARGE');
  assert.deepEqual((await readBackup(host)).payload, after);
});
