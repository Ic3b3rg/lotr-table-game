import { z } from 'zod';
import {
  ContentIdSchema,
  CatalogSchema,
  type Catalog,
  CampaignSkillDefinitionSchema,
  type CampaignSkillDefinition,
} from '../shared/catalog';
import { HashSchema } from '../shared/generated-map';
import { StatSchema } from '../shared/skill-tests';
import { requirePhysicalFamily } from '../physical-content/catalog';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';

const family = z.enum(['damage', 'fear']);
const scope = z.enum([
  'self',
  'each-nearby-excluding-self',
  'each-other-hero-any-distance',
  'self-and-each-nearby',
]);
const count = z.int().min(0).max(56);
const reference = z.strictObject({
  sourceId: z.string().min(1).max(100),
  locator: z.string().min(1).max(300),
});
export const FrontEventSchema = z.enum([
  'end-own-turn',
  'after-rest',
  'rally-scout',
  'before-interact',
  'during-own-turn',
  'after-darkness-suffering-batch',
]);
const atoms = z.discriminatedUnion('op', [
  z.strictObject({ op: z.literal('self-flip-down') }),
  z.strictObject({ op: z.literal('discard-self') }),
  z.strictObject({ op: z.literal('keep-faceup') }),
  z.strictObject({ op: z.literal('flip-random'), hero: scope, family, n: count }),
  z.strictObject({
    op: z.literal('suffer'),
    hero: scope,
    family,
    n: count,
    face: z.enum(['down', 'normal']),
  }),
  z.strictObject({
    op: z.literal('discard-inspiration'),
    hero: z.literal('self'),
    n: z.union([count, z.literal('all')]),
  }),
  z.strictObject({ op: z.literal('discard-prepared'), hero: z.literal('self'), n: count }),
  z.strictObject({ op: z.literal('discard-boons'), hero: z.literal('self'), n: z.literal('all') }),
  z.strictObject({
    op: z.literal('deplete'),
    hero: z.literal('self'),
    n: z.literal(1),
    resolveTrinketEffect: z.literal(false),
  }),
  z.strictObject({
    op: z.literal('gain-weakness'),
    hero: z.literal('self'),
    n: z.literal(1),
    destination: z.literal('shuffle-into-current-skill-deck'),
  }),
]);
type Atom = z.infer<typeof atoms>;
export type FrontOp =
  | Atom
  | { op: 'choose-alternative'; branches: FrontOp[] }
  | { op: 'simultaneous'; parts: FrontOp[] }
  | {
      op: 'conditional';
      condition: 'self-space-in-darkness' | 'exists-nearby-hero-excluding-self';
      then: FrontOp;
    }
  | {
      op: 'deplete-or-if-impossible';
      hero: 'another-hero-any-distance';
      n: 1;
      resolveTrinketEffect: false;
      fallback: FrontOp;
    };
export const FrontOpSchema: z.ZodType<FrontOp> = z.lazy(() =>
  z.union([
    atoms,
    z.strictObject({
      op: z.literal('choose-alternative'),
      branches: z.array(FrontOpSchema).min(2).max(5),
    }),
    z.strictObject({ op: z.literal('simultaneous'), parts: z.array(FrontOpSchema).min(2).max(5) }),
    z.strictObject({
      op: z.literal('conditional'),
      condition: z.enum(['self-space-in-darkness', 'exists-nearby-hero-excluding-self']),
      then: FrontOpSchema,
    }),
    z.strictObject({
      op: z.literal('deplete-or-if-impossible'),
      hero: z.literal('another-hero-any-distance'),
      n: z.literal(1),
      resolveTrinketEffect: z.literal(false),
      fallback: FrontOpSchema,
    }),
  ]),
);
export const PersistentOpSchema = z.union([
  z.strictObject({
    op: z.literal('replace-discard'),
    window: z.literal('would-discard'),
    hero: z.literal('self'),
    family,
    face: z.literal('up'),
    instead: z.literal('flip-down'),
  }),
  z.strictObject({
    op: z.literal('mandatory-spend'),
    window: z.literal('before-interact'),
    token: z.literal('threat'),
    resource: z.literal('inspiration'),
    n: z.literal(1),
  }),
  z.strictObject({ op: z.literal('prohibit-scout-top'), window: z.literal('rally-scout') }),
  z.strictObject({
    op: z.literal('stat-modifier'),
    window: z.literal('continuous'),
    stats: z.literal('all'),
    n: z.literal(-1),
  }),
  z.strictObject({
    op: z.literal('self-flip-down'),
    window: z.enum(['end-own-turn', 'after-rest']),
  }),
  z.strictObject({
    op: z.literal('travel-move-modifier'),
    window: z.literal('travel-action'),
    n: z.literal(-1),
  }),
  z.strictObject({
    op: z.literal('test-reveal-modifier'),
    window: z.literal('attack-test'),
    n: z.literal(-1),
  }),
  z.strictObject({
    op: z.literal('optional-self-discard'),
    window: z.literal('during-own-turn'),
    condition: z.literal('emboldened'),
  }),
  z.strictObject({
    op: z.literal('suffer'),
    window: z.literal('after-darkness-suffering-batch'),
    hero: z.literal('triggering-self-or-nearby'),
    family: z.literal('fear'),
    n: z.literal(1),
    face: z.literal('normal'),
    condition: z.literal('at-least-one-actually-suffered'),
    source: z.literal('this-card-not-darkness'),
  }),
  z.strictObject({
    op: z.literal('prohibit'),
    window: z.literal('continuous'),
    operation: z.literal('prevent-damage-including-negate'),
  }),
  z.strictObject({ op: z.literal('add-hits'), window: z.literal('attack'), n: z.literal(2) }),
  z.strictObject({
    op: z.literal('suffer'),
    window: z.literal('end-own-turn'),
    hero: z.literal('self'),
    family: z.literal('fear'),
    n: z.literal(1),
    face: z.literal('normal'),
  }),
  z.strictObject({
    op: z.literal('add-success'),
    window: z.literal('test-convert'),
    stats: z.array(StatSchema).min(1).max(5),
    n: z.literal(1),
    optional: z.literal(false),
  }),
]);
export const PolicyEffectSchema = z.discriminatedUnion('op', [
  z.strictObject({ op: z.literal('rest'), n: z.int().min(1).max(5) }),
  z.strictObject({ op: z.literal('guard'), n: z.int().min(1).max(5) }),
  z.strictObject({ op: z.literal('paid-prevent'), n: z.literal(1) }),
  z.strictObject({
    op: z.literal('facedown-prevent'),
    family: z.enum(['damage', 'any']),
    n: z.literal(1),
  }),
  z.strictObject({
    op: z.literal('limits'),
    damage: z.int().min(0).max(1),
    fear: z.int().min(0).max(1),
  }),
  z.strictObject({ op: z.literal('stat'), stat: StatSchema, n: z.literal(-1) }),
  z.strictObject({ op: z.literal('negate-might') }),
  z.strictObject({ op: z.literal('negate-bonus'), n: z.literal(1) }),
  z.strictObject({
    op: z.literal('convert-all'),
    noPrintedSuccess: z.boolean(),
    scout: z.int().min(0).max(2),
  }),
  z.strictObject({ op: z.literal('convert-one-scout'), scout: z.literal(1) }),
  z.strictObject({ op: z.literal('convert-pair-alone') }),
  z.strictObject({ op: z.literal('after-prepare-inspiration') }),
  z.strictObject({ op: z.literal('after-prepare-scout'), count: z.int().min(1).max(4) }),
  z.strictObject({ op: z.literal('after-setup-inspiration') }),
  z.strictObject({ op: z.literal('after-setup-scout'), count: z.int().min(1).max(4) }),
  z.strictObject({ op: z.literal('after-prepare-flip-fear') }),
  z.strictObject({ op: z.literal('after-guard-inspiration') }),
  z.strictObject({ op: z.literal('after-test-spend-inspiration') }),
  z.strictObject({ op: z.literal('fear-facedown-only'), depletion: z.int().min(1).max(3) }),
  z.strictObject({ op: z.literal('fear-facedown'), depletion: z.int().min(1).max(3) }),
  z.strictObject({ op: z.literal('ignore-card-resource-loss') }),
]);
export const FrontInputSchema = z.strictObject({
  version: z.literal(1),
  definitions: z
    .array(
      z.strictObject({
        cardId: ContentIdSchema,
        cardHash: HashSchema,
        originalHash: HashSchema,
        source: reference,
        body: z.array(FrontOpSchema).min(1).max(16),
        persistent: z.array(PersistentOpSchema).max(8),
      }),
    )
    .length(36),
  policies: z
    .array(
      z.strictObject({
        id: ContentIdSchema,
        kind: z.enum(['skill', 'item', 'hero']),
        definitionHash: HashSchema,
        source: reference,
        effects: z.array(PolicyEffectSchema).min(1).max(8),
      }),
    )
    .max(100),
});
export const FrontArtifactSchema = FrontInputSchema.extend({
  rawFingerprint: HashSchema,
  fingerprint: HashSchema,
});
export type FrontArtifact = z.infer<typeof FrontArtifactSchema>;
export type PersistentOp = z.infer<typeof PersistentOpSchema>;
export type PolicyEffect = z.infer<typeof PolicyEffectSchema>;

/** Compile reviewed structural annotations; prose and localized names never dispatch. */
export function compilePhysicalFronts(
  raw: unknown,
  input: unknown,
  catalog?: Catalog,
  campaignSkills: CampaignSkillDefinition[] = [],
): FrontArtifact {
  // Bound recursion before Zod's recursive schema is entered.
  let nodes = 0;
  const bound = (v: unknown, depth = 0) => {
    invariant(++nodes <= 20000 && depth <= 20, 'Programma fronti oltre il budget.');
    if (v && typeof v === 'object') for (const child of Object.values(v)) bound(child, depth + 1);
  };
  bound(input);
  const ir = FrontInputSchema.parse(input);
  const cards = [
    ...requirePhysicalFamily(raw, 'damage').cards,
    ...requirePhysicalFamily(raw, 'fear').cards,
  ];
  invariant(
    new Set(ir.definitions.map((d) => d.cardId)).size === 36,
    'Definizioni fronti duplicate.',
  );
  for (const d of ir.definitions) {
    const c = cards.find((c) => c.id === d.cardId);
    invariant(
      c &&
        d.cardHash === digest(c) &&
        d.originalHash === digest(c.text.original) &&
        digest(d.source) === digest(c.text.original?.reference ?? c.text.evidence[0]),
      'Fronte non legato ai campi originali del raw.',
    );
    invariant(
      d.body.filter((o) => ['self-flip-down', 'discard-self', 'keep-faceup'].includes(o.op))
        .length === 1 &&
        ['self-flip-down', 'discard-self', 'keep-faceup'].includes(d.body.at(-1)!.op),
      'Destinazione terminale assente o ambigua.',
    );
  }
  invariant(new Set(ir.policies.map((p) => p.id)).size === ir.policies.length, 'Policy duplicate.');
  if (ir.policies.length) {
    const c = CatalogSchema.parse(catalog);
    const additions = z.array(CampaignSkillDefinitionSchema).max(221).parse(campaignSkills);
    invariant(
      new Set([...c.skills, ...additions].map((c) => c.id)).size ===
        c.skills.length + additions.length,
      'Abilità campagna duplicate.',
    );
    for (const p of ir.policies) {
      const d = (
        p.kind === 'hero' ? c.heroes : p.kind === 'item' ? c.items : [...c.skills, ...additions]
      ).find((d) => d.id === p.id);
      invariant(
        d &&
          (!('identityStatus' in d) || d.identityStatus === 'confirmed') &&
          digest(d) === p.definitionHash,
        'Policy senza definizione confermata corrispondente.',
      );
    }
  }
  const compiled = { ...ir, rawFingerprint: digest(raw) };
  return { ...compiled, fingerprint: digest(compiled) };
}
export function validateFrontArtifact(
  raw: unknown,
  artifact: FrontArtifact,
  catalog?: Catalog,
  campaignSkills: CampaignSkillDefinition[] = [],
) {
  const { rawFingerprint: _, fingerprint: __, ...input } = FrontArtifactSchema.parse(artifact);
  invariant(
    digest(compilePhysicalFronts(raw, input, catalog, campaignSkills)) === digest(artifact),
    'Artifact fronti modificato.',
  );
}
