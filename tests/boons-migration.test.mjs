import test from 'node:test';
import assert from 'node:assert/strict';
import { startHost } from './host-helper.mjs';
import { readBackup, readSession, signBackup } from './skill-test-helper.mjs';

test('current schema restores an old schema16 payload without inventing a boon capability or copying stock', async (t) => {
  const host = await startHost();
  t.after(() => host.dispose());
  assert.equal((await readSession(host)).schemaVersion, 19);
  const backup = await readBackup(host),
    at = await readSession(host);
  backup.payload.state.schemaVersion = 16;
  signBackup(backup);
  const response = await host.request('/api/restores', {
    backup,
    generation: at.generation,
    expectedRevision: at.revision,
    confirmed: true,
  });
  assert.equal(response.status, 200, await response.text());
  const after = await readBackup(host);
  assert.equal(after.payload.state.schemaVersion, 19);
  assert.equal(after.payload.state.physical, null);
  assert.deepEqual(after.payload.commands, backup.payload.commands);
});
