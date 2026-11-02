import { createHash } from 'node:crypto';
import { SourceRandom, sourceShuffle, FLOAT32_POLICY } from '../map-generation/primitives';
import { parseSelectionInput } from './model';
import { collectPools, shuffleAndMerge } from './pools';

export function selectMapTiles(value: unknown) {
  const input = parseSelectionInput(value);
  const rng = new SourceRandom(input.context.seed);
  let stage = 'pools';
  let operations = 0;
  const trace: { stage: string; operation: string; samples: number; [key: string]: unknown }[] = [];
  const checkpoints: { stage: string; rng: ReturnType<SourceRandom['snapshot']> }[] = [];
  const observe = {
    tick: () => {
      if (++operations > input.budget.maxOperations)
        throw new Error('Budget amministrativo esaurito.');
    },
    emit: (operation: string, details: Record<string, unknown>) => {
      trace.push({ stage, operation, samples: rng.snapshot().samples, ...details });
    },
    checkpoint: (nextStage: string) => {
      stage = nextStage;
      checkpoints.push({ stage, rng: rng.snapshot() });
    },
  };
  const pools = collectPools(input, observe);
  const standard = [...input.standard];
  sourceShuffle(standard, rng);
  observe.checkpoint('standard-shuffle');
  const extras = [0, 0, 0, 0],
    scalingOrder = input.sections.map((s) => s.index);
  if (input.context.heroCount > 1) {
    sourceShuffle(scalingOrder, rng);
    let remaining = (input.context.heroCount - 1) * 2;
    while (remaining > 0)
      for (const id of scalingOrder) {
        observe.tick();
        if (!input.sections[id]!.ignorePlayerScaling) {
          extras[id]!++;
          remaining--;
          if (remaining === 0) break;
        }
      }
  }
  observe.checkpoint('scaling');
  shuffleAndMerge(pools, rng, observe);
  observe.checkpoint('coroutine-entry');
  stage = 'optional';
  for (const s of input.sections) rng.nextFloat32(0, 1);
  const { ownedCodes, ...poolResult } = pools;
  return {
    formatVersion: 1,
    algorithm: input.algorithm,
    scope: 'selection-only',
    floatPolicy: FLOAT32_POLICY,
    status: 'selected',
    checkpoint: 'after-optional-before-local-edges',
    inputFingerprint: createHash('sha256').update(JSON.stringify(input)).digest('hex'),
    input,
    pools: poolResult,
    standardOrder: standard.map((t) => t.source),
    scalingOrder,
    sections: input.sections.map((s) => ({
      id: s.index,
      extraSpaces: extras[s.index],
      availableTiles: [],
    })),
    trace,
    checkpoints,
    rng: rng.snapshot(),
    operations,
  };
}
