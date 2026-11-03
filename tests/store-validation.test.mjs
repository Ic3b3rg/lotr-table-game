import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { readyCycle, cycleCommand } from './physical-cycle-helper.mjs';

test('validated Store reads are isolated and revalidate any persisted state or receipt change', async (t) => {
  const ready = await readyCycle(t);
  assert.equal((await cycleCommand(ready, 'START_TURN')).status, 200);
  await ready.host.stop();
  const dir = await mkdtemp(join(tmpdir(), 'lotr-store-validation-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const outfile = join(dir, 'store.mjs');
  await build({
    stdin: { resolveDir: process.cwd(), contents: "export {Store} from './src/server/store.ts';" },
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
    logLevel: 'silent',
  });
  const { Store } = await import(pathToFileURL(outfile).href),
    store = new Store(ready.host.dataDir);
  t.after(() => store.close());
  const original = store.read(),
    again = store.read();
  again.preparation.heroes[0].inspiration = 99;
  assert.deepEqual(store.read(), original, 'a caller cannot mutate the saved validation result');
  const db = new DatabaseSync(join(ready.host.dataDir, 'session.sqlite'));
  t.after(() => db.close());
  const raw = db.prepare('SELECT data FROM session WHERE id=1').get().data;
  const changed = JSON.parse(raw);
  changed.physical.snapshot.resolution.faceup = [];
  db.prepare('UPDATE session SET data=? WHERE id=1').run(JSON.stringify(changed));
  assert.throws(() => store.read(), 'changed state must replay again');
  db.prepare('UPDATE session SET data=? WHERE id=1').run(raw);
  assert.deepEqual(store.read(), original);
  const row = db.prepare("SELECT * FROM commands WHERE result LIKE '%START_TURN%'").get();
  db.prepare('UPDATE commands SET fingerprint=? WHERE request_id=?').run(
    '0'.repeat(64),
    row.request_id,
  );
  assert.throws(
    () => store.read(),
    'changed receipts must replay again even when state bytes match',
  );
  db.prepare('UPDATE commands SET fingerprint=? WHERE request_id=?').run(
    row.fingerprint,
    row.request_id,
  );
  assert.deepEqual(store.read(), original);
});
