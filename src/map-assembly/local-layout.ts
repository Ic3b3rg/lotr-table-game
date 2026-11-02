import { comparisonSort, SourceRandom } from '../map-generation/primitives';
import { add, cubeKey, directionCube, normalizeDirection } from '../map-geometry/model';
import { canMatch, isConnection } from '../map-geometry/geometry';
import { AssemblyStop, type Observe } from './execution';
import type { SectionState, TileState, World, Placement } from './state';
import {
  attachTile,
  composite,
  getEdge,
  occupancy,
  sectionEdges,
  snapTile,
  resetTile,
  rotateTile,
} from './state';
import { f, transform, times } from './physical';

export type TrieNode = { value: number; children: TrieNode[] };
/** Ordered SequenceTree, including final-node pruning and nonterminal prefixes. */
export class PrefixTree {
  children: TrieNode[] = [];
  add(sequence: number[]): void {
    let children = this.children;
    for (const value of sequence) {
      let node = children.find((n) => n.value === value);
      if (!node) {
        node = { value, children: [] };
        children.push(node);
      }
      children = node.children;
    }
    children.length = 0;
  }
  wouldExist(sequence: number[], value: number): boolean {
    let children = this.children;
    for (const v of sequence) {
      const node = children.find((n) => n.value === v);
      if (!node) return false;
      children = node.children;
    }
    return children.some((n) => n.value === value);
  }
  get count(): number {
    let n = 0;
    const stack = [...this.children];
    while (stack.length) {
      const node = stack.pop()!;
      n++;
      stack.push(...node.children);
    }
    return n;
  }
}
export const rank = (count: number, factor: number) => Math.trunc(f(f(count - 1) * f(1 - factor)));
export const short = (n: number) => (n << 16) >> 16;
export const placementCompare = (a: Placement, b: Placement) => a.openEdgeCount - b.openEdgeCount;
export type LocalSearch = {
  sequence: number[];
  history: { sectionId: number; tileId: number; tileSource: string }[];
  invalid: PrefixTree;
  sectionCursor: number;
  activeSectionId: number;
  targetCursor: number;
  anchorCursor: number;
  contactCursor: number;
  tileToAttach: string | null;
};

function take(s: SectionState, hash: number): TileState | null {
  const at = s.available.findIndex((t) => t.shape.hashId === hash);
  return at < 0 ? null : s.available.splice(at, 1)[0]!;
  // Intentionally does NOT decrement SpacesFromAvailableTiles (A1357).
}
function attachNext(
  w: World,
  s: SectionState,
  rng: SourceRandom,
  search: LocalSearch,
  o: Observe,
): number {
  s.lastAttachedTileId = -1;
  if (s.available.length === 0) return -1;
  const definition = w.input.selection.sections[s.id]!;
  if (s.tiles.length === 0) {
    let hash: number;
    if (definition.start) {
      hash = [...w.input.selection.standard, ...w.input.selection.custom].find(
        (t) => t.modelSource === definition.start!.modelSource,
      )!.hashId;
    } else {
      const at = rng.nextInt(0, s.available.length);
      hash = s.available[at]!.shape.hashId;
      o.emit('first-tile-draw', {
        sectionId: s.id,
        min: 0,
        max: s.available.length,
        index: at,
        hashId: hash,
        available: s.available.map((t) => t.shape.source),
      });
    }
    const tile = take(s, hash);
    if (!tile) return -1;
    search.tileToAttach = tile.shape.source;
    tile.position = times(
      transform([0, 0, 0], tile.shape.hexes.find((h) => cubeKey(h.coords) === '0,0,0')!.transform),
      -1,
    );
    const rotation = rng.nextInt(0, 6);
    rotateTile(
      tile,
      tile.shape.hexes.findIndex((h) => cubeKey(h.coords) === '0,0,0'),
      rotation,
    );
    attachTile(w, s, tile);
    s.lastAttachedTileId = tile.shape.hashId;
    o.emit('first-tile', {
      sectionId: s.id,
      tileSource: tile.shape.source,
      hashId: tile.shape.hashId,
      rotation,
      min: 0,
      max: 6,
      globals: tile.globals,
    });
    search.tileToAttach = null;
    return tile.shape.hashId;
  }
  const valid = (t: TileState) => !search.invalid.wouldExist(search.sequence, t.shape.hashId);
  let last = s.available.length - 1;
  if (search.invalid.count > 0) {
    const before = s.available.map((t) => t.shape.source);
    comparisonSort(s.available, (a, b) => Number(valid(b)) - Number(valid(a)));
    last = -1;
    for (let i = 0; i < s.available.length; i++) if (valid(s.available[i]!)) last = i;
    o.emit('valid-next-sort', {
      sectionId: s.id,
      before,
      after: s.available.map((t) => t.shape.source),
      lastValid: last,
      sequence: [...search.sequence],
    });
    if (last < 0) return -1;
  }
  const at = rng.nextInt(0, last + 1),
    tile = take(s, s.available[at]!.shape.hashId)!;
  search.tileToAttach = tile.shape.source;
  o.emit('next-tile-draw', {
    sectionId: s.id,
    index: at,
    min: 0,
    max: last + 1,
    tileSource: tile.shape.source,
  });
  const targets = sectionEdges(w, s),
    anchors = tile.localEdges,
    occupied = occupancy([s]);
  s.tilePlacements = [];
  let enumerationIndex = 0;
  const rejected: Record<string, number> = { anchor: 0, overlap: 0, contact: 0 };
  for (let ti = 0; ti < targets.length; ti++) {
    search.targetCursor = ti;
    const target = targets[ti]!,
      targetTile = w.tiles.get(target.tileSource)!;
    for (let ai = 0; ai < anchors.length; ai++) {
      search.anchorCursor = ai;
      o.tick('tile-anchor');
      const anchor = anchors[ai]!;
      const a = getEdge(tile, anchor.hex, anchor.direction),
        b = getEdge(targetTile, target.hex, target.direction);
      if (!a || !b || !isConnection(b, a)) {
        rejected.anchor!++;
        continue;
      }
      const p: Placement = {
        anchor,
        target,
        sectionId: s.id,
        targetSectionId: s.id,
        openEdgeCount: targets.length + anchors.length,
        enumerationIndex: enumerationIndex++,
      };
      snapTile(w, tile, p);
      if (tile.globals.some((c) => occupied.has(cubeKey(c)))) {
        rejected.overlap!++;
        continue;
      }
      let compatible = true;
      for (let ci = 0; ci < anchors.length; ci++) {
        search.contactCursor = ci;
        o.tick('tile-contact');
        const e = anchors[ci]!,
          d = normalizeDirection(e.direction + tile.rotation);
        const neighbor = occupied.get(cubeKey(add(tile.globals[e.hex]!, directionCube(d))));
        if (!neighbor) continue;
        const ours = getEdge(tile, e.hex, e.direction),
          other = getEdge(
            neighbor.tile,
            neighbor.index,
            normalizeDirection(d + 3 - composite(w, neighbor.tile)),
          );
        if (!ours || !other || !canMatch(other, ours)) {
          compatible = false;
          break;
        }
        p.openEdgeCount -= 2;
      }
      if (compatible) {
        p.openEdgeCount = short(p.openEdgeCount);
        s.tilePlacements.push(p);
      } else rejected.contact!++;
    }
  }
  resetTile(tile);
  comparisonSort(s.tilePlacements, placementCompare);
  const index = rank(s.tilePlacements.length, w.input.geometry.sections[s.id]!.tileClumpFactor),
    chosen = s.tilePlacements[index];
  o.emit('tile-candidates', {
    sectionId: s.id,
    tileSource: tile.shape.source,
    sourceTileIdByte: tile.shape.hashId & 255,
    targetBoundaryCount: targets.length,
    incomingBoundaryCount: anchors.length,
    count: s.tilePlacements.length,
    index,
    rejected,
    candidates: s.tilePlacements,
  });
  if (!chosen)
    throw new AssemblyStop(
      'source-operation-exception',
      'empty-tile-placement-index',
      'A3ca4:0633: indicizzazione della lista TilePlacement vuota.',
    );
  snapTile(w, tile, chosen);
  attachTile(w, s, tile);
  s.lastAttachedTileId = tile.shape.hashId;
  o.emit('tile-attach', {
    sectionId: s.id,
    tileSource: tile.shape.source,
    index,
    chosen,
    globals: tile.globals,
  });
  search.tileToAttach = null;
  return tile.shape.hashId;
}
export function layoutTiles(w: World, rng: SourceRandom, search: LocalSearch, o: Observe): void {
  for (let id = 0; id < 4; id++) {
    search.sectionCursor = id;
    const activeSection = w.sections[id]!;
    search.activeSectionId = activeSection.id;
    while (!w.sections[id]!.isFinished) {
      o.tick('tile-attach-loop');
      // A3c93:06b4 assigns this reference outside the inner loop. Rollback
      // changes i at 083e, but 0855 branches to 06cc, retaining the reference.
      const s = activeSection,
        hash = attachNext(w, s, rng, search, o);
      if (hash >= 0) {
        search.sequence.push(hash);
        const tile = s.tiles[s.tiles.length - 1]!;
        search.history.push({ sectionId: id, tileId: hash, tileSource: tile.shape.source });
        s.isFinished = s.available.length === 0;
      } else {
        if (!search.history.length)
          throw new AssemblyStop(
            'source-failure',
            'tile-attach-history-exhausted',
            'Impossibile assemblare tutte le tessere.',
            2,
          );
        const failedSequence = [...search.sequence];
        search.invalid.add(search.sequence);
        const record = search.history.pop()!,
          target = w.sections[record.sectionId]!,
          tile = target.tiles.find((t) => t.shape.hashId === record.tileId);
        if (!tile)
          throw new AssemblyStop(
            'source-operation-exception',
            'rollback-tile-index',
            'A3c93:07f3: GetTileAtIndex(IndexOf) con indice -1.',
          );
        target.available.push(tile);
        target.tiles.splice(target.tiles.indexOf(tile), 1);
        tile.sectionId = null;
        target.radius = null;
        search.sequence.pop();
        target.isFinished = false;
        id = target.id;
        search.sectionCursor = id;
        o.emit('tile-rollback', {
          failedSectionId: s.id,
          sectionId: id,
          tileSource: tile.shape.source,
          failedSequence,
          sequence: [...search.sequence],
          invalidCount: search.invalid.count,
          available: target.available.map((t) => t.shape.source),
        });
      }
    }
  }
}
