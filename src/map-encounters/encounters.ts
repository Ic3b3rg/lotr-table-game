import { assembleMap } from '../map-assembly/assembly';
import { AssemblyStop } from '../map-assembly/execution';
import { InputError } from '../map-assembly/model';
import { parseEncounterInput } from './model';
import { EncounterState, fingerprint, freeze } from './state';
import { seedRequired } from './required';
import { seedGroups } from './groups';
import { seedFill, planSpawn } from './fill';

function seedFixed(s: EncounterState): void {
  s.stage = 'fixed-tile';
  for (const section of s.input.placement.sections) {
    s.sectionCursor = section.index;
    for (const entry of section.tileEncounters ?? []) {
      s.tick('fixed-entry');
      const model = s.models.get(entry.encounterSource)!;
      if (s.has(model.id)) s.fail('fixed-duplicate');
      if (!s.allModels.has(model.source)) s.fail('fixed-model-missing');
      const tile = s.assembly.sections[section.index]!.tiles.find((t) => t.hashId === entry.tileId);
      if (!tile) s.fail('fixed-tile-missing');
      const spaces = s.spaces.filter((v) => v.tileSource === tile.source);
      const index = entry.specifySpaceIndex
        ? entry.spaceIndex
        : s.draw('fixed-space', 0, spaces.length);
      const space = spaces[index];
      if (!space) s.fail('fixed-space-missing');
      if (space.encounterId >= 0) s.fail('fixed-occupied');
      s.assign(space, model.source, {
        stage: s.stage,
        sectionId: section.index,
        groupSource: null,
      });
    }
  }
}

/** Validated raw input only; no prefab/FSM execution or host state mutation. */
export function placeMapEncounters(value: unknown) {
  const input = parseEncounterInput(value),
    assembly = assembleMap(input.assembly),
    s = new EncounterState(input, assembly);
  let status:
    | 'encounters-complete'
    | 'source-failure'
    | 'source-operation-exception'
    | 'administrative-stop' = 'encounters-complete';
  let failure: {
    stage: string;
    reason: string;
    message: string;
    sourceErrorCode: number | null;
  } | null = null;
  try {
    if (assembly.status !== 'geometry-complete')
      throw new AssemblyStop(
        assembly.status,
        'assembly-failed',
        assembly.failure?.message ?? 'Assembly non riuscito.',
        assembly.failure?.sourceErrorCode ?? null,
      );
    s.stage = 'all-spaces';
    s.shuffle(s.allSpaces, 'all-spaces-shuffle', (v) => v.id);
    seedFixed(s);
    seedRequired(s);
    seedGroups(s);
    seedFill(s);
    planSpawn(s);
  } catch (error) {
    if (error instanceof InputError) throw error;
    const stop =
      error instanceof AssemblyStop
        ? error
        : new AssemblyStop(
            'source-operation-exception',
            'source-operation',
            error instanceof Error ? error.message : 'Operazione fonte non riuscita.',
          );
    status = stop.kind;
    failure = {
      stage: s.stage,
      reason: stop.reason,
      message: stop.message,
      sourceErrorCode: stop.sourceErrorCode,
    };
    s.trace.push({
      operation: 'failure',
      ordinal: s.trace.length,
      samples: s.random?.snapshot().samples ?? 0,
      ...failure,
    });
  }
  s.clock.finish();
  const records = [...s.assignments.values()].map((a) => ({
    ...a,
    prefab: s.models.get(a.modelSource)!.prefab,
    nodePosition: s.bySpace.get(a.spaceId)!.nodePosition,
  }));
  return freeze({
    formatVersion: 1,
    algorithm: input.algorithm,
    scope: 'encounter-placement-only',
    status,
    checkpoint:
      status === 'encounters-complete' ? 'after-encounter-history-before-prefab-execution' : null,
    failure,
    sourceParity: 'not-certified',
    numericalPolicy: assembly.numericalPolicy,
    floatPolicy: assembly.floatPolicy,
    inputFingerprint: fingerprint(input),
    placementFingerprint: fingerprint(input.placement),
    provenance: input.placement.provenance,
    executionPolicy: {
      policy: input.execution.policy,
      maxOperations: input.execution.maxOperations,
      maxTraceEvents: input.execution.maxTraceEvents,
      timeoutMilliseconds: input.execution.clock.timeoutMilliseconds,
      stepMilliseconds:
        input.execution.clock.policy === 'logical-clock-v1'
          ? input.execution.clock.stepMilliseconds
          : null,
    },
    retainedPools: {
      randomEncounterPool: assembly.selection.pools.randomEncounterPool,
      itemEncounterPool: assembly.selection.pools.itemEncounterPool,
    },
    assembly: {
      status: assembly.status,
      checkpoint: assembly.checkpoint,
      failure: assembly.failure,
      inputFingerprint: assembly.inputFingerprint,
      geometryFingerprint: assembly.geometryFingerprint,
      rng: assembly.rng,
      counts: assembly.counts,
      builderOrder: assembly.builderOrder,
      mapOrder: assembly.mapOrder,
      clockPolicy: assembly.clockPolicy,
    },
    upstreamDiagnostic: assembly.status === 'geometry-complete' ? null : assembly,
    spaces: s.spaces,
    allSpacesBeforeShuffle: s.allSpacesBeforeShuffle,
    allSpaces: s.allSpaces.map((v) => v.id),
    assignments: records,
    selectedModels: [...new Set(records.map((a) => a.modelSource))].map((r) => ({
      ...s.models.get(r)!,
      selection: s.selectionModels.get(r)!,
    })),
    placementOrder: [...records].sort((a, b) => a.placementOrdinal - b.placementOrdinal),
    spawnOrder: s.spawnOrder.map((a) => ({
      ...a,
      prefab: s.models.get(a.modelSource)!.prefab,
      nodePosition: s.bySpace.get(a.spaceId)!.nodePosition,
    })),
    chosenGroup:
      s.chosenGroup === null
        ? null
        : input.assembly.selection.groups.find((g) => g.source === s.chosenGroup)!,
    history: {
      incoming: {
        usedEncounterIds: input.assembly.selection.context.usedEncounterIds,
        usedGroupIds: input.assembly.selection.context.usedGroupIds,
      },
      result: { usedEncounterIds: s.usedEncounterIds, usedGroupIds: s.usedGroupIds },
    },
    closure: {
      status: 'pending-prefab-execution',
      selectedPrefabSources: [...new Set(records.map((a) => a.prefab.source))],
      pending: [
        'GameNode/components',
        'attached-child-FSMs',
        'FsmTemplates/nested-RunFSM',
        'variables/events',
        'localization/Italian',
        'model/item/enemy/token-refs',
        'action-types/effects',
        'PRE_REVEAL/REVEALED/interaction/hide/remove',
        'group-shared-state',
      ],
    },
    search: {
      stage: s.stage,
      operations: s.operations,
      sectionCursor: s.sectionCursor,
      groupCursor: s.groupCursor,
      modelCursor: s.modelCursor,
      spaceCursor: s.spaceCursor,
      remainingCount: s.remainingCount,
      sequence: s.sequence,
      history: s.history,
      invalidSequences: s.invalid.children,
      invalidCount: s.invalid.count,
      eligibleGroups: s.eligibleGroups,
    },
    trace: s.trace,
    clock: {
      policy: input.execution.clock.policy,
      pollingPolicy: 'encounter-search-sites-v1',
      observations: s.clock.observations,
      cursor: s.clock.cursor,
    },
    rng: s.random?.snapshot() ?? null,
  });
}
export type EncounterResult = ReturnType<typeof placeMapEncounters>;
