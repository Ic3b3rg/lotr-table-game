import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as primitives from '../dist/map-primitives.mjs';

const { SourceRandom, sourceShuffle, comparisonSort, FLOAT32_POLICY } = primitives;

const vectors = JSON.parse(
  await readFile(new URL('./fixtures/map-source-vectors.json', import.meta.url), 'utf8'),
);
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function bits(value) {
  const buffer = Buffer.alloc(8);
  buffer.writeDoubleBE(value);
  return buffer.toString('hex');
}
function sourceState(random) {
  const { seedArray, inext, inextp } = random.snapshot();
  return { seedArray, inext, inextp };
}

test('Random riproduce valori, bit double e stato dei corpi IL su semi signed e intervalli grandi', () => {
  for (const vector of vectors.random) {
    const random = new SourceRandom(vector.seed);
    for (const op of vector.operations) {
      const result =
        op.method === 'next' || op.method === 'nextDouble'
          ? random[op.method]()
          : random[op.method](op.min, op.max);
      assert.equal(
        op.bits ? bits(result) : result,
        op.bits ?? op.result,
        `${vector.seed}: ${op.method}`,
      );
    }
    assert.equal(
      hash(Array.from({ length: vector.tailCount }, () => random.next())),
      vector.tailHash,
    );
    assert.equal(random.snapshot().samples, vector.samples);
    assert.deepEqual(sourceState(random), vector.state);
    assert.equal(random.snapshot().seed, vector.seed);
  }
});

test('snapshot e ripristino conservano la sequenza senza condividere array modificabili', () => {
  const random = new SourceRandom(-71);
  for (let i = 0; i < 100; i++) random.nextInt(-2147483648, 2147483647);
  const saved = random.snapshot();
  const restored = SourceRandom.restore(JSON.parse(JSON.stringify(saved)));
  const isolated = SourceRandom.restore(saved);
  saved.seedArray.fill(0);
  assert.notDeepEqual(random.snapshot().seedArray, saved.seedArray);
  assert.notDeepEqual(isolated.snapshot().seedArray, saved.seedArray);
  for (let i = 0; i < 200; i++) {
    const expected = random.nextDouble();
    assert.equal(restored.nextDouble(), expected);
    assert.equal(isolated.nextDouble(), expected);
  }
  assert.deepEqual(restored.snapshot(), random.snapshot());
  assert.deepEqual(isolated.snapshot(), random.snapshot());
});

test('semi, stati e argomenti invalidi sono rifiutati senza consumare casualità', () => {
  for (const seed of [0.5, -2147483649, 2147483648, NaN, Infinity, '0'])
    assert.throws(() => new SourceRandom(seed));
  const random = new SourceRandom(0);
  const before = random.snapshot();
  for (const [min, max] of [
    [3, 2],
    [0, 1.5],
    [-2147483649, 1],
    [0, 2147483648],
    [NaN, 1],
    [0, Infinity],
  ]) {
    assert.throws(() => random.nextInt(min, max));
    assert.deepEqual(random.snapshot(), before);
  }
  for (const [min, max] of [
    [NaN, 1],
    [0, Infinity],
    [0, 1e100],
    [-3.4e38, 3.4e38],
  ]) {
    assert.throws(() => random.nextFloat32(min, max));
    assert.deepEqual(random.snapshot(), before);
  }
  const mutations = [
    (s) => {
      s.formatVersion = 2;
    },
    (s) => {
      s.algorithm = 'other';
    },
    (s) => {
      s.seed = 1.5;
    },
    (s) => {
      s.seedArray.pop();
    },
    (s) => {
      s.seedArray[0] = 1;
    },
    (s) => {
      s.seedArray[1] = -1;
    },
    (s) => {
      s.seedArray[1] = 2147483648;
    },
    (s) => {
      s.inext = 56;
    },
    (s) => {
      s.inextp = 20;
    },
    (s) => {
      s.samples = -1;
    },
    (s) => {
      s.samples = 1;
    },
    (s) => {
      s.extra = true;
    },
  ];
  for (const mutate of mutations) {
    const invalid = structuredClone(before);
    mutate(invalid);
    assert.throws(() => SourceRandom.restore(invalid));
    assert.deepEqual(random.snapshot(), before);
  }
  assert.throws(() => SourceRandom.restore(null));
});

test('il limite del contatore è controllato prima anche di un’operazione a due campioni', () => {
  const state = new SourceRandom(1).snapshot();
  state.samples = Number.MAX_SAFE_INTEGER - 1;
  state.inext = ((state.samples - 1) % 55) + 1;
  state.inextp = (((state.samples % 55) + 20) % 55) + 1;
  const random = SourceRandom.restore(state);
  assert.throws(() => random.nextInt(-2147483648, 2147483647));
  assert.deepEqual(random.snapshot(), state);
  random.next();
  const end = random.snapshot();
  assert.equal(end.samples, Number.MAX_SAFE_INTEGER);
  assert.throws(() => random.nextDouble());
  assert.deepEqual(random.snapshot(), end);
});

test('un campione interno uguale a Int32.MaxValue viene decrementato come nella fonte', () => {
  const state = new SourceRandom(0).snapshot();
  state.seedArray.fill(0);
  state.seedArray[1] = 2147483647;
  const random = SourceRandom.restore(state);
  assert.equal(random.next(), 2147483646);
  assert.equal(random.snapshot().samples, 1);
  assert.doesNotThrow(() => SourceRandom.restore(random.snapshot()));
});

test('la politica float32 dichiarata può arrotondare a uno e conserva gli estremi inversi', () => {
  assert.equal(FLOAT32_POLICY, 'float32-per-operation-v1');
  const state = new SourceRandom(0).snapshot();
  state.seedArray.fill(0);
  state.seedArray[1] = 2147483646;
  assert.ok(SourceRandom.restore(state).nextDouble() < 1);
  assert.equal(SourceRandom.restore(state).nextFloat32(0, 1), 1);
  assert.equal(SourceRandom.restore(state).nextFloat32(1, -1), -1);
  assert.equal(SourceRandom.restore(state).nextFloat32(3, 3), 3);
  const same = SourceRandom.restore(state);
  same.nextFloat32(3, 3);
  assert.equal(same.snapshot().samples, 1);
});

test('shuffle usa il range completo in ordine crescente e consuma anche il singleton', () => {
  for (const vector of vectors.shuffle) {
    const random = new SourceRandom(vector.seed);
    const values = Array.from({ length: vector.size }, (_, i) => i);
    sourceShuffle(values, random);
    assert.deepEqual(values, vector.order);
    assert.equal(random.snapshot().samples, vector.samples);
    assert.deepEqual(sourceState(random), vector.state);
  }
  const random = new SourceRandom(0);
  sourceShuffle(null, random);
  assert.equal(random.snapshot().samples, 0);
});

test('shuffle rifiuta un contatore insufficiente prima di modificare lista o casualità', () => {
  const state = new SourceRandom(0).snapshot();
  state.samples = Number.MAX_SAFE_INTEGER - 1;
  state.inext = ((state.samples - 1) % 55) + 1;
  state.inextp = (((state.samples % 55) + 20) % 55) + 1;
  const random = SourceRandom.restore(state);
  const values = ['a', 'b'];
  assert.throws(() => sourceShuffle(values, random));
  assert.deepEqual(random.snapshot(), state);
  assert.deepEqual(values, ['a', 'b']);
});

test('Comparison sort conserva pari e sequenza dei confronti di insertion, partition e heap', () => {
  assert.ok(vectors.sort.some((v) => v.heapCalls > 0));
  for (const vector of vectors.sort) {
    const values = vector.keys.map((key, id) => ({ id, key }));
    const comparisons = [];
    comparisonSort(values, (a, b) => {
      comparisons.push([a.id, b.id]);
      return a.key - b.key;
    });
    assert.deepEqual(
      values.map((v) => v.id),
      vector.order,
      vector.name,
    );
    assert.equal(comparisons.length, vector.comparisonCount, vector.name);
    assert.equal(hash(comparisons), vector.comparisonHash, vector.name);
    assert.deepEqual(
      values.map((v) => v.key),
      [...vector.keys].sort((a, b) => a - b),
    );
  }
});

test('il comparatore asimmetrico delle sezioni segue i due passaggi originali', () => {
  const values = [
    { id: 0, required: [1] },
    { id: 1, required: [0, 3, 2] },
    { id: 2, required: [3, 1] },
    { id: 3, required: [2, 1] },
  ];
  let most = null;
  function compare(a, b) {
    if (most && a.id === most.id) return -1;
    if (most && b.id === most.id) return 1;
    if (a.required.length !== b.required.length) return b.required.length - a.required.length;
    return most ? (a.required.includes(most.id) ? -1 : 1) : 0;
  }
  comparisonSort(values, compare);
  assert.deepEqual(
    values.map((v) => v.id),
    [1, 2, 3, 0],
  );
  most = values[0];
  comparisonSort(values, compare);
  assert.deepEqual(
    values.map((v) => v.id),
    [1, 3, 2, 0],
  );
});

test('Comparison sort rifiuta risultati fuori int32 e confronti che escono dalla lista', () => {
  assert.throws(() => comparisonSort([], null));
  for (const value of [NaN, Infinity, 0.5, 2147483648, -2147483649])
    assert.throws(() => comparisonSort([2, 1], () => value));
  assert.throws(() =>
    comparisonSort(
      Array.from({ length: 17 }, (_, i) => i),
      () => -1,
    ),
  );
  const error = new Error('callback failed');
  assert.throws(
    () =>
      comparisonSort([2, 1], () => {
        throw error;
      }),
    (e) => e === error,
  );
});
