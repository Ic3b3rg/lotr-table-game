import { z } from 'zod';
import { digest } from '../map-freeze/hash';
import { HashSchema } from '../shared/generated-map';
import { id, modifier, dependency, count, bounded, check, unique } from './model';
import {
  SeedSchema,
  SpawnCommandSchema,
  PlanCommandSchema,
  ExternalCommandSchema,
  ProvokeCommandSchema,
  type Receipt,
} from './kernel-model';
import { createCombatKernel } from './kernel';
const TechnicalRunSchema = z.strictObject({
  format: z.literal('combat-technical-run-v1'),
  seed: SeedSchema,
  adapter: z.strictObject({
    mode: z.literal('technical-fixture-v1'),
    attacks: z
      .array(
        z.strictObject({
          planId: id,
          resultId: id,
          successes: z.array(id).max(100),
          afterTest: z.strictObject({ spaceId: id, defeated: z.boolean() }).nullable(),
          requiredHooks: z.array(dependency).max(16),
        }),
      )
      .max(1000),
    effects: z
      .array(
        z.strictObject({
          effectId: id,
          resultId: id,
          hits: count,
          modifiers: z.array(modifier).max(2),
          evidence: z.strictObject({ file: id, locator: id, sha256: HashSchema }),
        }),
      )
      .max(1000),
  }),
  commands: z
    .array(
      z.discriminatedUnion('kind', [
        SpawnCommandSchema,
        PlanCommandSchema,
        ExternalCommandSchema,
        ProvokeCommandSchema,
        z.strictObject({ kind: z.literal('apply'), id, planId: id }),
      ]),
    )
    .min(1)
    .max(1000),
});
/** CLI-only technical input port. Deliberately not exported from the library or connected to HTTP. */
export function runTechnicalCombat(artifact: unknown, raw: unknown) {
  bounded(raw);
  const run = TechnicalRunSchema.parse(raw);
  unique(
    run.adapter.attacks.map((r) => r.planId),
    'Risultato tecnico attacco',
  );
  unique(
    run.adapter.effects.map((r) => r.effectId),
    'Risultato tecnico effetto',
  );
  const kernel = createCombatKernel(artifact, run.seed, {
    attackResult(query) {
      const r = run.adapter.attacks.find((r) => r.planId === query.id);
      check(r, 'Risultato tecnico assente: nessuna prova simulata implicita.');
      return {
        id: r.resultId,
        contextFingerprint: digest(query),
        artifactFingerprint: query.artifactFingerprint,
        projectionFingerprint: query.projectionFingerprint,
        heroId: query.heroId,
        stat: query.stat,
        successes: r.successes,
        afterTest: r.afterTest ?? { spaceId: query.spaceId, defeated: false },
        requiredHooks: r.requiredHooks,
      };
    },
    externalEffect(query) {
      const r = run.adapter.effects.find((r) => r.effectId === query.effectId);
      check(r, 'Effetto tecnico assente.');
      return {
        id: r.resultId,
        contextFingerprint: digest(query),
        artifactFingerprint: query.artifactFingerprint,
        projectionFingerprint: query.projectionFingerprint,
        hits: r.hits,
        modifiers: r.modifiers,
        evidence: r.evidence,
      };
    },
  });
  const receipts = new Map<string, Receipt>();
  let gates: string[] = [];
  for (const command of run.commands) {
    const { kind, ...input } = command;
    let result;
    switch (kind) {
      case 'spawn':
        result = kernel.spawn(input);
        break;
      case 'plan':
        result = kernel.planAttack(input);
        break;
      case 'external':
        result = kernel.applyExternal(input);
        break;
      case 'provoke':
        result = kernel.provoke(input);
        break;
      case 'apply': {
        const c = command as Extract<typeof command, { kind: 'apply' }>;
        const plan = receipts.get(c.planId);
        check(plan?.status === 'planned', 'Piano tecnico assente.');
        result = kernel.applyPlan({ id: c.id, planFingerprint: plan.plan.fingerprint });
        break;
      }
    }
    if (result.status === 'gated') {
      gates = result.gates;
      break;
    }
    receipts.set(command.id, result);
  }
  return {
    checkpoint: kernel.checkpoint(),
    report: {
      evidence: 'technical-adapter' as const,
      gameplayAcceptance: false,
      completedCommands: receipts.size,
      gates,
    },
  };
}
