import { invariant } from '../map-freeze/validate';
import type { FrontOp } from './front-program';
import type { FrontResources } from './front-state';

type Context = {
  hero: number;
  resources: FrontResources;
  condition: (condition: 'self-space-in-darkness' | 'exists-nearby-hero-excluding-self') => boolean;
  ignoresLoss: (resources: FrontResources) => boolean;
  trinkets: (resources: FrontResources, other: boolean) => { copy: string; hero: number }[];
};

/** Check known resource obligations without revealing or executing hidden consequences. */
export function canResolveAlternative(op: FrontOp, context: Context): boolean {
  let work = 0;
  function* sequence(parts: FrontOp[], resources: FrontResources): Generator<FrontResources> {
    if (!parts.length) {
      yield resources;
      return;
    }
    // The group can order simultaneous obligations; a choice must pay every part.
    for (const [n, part] of parts.entries())
      for (const next of plans(part, resources))
        yield* sequence(
          parts.filter((_, i) => i !== n),
          next,
        );
  }
  function* plans(op: FrontOp, resources: FrontResources): Generator<FrontResources> {
    invariant(++work <= 100000, 'Budget fattibilità fronti superato.');
    const hero = resources.preparation.heroes[context.hero]!;
    switch (op.op) {
      case 'choose-alternative':
        for (const branch of op.branches) yield* plans(branch, resources);
        return;
      case 'simultaneous':
        yield* sequence(op.parts, resources);
        return;
      case 'conditional':
        if (context.condition(op.condition)) yield* plans(op.then, resources);
        else yield resources;
        return;
      case 'discard-prepared': {
        if (context.ignoresLoss(resources)) {
          yield resources;
          return;
        }
        const quantity = op.n;
        function* select(start: number, ids: string[]): Generator<FrontResources> {
          if (ids.length === quantity) {
            const next = structuredClone(resources);
            const target = next.preparation.heroes[context.hero]!;
            target.prepared = target.prepared.filter((id) => !ids.includes(id));
            target.discard.push(...ids);
            yield next;
            return;
          }
          for (let n = start; n <= hero.prepared.length - (quantity - ids.length); n++)
            yield* select(n + 1, [...ids, hero.prepared[n]!]);
        }
        yield* select(0, []);
        return;
      }
      case 'discard-inspiration': {
        if (context.ignoresLoss(resources)) {
          yield resources;
          return;
        }
        const n = op.n === 'all' ? hero.inspiration : op.n;
        if (hero.inspiration < n) return;
        const next = structuredClone(resources);
        next.preparation.heroes[context.hero]!.inspiration -= n;
        yield next;
        return;
      }
      case 'deplete':
      case 'deplete-or-if-impossible': {
        const trinkets = context.trinkets(resources, op.op === 'deplete-or-if-impossible');
        if (!trinkets.length && op.op === 'deplete-or-if-impossible')
          yield* plans(op.fallback, resources);
        for (const { copy } of trinkets) {
          const next = structuredClone(resources);
          next.depletion.find((d) => d.copy === copy)!.remaining--;
          yield next;
        }
        return;
      }
      case 'gain-weakness': {
        if (!resources.preparation.weaknessDeck.length) return;
        const next = structuredClone(resources);
        next.preparation.heroes[context.hero]!.deck.push(next.preparation.weaknessDeck.shift()!);
        yield next;
        return;
      }
      default:
        yield resources;
    }
  }
  return !plans(op, context.resources).next().done;
}
