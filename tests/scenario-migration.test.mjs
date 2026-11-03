import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { startHost } from './host-helper.mjs';
import {
  readyCompany,
  readSession,
  readBackup,
  startTest,
  signBackup,
} from './skill-test-helper.mjs';
import { command } from './preparation-helper.mjs';
import { readyMap, startMapTurn, travelIntent } from './travel-helper.mjs';
import { readyGenerator, generate, waitGeneration } from './map-generation-helper.mjs';
async function downgrade(host) {
  const b = await readBackup(host);
  b.payload.state.schemaVersion = 9;
  delete b.payload.state.scenario;
  signBackup(b);
  return b;
}
async function importInto(t, backup) {
  const host = await startHost();
  t.after(() => host.dispose());
  const s = await readSession(host);
  const r = await host.request('/api/restores', {
    backup,
    generation: s.generation,
    expectedRevision: s.revision,
    confirmed: true,
  });
  assert.equal(r.status, 200, await r.text());
  return host;
}
for (const moment of ['test', 'scout', 'travel'])
  test(`schema9 legacy ${moment}: avvio e backup preservano copie, turni e ricevute`, async (t) => {
    const { host, player } = moment === 'travel' ? await readyMap(t) : await readyCompany(t);
    if (moment === 'test') assert.equal((await startTest(host, player)).status, 200);
    if (moment === 'scout')
      assert.equal(
        (await command(host, player, { type: 'START_SCOUT', heroId: 'hero-1', count: 2 })).status,
        200,
      );
    if (moment === 'travel') {
      const s = await startMapTurn(host, player);
      assert.equal(
        (await command(host, player, { type: 'START_TRAVEL', ...travelIntent(s) })).status,
        200,
      );
    }
    const before = await readSession(host),
      old = await downgrade(host);
    await host.stop();
    const db = new DatabaseSync(join(host.dataDir, 'session.sqlite'));
    db.prepare('UPDATE session SET data=? WHERE id=1').run(JSON.stringify(old.payload.state));
    db.close();
    const restarted = await startHost({ LOTR_DATA_DIR: host.dataDir });
    t.after(() => restarted.stop());
    assert.deepEqual(await readSession(restarted), before);
    assert.deepEqual((await readBackup(restarted)).payload.commands, old.payload.commands);
    const destination = await importInto(t, old),
      after = await readSession(destination);
    for (const key of [
      'preparation',
      'scout',
      'skillTest',
      'journey',
      'round',
      'mapGeneration',
      'scenario',
    ])
      assert.deepEqual(after[key], before[key], key);
    assert.deepEqual((await readBackup(destination)).payload.commands, old.payload.commands);
  });
for (const status of ['pending', 'frozen'])
  test(`schema9 ${status}: il consumer resta assente senza perdere generazione/RNG/ricevute`, async (t) => {
    const { host, player } = await readyGenerator(t);
    const accepted = await generate(host, player);
    assert.equal(accepted.status, 200);
    let source = host;
    if (status === 'pending') {
      await host.stop('SIGKILL');
      source = await startHost({ LOTR_DATA_DIR: host.dataDir });
      t.after(() => source.stop());
    } else await waitGeneration(host);
    const before = await readSession(source);
    assert.equal(before.mapGeneration.status, status);
    const old = await downgrade(source),
      destination = await importInto(t, old),
      after = await readSession(destination);
    assert.equal(after.scenario, null);
    assert.deepEqual(after.mapGeneration, before.mapGeneration);
    assert.deepEqual(after.preparation, before.preparation);
    assert.deepEqual((await readBackup(destination)).payload.commands, old.payload.commands);
  });
