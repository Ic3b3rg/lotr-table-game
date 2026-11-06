import { z } from 'zod';
import { bounded, pinsSchema } from './model';
import { verifyBattleMapArtifact } from './compiler';

const requestSchema = z.strictObject({
  kind: z.enum(['geometry', 'adventure-start']),
  expected: pinsSchema.optional(),
});

/** Technical geometry is available; starting an adventure remains owned by a future consumer. */
export function battleMapCapability(artifact: unknown, request: unknown) {
  bounded(request);
  const r = requestSchema.parse(request);
  const a = verifyBattleMapArtifact(artifact, r.expected);
  return {
    format: 'battle-map-capability-v1' as const,
    kind: r.kind,
    enabled: r.kind === 'geometry',
    runtimeReady: false as const,
    sourceFingerprint: a.sourceFingerprint,
    artifactFingerprint: a.artifactFingerprint,
    selectedAlternative: a.compiled.selectedAlternative,
    gates: a.gates,
  };
}
export type BattleMapCapability = ReturnType<typeof battleMapCapability>;
