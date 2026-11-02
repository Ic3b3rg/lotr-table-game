import { comparisonSort } from '../map-generation/primitives';
import type { PlacementModel } from './model';
import { EncounterState, type Origin, type Space } from './state';

/** A0ead: SpecificTile identity/index takes precedence over trait requirements. */
export function meets(s: EncounterState, space: Space, model: PlacementModel): boolean {
  if (model.specificTileModelSource !== null)
    return (
      s.tiles.get(space.tileSource)!.modelSource === model.specificTileModelSource &&
      space.index === model.specificSpaceIndex
    );
  return (
    (space.traits & model.requiredTraits) === model.requiredTraits &&
    (space.traits & model.excludedTraits) === 0
  );
}
function adjacentThreats(s: EncounterState, space: Space): number {
  let count = 0;
  for (const id of space.connected) {
    s.tick('adjacent-threat');
    const neighbor = s.bySpace.get(id)!;
    const model = [...s.models.values()].find(
      (m) => m.id === neighbor.encounterId && s.allModels.has(m.source),
    );
    if (model?.nodeType === 2) count++;
  }
  return count;
}
/** A1349: local scan, skip failed models, randomize only eligible/minimum prefix. */
export function tryCollection(
  s: EncounterState,
  sources: string[],
  sectionId: number,
  origin: Origin,
): Space | null {
  for (let i = 0; i < sources.length; i++) {
    s.modelCursor = i;
    s.tick('collection-model');
    const model = s.models.get(sources[i]!)!;
    if (
      s.has(model.id) ||
      s.invalid.wouldExist(s.sequence, model.id) ||
      !s.allModels.has(model.source)
    )
      continue;
    const eligible: Space[] = [];
    for (const space of s.spaces) {
      if (space.sectionId !== sectionId) continue;
      s.spaceCursor = space.index;
      s.tick('collection-space');
      if (space.encounterId < 0 && meets(s, space, model)) eligible.push(space);
    }
    const counts = new Map<string, number>();
    let prefixCount = eligible.length,
      minimumAdjacent: number | null = null;
    if (eligible.length && model.nodeType === 2) {
      for (const space of eligible) counts.set(space.id, adjacentThreats(s, space));
      comparisonSort(eligible, (a, b) => {
        s.tick('threat-comparison');
        return counts.get(a.id)! - counts.get(b.id)!;
      });
      minimumAdjacent = counts.get(eligible[0]!.id)!;
      prefixCount = eligible.findIndex((space) => counts.get(space.id)! > minimumAdjacent!);
      if (prefixCount < 0) prefixCount = eligible.length;
    }
    s.emit('eligible-spaces', {
      modelSource: model.source,
      sectionId,
      eligibleSpaces: eligible.map((v) => v.id),
      adjacentThreatCounts: eligible.map((v) => counts.get(v.id) ?? 0),
      minimumAdjacent,
      prefixCount,
    });
    if (!eligible.length) continue;
    return s.assign(eligible[s.draw('section-space', 0, prefixCount)]!, model.source, origin);
  }
  return null;
}
/** A1329: first empty compatible shuffled space, no draw and no Threat preference. */
export function firstFit(s: EncounterState, source: string, origin: Origin): Space | null {
  const model = s.models.get(source)!;
  for (let i = 0; i < s.allSpaces.length; i++) {
    s.spaceCursor = i;
    s.tick('first-fit-space');
    const space = s.allSpaces[i]!;
    if (space.encounterId < 0 && meets(s, space, model)) return s.assign(space, source, origin);
  }
  return null;
}
export function firstPending(s: EncounterState, sources: string[]): string | null {
  for (let i = 0; i < sources.length; i++) {
    s.modelCursor = i;
    s.tick('set-model');
    const source = sources[i]!,
      model = s.models.get(source)!;
    if (!s.has(model.id) && !s.invalid.wouldExist(s.sequence, model.id)) return source;
  }
  return null;
}
/** A1328 returns the first attempted model's result, even if a later one could fit. */
export function trySet(s: EncounterState, sources: string[], origin: Origin): Space | null {
  const source = firstPending(s, sources);
  if (source === null) return null;
  s.emit('set-candidate', { modelSource: source });
  return firstFit(s, source, origin);
}
export function remember(s: EncounterState, space: Space): void {
  const h = {
    encounterId: space.encounterId,
    tileId: s.tiles.get(space.tileSource)!.hashId,
    spaceIndex: space.index,
    spaceId: space.id,
  };
  s.sequence.push(space.encounterId);
  s.history.push(h);
  s.emit('search-append', h);
}
/** Resolve rollback by Map.GetTile(hash)/GetSpace(index), retaining full diagnostic IDs. */
export function rollback(s: EncounterState): void {
  const sequence = [...s.sequence];
  s.invalid.add(sequence);
  s.sequence.pop();
  const h = s.history.pop()!;
  const tile = s.assembly.mapOrder
    .flatMap((id) => s.assembly.sections[id]!.tiles)
    .find((t) => t.hashId === h.tileId)!;
  const space = s.spaces.find((v) => v.tileSource === tile.source && v.index === h.spaceIndex)!;
  space.encounterId = -1;
  s.assignments.delete(space.id);
  s.emit('rollback', {
    ...h,
    sequence,
    clearedSpaceId: space.id,
    invalidSequences: s.invalid.children,
  });
}
