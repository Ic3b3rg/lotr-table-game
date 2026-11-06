import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, stat, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { battleSource } from './fixtures/battle-map.mjs';
import { verifyBattleMapArtifact } from '../dist/battle-map-library.mjs';
const cli = 'dist/battle-map.mjs';
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
async function setup(t) {
  const dir = await mkdtemp(join(tmpdir(), 'battle-map-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const input = join(dir, 'source.json'),
    output = join(dir, 'artifact.json');
  await writeFile(input, JSON.stringify(battleSource()));
  return { dir, input, output };
}

test('CLI compile and pinned verify persist private snapshots without touching source', async (t) => {
  const { dir, input, output } = await setup(t),
    before = await readFile(input);
  const compiled = run('compile', '--input', input, '--output', output);
  assert.equal(compiled.status, 0, compiled.stderr);
  assert.equal((await stat(output)).mode & 0o777, 0o600);
  const a = verifyBattleMapArtifact(JSON.parse(await readFile(output, 'utf8')));
  const report = join(dir, 'verification.json');
  const verified = run(
    'verify',
    '--input',
    output,
    '--output',
    report,
    '--expect-source',
    a.sourceFingerprint,
    '--expect-artifact',
    a.artifactFingerprint,
  );
  assert.equal(verified.status, 0, verified.stderr);
  assert.equal(
    JSON.parse(await readFile(report, 'utf8')).artifactFingerprint,
    a.artifactFingerprint,
  );
  assert.deepEqual(await readFile(input), before);
  const mismatch = run(
    'verify',
    '--input',
    output,
    '--output',
    join(dir, 'mismatch.json'),
    '--expect-source',
    '0'.repeat(64),
  );
  assert.equal(mismatch.status, 1);
  assert.match(mismatch.stderr, /fingerprint mismatch/);
  assert.equal((await readdir(dir)).includes('mismatch.json'), false);
});

test('CLI capability returns exit2 with complete gated output and exit0 for geometry', async (t) => {
  const { dir, input, output } = await setup(t);
  assert.equal(run('compile', '--input', input, '--output', output).status, 0);
  const request = join(dir, 'request.json'),
    result = join(dir, 'gated.json');
  await writeFile(request, JSON.stringify({ kind: 'adventure-start' }));
  const gated = run('capability', '--input', request, '--artifact', output, '--output', result);
  assert.equal(gated.status, 2, gated.stderr);
  const body = JSON.parse(await readFile(result, 'utf8'));
  assert.equal(body.enabled, false);
  assert.equal(body.runtimeReady, false);
  assert.deepEqual(body.gates.boonQuantities, [null, null, null]);
  assert.equal((await stat(result)).mode & 0o777, 0o600);
  await writeFile(request, JSON.stringify({ kind: 'geometry' }));
  assert.equal(
    run(
      'capability',
      '--input',
      request,
      '--artifact',
      output,
      '--output',
      join(dir, 'geometry.json'),
    ).status,
    0,
  );
});

test('CLI rejects invalid commands/options/UTF8/JSON and never overwrites', async (t) => {
  const { dir, input, output } = await setup(t),
    before = await readFile(input);
  for (const args of [
    ['run', '--input', input, '--output', output],
    ['compile', '--input', input, '--input', input, '--output', output],
    ['compile', '--input', input, '--output', output, '--artifact', input],
    ['compile', '--input', input, '--output', output, '--expect-source', '0'.repeat(64)],
    ['verify', '--input', input, '--output', output, '--unknown', 'x'],
    ['capability', '--input', input, '--output', output],
    ['compile', '--input', input],
    ['compile', '--input', input, '--output', input],
  ]) {
    const r = run(...args);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /Battle map CLI:/);
  }
  assert.deepEqual(await readFile(input), before);
  const bad = join(dir, 'invalid.json');
  for (const contents of [
    Buffer.from([0xff]),
    '{',
    'null',
    Buffer.alloc(8 * 1024 * 1024 + 1, 32),
  ]) {
    await writeFile(bad, contents);
    assert.equal(run('compile', '--input', bad, '--output', output).status, 1);
  }
  assert.equal((await readdir(dir)).includes('artifact.json'), false);
});

test('two concurrent CLI publishers produce one complete artifact and preserve it on retry', async (t) => {
  const { dir, input, output } = await setup(t);
  const invoke = () =>
    new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [cli, 'compile', '--input', input, '--output', output],
        { stdio: 'ignore' },
      );
      child.once('error', reject);
      child.once('exit', resolve);
    });
  const codes = await Promise.all([invoke(), invoke()]);
  assert.deepEqual(codes.sort(), [0, 1]);
  const before = await readFile(output);
  verifyBattleMapArtifact(JSON.parse(before.toString()));
  assert.equal(run('compile', '--input', input, '--output', output).status, 1);
  assert.deepEqual(await readFile(output), before);
  assert.deepEqual((await readdir(dir)).sort(), ['artifact.json', 'source.json']);
});
