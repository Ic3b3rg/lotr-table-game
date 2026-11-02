import { assembleMap } from '../map-assembly/assembly';
import { placeMapEncounters } from '../map-encounters/encounters';
import { parseEncounterInput } from '../map-encounters/model';
import {
  AttemptRecordSchema,
  type GenerationContext,
  type AttemptRecord,
} from '../shared/generated-map';
import { buildAttemptInput, type GeneratorPack } from './pack';
import { digest } from './hash';
import { projectRealization } from './projection';

type Run = {
  requestedSeed: number;
  seed: number;
  attempt: number;
  incoming: GeneratorPack['template']['selection']['incoming'];
  attempts: AttemptRecord[];
};
/** No checkpoint input. The two upstream executions must agree before projection. */
export function runGenerationAttempt(pack: GeneratorPack, context: GenerationContext, run: Run) {
  const input = parseEncounterInput(
    buildAttemptInput(
      pack,
      { ...context, ...(run.attempts.at(-1)?.history ?? {}) },
      run.seed,
      run.incoming,
      run.attempt,
    ),
  );
  const assembly = assembleMap(input.assembly),
    encounters = placeMapEncounters(input);
  const summary = encounters.assembly;
  if (
    summary.inputFingerprint !== assembly.inputFingerprint ||
    summary.geometryFingerprint !== assembly.geometryFingerprint ||
    digest(summary.rng) !== digest(assembly.rng) ||
    digest(summary.counts) !== digest(assembly.counts) ||
    digest(summary.builderOrder) !== digest(assembly.builderOrder) ||
    digest(summary.mapOrder) !== digest(assembly.mapOrder) ||
    summary.status !== assembly.status
  )
    throw new Error('Ricalcolo assembly non concorde con incontri.');
  const pools = assembly.selection.pools;
  const incoming = {
    randomEncounterPool: encounters.retainedPools.randomEncounterPool,
    itemEncounterPool: encounters.retainedPools.itemEncounterPool,
    percentNormal: pools.percentNormal,
  };
  const history = { ...encounters.history.result, unlockedChainIds: context.unlockedChainIds };
  if (encounters.status === 'encounters-complete') {
    if (
      digest(
        assembly.spaces.map((s) => ({
          ...s,
          encounterId: encounters.spaces.find((v) => v.id === s.id)?.encounterId,
        })),
      ) !== digest(encounters.spaces)
    )
      throw new Error('Caselle upstream incoerenti.');
    return {
      status: 'frozen' as const,
      projection: projectRealization(
        pack,
        context,
        run.requestedSeed,
        run.attempts,
        input,
        assembly,
        encounters,
      ),
    };
  }
  const failure = encounters.failure!;
  const record = AttemptRecordSchema.parse({
    index: run.attempt,
    seed: run.seed,
    status: encounters.status,
    stage: failure.stage,
    reason: failure.reason,
    sourceErrorCode: failure.sourceErrorCode,
    incomingFingerprint: digest(run.incoming),
    retainedFingerprint: digest(incoming),
    historyFingerprint: digest(history),
    history,
    rng: encounters.rng,
    evidenceFingerprint: digest([
      assembly.trace,
      assembly.clock,
      encounters.trace,
      encounters.clock,
    ]),
  });
  return {
    status: 'failed' as const,
    record,
    incoming,
    history,
    retry: encounters.status === 'source-failure' && failure.sourceErrorCode !== null,
  };
}
