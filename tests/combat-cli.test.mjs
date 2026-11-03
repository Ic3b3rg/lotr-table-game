import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { combatFixture, seedFor } from './fixtures/combat.mjs';
import { compileCombatSource, restoreCombatKernel } from '../dist/combat-library.mjs';
const cli = (...args) =>
  spawnSync(process.execPath, [resolve('dist/combat.mjs'), ...args], { encoding: 'utf8' });
const json = async (path) => JSON.parse(await readFile(path, 'utf8'));

test('CLI compiles, verifies, runs the technical adapter path and replays the exported checkpoint', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'combat-cli-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const source = join(dir, 'source.json'),
    artifact = join(dir, 'artifact.json'),
    script = join(dir, 'run.json'),
    checkpoint = join(dir, 'checkpoint.json'),
    replay = join(dir, 'replay.json');
  await writeFile(source, JSON.stringify(combatFixture()));
  const compilation = cli('compile', '--input', source, '--output', artifact);
  assert.equal(compilation.status, 0, compilation.stderr);
  assert.equal((await stat(artifact)).mode & 0o777, 0o600);
  const a = await json(artifact);
  const verifyPath = join(dir, 'verify.json');
  assert.equal(cli('verify', '--input', artifact, '--output', verifyPath).status, 0);
  assert.deepEqual((await json(verifyPath)).coverage, { states: 4, actions: 1 });
  const planId = 'cli-attack';
  await writeFile(
    script,
    JSON.stringify({
      format: 'combat-technical-run-v1',
      seed: seedFor(a),
      adapter: {
        mode: 'technical-fixture-v1',
        attacks: [
          {
            planId,
            resultId: 'technical-result',
            successes: ['s1', 's2'],
            afterTest: null,
            requiredHooks: [],
          },
        ],
        effects: [],
      },
      commands: [
        { kind: 'spawn', id: 'cli-spawn', spawnId: a.compiled.spawns[0].id },
        {
          kind: 'plan',
          id: planId,
          heroId: 'hero-2',
          itemCopies: ['sword:1'],
          stat: 'might',
          slots: [{ copyId: 'sword:1', slotId: a.compiled.items[0].slots[0].id }],
        },
        { kind: 'apply', id: 'cli-apply', planId },
      ],
    }),
  );
  const run = cli('run', '--artifact', artifact, '--input', script, '--output', checkpoint);
  assert.equal(run.status, 0, run.stderr);
  const report = JSON.parse(run.stdout);
  assert.equal(report.gameplayAcceptance, false);
  assert.equal(report.evidence, 'technical-adapter');
  const saved = await json(checkpoint);
  assert.equal(saved.journal[2].receipt.continuation.kind, 'physical');
  assert.deepEqual(
    saved.state.group.figures.map((f) => f.health),
    [4, 4],
  );
  assert.equal(cli('replay', '--input', checkpoint, '--output', replay).status, 0);
  assert.deepEqual(await json(replay), saved);
  assert.deepEqual(restoreCombatKernel(saved).checkpoint(), saved);
  const request = join(dir, 'request.json'),
    capability = join(dir, 'capability.json');
  await writeFile(request, JSON.stringify({ operation: 'original-attack', heroId: 'hero-2' }));
  assert.equal(
    cli('capability', '--artifact', artifact, '--input', request, '--output', capability).status,
    2,
  );
  assert.equal((await json(capability)).runtimeReady, false);
});

test('CLI rejects unknown arguments, malformed input and overwrites without changing existing files', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'combat-cli-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const input = join(dir, 'input.json'),
    output = join(dir, 'out.json');
  await writeFile(input, JSON.stringify(combatFixture()));
  await writeFile(output, 'preserved');
  assert.notEqual(cli('compile', '--input', input, '--output', output).status, 0);
  assert.equal(await readFile(output, 'utf8'), 'preserved');
  assert.notEqual(
    cli('compile', '--input', input, '--input', input, '--output', join(dir, 'duplicate.json'))
      .status,
    0,
  );
  assert.notEqual(
    cli('compile', '--input', input, '--output', join(dir, 'unknown.json'), '--eval', 'noop')
      .status,
    0,
  );
  await writeFile(input, Buffer.from([0xff]));
  assert.notEqual(
    cli('compile', '--input', input, '--output', join(dir, 'invalid.json')).status,
    0,
  );
  await writeFile(input, JSON.stringify({ ...combatFixture(), unexpected: true }));
  assert.notEqual(cli('compile', '--input', input, '--output', join(dir, 'strict.json')).status, 0);
  const a = compileCombatSource(combatFixture());
  a.compiled.enemy.stats.health++;
  await writeFile(input, JSON.stringify(a));
  assert.notEqual(cli('verify', '--input', input, '--output', join(dir, 'forged.json')).status, 0);
});
