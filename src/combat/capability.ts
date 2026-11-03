import { z } from 'zod';
import { verifyCombatArtifact } from './compiler';
import { bounded, check, dependency, id, type Dependency } from './model';
const RequestSchema = z.strictObject({
  operation: z.enum(['kernel', 'original-person', 'original-attack']),
  heroId: id.optional(),
  shadowReached: z.boolean().optional(),
  requiredHooks: z.array(dependency).max(16).optional(),
});
/** Read-only preflight. Kernel completeness never authorizes original gameplay or costs. */
export function combatCapability(rawArtifact: unknown, rawRequest: unknown) {
  bounded(rawRequest);
  const a = verifyCombatArtifact(rawArtifact),
    request = RequestSchema.parse(rawRequest);
  if (request.heroId)
    check(
      a.source.projection.context.heroes.some((h) => h.catalogId === request.heroId),
      'Capability per eroe estraneo.',
    );
  const implemented = [
    'source-compiler',
    'spawn',
    'weapon-slots',
    'figure-hits',
    'instruction-selection',
    'checkpoint-replay',
  ];
  const missing: Dependency[] = [...(request.requiredHooks ?? [])];
  if (request.operation !== 'kernel') {
    missing.push(
      'attack-controller',
      'attack-windows',
      'persistent-attack-hooks',
      'physical-consequences-p2',
      'scenario-continuation',
    );
    if (request.operation === 'original-person') missing.push('person-controller');
    if (a.compiled.instructions.some((i) => i.dependencies.includes('boon-quantities-57')))
      missing.push('boon-quantities-57');
    if (request.shadowReached) missing.push('shadow-runtime', 'terminal-loss');
  }
  return {
    format: 'combat-capability-v1' as const,
    artifactFingerprint: a.fingerprint,
    projectionFingerprint: a.projectionFingerprint,
    operation: request.operation,
    implemented,
    missing: [...new Set(missing)],
    kernelReady: true,
    runtimeReady: false,
    enabled: request.operation === 'kernel' && missing.length === 0,
  };
}
