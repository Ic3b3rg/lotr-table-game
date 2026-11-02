import { z } from 'zod';

const MIN = -2147483648;
const MAX = 2147483647;
const ALGORITHM = 'system-random-subtractive-v1';
export const FLOAT32_POLICY = 'float32-per-operation-v1';

const StateSchema = z
  .strictObject({
    formatVersion: z.literal(1),
    algorithm: z.literal(ALGORITHM),
    seed: z.int().min(MIN).max(MAX),
    seedArray: z
      .array(
        z
          .int()
          .min(0)
          .max(MAX - 1),
      )
      .length(56),
    inext: z.int().min(0).max(55),
    inextp: z.int().min(1).max(55),
    samples: z.int().min(0).max(Number.MAX_SAFE_INTEGER),
  })
  .refine(
    (s) =>
      s.seedArray[0] === 0 &&
      s.inext === (s.samples === 0 ? 0 : ((s.samples - 1) % 55) + 1) &&
      s.inextp === (((s.samples % 55) + 20) % 55) + 1,
    'Indici o slot inutilizzato non coerenti con i campioni.',
  );
export type SourceRandomState = z.infer<typeof StateSchema>;

function int32(value: number): void {
  if (!Number.isInteger(value) || value < MIN || value > MAX)
    throw new RangeError('È richiesto un intero signed int32.');
}

/** Installed System.Random, separate from the host's card/gameplay randomness. */
export class SourceRandom {
  #seed: number;
  #seedArray = Array<number>(56).fill(0);
  #inext = 0;
  #inextp = 21;
  #samples = 0;

  constructor(seed: number) {
    int32(seed);
    this.#seed = seed | 0;
    let mj = (161803398 - (seed === MIN ? MAX : Math.abs(seed))) | 0;
    this.#seedArray[55] = mj;
    let mk = 1;
    let slot = 0;
    for (let i = 1; i < 55; i++) {
      slot += 21;
      if (slot >= 55) slot -= 55;
      this.#seedArray[slot] = mk;
      mk = (mj - mk) | 0;
      if (mk < 0) mk = (mk + MAX) | 0;
      mj = this.#seedArray[slot]!;
    }
    for (let pass = 0; pass < 4; pass++) {
      for (let i = 1; i < 56; i++) {
        let other = i + 30;
        if (other >= 55) other -= 55;
        let value = (this.#seedArray[i]! - this.#seedArray[other + 1]!) | 0;
        if (value < 0) value = (value + MAX) | 0;
        this.#seedArray[i] = value;
      }
    }
  }

  static restore(value: unknown): SourceRandom {
    const state = StateSchema.parse(value);
    const random = new SourceRandom(state.seed);
    random.#seedArray = [...state.seedArray];
    random.#inext = state.inext;
    random.#inextp = state.inextp;
    random.#samples = state.samples;
    return random;
  }

  snapshot(): SourceRandomState {
    return {
      formatVersion: 1,
      algorithm: ALGORITHM,
      seed: this.#seed,
      seedArray: [...this.#seedArray],
      inext: this.#inext,
      inextp: this.#inextp,
      samples: this.#samples,
    };
  }

  #requireSamples(count: number): void {
    if (Number.MAX_SAFE_INTEGER - this.#samples < count)
      throw new RangeError('Contatore dei campioni esaurito.');
  }

  next(): number {
    this.#requireSamples(1);
    this.#inext = this.#inext >= 55 ? 1 : this.#inext + 1;
    this.#inextp = this.#inextp >= 55 ? 1 : this.#inextp + 1;
    let value = (this.#seedArray[this.#inext]! - this.#seedArray[this.#inextp]!) | 0;
    if (value === MAX) value--;
    if (value < 0) value += MAX;
    this.#seedArray[this.#inext] = value;
    this.#samples++;
    return value;
  }

  nextDouble(): number {
    return this.next() * 4.656612875245797e-10;
  }

  nextInt(min: number, max: number): number {
    int32(min);
    int32(max);
    if (min > max) throw new RangeError('Il minimo supera il massimo.');
    const range = max - min;
    if (range <= MAX) return Math.trunc(this.nextDouble() * range) + min;
    this.#requireSamples(2);
    let sample = this.next();
    if (this.next() % 2 === 0) sample = -sample;
    return Math.trunc(((sample + 2147483646) / 4294967293) * range) + min;
  }

  nextFloat32(min: number, max: number): number {
    if (!Number.isFinite(min) || !Number.isFinite(max))
      throw new RangeError('Estremi float non finiti.');
    const a = Math.fround(min),
      b = Math.fround(max);
    const range = Math.fround(b - a);
    if (![a, b, range].every(Number.isFinite))
      throw new RangeError('Intervallo fuori dal formato float32.');
    return Math.fround(a + Math.fround(Math.fround(this.nextDouble()) * range));
  }
}
