import type { CombatClosure } from './compiler';
import type { DeployedGroup } from '../shared/deployment';
import { BoonKindSchema, type AttackModifier } from '../shared/combat';
import { bounded, check, integer } from './model';
import { resolveFigureHits } from './figures';
import type { BoonArtifact, BoonCustody } from '../shared/boons';
import { boonAcquisitionProblems } from '../physical-resolution/boon-stock';
export function effectiveGroup(a: CombatClosure, group: DeployedGroup) {
  const model = a.compiled.models.find((m) => m.source === group.source);
  check(model, 'Modello non congelato per il combattimento.');
  const recipe = group.battleRecipe
    ? a.source.scriptedGroups?.find((r) => r.key === group.battleRecipe)
    : undefined;
  check(
    !group.battleRecipe ||
      (recipe?.model === group.source &&
        recipe.logic === group.logic &&
        JSON.stringify(recipe.bonuses) === JSON.stringify(group.bonuses)),
    'Ricetta gruppo diversa dalla fonte.',
  );
  const bonuses = group.bonuses.map((ref) => {
    const b = a.compiled.bonuses.find((b) => b.source === ref);
    check(
      b &&
        (recipe ? recipe.bonuses.includes(ref) : model.bonuses.includes(ref)) &&
        b.languageEligible,
      'Bonus non congelato/legale.',
    );
    return b;
  });
  return {
    model,
    bonuses,
    elite: bonuses.length > 0,
    ranged: model.ranged || bonuses.some((b) => b.ranged),
    blocked: [...new Set(bonuses.flatMap((b) => b.blocked))],
  };
}
export function applyGroupHits(
  a: CombatClosure,
  group: DeployedGroup,
  hits: number,
  modifiers: AttackModifier[],
  testTerrain = false,
) {
  integer(hits, 'Colpi', 0, 10000);
  const effective = effectiveGroup(a, group);
  const allowed = modifiers.filter((m) => !effective.blocked.includes(m));
  check(
    allowed.every((m) => m === 'pierce' || m === 'stun' || (testTerrain && m === 'smite')),
    'Modificatore offensivo fuori closure.',
  );
  const result = resolveFigureHits(
    group.figures,
    hits,
    allowed.includes('pierce'),
    testTerrain && allowed.includes('smite'),
  );
  if (allowed.includes('stun')) group.exhausted = true;
  return {
    ...result,
    modifiers: allowed,
    suppressed: modifiers.filter((m) => effective.blocked.includes(m)),
  };
}

/** Dependency reachability only; the complete instruction population stays unchanged. */
export function reachableBoonKinds(a: CombatClosure, group: DeployedGroup) {
  const { model, bonuses } = effectiveGroup(a, group);
  const size = group.figures.filter((f) => f.health > 0).length;
  return [
    ...new Set(
      model.instructions
        .filter((i) => i.minimum <= size && i.maximum >= 1)
        .flatMap((i) => {
          const extra = i.addition;
          if (extra?.effect.op !== 'gain-boon') return [];
          const family =
            extra.predicate === 'damage-positive'
              ? 'damage'
              : extra.predicate === 'fear-positive'
                ? 'fear'
                : null;
          if (
            family &&
            bonuses.every((b) => b[family] === 0) &&
            i.damage.every((row) => row.size > size || row[family] === 0)
          )
            return [];
          return extra.effect.boon ? [extra.effect.boon] : BoonKindSchema.options;
        }),
    ),
  ];
}

export function preflightCombatGroup(
  a: CombatClosure,
  group: DeployedGroup,
  supply: {
    boons: { heroId: string; kind: string }[];
    quantities: null | Record<string, number>;
    artifact?: BoonArtifact | undefined;
    custody?: BoonCustody | undefined;
    heroIds?: string[] | undefined;
  },
) {
  if (supply.artifact) {
    const kinds = reachableBoonKinds(a, group);
    return kinds.length
      ? boonAcquisitionProblems(supply.artifact, supply.custody ?? [], kinds, supply.heroIds)
      : [];
  }
  const { model } = effectiveGroup(a, group);
  const size = group.figures.filter((f) => f.health > 0).length;
  // All positive sizes reachable by the parent attack, in source order; no dependency filtering.
  const candidates = model.instructions.filter((i) => i.minimum <= size && i.maximum >= 1);
  const missing: string[] = [];
  for (const i of candidates) {
    if (i.addition?.effect.op === 'gain-boon') {
      missing.push(supply.quantities === null ? 'boon-quantities-57' : 'boon-acquisition-consumer');
    }
  }
  return [...new Set(missing)];
}

/** Availability is independent of whether this hero currently holds a boon. */
export function boonSupply(
  quantities: null | Record<string, number>,
  held: { heroId: string; kind: string }[],
  kind: string,
): { status: 'unknown'; available: null } | { status: 'empty' | 'available'; available: number } {
  bounded({ quantities, held, kind });
  BoonKindSchema.parse(kind);
  check(Array.isArray(held) && held.length <= 10000, 'Benefici posseduti fuori limite.');
  for (const boon of held) {
    check(
      typeof boon.heroId === 'string' && boon.heroId.length > 0 && boon.heroId.length <= 200,
      'Proprietario del beneficio non valido.',
    );
    BoonKindSchema.parse(boon.kind);
  }
  if (quantities === null) return { status: 'unknown', available: null };
  check(
    Object.keys(quantities).length === BoonKindSchema.options.length,
    'Quantità dei benefici incomplete.',
  );
  for (const name of BoonKindSchema.options) {
    integer(quantities[name], 'Quantità del beneficio');
    check(
      held.filter((b) => b.kind === name).length <= quantities[name]!,
      'Benefici posseduti oltre la riserva verificata.',
    );
  }
  const available = quantities[kind]! - held.filter((b) => b.kind === kind).length;
  return { status: available === 0 ? 'empty' : 'available', available };
}
