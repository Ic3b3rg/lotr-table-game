import { z } from 'zod';
import { statSync, readFileSync } from 'node:fs';
import { ContentIdSchema, type Catalog } from '../shared/catalog';
import { definitionId, type Preparation } from '../shared/preparation';
import {
  GenerationContextSchema,
  HashSchema,
  Int32Schema,
  SourceSchema,
  type GenerationContext,
} from '../shared/generated-map';
import { parseEncounterInput } from '../map-encounters/model';
import { digest } from './hash';

export const GENERATION_POLICY = {
  policy: 'node-clean-attempt-v1',
  workerWallMilliseconds: 60000,
  workerHeapMiB: 512,
  clock: 'logical-clock-v1',
  stepMilliseconds: 0,
  selectionOperations: 1000000,
  assemblyOperations: 1000000,
  encounterOperations: 1000000,
  maxTraceEvents: 200000,
  attemptsPerActivation: 8,
  maxAttempts: 64,
} as const;
const mapping = z.strictObject({
  catalogId: ContentIdSchema,
  id: Int32Schema,
  source: SourceSchema,
});
const schema = z.strictObject({
  formatVersion: z.literal(1),
  algorithm: z.literal('session-A1-generator-pack-v1'),
  catalog: z.strictObject({
    id: ContentIdSchema,
    fingerprint: HashSchema,
    sources: z
      .array(z.strictObject({ name: z.string().min(1).max(200), sha256: HashSchema }))
      .min(1)
      .max(20),
  }),
  identity: z.strictObject({
    adventureId: z.literal(1),
    adventureSource: SourceSchema,
    builderSource: SourceSchema,
  }),
  campaign: z.strictObject({
    language: z.literal('Italian'),
    ownedProductIds: z.tuple([z.literal(0)]),
    groupItemCatalogIds: z.array(ContentIdSchema).max(1000),
  }),
  mapping: z.strictObject({
    heroes: z.array(mapping).length(6),
    items: z.array(mapping).min(1).max(100),
  }),
  template: z.strictObject({
    selection: z.record(z.string(), z.unknown()),
    geometry: z.unknown(),
    placement: z.unknown(),
  }),
});
function clock(attempt: number) {
  return {
    policy: 'logical-clock-v1' as const,
    stepMilliseconds: 0,
    timeoutMilliseconds: Math.min(30, 6 * (attempt + 1)) * 1000,
  };
}
function inputFrom(
  template: z.infer<typeof schema>['template'],
  context: unknown,
  attempt: number,
) {
  return parseEncounterInput({
    formatVersion: 1,
    algorithm: 'source-map-encounters-v1',
    assembly: {
      formatVersion: 1,
      algorithm: 'source-map-assembly-v1',
      selection: { ...template.selection, context },
      geometry: template.geometry,
      execution: {
        clock: clock(attempt),
        maxOperations: GENERATION_POLICY.assemblyOperations,
        maxTraceEvents: GENERATION_POLICY.maxTraceEvents,
      },
    },
    placement: template.placement,
    execution: {
      policy: 'encounter-operations-v1',
      clock: clock(attempt),
      maxOperations: GENERATION_POLICY.encounterOperations,
      maxTraceEvents: GENERATION_POLICY.maxTraceEvents,
    },
  });
}
/** A private raw template has no company/seed or caller-supplied checkpoints. */
export function parseGeneratorPack(value: unknown) {
  const p = schema.parse(value);
  if ('context' in p.template.selection)
    throw new Error('Il pacchetto non deve contenere una compagnia.');
  const selection = {
    ...p.template.selection,
    budget: {
      policy: 'selection-operations-v1',
      maxOperations: GENERATION_POLICY.selectionOperations,
    },
  };
  const first = p.mapping.heroes[0]!;
  const parsed = inputFrom(
    { ...p.template, selection },
    {
      adventureId: 1,
      seed: 0,
      heroCount: 1,
      language: p.campaign.language,
      ownedProductIds: p.campaign.ownedProductIds,
      heroes: [{ id: first.id, source: first.source, itemIds: [] }],
      groupItemIds: [],
      usedEncounterIds: [],
      usedGroupIds: [],
      unlockedChainIds: [],
    },
    0,
  );
  const { context: _context, ...normalized } = parsed.assembly.selection;
  if (
    normalized.incoming.randomEncounterPool.length ||
    normalized.incoming.itemEncounterPool.length
  )
    throw new Error('Una nuova A1 richiede pool iniziali vuoti.');
  const files = new Set(parsed.placement.provenance.files.map((f) => f.file));
  for (const ref of [
    p.identity.adventureSource,
    p.identity.builderSource,
    ...p.mapping.heroes.map((h) => h.source),
  ])
    if (!files.has(ref.slice(0, ref.lastIndexOf(':'))))
      throw new Error('Fonte mapping non dichiarata.');
  for (const rows of [p.mapping.heroes, p.mapping.items])
    for (const key of ['catalogId', 'source', 'id'] as const)
      if (new Set(rows.map((v) => v[key])).size !== rows.length)
        throw new Error('Mapping duplicato.');
  for (const item of p.mapping.items)
    if (!normalized.items.some((v) => v.id === item.id && v.source === item.source))
      throw new Error('ItemModel mapping non risolto.');
  const template = {
    selection: normalized,
    geometry: parsed.assembly.geometry,
    placement: parsed.placement,
  };
  return { ...p, template };
}
export type GeneratorPack = ReturnType<typeof parseGeneratorPack>;
export function loadGeneratorPack(path: string) {
  if (statSync(path).size > 64 * 1024 * 1024)
    throw new Error('Pacchetto generatore troppo grande.');
  return parseGeneratorPack(JSON.parse(readFileSync(path, 'utf8')));
}
export function deriveContext(
  pack: GeneratorPack,
  state: { content: Catalog | null; preparation: Preparation | null },
): GenerationContext {
  const c = state.content,
    p = state.preparation;
  if (!c || p?.status !== 'prepared') throw new Error('Preparate prima tutti gli eroi e i mazzi.');
  if (
    c.id !== pack.catalog.id ||
    digest(c) !== pack.catalog.fingerprint ||
    digest(c.sources) !== digest(pack.catalog.sources)
  )
    throw new Error('Il catalogo non corrisponde al generatore verificato.');
  const mappedItem = (id: string) => {
    const m = pack.mapping.items.find((v) => v.catalogId === id);
    if (!m) throw new Error('Mapping oggetto assente.');
    return m;
  };
  if (
    c.items.length !== pack.mapping.items.length ||
    c.heroes.some((h) => !pack.mapping.heroes.some((m) => m.catalogId === h.id))
  )
    throw new Error('Mapping catalogo incompleto.');
  const quantities = new Map<string, number>();
  for (const product of pack.template.selection.products.filter((v) =>
    pack.campaign.ownedProductIds.includes(v.id as 0),
  ))
    for (const q of product.itemQuantities)
      quantities.set(q.itemSource, (quantities.get(q.itemSource) ?? 0) + q.quantity);
  for (const item of c.items) {
    const m = mappedItem(item.id),
      model = pack.template.selection.items.find((v) => v.source === m.source)!;
    if (
      quantities.get(m.source) !== item.quantity ||
      item.upgrades.some((id) => !model.upgradeSources.includes(mappedItem(id).source))
    )
      throw new Error('Quantità o upgrade del catalogo incompatibili.');
  }
  const groupItems = pack.campaign.groupItemCatalogIds.map(mappedItem);
  return GenerationContextSchema.parse({
    policy: 'new-base-A1-v1',
    ...pack.identity,
    catalogId: c.id,
    catalogFingerprint: digest(c),
    language: pack.campaign.language,
    ownedProductIds: pack.campaign.ownedProductIds,
    groupItems,
    groupItemIds: groupItems.map((v) => v.id),
    heroCount: p.heroes.length,
    heroes: p.heroes.map((h) => {
      const m = pack.mapping.heroes.find((v) => v.catalogId === h.heroId);
      if (!m || !h.roleId) throw new Error('Mapping eroe assente.');
      const items = h.itemCopies.map((copy) => ({ ...mappedItem(definitionId(copy)), copy }));
      return {
        ...m,
        playerId: h.playerId,
        roleId: h.roleId,
        items,
        itemIds: items.map((i) => i.id),
      };
    }),
    usedEncounterIds: [],
    usedGroupIds: [],
    unlockedChainIds: [],
  });
}
export function buildAttemptInput(
  pack: GeneratorPack,
  context: GenerationContext,
  seed: number,
  incoming: GeneratorPack['template']['selection']['incoming'],
  attempt: number,
) {
  return inputFrom(
    { ...pack.template, selection: { ...pack.template.selection, incoming } },
    {
      adventureId: context.adventureId,
      seed,
      heroCount: context.heroCount,
      language: context.language,
      ownedProductIds: context.ownedProductIds,
      groupItemIds: context.groupItemIds,
      heroes: context.heroes.map(({ id, source, itemIds }) => ({ id, source, itemIds })),
      usedEncounterIds: context.usedEncounterIds,
      usedGroupIds: context.usedGroupIds,
      unlockedChainIds: context.unlockedChainIds,
    },
    attempt,
  );
}
