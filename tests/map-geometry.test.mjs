import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { geometryPackFixture, tileGeometryFixture } from './fixtures/map-geometry.mjs';

async function compiler(t, pack = geometryPackFixture()) {
  const directory = await mkdtemp(join(tmpdir(), 'lotr-geometry-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const input = join(directory, 'geometry.json');
  await writeFile(input, JSON.stringify(pack));
  return {
    input,
    directory,
    run(...args) {
      return spawnSync(process.execPath, ['dist/map-geometry.mjs', '--input', input, ...args], {
        encoding: 'utf8',
        timeout: 10_000,
      });
    },
  };
}
function success(result) {
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  return JSON.parse(result.stdout);
}

test('il compilatore elenca gli agganci nell’ordine esagono/direzione e compone due caselle reciproche', async (t) => {
  const cli = await compiler(t);
  const list = success(cli.run('--rotation', '0', '--list'));
  assert.equal(list.scope, 'geometry-only');
  assert.equal(list.candidates.length, 36);
  assert.deepEqual(list.candidates[0], {
    rotation: 3,
    origin: [1, -1, 0],
    target: { hex: 0, direction: 0 },
    anchor: { hex: 0, direction: 0 },
    openEdgeCount: 10,
  });
  assert.deepEqual(list.candidates[6].target, { hex: 0, direction: 1 });
  const output = success(cli.run('--rotation', '0', '--placement', '0'));
  assert.equal(output.formatVersion, 1);
  assert.equal(output.scope, 'geometry-only');
  assert.equal(output.placementIndex, 0);
  assert.deepEqual(output.pack, geometryPackFixture());
  assert.equal(output.packHash.length, 64);
  assert.deepEqual(
    output.tiles.map((tile) => ({ id: tile.id, rotation: tile.rotation, origin: tile.origin })),
    [
      { id: 'tile-a', rotation: 0, origin: [0, 0, 0] },
      { id: 'tile-b', rotation: 3, origin: [1, -1, 0] },
    ],
  );
  assert.deepEqual(
    output.spaces.map((space) => ({ id: space.id, connected: space.connected })),
    [
      { id: 'tile-a:0', connected: ['tile-b:0'] },
      { id: 'tile-b:0', connected: ['tile-a:0'] },
    ],
  );
  assert.deepEqual(output.connections, [['tile-a:0', 'tile-b:0']]);
  assert.equal(await readFile(cli.input, 'utf8'), JSON.stringify(geometryPackFixture()));
});

test('le sei rotazioni conservano coordinate cubiche e ordine globale dei bordi del tratto', async (t) => {
  const cli = await compiler(t);
  for (let rotation = 0; rotation < 6; rotation++) {
    const list = success(cli.run('--rotation', String(rotation), '--list'));
    assert.equal(list.candidates.length, 36);
    assert.equal(list.candidates[0].target.direction, (6 - rotation) % 6);
    assert.deepEqual(list.candidates[0].origin, [1, -1, 0]);
    const result = success(cli.run('--rotation', String(rotation), '--placement', '0'));
    assert.equal(result.tiles[0].rotation, rotation);
    assert.equal(result.spaces.length, 2);
    assert.equal(result.connections.length, 1);
  }
});

test('rive opposte, ruscelli, strade e passaggi conservano la compatibilità originale', async (t) => {
  for (const [a, b, open, count] of [
    [300, 400, true, 36],
    [300, 300, true, 0],
    [500, 500, true, 36],
    [500, 0, true, 0],
    [550, 550, true, 36],
    [550, 0, true, 0],
    [600, 0, true, 36],
    [600, 0, false, 0],
    [100, 0, true, 0],
    [200, 200, true, 0],
    [700, 0, true, 0],
  ]) {
    const pack = geometryPackFixture();
    pack.start = tileGeometryFixture('tile-a', a, open);
    pack.attachment = tileGeometryFixture('tile-b', b);
    const cli = await compiler(t, pack);
    const list = success(cli.run('--rotation', '0', '--list'));
    assert.equal(list.candidates.length, count, `${a}/${b}, passage=${open}`);
    if (!count) {
      const failed = cli.run('--rotation', '0', '--placement', '0');
      assert.equal(failed.status, 1);
      assert.equal(failed.stdout, '');
    }
  }
});

function twoHexTile(id, second) {
  const tile = tileGeometryFixture(id);
  tile.hexes.push({ coords: second, space: 0 });
  tile.edges.push(...tileGeometryFixture().edges.map((edge) => ({ ...edge, hex: 1 })));
  return tile;
}

test('un aggancio valido non permette sovrapposizioni o altri contatti incompatibili', async (t) => {
  const pack = geometryPackFixture();
  pack.start = twoHexTile('tile-a', [1, -1, 0]);
  pack.attachment = twoHexTile('tile-b', [0, -1, 1]);
  const cli = await compiler(t, pack);
  const list = success(cli.run('--rotation', '0', '--list'));
  assert.ok(list.candidates.length > 0);
  assert.ok(
    !list.candidates.some(
      (c) =>
        c.target.hex === 0 &&
        c.target.direction === 1 &&
        c.anchor.hex === 0 &&
        c.anchor.direction === 0,
    ),
  );
  const conflict = geometryPackFixture();
  conflict.start = twoHexTile('tile-a', [0, -1, 1]);
  conflict.attachment = twoHexTile('tile-b', [0, 1, -1]);
  conflict.attachment.edges.find((e) => e.hex === 1 && e.direction === 0).traits = 100;
  const other = await compiler(t, conflict);
  const candidates = success(other.run('--rotation', '0', '--list')).candidates;
  assert.ok(candidates.length > 0);
  assert.ok(
    !candidates.some(
      (c) =>
        c.target.hex === 0 &&
        c.target.direction === 0 &&
        c.anchor.hex === 0 &&
        c.anchor.direction === 0,
    ),
  );
});

test('un contatto bloccato può combaciare senza aggiungere movimento fra quelle caselle', async (t) => {
  const pack = geometryPackFixture();
  pack.start = twoHexTile('tile-a', [0, -1, 1]);
  pack.attachment = twoHexTile('tile-b', [0, 1, -1]);
  pack.start.spaces.push({ traits: 4, hasDarkness: true });
  pack.attachment.spaces.push({ traits: 1, hasDarkness: false });
  pack.start.hexes[1].space = 1;
  pack.attachment.hexes[1].space = 1;
  pack.start.links = [[0, 1]];
  pack.attachment.links = [[0, 1]];
  pack.attachment.edges.find((e) => e.hex === 1 && e.direction === 0).traits = 700;
  const cli = await compiler(t, pack);
  const list = success(cli.run('--rotation', '0', '--list'));
  const index = list.candidates.findIndex(
    (c) =>
      c.target.hex === 0 &&
      c.target.direction === 0 &&
      c.anchor.hex === 0 &&
      c.anchor.direction === 0,
  );
  assert.ok(index >= 0);
  const result = success(cli.run('--rotation', '0', '--placement', String(index)));
  assert.ok(result.connections.some(([a, b]) => a === 'tile-a:0' && b === 'tile-b:0'));
  assert.ok(!result.connections.some(([a, b]) => a === 'tile-a:1' && b === 'tile-b:1'));
  assert.deepEqual(result.spaces.find((s) => s.id === 'tile-a:1').hexes, [[0, -1, 1]]);
  assert.equal(result.spaces.find((s) => s.id === 'tile-a:1').hasDarkness, true);
  for (const [a, b] of result.connections) {
    assert.ok(result.spaces.find((s) => s.id === a).connected.includes(b));
    assert.ok(result.spaces.find((s) => s.id === b).connected.includes(a));
  }
});

test('input malformati e indici incoerenti sono rifiutati senza output', async (t) => {
  const cli = await compiler(t);
  for (const args of [
    [],
    ['--rotation', '6', '--list'],
    ['--rotation', '-1', '--list'],
    ['--rotation', '1.5', '--list'],
    ['--rotation', '0', '--placement', '99'],
    ['--rotation', '0', '--list', '--placement', '0'],
    ['--rotation', '0', '--list', '--unknown'],
  ]) {
    const r = cli.run(...args);
    assert.equal(r.status, 1);
    assert.equal(r.stdout, '');
  }
  for (const mutate of [
    (p) => {
      p.attachment.id = p.start.id;
    },
    (p) => {
      p.start.hexes[0].coords = [1, 1, 1];
    },
    (p) => {
      p.start.hexes.push(structuredClone(p.start.hexes[0]));
    },
    (p) => {
      p.start.hexes[0].space = 9;
    },
    (p) => {
      p.start.edges.pop();
    },
    (p) => {
      p.start.edges.push(structuredClone(p.start.edges[0]));
    },
    (p) => {
      p.start.edges[0].hex = 3;
    },
    (p) => {
      p.start.edges[0].traits = 999;
    },
    (p) => {
      p.start.links = [[0, 1]];
    },
  ]) {
    const pack = geometryPackFixture();
    mutate(pack);
    const bad = await compiler(t, pack);
    const r = bad.run('--rotation', '0', '--list');
    assert.equal(r.status, 1);
    assert.equal(r.stdout, '');
  }
});

test('il risultato è congelato e deterministico, senza sovrascrivere file esistenti', async (t) => {
  const cli = await compiler(t);
  const path = join(cli.directory, 'composed.json');
  const args = ['--rotation', '2', '--placement', '5'];
  const first = success(cli.run(...args));
  assert.deepEqual(success(cli.run(...args)), first);
  const written = cli.run(...args, '--output', path);
  assert.equal(written.status, 0, written.stderr);
  assert.equal(written.stdout, '');
  assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), first);
  const sentinel = 'already owned by the user';
  await writeFile(path, sentinel);
  const overwrite = cli.run(...args, '--output', path);
  assert.equal(overwrite.status, 1);
  assert.equal(overwrite.stdout, '');
  assert.equal(await readFile(path, 'utf8'), sentinel);
  await writeFile(cli.input, 'bad JSON');
  assert.equal(cli.run(...args, '--output', path).status, 1);
  assert.equal(await readFile(path, 'utf8'), sentinel);
});
