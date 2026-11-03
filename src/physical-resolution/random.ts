import { createHash } from 'node:crypto';

/** Independent physical stream. Rejection avoids modulo bias; no Unity parity claim. */
export class PhysicalRandom {
  cursor = 0;
  constructor(private readonly entropy: string) {}
  index(size: number) {
    if (!Number.isInteger(size) || size < 1 || size > 28)
      throw new Error('Popolazione casuale fisica non valida.');
    const bound = 0x100000000 - (0x100000000 % size);
    for (let n = 0; n < 128; n++) {
      const value = createHash('sha256')
        .update(`physical-v1:${this.entropy}:${this.cursor++}`)
        .digest()
        .readUInt32BE(0);
      if (value < bound) return value % size;
    }
    throw new Error('Budget casuale fisico superato.');
  }
  permutation(size: number) {
    const indices = Array.from({ length: size }, (_, n) => n);
    for (let n = size - 1; n > 0; n--) {
      const j = this.index(n + 1);
      [indices[n], indices[j]] = [indices[j]!, indices[n]!];
    }
    return indices;
  }
}
