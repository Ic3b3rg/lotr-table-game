import { requirePhysicalFamily } from '../physical-content/catalog';
import type { PhysicalState } from './model';
import type { PersistentOp } from './front-program';

/** Derive live passive effects without revealing any facedown identity. */
export function persistentEffects(p: PhysicalState, heroId?: string): PersistentOp[] {
  if (p.version === 1) return [];
  const up = new Set(p.snapshot.resolution!.faceup);
  const held = p.snapshot.areas
    .filter(
      (h) =>
        (!heroId || h.heroId === heroId) &&
        !p.snapshot.lastStand?.heroes.find((s) => s.heroId === h.heroId)?.defeated,
    )
    .flatMap((h) => [...h.damage, ...h.fear].filter((c) => up.has(c)));
  if (!held.length) return [];
  const cards = [
    ...requirePhysicalFamily(p.raw, 'damage').cards,
    ...requirePhysicalFamily(p.raw, 'fear').cards,
  ];
  return held.flatMap((copy) => {
    const card = cards.find((c) => c.copies.some((c) => c.id === copy))!;
    return p.fronts!.artifact.definitions.find((d) => d.cardId === card.id)!.persistent;
  });
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

/** Same source-derived limits used by the combat frontier and the physical consumer. */
export function physicalLimits(p: PhysicalState, heroId: string) {
  const hero = p.snapshot.resolution!.resources!.preparation.heroes.find(
    (h) => h.heroId === heroId,
  )!;
  const definition = p.fronts!.catalog.heroes.find((h) => h.id === heroId)!;
  const limits = { damage: definition.stats.damage, fear: definition.stats.fear };
  for (const copy of [hero.heroId, ...hero.itemCopies, ...hero.prepared]) {
    if (p.snapshot.resolution!.resources!.depletion.some((d) => d.copy === copy && !d.remaining))
      continue;
    const id = copy === hero.heroId ? copy : copy.slice(0, copy.lastIndexOf(':'));
    for (const e of p.fronts!.artifact.policies.find((p) => p.id === id)?.effects ?? [])
      if (e.op === 'limits') {
        limits.damage += e.damage;
        limits.fear += e.fear;
      }
  }
  return limits;
}
