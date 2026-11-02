import { createHash } from 'node:crypto';
import { SourceRandom, sourceShuffle, FLOAT32_POLICY } from '../map-generation/primitives';
import { parseSelectionInput } from './model';

export function selectMapTiles(value: unknown) {
  const input = parseSelectionInput(value);
  const rng = new SourceRandom(input.context.seed);
  const standard = [...input.standard];
  sourceShuffle(standard, rng);
  const checkpoints = [{ stage: 'coroutine-entry', rng: rng.snapshot() }];
  for (const s of input.sections) rng.nextFloat32(0, 1);
  return {
    formatVersion: 1,
    algorithm: input.algorithm,
    scope: 'selection-only',
    floatPolicy: FLOAT32_POLICY,
    status: 'selected',
    checkpoint: 'after-optional-before-local-edges',
    inputFingerprint: createHash('sha256').update(JSON.stringify(input)).digest('hex'),
    input,
    standardOrder: standard.map((t) => t.source),
    sections: input.sections.map((s) => ({ id: s.index, availableTiles: [] })),
    checkpoints,
    rng: rng.snapshot(),
  };
}
