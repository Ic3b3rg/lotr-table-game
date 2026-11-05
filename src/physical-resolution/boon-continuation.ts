import type { BoonKind } from '../shared/boons';
import { BoonKindSchema } from '../shared/combat';
import type { PhysicalProgram } from '../shared/physical';
import type { FrontResources } from './front-state';
import type { PhysicalState } from './model';

/** Credit only a mandatory return whose end-turn context is already known. */
function endTurnReturnedKinds(
  p: PhysicalState,
  context: FrontResources | undefined,
  spatial: PhysicalState['runs'][number]['spatial'],
  hero: number,
): BoonKind[] {
  if (!context || !spatial?.enemies) return [];
  const heroId = p.heroes[hero]!.heroId;
  if (p.snapshot.lastStand?.heroes.some((h) => h.heroId === heroId && h.defeated)) return [];
  const from = spatial.heroes[hero]!.spaceId;
  if (
    spatial.enemies.some(
      (e) =>
        e.spaceId === from ||
        spatial.connections.some(
          ([a, b]) => (a === from && b === e.spaceId) || (b === from && a === e.spaceId),
        ),
    )
  )
    return [];
  const faceup = new Set(p.snapshot.resolution?.faceup ?? []);
  const raw = p.raw as { cards: { id: string; copies: { id: string }[] }[] };
  const liveCards = new Set(
    raw.cards.filter((c) => c.copies.some((copy) => faceup.has(copy.id))).map((c) => c.id),
  );
  if (
    p.fronts!.artifact.definitions.some(
      (d) =>
        liveCards.has(d.cardId) &&
        d.persistent.some((e) => e.window === 'end-own-turn' || e.window === 'after-rest'),
    )
  )
    return [];
  const regains = (p.snapshot.lastStand?.titles ?? []).flatMap((t) =>
    t.heroId === heroId &&
    !t.removed &&
    !t.pending &&
    context.preparation.heroes[hero]!.prepared.includes(t.copy)
      ? (p.lastStand?.titles.find((d) => d.cardId === t.cardId)?.effects ?? []).flatMap((e) =>
          e.op === 'rest' ? [e.after.boon] : [],
        )
      : [],
  );
  return p
    .boons!.definitions.filter(
      (d) => d.effects.some((e) => e.op === 'discard-at-end-turn') && !regains.includes(d.kind),
    )
    .map((d) => d.kind);
}

export function boonProgramProblems(
  p: PhysicalState,
  program: PhysicalProgram,
  context: FrontResources | undefined,
  spatial: PhysicalState['runs'][number]['spatial'],
): string[] {
  if (!p.boons || program.profile !== 'source-fronts-v1') return [];

  const possible = new Map(
    BoonKindSchema.options.map((kind) => [
      kind,
      new Set((context?.boonCustody ?? []).filter((b) => b.kind === kind).map((b) => b.heroId)),
    ]),
  );
  let uncertainSurvival = false;
  for (const [index, child] of program.children.entries()) {
    if (child.kind === 'source-boon') {
      if (!p.boons.runtimeReady) return ['boon-quantities-57'];
      possible.get(child.boon)!.add(p.heroes[child.hero]!.heroId);
      if (possible.get(child.boon)!.size > p.boons.stock.quantities![child.boon])
        return ['boon-supply-exhaustion-rule'];
      continue;
    }
    if (
      child.kind === 'end-turn' &&
      program.children
        .slice(0, index)
        .every(
          (c) =>
            c.kind === 'inspiration' ||
            (c.kind === 'combat-addition' && c.addition.effect.op === 'gain-boon'),
        )
    )
      for (const kind of endTurnReturnedKinds(p, context, spatial, child.hero))
        possible.get(kind)!.delete(p.heroes[child.hero]!.heroId);
    if (
      ['suffer', 'group-test', 'group-suffer', 'darkness', 'enemy-attack', 'end-turn'].includes(
        child.kind,
      )
    )
      uncertainSurvival = true;
    if (child.kind !== 'combat-addition' && child.kind !== 'enemy-attack') continue;
    const addition = child.addition;
    if (!addition) continue;
    if (
      child.kind === 'enemy-attack' &&
      ((addition.predicate === 'damage-positive' && !child.outcome.offered.damage) ||
        (addition.predicate === 'fear-positive' && !child.outcome.offered.fear) ||
        (addition.predicate === 'recipient-in-darkness' &&
          !program.darknessHeroes.includes(child.hero)))
    )
      continue;
    if (child.kind === 'combat-addition') {
      const suffered = child.outcome.suffered,
        predicate = addition.predicate;
      if (
        (predicate === 'damage-positive' && !suffered.damage) ||
        (predicate === 'fear-positive' && !suffered.fear) ||
        (predicate === 'zero-damage-and-fear' && suffered.damage + suffered.fear) ||
        (predicate === 'recipient-in-darkness' && !program.darknessHeroes.includes(child.hero))
      )
        continue;
    }
    const heroId = p.heroes[child.hero]!.heroId;
    if (addition.effect.op === 'lose-boon-or-weakness' && !uncertainSurvival)
      possible.get(addition.effect.boon)!.delete(heroId);
    if (addition.effect.op !== 'gain-boon') continue;
    if (!p.boons.runtimeReady) return ['boon-quantities-57'];
    for (const kind of addition.effect.boon ? [addition.effect.boon] : BoonKindSchema.options) {
      possible.get(kind)!.add(heroId);
      if (possible.get(kind)!.size > p.boons.stock.quantities![kind])
        return ['boon-supply-exhaustion-rule'];
    }
  }
  return [];
}
