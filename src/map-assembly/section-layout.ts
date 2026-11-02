import { comparisonSort } from '../map-generation/primitives';
import { add, cubeKey, directionCube, normalizeDirection } from '../map-geometry/model';
import { canMatch, isConnection } from '../map-geometry/geometry';
import type { Observe } from './execution';
import { AssemblyStop } from './execution';
import type { World, SectionState, Placement } from './state';
import {
  composite,
  getEdge,
  mapEdges,
  occupancy,
  sectionEdges,
  snapSection,
  sphere,
} from './state';
import { f, strictSphere } from './physical';
import { placementCompare, rank, short } from './local-layout';

export type SectionSearch = {
  index: number;
  localMin: number;
  localMinSearchStartTime: number;
  rollbackSectionId: number;
  targetCursor: number;
  anchorCursor: number;
  contactCursor: number;
};
export function sectionOrders(w: World): { first: number[]; sorted: number[] } {
  const count = (id: number) =>
    w.input.selection.requiredConnections.filter(([a, b]) => a === id || b === id).length;
  const sorted = w.sections.map((s) => s.id);
  comparisonSort(sorted, (a, b) => count(b) - count(a));
  const first = [...sorted],
    most = sorted[0]!;
  comparisonSort(sorted, (a, b) => {
    const result = count(b) - count(a);
    if (a === most) return -1;
    if (b === most) return 1;
    if (result === 0) return w.sections[a]!.required.includes(most) ? -1 : 1;
    return result;
  });
  return { first, sorted };
}
export const allowed = (w: World, a: number, b: number) =>
  !w.input.geometry.invalidConnections.some(
    ([x, y]) => (x === a && y === b) || (x === b && y === a),
  );
function calculate(
  w: World,
  s: SectionState,
  map: SectionState[],
  search: SectionSearch,
  o: Observe,
): void {
  const full = mapEdges(w, map),
    incoming = s.localEdges,
    fullCombinedCount = full.length + incoming.length;
  let targets = full,
    targetSectionId: number | null = null;
  s.placements = [];
  const requiredAttached = s.required.filter((id) => map.some((s) => s.id === id));
  for (const id of requiredAttached) {
    const edges = sectionEdges(w, w.sections[id]!);
    if (edges.length <= targets.length) {
      targets = edges;
      targetSectionId = id;
    }
  }
  const occupied = occupancy(map),
    rejected: Record<string, number> = {
      anchor: 0,
      forbidden: 0,
      sphere: 0,
      overlap: 0,
      contact: 0,
      required: 0,
    };
  let enumerationIndex = 0;
  let nonTraversableForbiddenContacts = 0;
  for (let ti = 0; ti < targets.length; ti++) {
    search.targetCursor = ti;
    const target = targets[ti]!,
      targetTile = w.tiles.get(target.tileSource)!;
    for (let ai = 0; ai < incoming.length; ai++) {
      search.anchorCursor = ai;
      o.tick('section-anchor');
      const anchor = incoming[ai]!,
        tile = w.tiles.get(anchor.tileSource)!;
      const a = getEdge(tile, anchor.hex, anchor.direction),
        b = getEdge(targetTile, target.hex, target.direction);
      if (!a || !b || !isConnection(b, a)) {
        rejected.anchor!++;
        continue;
      }
      if (!allowed(w, s.id, targetTile.sectionId!)) {
        rejected.forbidden!++;
        continue;
      }
      const candidate: Placement = {
        anchor,
        target,
        sectionId: s.id,
        targetSectionId: targetTile.sectionId!,
        openEdgeCount: fullCombinedCount,
        enumerationIndex: enumerationIndex++,
      };
      snapSection(w, s, candidate);
      if (
        s.required.length > 0 &&
        requiredAttached.some((id) => !strictSphere(sphere(w, s), sphere(w, w.sections[id]!)))
      ) {
        rejected.sphere!++;
        continue;
      }
      if (s.tiles.some((t) => t.globals.some((c) => occupied.has(cubeKey(c))))) {
        rejected.overlap!++;
        continue;
      }
      let compatible = true;
      const contacted: number[] = [];
      for (let ci = 0; ci < incoming.length; ci++) {
        search.contactCursor = ci;
        o.tick('section-contact');
        const e = incoming[ci]!,
          t = w.tiles.get(e.tileSource)!,
          d = normalizeDirection(e.direction + composite(w, t));
        const neighbor = occupied.get(cubeKey(add(t.globals[e.hex]!, directionCube(d))));
        if (!neighbor) continue;
        const ours = getEdge(t, e.hex, e.direction),
          other = getEdge(
            neighbor.tile,
            neighbor.index,
            normalizeDirection(d + 3 - composite(w, neighbor.tile)),
          );
        if (!ours || !other || !canMatch(other, ours)) {
          rejected.contact!++;
          compatible = false;
          break;
        }
        if (!allowed(w, s.id, neighbor.section.id)) {
          if (!isConnection(other, ours)) nonTraversableForbiddenContacts++;
          rejected.forbidden!++;
          compatible = false;
          break;
        }
        if (isConnection(other, ours) && !contacted.includes(neighbor.section.id))
          contacted.push(neighbor.section.id);
        candidate.openEdgeCount -= 2;
      }
      if (!compatible) continue;
      if (s.required.length > 0 && !requiredAttached.every((id) => contacted.includes(id))) {
        rejected.required!++;
        continue;
      }
      candidate.openEdgeCount = short(candidate.openEdgeCount);
      s.placements.push(candidate);
    }
  }
  if (s.placements.length > 0) comparisonSort(s.placements, placementCompare);
  else {
    search.rollbackSectionId = map[map.length - 1]!.id;
    if (s.required.length > 0)
      for (let i = map.length - 1; i > 0; i--)
        if (requiredAttached.includes(map[i]!.id)) {
          search.rollbackSectionId = map[i]!.id;
          break;
        }
  }
  o.emit('section-candidates', {
    sectionId: s.id,
    mapOrder: map.map((s) => s.id),
    fullMapBoundaryCount: full.length,
    incomingBoundaryCount: incoming.length,
    fullCombinedCount,
    nonTraversableForbiddenContacts,
    targetBoundaryCount: targets.length,
    targetSectionId,
    requiredAttached,
    count: s.placements.length,
    rejected,
    candidates: s.placements,
    rollbackSectionId: search.rollbackSectionId,
  });
}
export function layoutSections(
  w: World,
  order: number[],
  map: SectionState[],
  search: SectionSearch,
  o: Observe,
  time: (site: string) => number,
): void {
  search.localMin = order.length;
  search.localMinSearchStartTime = f(time('section-search-start') / 1000);
  map.push(w.sections[order[0]!]!);
  o.emit('map-root', { sectionId: order[0], mapOrder: map.map((s) => s.id) });
  for (let i = 1; i < order.length; i++) {
    search.index = i;
    o.tick('section-loop');
    const s = w.sections[order[i]!]!;
    if (!s.placements.length) {
      calculate(w, s, map, search, o);
      if (!s.placements.length) {
        const elapsed = f(time('five-second-test') / 1000),
          jump = f(elapsed - search.localMinSearchStartTime) > 5;
        o.emit('five-second-decision', {
          sectionId: s.id,
          index: i,
          elapsed,
          localMin: search.localMin,
          localMinSearchStartTime: search.localMinSearchStartTime,
          jump,
          mapOrder: map.map((s) => s.id),
        });
        if (jump) {
          if (!map[1])
            throw new AssemblyStop(
              'source-operation-exception',
              'five-second-map-index',
              'A3c93:0b30: Map.Sections[1] assente.',
            );
          search.rollbackSectionId = map[1]!.id;
        }
        let removedCount = 0;
        for (;;) {
          o.tick('section-rollback');
          const removed = map.pop()!;
          o.emit('section-remove', {
            sectionId: removed.id,
            target: search.rollbackSectionId,
            remainingCandidates: removed.placements.length,
            mapOrder: map.map((s) => s.id),
          });
          if (!map.length)
            throw new AssemblyStop(
              'source-failure',
              'section-root-exhausted',
              'Impossibile assemblare tutte le sezioni: radice rimossa.',
              2,
            );
          removedCount++;
          if (removed.id !== search.rollbackSectionId) {
            removed.placements = [];
            o.emit('clear-section-candidates', { sectionId: removed.id });
            continue;
          }
          if (!removed.placements.length) {
            search.rollbackSectionId = map[map.length - 1]!.id;
            continue;
          }
          break;
        }
        const depth = i - removedCount;
        if (depth < search.localMin || search.localMin === 1) {
          search.localMin = depth;
          search.localMinSearchStartTime = f(time('local-min-reset') / 1000);
        }
        i -= removedCount + 1;
        o.emit('section-rollback-resume', {
          nextSortedIndex: i + 1,
          removedCount,
          rollbackSectionId: search.rollbackSectionId,
          localMin: search.localMin,
          localMinSearchStartTime: search.localMinSearchStartTime,
        });
        if (i < 0)
          throw new AssemblyStop(
            'source-failure',
            'section-index-exhausted',
            'Indice di ricerca delle sezioni esaurito.',
            2,
          );
        continue;
      }
    }
    let sum = 0;
    for (const existing of w.sections)
      if (map.includes(existing))
        sum = f(sum + w.input.geometry.sections[existing.id]!.sectionClumpFactor);
    const average = f(sum / f(map.length)),
      factor = f(f(average + w.input.geometry.sections[s.id]!.sectionClumpFactor) * 0.5),
      index = rank(s.placements.length, factor),
      count = s.placements.length;
    const chosen = s.placements.splice(index, 1)[0];
    if (!chosen)
      throw new AssemblyStop(
        'source-operation-exception',
        'section-placement-index',
        'Indice SectionPlacement non valido.',
      );
    snapSection(w, s, chosen);
    map.push(s);
    o.emit('section-attach', {
      sectionId: s.id,
      count,
      index,
      average,
      factor,
      chosen,
      remainingCandidates: s.placements.length,
      mapOrder: map.map((s) => s.id),
    });
  }
  search.index = order.length;
}
