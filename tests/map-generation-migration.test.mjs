import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { startHost } from './host-helper.mjs';
import {
  readBackup,
  readSession,
  readyCompany,
  signBackup,
  startTest,
} from './skill-test-helper.mjs';
import { command } from './preparation-helper.mjs';
import { readyMap, startMapTurn, travelIntent } from './travel-helper.mjs';
for (const moment of ['prova', 'Scoperta', 'viaggio'])
  test(`schema8 ${moment}: migrazione e import conservano mazzi, richieste e ricevute`, async (t) => {
    const { host, player } = moment === 'viaggio' ? await readyMap(t) : await readyCompany(t);
    if (moment === 'prova') assert.equal((await startTest(host, player)).status, 200);
    if (moment === 'Scoperta')
      assert.equal(
        (await command(host, player, { type: 'START_SCOUT', heroId: 'hero-1', count: 3 })).status,
        200,
      );
    if (moment === 'viaggio') {
      const s = await startMapTurn(host, player);
      assert.equal(
        (await command(host, player, { type: 'START_TRAVEL', ...travelIntent(s) })).status,
        200,
      );
    }
    const backup = await readBackup(host),
      before = await readSession(host);
    backup.payload.state.schemaVersion = 8;
    delete backup.payload.state.mapGeneration;
    delete backup.payload.state.scenario;
    delete backup.payload.state.physical;
    signBackup(backup);
    await host.stop();
    const db = new DatabaseSync(join(host.dataDir, 'session.sqlite'));
    db.prepare('UPDATE session SET data=? WHERE id=1').run(JSON.stringify(backup.payload.state));
    db.close();
    const restarted = await startHost({ LOTR_DATA_DIR: host.dataDir });
    t.after(() => restarted.stop());
    const migrated = await readSession(restarted);
    assert.deepEqual(migrated, { ...before, schemaVersion: 27, mapGeneration: null });
    assert.deepEqual((await readBackup(restarted)).payload.commands, backup.payload.commands);
    const destination = await startHost();
    t.after(() => destination.dispose());
    const blank = await readSession(destination);
    assert.equal(
      (
        await destination.request('/api/restores', {
          backup,
          generation: blank.generation,
          expectedRevision: blank.revision,
          confirmed: true,
        })
      ).status,
      200,
    );
    const after = await readSession(destination);
    for (const key of [
      'players',
      'preparation',
      'scout',
      'skillTest',
      'journey',
      'round',
      'mapGeneration',
    ])
      assert.deepEqual(after[key], migrated[key]);
    assert.deepEqual((await readBackup(destination)).payload.commands, backup.payload.commands);
  });
