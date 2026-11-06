import { z } from 'zod';
import { ContentIdSchema as id } from '../shared/catalog';
import { CopyIdSchema as copy } from '../shared/preparation';
import { CampRecipeSchema } from '../shared/camp-preparation';
import { boundPhysicalInput } from '../physical-content/validation';
import { PHYSICAL_CONTENT_LIMITS } from '../physical-content/model';
import { canonical } from '../map-freeze/hash';

export const fingerprint = z.string().regex(/^[0-9a-f]{64}$/);
const identity = z.enum(['bound', 'requires-content']);
const evidence = z
  .array(z.strictObject({ sourceId: id, locator: z.string().min(1).max(1000) }))
  .min(1)
  .max(20);
const initialKind = z.enum(['basic', 'hero', 'role']);
export const cardSchema = z.strictObject({
  id,
  kind: z.enum(['basic', 'hero', 'role', 'weakness', 'purchased', 'title']),
  ownerId: id.nullable(),
  number: z.int().min(1).max(1000),
  copies: z.array(copy).min(1).max(5),
  identity,
  definitionHash: fingerprint,
  evidence,
});
export const sourceSchema = z.strictObject({
  format: z.literal('camp-decks-source-v1'),
  revision: z.int().positive(),
  catalog: z.strictObject({
    fingerprint,
    heroIds: z.array(id).length(6),
    roleIds: z.array(id).length(6),
    cards: z.array(cardSchema).min(95).max(512),
  }),
  capability: z.strictObject({
    version: z.literal('source-camp-preparation-v1'),
    catalogFingerprint: fingerprint,
    evidenceHash: fingerprint,
    cards: z
      .array(
        z.strictObject({
          cardId: id,
          cardHash: fingerprint,
          kind: initialKind,
          ownerId: id.nullable(),
          number: z.int().min(1).max(6),
          identity,
          evidence,
        }),
      )
      .length(54),
  }),
  originalRoster: z
    .array(z.strictObject({ heroId: id, playerId: id, initialRoleId: id }))
    .min(2)
    .max(5),
  episode: z.strictObject({ id, fingerprint, outcome: z.enum(['win', 'loss']) }),
  drawOrder: z.array(id).min(2).max(5),
  campaign: z.strictObject({
    heroes: z
      .array(
        z.strictObject({
          heroId: id,
          roleId: id.nullable(),
          skillCopies: z.array(copy).max(250),
          titleCopies: z.array(copy).max(21),
          itemCopies: z.array(copy).max(3),
          balances: z
            .array(z.strictObject({ roleId: id, availableXP: z.int().nonnegative() }))
            .max(6),
          provenance: z.unknown(),
        }),
      )
      .min(2)
      .max(5),
    inventory: z
      .array(
        z.strictObject({
          copy,
          kind: z.enum(['purchased', 'title', 'item', 'accessory']),
          ownerId: id.nullable(),
        }),
      )
      .max(1000),
    provenance: z.unknown(),
  }),
  oldWeaknesses: z
    .array(
      z.strictObject({
        copy,
        heroId: id.nullable(),
        playerId: id.nullable(),
        zone: z.enum(['deck', 'discard', 'prepared', 'revealed', 'setAside', 'reserve']),
        episodeFingerprint: fingerprint,
      }),
    )
    .length(20),
  choices: z
    .array(
      z.strictObject({
        heroId: id,
        accessory: copy.nullable(),
        recipe: CampRecipeSchema,
        summaryHash: fingerprint,
        confirmedRevision: z.int().positive().nullable(),
      }),
    )
    .min(2)
    .max(5),
});
export const entropySchema = z.strictObject({ seed: fingerprint });
export const pinsSchema = z.strictObject({
  sourceFingerprint: fingerprint.optional(),
  realizationFingerprint: fingerprint.optional(),
  artifactFingerprint: fingerprint.optional(),
});
export type CampDeckSource = z.infer<typeof sourceSchema>;
export type CampDeckPins = z.infer<typeof pinsSchema>;
export type CampDeckCard = z.infer<typeof cardSchema>;
export const POLICY = 'camp-decks-sha256-fy-v1' as const;
export const PENDING = Object.freeze([
  'atomic-registry-activation-preserving-A1-origin-and-RNG',
  'physical-damage-fear-boon-cleanup',
  'on-prepare-and-after-setup-triggers',
  'consumable-resets',
  'new-role-XP-initialization',
  'Scout3-and-startup-enemies',
  'post-loss-weakness-after-Scout3-in-future-consumer',
  'benefit-quantities-57',
]);
export function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(`Camp decks: ${message}`);
}
export function unique(values: string[], label: string): void {
  check(new Set(values).size === values.length, `${label}: duplicate identity.`);
}
export function sameSet(actual: string[], expected: string[], label: string): void {
  unique(actual, label);
  check(
    actual.length === expected.length && actual.every((v) => expected.includes(v)),
    `${label}: missing/unknown identity.`,
  );
}
/** Same descriptor and canonical byte budgets on source, full output and replay. */
export function bounded(value: unknown): void {
  boundPhysicalInput(value);
  check(Buffer.byteLength(canonical(value)) <= PHYSICAL_CONTENT_LIMITS.bytes, 'JSON byte budget.');
}
