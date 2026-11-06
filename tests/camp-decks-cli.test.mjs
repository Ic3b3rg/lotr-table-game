import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, stat, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { source, refreshChoices, seed } from './fixtures/camp-decks.mjs';
const cli = resolve('dist/camp-decks.mjs');
const run = (...args) =>
  new Promise((done, reject) => {
    const p = spawn(process.execPath, [cli, ...args]);
    let stdout = '',
      stderr = '';
    p.stdout.on('data', (b) => (stdout += b));
    p.stderr.on('data', (b) => (stderr += b));
    p.on('error', reject);
    p.on('close', (code) => done({ code, stdout, stderr }));
  });
async function workspace(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'lotr-camp-decks-test-'));
  try {
    const input = join(dir, 'source.json');
    await writeFile(input, JSON.stringify(source()));
    await fn({ dir, input, output: join(dir, 'output.json') });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
test('camp CLI materializes and verifies a private0600 file with trusted pins', () =>
  workspace(async ({ dir, input, output }) => {
    const r = await run('materialize', '--input', input, '--output', output, '--seed', seed);
    assert.equal(r.code, 0, r.stderr);
    assert.equal((await stat(output)).mode & 0o777, 0o600);
    const a = JSON.parse(await readFile(output, 'utf8'));
    assert.equal(r.stdout.includes(seed), false);
    const report = join(dir, 'verify.json');
    const v = await run(
      'verify',
      '--input',
      output,
      '--output',
      report,
      '--expect-source',
      a.sourceFingerprint,
      '--expect-realization',
      a.realizationFingerprint,
      '--expect-artifact',
      a.artifactFingerprint,
    );
    assert.equal(v.code, 0, v.stderr);
    assert.equal(JSON.parse(await readFile(report, 'utf8')).valid, true);
    assert.equal((await stat(report)).mode & 0o777, 0o600);
  }));
test('camp CLI capability succeeds and legitimate gate exits2 with diagnostic preserved', () =>
  workspace(async ({ dir, input, output }) => {
    assert.equal((await run('capability', '--input', input, '--output', output)).code, 0);
    const s = source();
    s.capability.cards.find(
      (c) => c.kind === 'role' && c.ownerId === s.campaign.heroes[0].roleId,
    ).identity = 'requires-content';
    refreshChoices(s);
    await writeFile(input, JSON.stringify(s));
    for (const command of ['capability', 'materialize']) {
      const out = join(dir, `${command}.json`);
      const r = await run(
        command,
        '--input',
        input,
        '--output',
        out,
        ...(command === 'materialize' ? ['--seed', seed] : []),
      );
      assert.equal(r.code, 2, r.stderr);
      const doc = JSON.parse(await readFile(out, 'utf8'));
      assert.equal((doc.capability ?? doc).enabled, false);
      if (command === 'materialize') assert.equal(doc.entropyDraws, 0);
      assert.equal((await stat(out)).mode & 0o777, 0o600);
    }
  }));
test('camp CLI invalid commands, options, inputs and pins exit1 without publication', () =>
  workspace(async ({ dir, input, output }) => {
    const invalid = [
      ['wrong'],
      ['materialize', '--seed', seed, '--seed', seed],
      ['materialize'],
      ['capability', '--seed', seed],
      ['materialize', '--seed', 'bad'],
      ['verify', '--seed', seed],
      ['capability', '--expect-source', 'ab'.repeat(32)],
      ['capability', '--unknown', 'x'],
      ['materialize', '--seed', seed, 'positional'],
    ];
    for (const args of invalid) {
      const [command, ...options] = args;
      const r = await run(command, '--input', input, '--output', output, ...options);
      assert.equal(r.code, 1, JSON.stringify(args));
      assert.equal((await readdir(dir)).includes('output.json'), false);
    }
    await writeFile(input, '{');
    assert.equal((await run('capability', '--input', input, '--output', output)).code, 1);
    await writeFile(input, Buffer.from([0xff]));
    assert.equal((await run('capability', '--input', input, '--output', output)).code, 1);
    await writeFile(input, JSON.stringify(source()));
    const artifact = join(dir, 'artifact.json');
    assert.equal(
      (await run('materialize', '--input', input, '--output', artifact, '--seed', seed)).code,
      0,
    );
    assert.equal(
      (
        await run(
          'verify',
          '--input',
          artifact,
          '--output',
          output,
          '--expect-realization',
          'ab'.repeat(32),
        )
      ).code,
      1,
    );
    assert.equal((await readdir(dir)).includes('output.json'), false);
  }));
test('camp CLI never overwrites an existing file, including a gated diagnostic', () =>
  workspace(async ({ input, output }) => {
    await writeFile(output, 'existing-private-data', { mode: 0o600 });
    const r = await run('materialize', '--input', input, '--output', output, '--seed', seed);
    assert.equal(r.code, 1);
    assert.equal(await readFile(output, 'utf8'), 'existing-private-data');
    const s = source();
    s.campaign.heroes[0].roleId = null;
    refreshChoices(s);
    await writeFile(input, JSON.stringify(s));
    assert.equal((await run('capability', '--input', input, '--output', output)).code, 1);
    assert.equal(await readFile(output, 'utf8'), 'existing-private-data');
  }));
test('concurrent camp CLI publishers produce one complete output and clean staged files', () =>
  workspace(async ({ dir, input, output }) => {
    const results = await Promise.all([
      run('materialize', '--input', input, '--output', output, '--seed', seed),
      run('materialize', '--input', input, '--output', output, '--seed', '34'.repeat(32)),
    ]);
    assert.deepEqual(results.map((r) => r.code).sort(), [0, 1]);
    assert.equal((await stat(output)).mode & 0o777, 0o600);
    assert.equal(JSON.parse(await readFile(output, 'utf8')).format, 'camp-decks-artifact-v1');
    assert.deepEqual((await readdir(dir)).sort(), ['output.json', 'source.json']);
  }));
test('camp CLI rejects expanded artifact over budget and oversized input without partial files', () =>
  workspace(async ({ dir, input, output }) => {
    const s = source();
    s.campaign.provenance.history = Array(60000).fill('invented');
    await writeFile(input, JSON.stringify(s));
    assert.equal(
      (await run('materialize', '--input', input, '--output', output, '--seed', seed)).code,
      1,
    );
    assert.deepEqual(await readdir(dir), ['source.json']);
    await writeFile(input, ' '.repeat(8 * 1024 * 1024 + 1));
    assert.equal((await run('capability', '--input', input, '--output', output)).code, 1);
    assert.deepEqual(await readdir(dir), ['source.json']);
  }));
