import { z } from 'zod';

const int32 = z.int().min(-2147483648).max(2147483647);
const mask = int32;
const index = z.int().min(0).max(10000);
const source = z
  .string()
  .max(160)
  .regex(/^[\w.-]+:-?[1-9][0-9]*$/);
const code = z.string().min(1).max(100);
const float32 = z
  .number()
  .finite()
  .refine((n) => Math.fround(n) === n, 'Richiesto float32.');
export const StoredFloatSchema = z.union([float32, z.literal('Infinity'), z.literal('-Infinity')]);
export type StoredFloat = z.infer<typeof StoredFloatSchema>;
export const storeFloat = (n: number): StoredFloat =>
  n === Infinity ? 'Infinity' : n === -Infinity ? '-Infinity' : n;
export const loadFloat = (n: StoredFloat): number => Number(n);

const TileSchema = z.strictObject({
  index,
  source,
  modelSource: source,
  code,
  hashId: int32,
  oppositeHashId: int32,
  set: mask,
  spaces: z
    .array(z.strictObject({ index, source, traits: mask }))
    .min(1)
    .max(100),
});
const reserved = z.strictObject({ isStandard: z.boolean(), modelSource: source });
const PackSchema = z.strictObject({
  formatVersion: z.literal(1),
  algorithm: z.literal('source-selection-v1'),
  provenance: z.strictObject({
    sourceVersion: z.string().min(1).max(200),
    files: z
      .array(
        z.strictObject({
          file: z
            .string()
            .regex(/^[\w.-]+$/)
            .max(100),
          sha256: z.string().regex(/^[a-f0-9]{64}$/),
        }),
      )
      .min(1)
      .max(100),
  }),
  context: z.strictObject({
    adventureId: int32,
    seed: int32,
    heroCount: z.int().min(1).max(5),
    language: z.enum([
      'English',
      'Spanish',
      'French',
      'German',
      'Italian',
      'Portuguese',
      'Polish',
      'Hungarian',
      'Chinese',
      'Czech',
      'Russian',
      'Korean',
      'Ukrainian',
    ]),
    ownedProductIds: z.array(int32).min(1).max(100),
    groupItemIds: z.array(int32).max(1000),
    heroes: z
      .array(z.strictObject({ id: int32, source, itemIds: z.array(int32).max(1000) }))
      .min(1)
      .max(5),
    usedEncounterIds: z.array(int32).max(10000),
    usedGroupIds: z.array(int32).max(10000),
    unlockedChainIds: z.array(int32).max(10000),
  }),
  products: z
    .array(
      z.strictObject({
        index,
        source,
        id: int32,
        tileCodes: z.array(code).max(1000),
        encounterSources: z.array(source).max(10000),
        groupSources: z.array(source).max(1000),
        itemQuantities: z
          .array(z.strictObject({ itemSource: source, quantity: z.int().min(0).max(1000) }))
          .max(1000),
      }),
    )
    .min(1)
    .max(100),
  items: z
    .array(
      z.strictObject({
        index,
        source,
        id: int32,
        upgradeSources: z.array(source.nullable()).max(1000),
      }),
    )
    .max(1000),
  encounters: z
    .array(
      z.strictObject({
        index,
        source,
        id: int32,
        type: z.int().min(0).max(4),
        traits: mask,
        isRepeatable: z.boolean(),
        unsupportedLanguages: z.array(z.string().max(30)).max(20),
        itemSources: z.array(source.nullable()).max(100),
      }),
    )
    .max(10000),
  groups: z
    .array(
      z.strictObject({
        index,
        source,
        id: int32,
        isRepeatable: z.boolean(),
        requiredSources: z.array(source).max(1000),
        optionalSources: z.array(source).max(1000),
        requiredOptionalCount: z.int().min(0).max(1000),
      }),
    )
    .max(1000),
  standard: z.array(TileSchema).length(120),
  custom: z.array(TileSchema).max(120),
  sections: z
    .array(
      z.strictObject({
        index,
        source,
        allowedTileSets: mask,
        minimumSpaces: z.int().min(0).max(10000),
        maximumSpaces: z.int().min(0).max(10000),
        ignorePlayerScaling: z.boolean(),
        relativeSizeFactor: float32,
        start: reserved.nullable(),
        required: z.array(reserved).max(120),
        traitRequirements: z
          .array(z.strictObject({ trait: mask, count: z.int().min(0).max(1000) }))
          .max(100),
        fixedEncounterSources: z.array(source).max(1000),
      }),
    )
    .length(4),
  requiredConnections: z.array(z.tuple([z.int().min(0).max(3), z.int().min(0).max(3)])).max(100),
  adventureEncounterSources: z.array(source).max(1000),
  encounterTraitsFilter: z.strictObject({
    mustHaveAny: mask,
    mustHaveAll: mask,
    excludeIfAny: mask,
  }),
  incoming: z.strictObject({
    randomEncounterPool: z.array(source).max(20000),
    itemEncounterPool: z.array(source).max(20000),
    percentNormal: StoredFloatSchema,
  }),
  budget: z.strictObject({
    policy: z.literal('selection-operations-v1'),
    maxOperations: z.int().min(1).max(10000000),
  }),
});
export type SelectionInput = z.infer<typeof PackSchema>;
export type Tile = SelectionInput['standard'][number];

/** Structural and referential checks never filter, sort or invent source data. */
export function parseSelectionInput(value: unknown): SelectionInput {
  const p = PackSchema.parse(value);
  const fail = (message: string): never => {
    throw new Error(`Input: ${message}`);
  };
  const unique = <T>(values: T[], label: string) => {
    if (new Set(values).size !== values.length) fail(`${label}: duplicato.`);
  };
  const ordered = (values: { index: number }[], label: string) => {
    if (values.some((v, i) => v.index !== i)) fail(`${label}: indice originale non contiguo.`);
  };
  const files = new Set(p.provenance.files.map((f) => f.file));
  unique(
    p.provenance.files.map((f) => f.file),
    'file fonte',
  );
  const refs = [
    ...p.products,
    ...p.items,
    ...p.encounters,
    ...p.groups,
    ...p.sections,
    ...p.context.heroes,
  ].map((entity) => entity.source);
  for (const tile of [...p.standard, ...p.custom])
    refs.push(tile.source, tile.modelSource, ...tile.spaces.map((space) => space.source));
  for (const r of refs)
    if (!files.has(r.slice(0, r.lastIndexOf(':')))) fail(`File fonte non dichiarato: ${r}.`);
  for (const [name, values] of Object.entries({
    products: p.products,
    items: p.items,
    encounters: p.encounters,
    groups: p.groups,
    standard: p.standard,
    custom: p.custom,
    sections: p.sections,
  })) {
    ordered(values, name);
    unique(
      values.map((v) => v.source),
      `${name} source`,
    );
  }
  for (const values of [p.products, p.items, p.encounters, p.groups])
    unique(
      values.map((v) => v.id),
      'ID modello',
    );
  unique(p.context.ownedProductIds, 'prodotti posseduti');
  unique(
    p.context.heroes.map((h) => h.id),
    'eroi',
  );
  if (p.context.heroes.length !== p.context.heroCount) fail('H diverso dagli eroi espliciti.');
  const tiles = [...p.standard, ...p.custom];
  const models = new Map<string, Tile>();
  const codes = new Map<string, Tile>();
  for (const bucket of [p.standard, p.custom])
    unique(
      bucket.map((t) => t.hashId),
      'HashId bucket',
    );
  unique(
    tiles.map((t) => t.source),
    'identità prefab',
  );
  for (const t of tiles) {
    ordered(t.spaces, 'caselle');
    unique(
      t.spaces.map((s) => s.source),
      'caselle source',
    );
    for (const prior of [models.get(t.modelSource), codes.get(t.code)]) {
      if (
        prior &&
        (prior.hashId !== t.hashId ||
          prior.code !== t.code ||
          prior.set !== t.set ||
          prior.oppositeHashId !== t.oppositeHashId)
      )
        fail('Identità modello incoerente.');
    }
    models.set(t.modelSource, t);
    codes.set(t.code, t);
    if (!tiles.some((o) => o.hashId === t.oppositeHashId))
      fail(`Opposite HashId non risolto: ${t.source}.`);
  }
  const items = new Map(p.items.map((i) => [i.source, i]));
  const itemIds = new Set(p.items.map((i) => i.id));
  const encounters = new Set(p.encounters.map((e) => e.source));
  const groups = new Set(p.groups.map((g) => g.source));
  const requireRef = (ok: boolean, r: string | number) => {
    if (!ok) fail(`Riferimento non risolto: ${r}.`);
  };
  for (const id of p.context.ownedProductIds)
    requireRef(
      p.products.some((x) => x.id === id),
      id,
    );
  for (const id of [...p.context.groupItemIds, ...p.context.heroes.flatMap((h) => h.itemIds)])
    requireRef(itemIds.has(id), id);
  for (const product of p.products) {
    for (const c of product.tileCodes) requireRef(codes.has(c), c);
    for (const r of product.encounterSources) requireRef(encounters.has(r), r);
    for (const r of product.groupSources) requireRef(groups.has(r), r);
    for (const q of product.itemQuantities) requireRef(items.has(q.itemSource), q.itemSource);
  }
  for (const item of p.items)
    for (const r of item.upgradeSources) if (r !== null) requireRef(items.has(r), r);
  for (const e of p.encounters)
    for (const r of e.itemSources) if (r !== null) requireRef(items.has(r), r);
  for (const g of p.groups)
    for (const r of [...g.requiredSources, ...g.optionalSources]) requireRef(encounters.has(r), r);
  for (const s of p.sections) {
    if (s.minimumSpaces > s.maximumSpaces) fail(`Sezione ${s.index}: minimo superiore al massimo.`);
    for (const r of [...(s.start ? [s.start] : []), ...s.required])
      requireRef(models.has(r.modelSource), r.modelSource);
    for (const r of s.fixedEncounterSources) requireRef(encounters.has(r), r);
  }
  for (const r of [
    ...p.adventureEncounterSources,
    ...p.incoming.randomEncounterPool,
    ...p.incoming.itemEncounterPool,
  ])
    requireRef(encounters.has(r), r);
  return p;
}
