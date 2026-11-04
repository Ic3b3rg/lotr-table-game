import type { BoonArtifact, BoonCustody, BoonKind } from '../shared/boons';
import { invariant } from '../map-freeze/validate';

/** A copy is either in the supply or in one hero's faceup area, never a skill zone. */
export function validateBoonCustody(a: BoonArtifact, held: BoonCustody, heroes: string[]) {
  invariant(
    new Set(held.map((b) => b.copyId)).size === held.length &&
      new Set(held.map((b) => `${b.heroId}:${b.kind}`)).size === held.length,
    'Copia o tipo beneficio duplicato presso un eroe.',
  );
  for (const b of held)
    invariant(
      a.stock.status === 'verified' &&
        heroes.includes(b.heroId) &&
        a.stock.copies.some((c) => c.id === b.copyId && c.kind === b.kind) &&
        b.face === 'faceup',
      'Custodia beneficio senza copia, eroe o riserva attestati.',
    );
}
export function boonAvailability(a: BoonArtifact | undefined, held: BoonCustody, kind: BoonKind) {
  if (!a || a.stock.status === 'unverified')
    return { status: 'unknown' as const, copies: [] as string[], available: null };
  const copies = a.stock.copies
    .filter((c) => c.kind === kind && !held.some((b) => b.copyId === c.id))
    .map((c) => c.id);
  return {
    status: copies.length ? ('available' as const) : ('verified-empty' as const),
    copies,
    available: copies.length,
  };
}

/** Exhaustion has no invented replacement rule. Check the whole offered choice. */
export function boonAcquisitionProblems(
  a: BoonArtifact | undefined,
  held: BoonCustody,
  kinds: BoonKind[],
  heroIds?: string[],
) {
  if (!a) return ['boon-quantities-57'];
  if (!a.runtimeReady) return ['boon-quantities-57'];
  return kinds.some(
    (kind) =>
      boonAvailability(a, held, kind).status === 'verified-empty' &&
      (!heroIds?.length ||
        heroIds.some((heroId) => !held.some((b) => b.heroId === heroId && b.kind === kind))),
  )
    ? ['boon-supply-exhaustion-rule']
    : [];
}
