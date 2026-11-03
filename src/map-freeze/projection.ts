import type { AssemblyResult } from '../map-assembly/assembly';
import type { EncounterInput } from '../map-encounters/model';
import type { EncounterResult } from '../map-encounters/encounters';
import { SourceRandom } from '../map-generation/primitives';
import {
  ProjectionDataSchema,
  type GenerationContext,
  type AttemptRecord,
} from '../shared/generated-map';
import { GENERATION_POLICY, type GeneratorPack } from './pack';
import { digest } from './hash';
import { validateProjection } from './validate';

export function projectRealization(
  pack: GeneratorPack,
  context: GenerationContext,
  requestedSeed: number,
  attempts: AttemptRecord[],
  input: EncounterInput,
  assembly: AssemblyResult,
  encounters: EncounterResult,
) {
  if (assembly.status !== 'geometry-complete' || encounters.status !== 'encounters-complete')
    throw new Error('Pipeline non completa.');
  const data = ProjectionDataSchema.parse({
    formatVersion: 1,
    algorithm: 'frozen-A1-v1',
    validationVersion: 'A1-semantic-v1',
    sourceParity: 'not-certified',
    provenance: input.placement.provenance,
    packFingerprint: digest(pack),
    contextFingerprint: digest(context),
    context,
    requestedSeed,
    successfulSeed: input.assembly.selection.context.seed,
    attempts,
    policy: GENERATION_POLICY,
    numericalPolicy: assembly.numericalPolicy,
    floatPolicy: assembly.floatPolicy,
    inputFingerprint: encounters.inputFingerprint,
    geometryFingerprint: assembly.geometryFingerprint,
    placementFingerprint: encounters.placementFingerprint,
    evidence: {
      selection: digest(assembly.selection.trace),
      assembly: digest(assembly.trace),
      encounters: digest(encounters.trace),
      clock: digest([assembly.clock, encounters.clock]),
    },
    retryState: {
      incoming: input.assembly.selection.incoming,
      retainedFingerprint: digest({
        randomEncounterPool: assembly.selection.pools.randomEncounterPool,
        itemEncounterPool: assembly.selection.pools.itemEncounterPool,
        percentNormal: assembly.selection.pools.percentNormal,
      }),
      eligibleItemCount: assembly.selection.pools.itemEligible.length,
    },
    rng: {
      initial: new SourceRandom(input.assembly.selection.context.seed).snapshot(),
      geometry: assembly.rng,
      final: encounters.rng,
    },
    builderOrder: assembly.builderOrder,
    mapOrder: assembly.mapOrder,
    geometrySettings: {
      mapPosition: input.assembly.geometry.mapPosition,
      cornerCos: input.assembly.geometry.cornerCos,
      cornerSin: input.assembly.geometry.cornerSin,
      invalidConnections: input.assembly.geometry.invalidConnections,
      sections: input.assembly.geometry.sections,
    },
    requiredConnections: input.assembly.selection.requiredConnections,
    sections: assembly.sections.map((s) => ({
      id: s.id,
      source: s.source,
      rotation: s.localRotations,
      position: s.displayPosition,
      cubeOrigin: s.cubeOrigin,
      boundingSphere: s.boundingSphere,
      tiles: s.tiles.map((t) => {
        const standard = input.assembly.selection.standard.find((v) => v.source === t.source),
          custom = input.assembly.selection.custom.find((v) => v.source === t.source);
        const model = standard ?? custom!;
        return {
          source: t.source,
          sourceIndex: model.index,
          bucket: standard ? 'standard' : 'custom',
          code: model.code,
          hashId: t.hashId,
          oppositeHashId: model.oppositeHashId,
          modelSource: t.modelSource,
          rotation: t.localRotations,
          compositeRotation: t.compositeRotations,
          localPosition: t.localDisplayPosition,
          worldPosition: t.worldDisplayPosition,
          shape: input.assembly.geometry.tiles.find((v) => v.source === t.source)!,
          hexes: t.hexes,
        };
      }),
    })),
    spaces: encounters.spaces,
    contacts: assembly.contacts,
    movementGraph: {
      algorithm: assembly.movementGraph.algorithm,
      edges: assembly.movementGraph.edges,
      components: assembly.movementGraph.components,
    },
    allSpaces: encounters.allSpaces,
    assignments: encounters.assignments,
    selectedModels: encounters.selectedModels,
    encounterRequirements: {
      sections: input.placement.sections,
      adventureEncounterSources: input.placement.adventureEncounterSources,
    },
    spawnOrder: encounters.spawnOrder.map((v) => v.spaceId),
    chosenGroup: encounters.chosenGroup,
    history: { ...encounters.history.result, unlockedChainIds: context.unlockedChainIds },
    closure: {
      status: encounters.closure.status,
      selectedPrefabSources: encounters.closure.selectedPrefabSources,
    },
    continuation: {
      boundary: 'before-BeginAdventure(false)',
      status: 'pending-startup',
      pending: [
        'selected-prefab-closure',
        'initial-nodes',
        'objective-0',
        'scout-2-each-hero',
        'spirit-1',
      ],
      gameplayRng: null,
    },
  });
  return validateProjection({ ...data, fingerprint: digest(data) });
}
