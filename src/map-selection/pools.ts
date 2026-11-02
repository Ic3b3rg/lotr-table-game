import { sourceShuffle, type SourceRandom } from '../map-generation/primitives';
import { loadFloat, storeFloat, type SelectionInput } from './model';

type Observe = {
  tick: () => void;
  begin: (stage: string) => void;
  emit: (operation: string, details: Record<string, unknown>) => void;
  checkpoint: (stage: string) => void;
};

export function createPools(p: SelectionInput) {
  const products = p.products.filter((x) => p.context.ownedProductIds.includes(x.id));
  const ownedCodes = new Set(products.flatMap((x) => x.tileCodes));
  const items = new Map(p.items.map((x) => [x.source, x]));
  const quantities = new Map<number, number>();
  for (const product of products)
    for (const q of product.itemQuantities) {
      const id = items.get(q.itemSource)!.id;
      quantities.set(id, (quantities.get(id) ?? 0) + q.quantity);
    }
  const itemCapacity = p.items.map((i) => ({
    id: i.id,
    owned: quantities.get(i.id) ?? 0,
    held:
      p.context.groupItemIds.filter((id) => id === i.id).length +
      p.context.heroes.filter((h) => h.itemIds.includes(i.id)).length,
  }));
  return {
    ownedCodes,
    itemCapacity,
    normalEligible: [] as string[],
    chainEligible: [] as string[],
    itemEligible: [] as string[],
    normalShuffled: [] as string[],
    chainShuffled: [] as string[],
    itemEncounterPool: [...p.incoming.itemEncounterPool],
    randomEncounterPool: [...p.incoming.randomEncounterPool],
    percentNormal: p.incoming.percentNormal,
  };
}

/** CreateMap 00fb–0377; retained pools are never cleared on retry. */
export function collectPools(
  p: SelectionInput,
  pools: ReturnType<typeof createPools>,
  observe: Observe,
): void {
  const products = p.products.filter((x) => p.context.ownedProductIds.includes(x.id));
  const items = new Map(p.items.map((x) => [x.source, x]));
  const capacities = new Map(pools.itemCapacity.map((x) => [x.id, x]));
  const canUpgrade = (source: string, target: number): boolean => {
    // Explicit stack preserves depth-first order without relying on JS stack size.
    const stack = [...items.get(source)!.upgradeSources].reverse();
    while (stack.length) {
      observe.tick();
      const next = stack.pop()!;
      if (next === null) continue;
      const item = items.get(next)!;
      if (item.id === target) return true;
      stack.push(...[...item.upgradeSources].reverse());
    }
    return false;
  };
  const encounterBySource = new Map(p.encounters.map((e) => [e.source, e]));
  const collection = new Map<number, SelectionInput['encounters'][number]>();
  for (const product of products)
    for (const r of product.encounterSources) {
      const e = encounterBySource.get(r)!;
      if (!collection.has(e.id)) collection.set(e.id, e);
    }
  const { normalEligible, chainEligible, itemEligible } = pools;
  const fixed = new Set([
    ...p.adventureEncounterSources,
    ...p.sections.flatMap((s) => s.fixedEncounterSources),
  ]);
  const f = p.encounterTraitsFilter;
  for (const e of collection.values()) {
    observe.tick();
    let reason = 'type';
    if (e.unsupportedLanguages.includes(p.context.language)) reason = 'language';
    else if (e.type === 0) {
      if (!e.isRepeatable && p.context.usedEncounterIds.includes(e.id)) reason = 'history';
      else if (
        (e.traits & f.excludeIfAny) !== 0 ||
        (e.traits & f.mustHaveAll) !== f.mustHaveAll ||
        (f.mustHaveAny !== 0 && (e.traits & f.mustHaveAny) === 0)
      )
        reason = 'traits';
      else if (fixed.has(e.source)) reason = 'fixed-normal-reference';
      else {
        normalEligible.push(e.source);
        reason = 'normal';
      }
    } else if (e.type === 2) {
      if (!p.context.unlockedChainIds.includes(e.id)) reason = 'locked-chain';
      else if (!e.isRepeatable && p.context.usedEncounterIds.includes(e.id)) reason = 'history';
      else {
        chainEligible.push(e.source);
        reason = 'chain';
      }
    } else if (e.type === 4) {
      reason = 'item-empty';
      if (e.itemSources.some((r) => r !== null)) {
        reason = 'item';
        for (const r of e.itemSources) {
          observe.tick();
          if (r === null) {
            reason = 'item-unavailable';
            break;
          }
          const item = items.get(r)!,
            capacity = capacities.get(item.id)!;
          if (capacity.held >= capacity.owned) {
            reason = 'item-capacity';
            break;
          }
          if (p.context.groupItemIds.some((id) => id === item.id || canUpgrade(r, id))) {
            reason = 'group-item-or-upgrade';
            break;
          }
        }
        if (reason === 'item') {
          itemEligible.push(e.source);
          pools.itemEncounterPool.push(e.source);
        }
      }
    }
    observe.emit('filter', { encounterSource: e.source, reason });
  }
  pools.normalShuffled = [...normalEligible];
  pools.chainShuffled = [...chainEligible];
}

/** CreateMap 044f–0503; strict float comparison and no clamp. */
export function shuffleAndMerge(
  pools: ReturnType<typeof createPools>,
  rng: SourceRandom,
  observe: Observe,
): void {
  observe.begin('normal-shuffle');
  sourceShuffle(pools.normalShuffled, rng);
  observe.checkpoint('normal-shuffle');
  observe.begin('chain-shuffle');
  sourceShuffle(pools.chainShuffled, rng);
  observe.checkpoint('chain-shuffle');
  observe.begin('item-shuffle');
  sourceShuffle(pools.itemEncounterPool, rng);
  observe.checkpoint('item-shuffle');
  observe.begin('pool-merge');
  const normal = [...pools.normalShuffled],
    chain = [...pools.chainShuffled];
  while (normal.length || chain.length) {
    observe.tick();
    let takeNormal = chain.length === 0;
    let draw: number | null = null;
    if (normal.length && chain.length) {
      draw = rng.nextFloat32(0, 1);
      takeNormal = draw < loadFloat(pools.percentNormal);
      pools.percentNormal = storeFloat(
        Math.fround(loadFloat(pools.percentNormal) * (takeNormal ? 0.5 : 2)),
      );
    }
    const encounterSource = (takeNormal ? normal : chain).shift()!;
    pools.randomEncounterPool.push(encounterSource);
    observe.emit('merge', {
      pool: takeNormal ? 'normal' : 'chain',
      encounterSource,
      draw,
      percentNormal: pools.percentNormal,
    });
  }
}
