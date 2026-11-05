import type { ScenarioPack } from './scenario';

/** Additional interactions are owned by the optional, immutable pre-startup capability. */
export function playableScenarioPrefab(pack: ScenarioPack, source: string) {
  return !!(
    pack.manifest.playablePrefabs?.includes(source) ||
    pack.manifest.clues?.encounters.includes(source) ||
    pack.manifest.lair?.prefab === source ||
    pack.manifest.baseProducts?.prefab === source ||
    pack.manifest.items?.prefab === source ||
    pack.manifest.firstCombat?.prefab === source ||
    pack.manifest.searches?.encounters.some((e) => e.prefab === source) ||
    pack.manifest.linked?.encounters.some((e) => e.prefab === source)
  );
}
