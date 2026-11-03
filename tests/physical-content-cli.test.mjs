import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { spawnSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, readFile, rm, stat, link, symlink, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { physicalPack } from './fixtures/physical-content.mjs';

const cli = new URL('../dist/physical-content.mjs', import.meta.url).pathname;
const run = (args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
async function files(t, content = JSON.stringify(physicalPack())) {
  const dir = await mkdtemp(join(tmpdir(), 'lotr-physical-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const input = join(dir, 'input.json');
  const output = join(dir, 'output.json');
  await writeFile(input, content);
  return { dir, input, output, args: ['--input', input, '--output', output] };
}

test('CLI pubblica catalogo verificato e hash dei byte esatti senza toccare input', async (t) => {
  const content = `\n${JSON.stringify(physicalPack(), null, 2)}\n`;
  const f = await files(t, content);
  const r = run(f.args);
  assert.equal(r.status, 0, r.stderr);
  const output = JSON.parse(await readFile(f.output, 'utf8'));
  assert.equal(output.status, 'verified');
  assert.equal(output.catalog.cards.length, 60);
  assert.equal(output.inputFileFingerprint, createHash('sha256').update(content).digest('hex'));
  assert.equal(await readFile(f.input, 'utf8'), content);
  assert.equal((await stat(f.output)).mode & 0o777, 0o600);
  assert.deepEqual((await readdir(f.dir)).sort(), ['input.json', 'output.json']);
});

test('CLI diagnostico exit 2 non contiene proprietà catalog', async (t) => {
  const p = physicalPack();
  p.cards[0].text.status = 'conflict';
  p.cards[0].text.note = 'Fonti discordanti.';
  const f = await files(t, JSON.stringify(p));
  const r = run(f.args);
  assert.equal(r.status, 2, r.stderr);
  const output = JSON.parse(await readFile(f.output, 'utf8'));
  assert.equal(output.status, 'diagnostic');
  assert.equal('catalog' in output, false);
  assert.equal(output.coverage[1].complete, true);
});

for (const alias of ['existing', 'input', 'hardlink', 'symlink'])
  test(`CLI preserva output ${alias} e input`, async (t) => {
    const f = await files(t);
    const before = await readFile(f.input);
    if (alias === 'existing') await writeFile(f.output, 'ORIGINAL OUTPUT');
    if (alias === 'input') f.output = f.input;
    if (alias === 'hardlink') await link(f.input, f.output);
    if (alias === 'symlink') await symlink(f.input, f.output);
    const outputBefore = await readFile(f.output);
    const r = run(['--input', f.input, '--output', f.output]);
    assert.equal(r.status, 1);
    assert.deepEqual(await readFile(f.input), before);
    assert.deepEqual(await readFile(f.output), outputBefore);
    assert.deepEqual(
      (await readdir(f.dir)).sort(),
      alias === 'input' ? ['input.json'] : ['input.json', 'output.json'],
    );
  });

test('due pubblicazioni concorrenti hanno un solo vincitore e file completo', async (t) => {
  const f = await files(t);
  const execute = promisify(execFile);
  const results = await Promise.allSettled([
    execute(process.execPath, [cli, ...f.args]),
    execute(process.execPath, [cli, ...f.args]),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter((r) => r.status === 'rejected' && r.reason.code === 1).length, 1);
  const output = JSON.parse(await readFile(f.output, 'utf8'));
  assert.equal(output.status, 'verified');
  assert.equal(output.catalog.cards.length, 60);
  assert.deepEqual((await readdir(f.dir)).sort(), ['input.json', 'output.json']);
});

for (const [name, content] of [
  ['JSON malformato', '{'],
  ['UTF-8 malformato', Buffer.from([0xc3, 0x28])],
  ['versione sconosciuta', JSON.stringify({ ...physicalPack(), formatVersion: 9 })],
  ['riferimento invalido', JSON.stringify({ ...physicalPack(), sources: [] })],
  ['file oltre 8 MiB', Buffer.alloc(8 * 1024 * 1024 + 1, 32)],
])
  test(`CLI rifiuta ${name} senza output`, async (t) => {
    const f = await files(t, content);
    const before = await readFile(f.input);
    const r = run(f.args);
    assert.equal(r.status, 1);
    assert.ok(r.stderr.length > 0);
    await assert.rejects(stat(f.output), { code: 'ENOENT' });
    assert.deepEqual(await readFile(f.input), before);
  });

test('CLI rifiuta opzioni mancanti, duplicate, sconosciute, posizionali e input non file', async (t) => {
  const f = await files(t);
  for (const args of [
    [],
    ['--input', f.input],
    [...f.args, '--input', f.input],
    [...f.args, '--extra'],
    [...f.args, 'extra'],
    ['--input', f.dir, '--output', f.output],
  ]) {
    const r = run(args);
    assert.equal(r.status, 1);
    await assert.rejects(stat(f.output), { code: 'ENOENT' });
  }
});
