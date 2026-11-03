import type { PhysicalState } from './model';
import type { PhysicalView } from '../shared/physical';

/** Counts only: catalogue copy IDs, front hashes, deck order and entropy stay private. */
export function physicalView(p: PhysicalState | null): PhysicalView | null {
  if (!p) return null;
  return {
    synthetic: true,
    decks: { damage: p.snapshot.decks.damage.length, fear: p.snapshot.decks.fear.length },
    heroes: p.snapshot.areas.map((h) => ({
      heroId: h.heroId,
      facedown: { damage: h.damage.length, fear: h.fear.length },
    })),
    active: structuredClone(p.snapshot.active),
    parents: structuredClone(p.snapshot.parents),
  };
}
