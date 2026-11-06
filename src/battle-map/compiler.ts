import { z } from 'zod';
import { canonical, digest } from '../map-freeze/hash';
import { bounded, check, fingerprint, pinsSchema, sorted, type BattleMapPins } from './model';
import { parseSource } from './source';
import { deriveLayout, assertEquivalent } from './geometry';

export function compileBattleMapSource(raw: unknown) {
  const ctx = parseSource(raw),
    source = ctx.s;
  const layouts = sorted(source.alternatives).map((a) => deriveLayout(ctx, a));
  assertEquivalent(layouts, source.tolerances.geometry, source.tolerances.uv);
  const body = {
    format: 'battle-map-artifact-v1' as const,
    algorithm: source.algorithm,
    source,
    sourceFingerprint: digest(source),
    compiled: { selectedAlternative: source.selectedAlternative, layouts },
    runtimeReady: false as const,
    gates: {
      boonQuantities: [null, null, null],
      boonStatus: 'unverified',
      original156: 'static-gated',
      requirements: [
        'boon-quantities-57',
        'decks-shuffles-triggers',
        'packet-scenario-consumers',
        'enemy-generation',
        'random-results-freeze',
        'transactional-startup-integration',
      ],
    },
  };
  const artifact = { ...body, artifactFingerprint: digest(body) };
  bounded(artifact);
  return artifact;
}
export type BattleMapArtifact = ReturnType<typeof compileBattleMapSource>;

const envelope = z.strictObject({
  format: z.literal('battle-map-artifact-v1'),
  algorithm: z.literal('rectilinear-patches-v1'),
  source: z.unknown(),
  sourceFingerprint: fingerprint,
  compiled: z.unknown(),
  runtimeReady: z.literal(false),
  gates: z.unknown(),
  artifactFingerprint: fingerprint,
});

/** Recompile all derivations. Caller pins establish identity; hashing alone does not. */
export function verifyBattleMapArtifact(raw: unknown, expected?: BattleMapPins): BattleMapArtifact {
  bounded(raw);
  if (expected !== undefined) bounded(expected);
  const pins = pinsSchema.parse(expected === undefined ? {} : expected),
    supplied = envelope.parse(raw);
  const rebuilt = compileBattleMapSource(supplied.source);
  check(
    canonical(supplied) === canonical(rebuilt),
    'Artifact does not match complete recompilation.',
  );
  check(
    pins.sourceFingerprint === undefined || pins.sourceFingerprint === rebuilt.sourceFingerprint,
    'Expected source fingerprint mismatch.',
  );
  check(
    pins.artifactFingerprint === undefined ||
      pins.artifactFingerprint === rebuilt.artifactFingerprint,
    'Expected artifact fingerprint mismatch.',
  );
  return rebuilt;
}
