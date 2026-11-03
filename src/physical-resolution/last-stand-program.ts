import { createHash } from 'node:crypto';
import { z } from 'zod';
import { ContentIdSchema } from '../shared/catalog';
import { HashSchema } from '../shared/generated-map';
import { StatSchema } from '../shared/skill-tests';
import { requirePhysicalFamily } from '../physical-content/catalog';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';

const reference = z.strictObject({
  sourceId: z.string().min(1).max(100),
  locator: z.string().min(1).max(300),
});
const message = z.strictObject({
  text: z.string().min(1).max(16000),
  textSha256: HashSchema,
  source: reference,
});
export const TitleEffectSchema = z.discriminatedUnion('op', [
  z.strictObject({
    op: z.literal('last-stand-success'),
    n: z.int().min(1).max(5),
    cost: z.literal('remove-from-adventure'),
    target: z.literal('self-or-nearby'),
  }),
  z.strictObject({
    op: z.literal('rest'),
    n: z.int().min(1).max(5),
    after: z.strictObject({
      op: z.literal('remove-and-gain-boon'),
      boon: z.enum(['emboldened', 'hidden', 'determined']),
    }),
  }),
]);
export const LastStandInputSchema = z.strictObject({
  version: z.literal(1),
  rules: z.literal('source-last-stand-v1'),
  sources: z
    .array(z.strictObject({ id: z.string().min(1).max(100), sha256: HashSchema }))
    .min(1)
    .max(32),
  instructions: z
    .array(
      message.extend({
        id: z.string().min(1).max(200),
        family: z.enum(['damage', 'fear']),
        model: reference.extend({ sha256: HashSchema }),
        stat: StatSchema,
      }),
    )
    .length(10),
  outcomes: z.strictObject({ damage: message, fear: message, defeat: message }),
  awards: z
    .array(
      z.strictObject({
        condition: z.enum(['only-active-hero', 'tested-difficulty-at-least']),
        minimum: z.int().min(1).max(99).nullable(),
        titleId: ContentIdSchema,
        source: reference,
      }),
    )
    .length(2),
  titles: z
    .array(
      z.strictObject({
        cardId: ContentIdSchema,
        cardHash: HashSchema,
        source: reference,
        effects: z.array(TitleEffectSchema).min(1).max(8),
      }),
    )
    .length(2),
});
export const LastStandArtifactSchema = LastStandInputSchema.extend({
  rawFingerprint: HashSchema,
  fingerprint: HashSchema,
});
export type LastStandArtifact = z.infer<typeof LastStandArtifactSchema>;

/** Reviewed structural instructions; no prose, localization or card name dispatch. */
export function compileLastStand(raw: unknown, input: unknown): LastStandArtifact {
  const ir = LastStandInputSchema.parse(input);
  const titles = requirePhysicalFamily(raw, 'title').cards;
  invariant(
    new Set(ir.sources.map((s) => s.id)).size === ir.sources.length,
    'Fonti Ultimo Sforzo duplicate.',
  );
  invariant(
    new Set(ir.instructions.map((i) => i.id)).size === 10 &&
      ['damage', 'fear'].every((f) => ir.instructions.filter((i) => i.family === f).length === 5),
    'Famiglie istruzioni Ultimo Sforzo incomplete o duplicate.',
  );
  for (const m of [...ir.instructions, ...Object.values(ir.outcomes)])
    invariant(
      createHash('sha256').update(m.text).digest('hex') === m.textSha256 &&
        ir.sources.some((s) => s.id === m.source.sourceId),
      'Testo istruzione senza fonte/hash corrispondente.',
    );
  invariant(
    new Set(ir.titles.map((t) => t.cardId)).size === 2 &&
      new Set(ir.awards.map((a) => a.condition)).size === 2,
    'Titoli o condizioni duplicati.',
  );
  for (const t of ir.titles) {
    const card = titles.find((c) => c.id === t.cardId);
    invariant(
      card &&
        digest(card) === t.cardHash &&
        digest(t.source) === digest(card.text.original?.reference ?? card.text.evidence[0]),
      'Titolo non legato alla famiglia verificata.',
    );
  }
  for (const a of ir.awards)
    invariant(
      ir.titles.some((t) => t.cardId === a.titleId) &&
        (a.condition === 'only-active-hero' ? a.minimum === null : a.minimum !== null) &&
        ir.sources.some((s) => s.id === a.source.sourceId),
      'Premio titolo senza condizione/fonte.',
    );
  const compiled = { ...ir, rawFingerprint: digest(raw) };
  return { ...compiled, fingerprint: digest(compiled) };
}
export function validateLastStandArtifact(raw: unknown, artifact: LastStandArtifact) {
  const { rawFingerprint: _, fingerprint: __, ...input } = LastStandArtifactSchema.parse(artifact);
  invariant(
    digest(compileLastStand(raw, input)) === digest(artifact),
    'Artifact Ultimo Sforzo modificato.',
  );
}
