import { AssemblyStop } from '../map-assembly/execution';
import { storeFloat } from '../map-selection/model';
import { EncounterState } from './state';
import { firstFit, tryCollection } from './placement';

export function seedFill(s: EncounterState): void {
  s.stage = 'item';
  for (const source of s.assembly.selection.pools.itemEncounterPool) {
    s.tick('item-model');
    // A3c93:1771–17e9 has no global HasEncounter check here.
    if (firstFit(s, source, { stage: s.stage, sectionId: null, groupSource: null })) break;
  }
  s.stage = 'normal-fill';
  s.clearSearch(true);
  const pool = [...s.assembly.selection.pools.randomEncounterPool];
  for (const section of s.input.placement.sections) {
    s.sectionCursor = section.index;
    const spaces = s.spaces.filter((v) => v.sectionId === section.index);
    const threshold = Math.fround(section.randomFillPercent * Math.fround(spaces.length));
    while (Math.fround(spaces.filter((v) => v.encounterId >= 0).length) < threshold) {
      s.tick('fill-iteration');
      if (
        !tryCollection(s, pool, section.index, {
          stage: s.stage,
          sectionId: section.index,
          groupSource: null,
        })
      )
        break;
    }
    s.emit('fill-section', {
      sectionId: section.index,
      threshold: storeFloat(threshold),
      encounterCount: spaces.filter((v) => v.encounterId >= 0).length,
    });
  }
}

/** Source spawn order and history changes only; prefab execution remains gated. */
export function planSpawn(s: EncounterState): void {
  s.stage = 'spawn-plan';
  s.sectionCursor = null;
  for (let i = 0; i < s.allSpaces.length; i++) {
    s.spaceCursor = i;
    s.tick('spawn-space');
    const space = s.allSpaces[i]!;
    if (space.encounterId < 0) continue;
    const assignment = s.assignments.get(space.id)!;
    if (!s.ownedModels.has(assignment.modelSource)) {
      // A3c93:191b–1923 indexes Sections with allSpaces' index while logging.
      if (i >= s.input.placement.sections.length)
        throw new AssemblyStop(
          'source-operation-exception',
          'spawn-log-section-index',
          'Indice Sections del log fonte fuori intervallo.',
        );
      s.fail('spawn-model-not-owned');
    }
    if (!s.usedEncounterIds.includes(space.encounterId)) s.usedEncounterIds.push(space.encounterId);
    const spawn = { ...assignment, spawnOrdinal: s.spawnOrder.length };
    s.spawnOrder.push(spawn);
    s.emit('spawn-plan', spawn);
  }
  const group = s.input.assembly.selection.groups.find((g) => g.source === s.chosenGroup)!;
  if (!s.usedGroupIds.includes(group.id)) s.usedGroupIds.push(group.id);
  s.stage = 'encounter-boundary';
}
