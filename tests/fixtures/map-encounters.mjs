// Entirely invented metadata; no game contents or original prefab paths.
import { assemblyFixture, ref } from './map-assembly.mjs';
export function encountersFixture() {
  const assembly = assemblyFixture();
  const input = {
    formatVersion: 1,
    algorithm: 'source-map-encounters-v1',
    assembly,
    placement: {
      formatVersion: 1,
      algorithm: 'source-encounter-placement-pack-v1',
      provenance: structuredClone(assembly.selection.provenance),
      models: [],
      sections: assembly.selection.sections.map((s) => ({
        index: s.index,
        source: s.source,
        tileEncounters: [],
        sectionEncounterSources: [],
        randomFillPercent: 0,
      })),
      adventureEncounterSources: [],
      specifiedGroupSource: null,
    },
    execution: {
      policy: 'encounter-operations-v1',
      clock: { policy: 'logical-clock-v1', stepMilliseconds: 0, timeoutMilliseconds: 30000 },
      maxOperations: 100000,
      maxTraceEvents: 100000,
    },
  };
  addGroup(input);
  return input;
}
export function addEncounter(input, edit = {}, placement = {}) {
  const selection = input.assembly.selection;
  const index = selection.encounters.length;
  const model = {
    index,
    source: ref(30000 + index),
    id: 100000 + index,
    type: 3,
    traits: 1,
    isRepeatable: false,
    unsupportedLanguages: [],
    itemSources: [],
    ...edit,
  };
  selection.encounters.push(model);
  selection.products[0].encounterSources.push(model.source);
  input.placement.models.push({
    index,
    source: model.source,
    id: model.id,
    nodeType: 0,
    requiredTraits: 0,
    excludedTraits: 0,
    specificTileModelSource: null,
    specificSpaceIndex: 0,
    prefab: {
      path: `Assets/Resources/Invented/Example${index}.prefab`,
      resourceKey: `invented/example${index}`,
      source: ref(40000 + index),
      targetClass: 'GameObject',
    },
    ...placement,
  });
  return model.source;
}
export function addGroup(input, edit = {}) {
  const selection = input.assembly.selection;
  const index = selection.groups.length;
  const group = {
    index,
    source: ref(50000 + index),
    id: 90000 + index,
    isRepeatable: false,
    requiredSources: [],
    optionalSources: [],
    requiredOptionalCount: 0,
    ...edit,
  };
  selection.groups.push(group);
  selection.products[0].groupSources.push(group.source);
  return group.source;
}
export function fixed(input, section, tile, source, spaceIndex = 0) {
  input.placement.sections[section].tileEncounters.push({
    encounterSource: source,
    tileId: input.assembly.selection.standard[tile].hashId,
    specifySpaceIndex: spaceIndex !== null,
    spaceIndex: spaceIndex ?? 0,
  });
  synchronize(input);
}
export function synchronize(input) {
  for (const s of input.placement.sections)
    input.assembly.selection.sections[s.index].fixedEncounterSources = [
      ...(s.tileEncounters ?? []).map((e) => e.encounterSource),
      ...(s.sectionEncounterSources ?? []),
    ];
  input.assembly.selection.adventureEncounterSources =
    input.placement.adventureEncounterSources ?? [];
  return input;
}
