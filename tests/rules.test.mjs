import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, symlink, truncate, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startHost } from './host-helper.mjs';

test('guida dichiara i PDF assenti e serve soltanto documenti locali esplicitamente consentiti', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'lotr-rules-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const host = await startHost({ LOTR_RULES_DIR: directory });
  t.after(() => host.dispose());
  const r = await host.request('/api/rules');
  assert.equal(r.status, 200);
  const manifest = await r.json();
  assert.equal(manifest.length, 4);
  assert.ok(manifest.every((doc) => !doc.available));
  const pdf = Buffer.from('%PDF-1.7\nLocal invented test document\n%%EOF');
  await writeFile(join(directory, 'manuale-gioco-it.pdf'), pdf);
  const document = await host.request('/api/rules/manual');
  assert.equal(document.status, 200);
  assert.equal(document.headers.get('content-type'), 'application/pdf');
  assert.deepEqual(Buffer.from(await document.arrayBuffer()), pdf);
  // The supplied corrected-card PDF is about 42 MB. Keep that real installation usable.
  const corrections = join(directory, 'carte-corrette-it.pdf');
  await writeFile(corrections, pdf);
  await truncate(corrections, 45_000_000);
  assert.equal(
    (await (await host.request('/api/rules')).json()).find((doc) => doc.id === 'corrections')
      .available,
    true,
  );
  const largeDocument = await host.request('/api/rules/corrections');
  assert.equal(largeDocument.status, 200);
  assert.equal((await largeDocument.arrayBuffer()).byteLength, 45_000_000);
  assert.equal(
    (await (await host.request('/api/rules')).json()).find((doc) => doc.id === 'manual').available,
    true,
  );
  await writeFile(join(directory, 'unlisted.pdf'), pdf);
  assert.equal((await host.request('/api/rules/unlisted.pdf')).status, 404);
  assert.equal((await host.request('/api/rules/%2e%2e%2fsecret.pdf')).status, 404);
  await writeFile(join(directory, 'manuale-gioco-it.pdf'), 'not a PDF');
  assert.equal((await host.request('/api/rules/manual')).status, 404);
});

test('i documenti locali non seguono symlink fuori dalla cartella né file troppo grandi', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'lotr-rules-'));
  const outside = await mkdtemp(join(tmpdir(), 'lotr-rules-outside-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await writeFile(join(outside, 'manual.pdf'), '%PDF-1.7\n');
  await symlink(join(outside, 'manual.pdf'), join(directory, 'manuale-gioco-it.pdf'));
  const host = await startHost({ LOTR_RULES_DIR: directory });
  t.after(() => host.dispose());
  assert.equal((await host.request('/api/rules/manual')).status, 404);
  await writeFile(join(directory, 'rules-reference-en.pdf'), '%PDF-1.7\n');
  await truncate(join(directory, 'rules-reference-en.pdf'), 64_000_001);
  assert.equal((await host.request('/api/rules/reference')).status, 404);
});
