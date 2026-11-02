import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { assembleMap } from '../dist/map-assembly-library.mjs';
import { movementFixture } from './fixtures/map-movement.mjs';

async function runCLI(input, check) {
  const dir = await mkdtemp(join(tmpdir(), 'lotr-movement-'));
  try {
    const source = join(dir, 'input.json'),
      output = join(dir, 'output.json'),
      bytes = JSON.stringify(input) + '\n';
    await writeFile(source, bytes);
    const process = spawnSync(
      globalThis.process.execPath,
      [resolve('dist/map-assembly.mjs'), '--input', source, '--output', output],
      { encoding: 'utf8', timeout: 30000 },
    );
    let result;
    try {
      result = JSON.parse(await readFile(output, 'utf8'));
    } catch {}
    await check({ process, result });
    assert.equal(await readFile(source, 'utf8'), bytes);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

for (const [name, edit] of [
  ['asymmetric authoring', (t) => (t.spaces[1].serializedConnectedSpaces = [])],
  ['out-of-range reference', (t) => (t.spaces[0].serializedConnectedSpaces = [2])],
  ['negative index', (t) => (t.spaces[0].serializedConnectedSpaces = [-1])],
  ['fractional index', (t) => (t.spaces[0].serializedConnectedSpaces = [0.5])],
  ['self-link', (t) => (t.spaces[0].serializedConnectedSpaces = [0])],
  ['duplicate authoring', (t) => (t.spaces[0].serializedConnectedSpaces = [1, 1])],
  ['unknown source file', (t) => (t.spaces[0].source = 'absent.assets:1')],
  ['wrong space reference', (t) => (t.spaces[0].source = t.spaces[1].source)],
]) {
  test(`movement input rejects ${name} through library and CLI without repairing input`, async () => {
    const input = movementFixture();
    edit(input.geometry.tiles[0]);
    const before = structuredClone(input);
    assert.throws(() => assembleMap(input));
    assert.deepEqual(input, before);
    await runCLI(input, ({ process, result }) => {
      assert.equal(process.status, 1, process.stderr);
      assert.equal(result, undefined);
      assert.match(process.stderr, /Input/);
    });
  });
}
