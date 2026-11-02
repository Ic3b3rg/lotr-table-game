// Invented ordered multi-tile/four-section data. No original game assets.
import { createHash } from 'node:crypto';
export const ref = (n) => `invented.assets:${n}`;
export const digest = (s) => createHash('sha256').update(s).digest('hex');
export const frame = (source, position = [0, 0, 0]) => ({
  source,
  position,
  rotation: [0, 0, 0, 1],
  scale: [1, 1, 1],
});
export function assemblyFixture() {
  const standard = Array.from({ length: 120 }, (_, index) => ({
    index,
    source: ref(1000 + index),
    modelSource: ref(2000 + index),
    code: `invented-${index}`,
    hashId: 10000 + index,
    oppositeHashId: 10000 + (index ^ 1),
    set: 1,
    spaces: [0, 1].map((n) => ({ index: n, source: ref(3000 + index * 2 + n), traits: 1 })),
  }));
  const f = Math.fround;
  const coords = [
    [0, 0, 0],
    [1, -1, 0],
    [0, -1, 1],
    [-1, 0, 1],
    [-1, 1, 0],
    [0, 1, -1],
    [1, 0, -1],
  ];
  const cornerCos = [0.8660254, 0, -0.8660254, -0.8660254, 0, 0.8660254].map(f);
  const cornerSin = [-0.5, -1, -0.5, 0.5, 1, 0.5].map(f);
  const selection = {
    formatVersion: 1,
    algorithm: 'source-selection-v1',
    provenance: {
      sourceVersion: 'invented-v1',
      files: [{ file: 'invented.assets', sha256: digest('invented') }],
    },
    context: {
      adventureId: 1,
      seed: 1,
      heroCount: 1,
      language: 'Italian',
      ownedProductIds: [0],
      groupItemIds: [],
      heroes: [{ id: 1, source: ref(4000), itemIds: [] }],
      usedEncounterIds: [],
      usedGroupIds: [],
      unlockedChainIds: [],
    },
    products: [
      {
        index: 0,
        source: ref(1),
        id: 0,
        tileCodes: standard.slice(0, 8).map((t) => t.code),
        encounterSources: [],
        groupSources: [],
        itemQuantities: [],
      },
    ],
    items: [],
    encounters: [],
    groups: [],
    standard,
    custom: [],
    sections: Array.from({ length: 4 }, (_, index) => ({
      index,
      source: ref(5000 + index),
      allowedTileSets: 1,
      minimumSpaces: 4,
      maximumSpaces: 4,
      ignorePlayerScaling: true,
      relativeSizeFactor: -1,
      start: { isStandard: true, modelSource: standard[index * 2].modelSource },
      required: [{ isStandard: true, modelSource: standard[index * 2 + 1].modelSource }],
      traitRequirements: [],
      fixedEncounterSources: [],
    })),
    requiredConnections: [
      [0, 1],
      [2, 3],
      [3, 1],
      [2, 1],
    ],
    adventureEncounterSources: [],
    encounterTraitsFilter: { mustHaveAny: 0, mustHaveAll: 0, excludeIfAny: 0 },
    incoming: { randomEncounterPool: [], itemEncounterPool: [], percentNormal: f(0.4) },
    budget: { policy: 'selection-operations-v1', maxOperations: 100000 },
  };
  const tiles = standard.slice(0, 8).map((t, i) => ({
    source: t.source,
    modelSource: t.modelSource,
    hashId: t.hashId,
    resetPosition: [0, 0, 0],
    authoring: [frame(ref(6000 + i))],
    spaces: t.spaces.map((s) => ({
      source: s.source,
      traits: s.traits,
      hasDarkness: false,
      nodeAnchor: [frame(ref(7000 + i))],
      serializedConnectedSpaces: [1 - s.index],
    })),
    hexes: coords.map((c, h) => ({
      source: ref(10000 + i * 20 + h),
      coords: [...c],
      space: h < 3 ? 0 : 1,
      transform: [
        frame(ref(13000 + i * 20 + h), [f(Math.sqrt(3) * (c[0] + c[2] / 2)), f(-1.5 * c[2]), 0]),
      ],
      meshSource: ref(8000),
      bounds: { center: [0, 0, 0], extents: [f(Math.sqrt(3) / 2), 1, 0] },
      render: { polygon: [], uv: [] },
    })),
    edges: coords.flatMap((_, h) =>
      Array.from({ length: 6 }, (_, direction) => ({
        source: ref(16000 + i * 100 + h * 6 + direction),
        hex: h,
        direction,
        traits: 0,
        isPassageOpen: true,
      })),
    ),
    render: { imagePath: 'invented', uvAffine: [] },
  }));
  return {
    formatVersion: 1,
    algorithm: 'source-map-assembly-v1',
    selection,
    geometry: {
      formatVersion: 1,
      algorithm: 'source-map-geometry-pack-v1',
      provenance: structuredClone(selection.provenance),
      mapPosition: [0, 0, 0],
      cornerCos,
      cornerSin,
      sections: selection.sections.map((s) => ({
        id: s.index,
        source: s.source,
        position: [0, 0, 0],
        tileClumpFactor: 1,
        sectionClumpFactor: 1,
        authoring: [frame(ref(9000 + s.index))],
      })),
      invalidConnections: [],
      tiles,
    },
    execution: {
      clock: { policy: 'logical-clock-v1', stepMilliseconds: 0, timeoutMilliseconds: 30000 },
      maxOperations: 1000000,
      maxTraceEvents: 100000,
    },
  };
}
