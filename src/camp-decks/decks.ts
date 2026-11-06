import { z } from 'zod';
import { canonical, digest } from '../map-freeze/hash';
import { parseSource, capabilityFor } from './source';
import {
  bounded,
  check,
  entropySchema,
  fingerprint,
  pinsSchema,
  sourceSchema,
  unique,
  POLICY,
  PENDING,
} from './model';
import { shuffleCopies } from './random';

type Context = ReturnType<typeof parseSource>;
type Entropy = z.infer<typeof entropySchema>;
function buildArtifact(context: Context, entropy: Entropy) {
  const { s, recipes, copies } = context;
  const sourceFingerprint = digest(s);
  const realizationFingerprint = digest({ sourceFingerprint, entropy, policy: POLICY });
  const pool = shuffleCopies(
    s.catalog.cards.filter((c) => c.kind === 'weakness').flatMap((c) => c.copies),
    entropy.seed,
    'weakness-pool',
  );
  const assignments = s.drawOrder.map((heroId, i) => ({ heroId, copy: pool.order[i]! }));
  const streams = [pool.trace];
  const heroes = s.originalRoster.map((r, rosterIndex) => {
    const recipe = recipes.find((p) => p.heroId === r.heroId)!;
    const allocated = recipe.cards.map((c) => {
      if (c.copy !== null) return c.copy;
      const card = s.catalog.cards.find((d) => d.id === c.cardId)!;
      return card.copies[c.kind === 'basic' ? rosterIndex : 0]!;
    });
    const prepared = allocated.filter((copy) => copies.get(copy)!.id === recipe.futurePrepared);
    check(prepared.length === 1, 'New role1 structural placement.');
    const weakness = assignments.find((a) => a.heroId === r.heroId)!.copy;
    const shuffled = shuffleCopies(
      [...allocated.filter((copy) => !prepared.includes(copy)), weakness],
      entropy.seed,
      `hero:${r.heroId}`,
    );
    streams.push(shuffled.trace);
    return {
      heroId: r.heroId,
      playerId: r.playerId,
      roleId: recipe.roleId!,
      recipeHash: digest(recipe),
      weakness,
      prepared,
      deck: shuffled.order,
      discard: [] as string[],
      revealed: [] as string[],
      setAside: [] as string[],
    };
  });
  const reserve = pool.order.slice(s.originalRoster.length);
  unique(
    [...heroes.flatMap((h) => [...h.prepared, ...h.deck]), ...reserve],
    'Materialized physical copies',
  );
  const body = {
    format: 'camp-decks-artifact-v1' as const,
    source: s,
    entropy,
    policy: POLICY,
    sourceFingerprint,
    realizationFingerprint,
    materialized: {
      phase: 'before-activation-and-preparation-triggers' as const,
      runtimeReady: false as const,
      adventureStartEnabled: false as const,
      pending: [...PENDING],
      heroes,
      weaknessPool: { shuffled: pool.order, assignments, reserve },
      streams,
      // All resources here are archived provenance, never finalized active values.
      lineage: {
        episode: s.episode,
        originalRoster: s.originalRoster,
        campaign: s.campaign,
        choices: s.choices,
        oldWeaknesses: s.oldWeaknesses,
      },
    },
  };
  bounded(body);
  const artifact = { ...body, artifactFingerprint: digest(body) };
  bounded(artifact);
  // Avoid aliases between embedded source and the materialized lineage as well.
  return structuredClone(artifact);
}
export type CampDeckArtifact = ReturnType<typeof buildArtifact>;
export function materializeCampDecks(source: unknown, entropy: unknown) {
  const context = parseSource(source);
  const capability = capabilityFor(context);
  if (!capability.enabled)
    return {
      format: 'camp-decks-gate-v1' as const,
      capability,
      entropyDraws: 0 as const,
    };
  bounded(entropy);
  return buildArtifact(context, entropySchema.parse(entropy));
}

const artifactSchema = z.strictObject({
  format: z.literal('camp-decks-artifact-v1'),
  source: sourceSchema,
  entropy: entropySchema,
  policy: z.literal(POLICY),
  sourceFingerprint: fingerprint,
  realizationFingerprint: fingerprint,
  artifactFingerprint: fingerprint,
  materialized: z.unknown(),
});
/** Reproduction proves consistency; only independently supplied pins bind authority. */
export function verifyCampDeckArtifact(raw: unknown, expectedPins: unknown = {}): CampDeckArtifact {
  bounded(raw);
  bounded(expectedPins);
  const pins = pinsSchema.parse(expectedPins);
  const received = artifactSchema.parse(raw);
  const expected = materializeCampDecks(received.source, received.entropy);
  check(expected.format === 'camp-decks-artifact-v1', 'Artifact source is gated.');
  check(canonical(raw) === canonical(expected), 'Full artifact replay mismatch.');
  for (const name of [
    'sourceFingerprint',
    'realizationFingerprint',
    'artifactFingerprint',
  ] as const)
    check(
      pins[name] === undefined || pins[name] === expected[name],
      `Expected ${name} pin mismatch.`,
    );
  return expected;
}
