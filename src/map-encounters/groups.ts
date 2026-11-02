import { comparisonSort } from '../map-generation/primitives';
import { EncounterState } from './state';
import { remember, rollback, trySet } from './placement';

/** A3c99 clears only its history/sequence, retaining InvalidMapSequences. */
function seedNumber(
  s: EncounterState,
  sources: string[],
  count: number,
  groupSource: string,
): void {
  s.clearSearch(false);
  s.remainingCount = count;
  while (s.remainingCount > 0) {
    s.tick('group-iteration');
    const space = trySet(s, sources, { stage: s.stage, sectionId: null, groupSource });
    if (space) {
      remember(s, space);
      s.remainingCount--;
    } else if (s.history.length) {
      rollback(s);
      s.remainingCount++;
    } else return;
  }
}

export function seedGroups(s: EncounterState): void {
  s.stage = 'groups';
  s.sectionCursor = null;
  const p = s.input.assembly.selection,
    groups = new Map(p.groups.map((g) => [g.source, g]));
  const free = s.spaces.filter((v) => v.encounterId < 0).length;
  const requiredCount = (g: (typeof p.groups)[number]) =>
    g.requiredSources.length + g.requiredOptionalCount;
  const specified = s.input.placement.specifiedGroupSource;
  let candidates: typeof p.groups;
  if (specified !== null) {
    const group = groups.get(specified)!;
    if (free < requiredCount(group)) s.fail('specified-group-capacity');
    candidates = [group];
  } else {
    const filter = p.encounterTraitsFilter;
    const owned = p.products
      .filter((product) => p.context.ownedProductIds.includes(product.id))
      .flatMap((product) => product.groupSources);
    candidates = [];
    for (const source of owned) {
      s.tick('group-filter');
      const g = groups.get(source)!;
      let compatible = free >= requiredCount(g);
      if (compatible)
        for (const r of [...g.requiredSources, ...g.optionalSources]) {
          s.tick('group-trait-filter');
          const e = s.selectionModels.get(r)!;
          if (
            (e.traits & filter.excludeIfAny) !== 0 ||
            (e.traits & filter.mustHaveAll) !== filter.mustHaveAll ||
            (filter.mustHaveAny !== 0 && (e.traits & filter.mustHaveAny) === 0)
          ) {
            compatible = false;
            break;
          }
        }
      s.emit('group-filter', {
        groupSource: source,
        free,
        requiredCount: requiredCount(g),
        eligible: compatible,
      });
      if (compatible) candidates.push(g);
    }
    s.shuffle(candidates, 'groups-shuffle', (g) => g.source);
    const before = candidates.map((g) => g.source);
    comparisonSort(candidates, (a, b) => {
      s.tick('group-comparison');
      return (
        Number(p.context.usedGroupIds.includes(a.id)) -
          Number(p.context.usedGroupIds.includes(b.id)) ||
        Number(a.isRepeatable) - Number(b.isRepeatable)
      );
    });
    s.emit('group-sort', { before, after: candidates.map((g) => g.source) });
  }
  s.eligibleGroups = candidates.map((g) => g.source);
  for (let i = 0; i < candidates.length; i++) {
    s.groupCursor = i;
    s.tick('group-attempt');
    const g = candidates[i]!;
    s.emit('group-attempt', { groupSource: g.source, invalidSequences: s.invalid.children });
    s.stage = 'group-required';
    let sources = [...g.requiredSources];
    s.shuffle(sources, 'group-required-shuffle', (r) => r);
    seedNumber(s, sources, g.requiredSources.length, g.source);
    if (s.sequence.length < g.requiredSources.length) {
      s.stage = 'groups';
      continue;
    }
    if (g.requiredOptionalCount > 0) {
      s.stage = 'group-optional';
      // A3c93:15a0–15ec retains the required list if OptionalEncounters is empty.
      if (g.optionalSources.length) {
        sources = [...g.optionalSources];
        s.shuffle(sources, 'group-optional-shuffle', (r) => r);
      }
      seedNumber(s, sources, g.requiredOptionalCount, g.source);
      if (s.sequence.length < g.requiredOptionalCount) {
        for (const r of g.requiredSources)
          for (const space of s.allSpaces) {
            s.tick('group-cleanup-space');
            if (space.encounterId === s.models.get(r)!.id) {
              space.encounterId = -1;
              s.assignments.delete(space.id);
              s.emit('group-cleanup', { groupSource: g.source, modelSource: r, spaceId: space.id });
            }
          }
        s.stage = 'groups';
        continue;
      }
    }
    s.chosenGroup = g.source;
    return;
  }
  s.stage = 'groups';
  s.fail('group-requirement');
}
