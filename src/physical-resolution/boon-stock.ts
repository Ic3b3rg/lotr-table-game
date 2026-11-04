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

export type BoonRequest = { heroes: string[]; kinds: BoonKind[] };
/** Maximum distinct recipients per kind; a duplicate never needs another copy. */
export function preflightBoonRequests(
  a: BoonArtifact | undefined,
  held: BoonCustody,
  requests: BoonRequest[],
) {
  if (!requests.length) return [];
  if (!a?.runtimeReady) return ['boon-quantities-57'];
  for (const kind of a.definitions.map((d) => d.kind)) {
    const grants = requests.filter((r) => r.kinds.includes(kind));
    const assigned = new Map<string, number>();
    const match = (index: number, seen: Set<string>): boolean => {
      for (const hero of grants[index]!.heroes) {
        if (seen.has(hero) || held.some((b) => b.heroId === hero && b.kind === kind)) continue;
        seen.add(hero);
        const previous = assigned.get(hero);
        if (previous === undefined || match(previous, seen)) {
          assigned.set(hero, index);
          return true;
        }
      }
      return false;
    };
    for (let i = 0; i < grants.length; i++) match(i, new Set());
    if (assigned.size > boonAvailability(a, held, kind).copies.length)
      return ['boon-supply-exhaustion-rule'];
  }
  return [];
}
