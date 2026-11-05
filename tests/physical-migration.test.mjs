import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { readyScenario, startScenario } from './scenario-helper.mjs';
import { readSession, readBackup, signBackup } from './skill-test-helper.mjs';
import { startHost } from './host-helper.mjs';

test('schema10 pending scenario migrates and imports intact without retroactive physical initialization', async (t) => {
  const { host, player } = await readyScenario(t);
  assert.equal((await startScenario(host, player)).status, 200);
  const before = await readSession(host),
    backup = await readBackup(host);
  backup.payload.state.schemaVersion = 10;
  delete backup.payload.state.physical;
  signBackup(backup);
  await host.stop();
  const db = new DatabaseSync(join(host.dataDir, 'session.sqlite'));
  db.prepare('UPDATE session SET data=? WHERE id=1').run(JSON.stringify(backup.payload.state));
  db.close();
  const restarted = await startHost({ LOTR_DATA_DIR: host.dataDir });
  t.after(() => restarted.stop());
  assert.deepEqual(await readSession(restarted), before);
  assert.equal((await readSession(restarted)).physical, null);
  assert.deepEqual((await readBackup(restarted)).payload.commands, backup.payload.commands);
  const destination = await startHost();
  t.after(() => destination.dispose());
  const s = await readSession(destination),
    r = await destination.request('/api/restores', {
      backup,
      generation: s.generation,
      expectedRevision: s.revision,
      confirmed: true,
    });
  assert.equal(r.status, 200, await r.text());
  const imported = await readSession(destination);
  assert.equal(imported.schemaVersion, 24);
  assert.equal(imported.physical, null);
  for (const key of [
    'scenario',
    'mapGeneration',
    'preparation',
    'scout',
    'skillTest',
    'journey',
    'round',
  ])
    assert.deepEqual(imported[key], before[key]);
  assert.deepEqual((await readBackup(destination)).payload.commands, backup.payload.commands);
});
