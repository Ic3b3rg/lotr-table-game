import type { CombatClosure } from './compiler';
import type { DeployedGroup } from '../shared/deployment';
import type { AttackModifier } from '../shared/combat';
import { check, integer } from './model';
import { resolveFigureHits } from './figures';
export function effectiveGroup(a: CombatClosure, group: DeployedGroup) {
  const model = a.compiled.models.find((m) => m.source === group.source);
  check(model, 'Modello non congelato per il combattimento.');
  const bonuses = group.bonuses.map((ref) => {
    const b = a.compiled.bonuses.find((b) => b.source === ref);
    check(b && model.bonuses.includes(ref) && b.languageEligible, 'Bonus non congelato/legale.');
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
) {
  integer(hits, 'Colpi', 0, 10000);
  const effective = effectiveGroup(a, group);
  const allowed = modifiers.filter((m) => !effective.blocked.includes(m));
  check(
    allowed.every((m) => m === 'pierce' || m === 'stun'),
    'Modificatore offensivo fuori closure.',
  );
  const result = resolveFigureHits(group.figures, hits, allowed.includes('pierce'));
  if (allowed.includes('stun')) group.exhausted = true;
  return {
    ...result,
    modifiers: allowed,
    suppressed: modifiers.filter((m) => effective.blocked.includes(m)),
  };
}
export function preflightCombatGroup(
  a: CombatClosure,
  group: DeployedGroup,
  supply: { boons: { heroId: string; kind: string }[]; quantities: null | Record<string, number> },
) {
  const { model } = effectiveGroup(a, group);
  const size = group.figures.filter((f) => f.health > 0).length;
  // All positive sizes reachable by the parent attack, in source order; no dependency filtering.
  const candidates = model.instructions.filter((i) => i.minimum <= size && i.maximum >= 1);
  const missing: string[] = [];
  for (const i of candidates) {
    if (i.addition?.effect.op === 'gain-boon') missing.push('boon-quantities-57');
  }
  if (supply.quantities !== null && missing.length) missing.push('boon-acquisition-consumer');
  return [...new Set(missing)];
}
