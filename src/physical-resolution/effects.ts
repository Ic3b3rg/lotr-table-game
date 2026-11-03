import { requirePhysicalFamily } from '../physical-content/catalog';
import type { PhysicalState } from './model';
import type { PersistentOp } from './front-program';

/** Derive live passive effects without revealing any facedown identity. */
export function persistentEffects(p: PhysicalState, heroId?: string): PersistentOp[] {
  if (p.version === 1) return [];
  const cards = [
    ...requirePhysicalFamily(p.raw, 'damage').cards,
    ...requirePhysicalFamily(p.raw, 'fear').cards,
  ];
  const up = new Set(p.snapshot.resolution!.faceup);
  return p.snapshot.areas
    .filter(
      (h) =>
        (!heroId || h.heroId === heroId) &&
        !p.snapshot.lastStand?.heroes.find((s) => s.heroId === h.heroId)?.defeated,
    )
    .flatMap((h) =>
      [...h.damage, ...h.fear]
        .filter((c) => up.has(c))
        .flatMap((copy) => {
          const card = cards.find((c) => c.copies.some((c) => c.id === copy))!;
          return p.fronts!.artifact.definitions.find((d) => d.cardId === card.id)!.persistent;
        }),
    );
}
export function travelMoves(p: PhysicalState, heroId: string) {
  return Math.max(
    0,
    2 +
      persistentEffects(p, heroId).reduce(
        (n, e) => n + (e.op === 'travel-move-modifier' ? e.n : 0),
        0,
      ),
  );
}
