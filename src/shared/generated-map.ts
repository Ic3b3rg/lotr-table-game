import { z } from 'zod';
import { ContentIdSchema } from './catalog';
import { CopyIdSchema } from './preparation';

export const HashSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const SourceSchema = z
  .string()
  .max(160)
  .regex(/^[\w.-]+:-?[1-9][0-9]*$/);
export const Int32Schema = z.int().min(-2147483648).max(2147483647);
export const HistorySchema = z.strictObject({
  usedEncounterIds: z.array(Int32Schema).max(10000),
  usedGroupIds: z.array(Int32Schema).max(10000),
  unlockedChainIds: z.array(Int32Schema).max(10000),
});
const mappedItem = z.strictObject({
  catalogId: ContentIdSchema,
  id: Int32Schema,
  source: SourceSchema,
});
export const GenerationContextSchema = HistorySchema.extend({
  policy: z.literal('new-base-A1-v1'),
  adventureId: z.literal(1),
  adventureSource: SourceSchema,
  builderSource: SourceSchema,
  catalogId: ContentIdSchema,
  catalogFingerprint: HashSchema,
  language: z.literal('Italian'),
  ownedProductIds: z.array(Int32Schema).length(1),
  groupItems: z.array(mappedItem).max(1000),
  groupItemIds: z.array(Int32Schema).max(1000),
  heroCount: z.int().min(1).max(5),
  heroes: z
    .array(
      z.strictObject({
        catalogId: ContentIdSchema,
        playerId: z.uuid(),
        roleId: ContentIdSchema,
        id: Int32Schema,
        source: SourceSchema,
        items: z.array(mappedItem.extend({ copy: CopyIdSchema })).max(3),
        itemIds: z.array(Int32Schema).max(3),
      }),
    )
    .min(1)
    .max(5),
});
export type GenerationContext = z.infer<typeof GenerationContextSchema>;

// Only selected shapes cross this boundary; the unused pack and search state do not.
import { GeometryPackSchema } from '../map-assembly/model';
import { PlacementPackSchema } from '../map-encounters/model';
import { StoredFloatSchema } from '../map-selection/model';
import { SourceRandomStateSchema } from '../map-generation/primitives';

export const VectorSchema = z.tuple([
  z.number().finite().min(-1e8).max(1e8),
  z.number().finite().min(-1e8).max(1e8),
  z.number().finite().min(-1e8).max(1e8),
]);
const coordinate = z.int().min(-2048).max(2048);
const cube = z.tuple([coordinate, coordinate, coordinate]).refine((v) => v[0] + v[1] + v[2] === 0);
const rotation = z.int().min(0).max(5);
const sectionId = z.int().min(0).max(3);
const index = z.int().min(0).max(10000);
const spaceId = z
  .string()
  .max(200)
  .regex(/^[\w.-]+:-?[1-9][0-9]*\/space\/[0-9]+$/);
const shape = GeometryPackSchema.shape.tiles.element;
const provenance = GeometryPackSchema.shape.provenance;
export const IncomingPoolsSchema = z.strictObject({
  randomEncounterPool: z.array(SourceSchema).max(20000),
  itemEncounterPool: z.array(SourceSchema).max(20000),
  percentNormal: StoredFloatSchema,
});
export const AttemptRecordSchema = z.strictObject({
  index,
  seed: Int32Schema,
  status: z.enum(['source-failure', 'source-operation-exception', 'administrative-stop']),
  stage: z.string().max(100),
  reason: z.string().max(150),
  sourceErrorCode: Int32Schema.nullable(),
  incomingFingerprint: HashSchema,
  retainedFingerprint: HashSchema,
  historyFingerprint: HashSchema,
  history: HistorySchema,
  rng: SourceRandomStateSchema.nullable(),
  evidenceFingerprint: HashSchema,
});
export const NodePolicySchema = z.strictObject({
  policy: z.literal('node-clean-attempt-v1'),
  workerWallMilliseconds: z.literal(60000),
  workerHeapMiB: z.literal(512),
  clock: z.literal('logical-clock-v1'),
  stepMilliseconds: z.literal(0),
  selectionOperations: z.literal(1000000),
  assemblyOperations: z.literal(1000000),
  encounterOperations: z.literal(1000000),
  maxTraceEvents: z.literal(200000),
  attemptsPerActivation: z.literal(8),
  maxAttempts: z.literal(64),
});
const endpoint = z.strictObject({
  sectionId,
  tileSource: SourceSchema,
  hashId: Int32Schema,
  hex: index,
  coords: cube,
  tileCoords: cube,
  direction: rotation,
  intrinsicDirection: rotation,
  spaceId,
});
const contact = z.strictObject({
  a: endpoint,
  b: endpoint,
  edges: z.tuple([shape.shape.edges.element.nullable(), shape.shape.edges.element.nullable()]),
  compatible: z.boolean(),
  traversable: z.boolean(),
  allowed: z.boolean(),
});
const movementProof = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('intra-tile-authoring'),
    tileSource: SourceSchema,
    spaceIndices: z.tuple([index, index]),
    spaceSources: z.tuple([SourceSchema, SourceSchema]),
  }),
  z.strictObject({ kind: z.literal('inter-tile-contact'), contactIndex: index }),
]);
export const PrefabSchema = z.strictObject({
  path: z.string().min(1).max(1500),
  resourceKey: z.string().min(1).max(1500),
  source: SourceSchema,
  targetClass: z.literal('GameObject'),
});
const selectedModel = z.strictObject({
  index,
  source: SourceSchema,
  id: Int32Schema.min(0),
  nodeType: Int32Schema,
  requiredTraits: Int32Schema,
  excludedTraits: Int32Schema,
  specificTileModelSource: SourceSchema.nullable(),
  specificSpaceIndex: Int32Schema,
  prefab: PrefabSchema,
  selection: z.strictObject({
    index,
    source: SourceSchema,
    id: Int32Schema,
    type: z.int().min(0).max(4),
    traits: Int32Schema,
    isRepeatable: z.boolean(),
    unsupportedLanguages: z.array(z.string().max(30)).max(20),
    itemSources: z.array(SourceSchema.nullable()).max(100),
  }),
});
export const ProjectionDataSchema = z.strictObject({
  formatVersion: z.literal(1),
  algorithm: z.literal('frozen-A1-v1'),
  validationVersion: z.literal('A1-semantic-v1'),
  sourceParity: z.literal('not-certified'),
  provenance,
  packFingerprint: HashSchema,
  contextFingerprint: HashSchema,
  context: GenerationContextSchema,
  requestedSeed: Int32Schema,
  successfulSeed: Int32Schema,
  attempts: z.array(AttemptRecordSchema).max(63),
  policy: NodePolicySchema,
  numericalPolicy: z.literal('portable-transform-f32-v1'),
  floatPolicy: z.literal('float32-per-operation-v1'),
  inputFingerprint: HashSchema,
  geometryFingerprint: HashSchema,
  placementFingerprint: HashSchema,
  evidence: z.strictObject({
    selection: HashSchema,
    assembly: HashSchema,
    encounters: HashSchema,
    clock: HashSchema,
  }),
  rng: z.strictObject({
    initial: SourceRandomStateSchema,
    geometry: SourceRandomStateSchema,
    final: SourceRandomStateSchema,
  }),
  builderOrder: z.tuple([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  mapOrder: z.array(sectionId).length(4),
  geometrySettings: GeometryPackSchema.pick({
    mapPosition: true,
    cornerCos: true,
    cornerSin: true,
    invalidConnections: true,
    sections: true,
  }),
  requiredConnections: z.array(z.tuple([sectionId, sectionId])).max(100),
  sections: z
    .array(
      z.strictObject({
        id: sectionId,
        source: SourceSchema,
        rotation,
        position: VectorSchema,
        cubeOrigin: cube,
        boundingSphere: z.strictObject({
          position: VectorSchema,
          radius: z.number().min(0).max(1e8),
        }),
        tiles: z
          .array(
            z.strictObject({
              source: SourceSchema,
              sourceIndex: index,
              bucket: z.enum(['standard', 'custom']),
              code: z.string().min(1).max(100),
              hashId: Int32Schema,
              oppositeHashId: Int32Schema,
              modelSource: SourceSchema,
              rotation,
              compositeRotation: rotation,
              localPosition: VectorSchema,
              worldPosition: VectorSchema,
              shape,
              hexes: z
                .array(
                  z.strictObject({
                    source: SourceSchema,
                    index,
                    tileCoords: cube,
                    sectionCoords: cube,
                    globalCoords: cube,
                    space: index,
                    worldCenter: VectorSchema,
                  }),
                )
                .min(1)
                .max(32),
            }),
          )
          .min(1)
          .max(120),
      }),
    )
    .length(4),
  spaces: z
    .array(
      z.strictObject({
        id: spaceId,
        source: SourceSchema,
        sectionId,
        tileSource: SourceSchema,
        index,
        traits: Int32Schema,
        hasDarkness: z.boolean(),
        encounterId: Int32Schema.min(-1),
        hexes: z.array(cube).min(1).max(32),
        nodePosition: VectorSchema,
        connected: z.array(spaceId).max(1000),
      }),
    )
    .min(1)
    .max(1000),
  contacts: z.array(contact).max(10000),
  movementGraph: z.strictObject({
    algorithm: z.literal('authoring-and-traversable-contacts-v1'),
    edges: z
      .array(
        z.strictObject({
          a: spaceId,
          b: spaceId,
          provenance: z.array(movementProof).min(1).max(100),
        }),
      )
      .max(10000),
    components: z.array(z.array(spaceId).min(1).max(1000)).length(1),
  }),
  allSpaces: z.array(spaceId).min(1).max(1000),
  assignments: z
    .array(
      z.strictObject({
        spaceId,
        encounterId: Int32Schema.min(0),
        modelSource: SourceSchema,
        origin: z.strictObject({
          stage: z.enum([
            'fixed-tile',
            'required-section',
            'required-adventure',
            'group-required',
            'group-optional',
            'item',
            'normal-fill',
          ]),
          sectionId: sectionId.nullable(),
          groupSource: SourceSchema.nullable(),
        }),
        placementOrdinal: index,
        prefab: PrefabSchema,
        nodePosition: VectorSchema,
      }),
    )
    .max(1000),
  selectedModels: z.array(selectedModel).max(1000),
  encounterRequirements: PlacementPackSchema.pick({
    sections: true,
    adventureEncounterSources: true,
  }),
  spawnOrder: z.array(spaceId).max(1000),
  chosenGroup: z.strictObject({
    index,
    source: SourceSchema,
    id: Int32Schema,
    isRepeatable: z.boolean(),
    requiredSources: z.array(SourceSchema).max(1000),
    optionalSources: z.array(SourceSchema).max(1000),
    requiredOptionalCount: z.int().min(0).max(1000),
  }),
  history: HistorySchema,
  closure: z.strictObject({
    status: z.literal('pending-prefab-execution'),
    selectedPrefabSources: z.array(SourceSchema).max(1000),
  }),
  continuation: z.strictObject({
    boundary: z.literal('before-BeginAdventure(false)'),
    status: z.literal('pending-startup'),
    pending: z.tuple([
      z.literal('selected-prefab-closure'),
      z.literal('initial-nodes'),
      z.literal('objective-0'),
      z.literal('scout-2-each-hero'),
      z.literal('spirit-1'),
    ]),
    gameplayRng: z.null(),
  }),
});
export const ProjectionSchema = ProjectionDataSchema.extend({ fingerprint: HashSchema });
export type Projection = z.infer<typeof ProjectionSchema>;
export type AttemptRecord = z.infer<typeof AttemptRecordSchema>;
export const GenerationJobSchema = z.strictObject({
  id: z.uuid(),
  packFingerprint: HashSchema,
  contextFingerprint: HashSchema,
  context: GenerationContextSchema,
  requestedSeed: Int32Schema,
  seed: Int32Schema,
  attempt: z.int().min(0).max(63),
  incoming: IncomingPoolsSchema,
  attempts: z.array(AttemptRecordSchema).max(63),
  policy: NodePolicySchema,
});
export type GenerationJob = z.infer<typeof GenerationJobSchema>;
const requestKey = z.strictObject({
  playerId: z.uuid(),
  requestId: z
    .string()
    .min(24)
    .max(80)
    .regex(/^[A-Za-z0-9_-]+$/),
  type: z.enum(['GENERATE_ADVENTURE_MAP', 'RESUME_ADVENTURE_MAP']),
});
export const MapGenerationSchema = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('pending'),
    job: GenerationJobSchema,
    requests: z.array(requestKey).min(1).max(65),
  }),
  z.strictObject({
    status: z.literal('paused'),
    job: GenerationJobSchema,
    requests: z.array(requestKey).min(1).max(65),
    failure: AttemptRecordSchema.nullable(),
    reason: z.enum([
      'attempt-batch-limit',
      'source-operation-exception',
      'administrative-stop',
      'attempt-limit',
      'worker-failed',
    ]),
  }),
  z.strictObject({
    status: z.literal('frozen'),
    id: z.uuid(),
    projection: ProjectionSchema,
    requests: z.array(requestKey).min(1).max(65),
  }),
]);
export type MapGeneration = z.infer<typeof MapGenerationSchema>;
export const GenerationOfferSchema = z.strictObject({
  kind: z.enum(['legacy', 'unavailable', 'ready', 'pending', 'paused', 'frozen']),
  packFingerprint: HashSchema.nullable(),
  contextFingerprint: HashSchema.nullable(),
  jobId: z.uuid().nullable(),
  attempt: z.int().min(1).max(64).nullable(),
  running: z.boolean(),
  canResume: z.boolean(),
  message: z.string().min(1).max(600),
});
export type GenerationOffer = z.infer<typeof GenerationOfferSchema>;
