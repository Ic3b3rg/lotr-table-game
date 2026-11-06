import { digest } from '../map-freeze/hash';
import { sorted } from './model';
import { parseSource } from './source';
import { deriveLayout, assertEquivalent } from './geometry';

export function compileBattleMapSource(raw: unknown) {
  const ctx = parseSource(raw),
    source = ctx.s;
  const layouts = sorted(source.alternatives).map((a) => deriveLayout(ctx, a));
  assertEquivalent(layouts, source.tolerances.geometry);
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
  return { ...body, artifactFingerprint: digest(body) };
}
export type BattleMapArtifact = ReturnType<typeof compileBattleMapSource>;
