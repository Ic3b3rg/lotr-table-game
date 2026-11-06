import { createHash } from 'node:crypto';

export const POLICY = 'camp-decks-sha256-fy-v1' as const;
const UINT32 = 2 ** 32;

/** Null discards the incomplete residue interval; never folds it into an index. */
export function indexForWord(word: number, size: number): number | null {
  if (
    !Number.isInteger(word) ||
    word < 0 ||
    word >= UINT32 ||
    !Number.isInteger(size) ||
    size < 1 ||
    size > 201
  )
    throw new Error('Camp decks: invalid random word/size.');
  return word < Math.floor(UINT32 / size) * size ? word % size : null;
}
export function shuffleCopies(copies: string[], seed: string, stream: string) {
  if (copies.length > 201) throw new Error('Camp decks: shuffle size budget.');
  const order = [...copies];
  const words: {
    cursor: number;
    size: number;
    word: number;
    accepted: boolean;
    index: number | null;
  }[] = [];
  let cursor = 0;
  for (let size = order.length; size > 1; size--) {
    let index: number | null;
    do {
      if (cursor >= 100000) throw new Error('Camp decks: entropy trace budget.');
      // This primitive-only tuple has exactly the repository canonical JSON encoding.
      const word = createHash('sha256')
        .update(JSON.stringify([POLICY, seed, stream, cursor]))
        .digest()
        .readUInt32BE();
      index = indexForWord(word, size);
      words.push({ cursor, size, word, accepted: index !== null, index });
      cursor++;
    } while (index === null);
    [order[size - 1], order[index]] = [order[index]!, order[size - 1]!];
  }
  return { order, trace: { stream, cursor, words } };
}
