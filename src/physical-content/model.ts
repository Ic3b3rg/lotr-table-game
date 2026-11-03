import { z } from 'zod';

export const PHYSICAL_CONTENT_LIMITS = Object.freeze({
  bytes: 8 * 1024 * 1024,
  cards: 100,
  copies: 200,
  sources: 128,
  errata: 128,
  string: 16384,
  depth: 24,
  nodes: 100000,
});
export const FAMILIES = ['damage', 'fear', 'boon', 'title'] as const;
export const EXPECTED = Object.freeze({
  damage: Object.freeze({ definitions: 18, copies: 28 }),
  fear: Object.freeze({ definitions: 18, copies: 28 }),
  boon: Object.freeze({ definitions: 3, copies: 15 }),
  title: Object.freeze({ definitions: 21, copies: 21 }),
});

const id = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z][a-z0-9-]*$/);
const short = z
  .string()
  .min(1)
  .max(400)
  .refine((s) => s.trim().length > 0);
const text = z
  .string()
  .min(1)
  .max(PHYSICAL_CONTENT_LIMITS.string)
  .refine((s) => s.trim().length > 0);
const reference = z.strictObject({ sourceId: id, locator: z.string().min(1).max(300) });
const symbol = z.enum([
  'damage',
  'fear',
  'success',
  'fate',
  'might',
  'wisdom',
  'agility',
  'spirit',
  'wit',
  'inspiration',
  'depletion',
]);
const strings = z.array(short).max(24);
const fact = <S extends z.ZodType>(value: S) =>
  z.strictObject({
    value,
    status: z.enum(['verified', 'unresolved', 'conflict']),
    evidence: z.array(reference).min(1).max(12),
    errataIds: z.array(id).max(8),
    note: z.string().max(2000),
  });
const original = z.strictObject({ text, language: z.enum(['en', 'it']), reference });
const comparison = z.strictObject({
  numbers: short,
  symbols: short,
  costs: short,
  targets: short,
  conditions: short,
  timing: short,
  duration: short,
  operations: short,
});
const localized = fact(text).extend({
  language: z.literal('it'),
  origin: z.enum(['original-it', 'working-translation', 'app-localization']),
  original: original.nullable(),
  comparison: comparison.nullable(),
});
const model = z.strictObject({
  sourceId: id,
  locator: z.string().min(1).max(300),
  modelId: z.int().min(1).max(10000),
});
const orientation = z.enum(['portrait', 'landscape', 'unknown']);

export const FACT_FIELDS = [
  'name',
  'aliases',
  'quantity',
  'printing',
  'front',
  'back',
  'text',
  'mechanics.timing',
  'mechanics.conditions',
  'mechanics.costs',
  'mechanics.targets',
  'mechanics.duration',
  'mechanics.operations',
  'mechanics.values',
  'mechanics.symbols',
  'usage',
  'binding',
] as const;

const PackSchema = z.strictObject({
  formatVersion: z.literal(1),
  profile: z.literal('base-physical-v1'),
  language: z.literal('it'),
  sources: z
    .array(
      z.strictObject({
        id,
        kind: z.enum([
          'workbook',
          'app-model',
          'app-localization',
          'official-rules',
          'official-errata',
          'official-corrected-card',
          'original-card-image',
          'derived-evidence',
        ]),
        language: z.enum(['it', 'en', 'mul', 'none']),
        edition: z.string().min(1).max(200).nullable(),
        uri: z.string().min(1).max(2048),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
      }),
    )
    .min(1)
    .max(PHYSICAL_CONTENT_LIMITS.sources),
  cards: z
    .array(
      z.strictObject({
        id,
        family: z.enum(FAMILIES),
        order: z.int().min(0).max(99),
        name: localized,
        aliases: fact(z.array(short).min(1).max(8)),
        quantity: fact(z.int().min(1).max(28).nullable()),
        copies: z.array(z.strictObject({ id, ordinal: z.int().min(1).max(28) })).max(28),
        printing: fact(
          z.strictObject({
            type: z.enum(FAMILIES),
            number: z.int().min(1).max(21).nullable(),
            rank: z.null(),
            traits: strings,
            icons: z.array(z.strictObject({ symbol, count: z.int().min(1).max(9) })).max(12),
          }),
        ),
        front: fact(z.strictObject({ kind: z.literal('rules'), orientation })),
        back: fact(
          z.strictObject({
            kind: z.enum(['damage-back', 'fear-back', 'skill-back', 'same-as-front', 'unknown']),
            orientation,
          }),
        ),
        text: localized,
        mechanics: z.strictObject({
          timing: fact(strings),
          conditions: fact(strings),
          costs: fact(strings),
          targets: fact(strings),
          duration: fact(strings),
          operations: fact(strings),
          values: fact(
            z
              .array(
                z.strictObject({
                  label: short,
                  value: z.union([z.int().min(-100).max(100), z.enum(['all', 'any', 'equal'])]),
                  unit: short,
                }),
              )
              .max(24),
          ),
          symbols: fact(z.array(symbol).max(12)),
        }),
        usage: fact(
          z.strictObject({
            acquire: z.enum(['suffer', 'supply', 'app-instruction']),
            initialFace: z.enum(['faceup', 'instruction']),
            requiresPrepared: z.boolean(),
            prepareOnGain: z.enum(['unless-instructed-otherwise', 'not-applicable']),
            ownership: z.enum(['adventure', 'campaign']),
            removedUntil: z.enum(['next-adventure', 'not-applicable']),
          }),
        ),
        binding: fact(
          z
            .strictObject({
              titleModel: model,
              nameKey: z.string().min(1).max(200),
              skillModels: z.array(model).max(4),
              skillStatus: z.enum(['linked', 'absent-in-checked-base']),
            })
            .nullable(),
        ),
      }),
    )
    .max(PHYSICAL_CONTENT_LIMITS.cards),
  errata: z
    .array(
      z.strictObject({
        id,
        cardId: id,
        fields: z.array(z.enum(FACT_FIELDS)).min(1).max(17),
        reference,
        disposition: z.enum(['applied', 'already-incorporated']),
        original: z.strictObject({ reference, text }).nullable(),
        note: short,
      }),
    )
    .max(PHYSICAL_CONTENT_LIMITS.errata),
});

export type PhysicalPack = z.infer<typeof PackSchema>;
export type PhysicalCard = PhysicalPack['cards'][number];
export type Fact = {
  value: unknown;
  status: 'verified' | 'unresolved' | 'conflict';
  evidence: z.infer<typeof reference>[];
  errataIds: string[];
  note: string;
};
export type DeepReadonly<T> = T extends object
  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : T;

export function parsePhysicalPack(value: unknown): PhysicalPack {
  return PackSchema.parse(value);
}

export function cardFacts(card: PhysicalCard): [(typeof FACT_FIELDS)[number], Fact][] {
  return FACT_FIELDS.map((field) => {
    if (field.startsWith('mechanics.')) {
      const key = field.slice(10) as keyof PhysicalCard['mechanics'];
      return [field, card.mechanics[key]];
    }
    return [field, card[field as Exclude<(typeof FACT_FIELDS)[number], `mechanics.${string}`>]];
  });
}
