import { z } from 'zod';
import { HashSchema, SourceSchema } from './generated-map';
import { CombatClosureArtifactSchema } from './combat';

const source = z.strictObject({ source: SourceSchema, objectHash: HashSchema });
const anchor = z.string().min(1).max(100);
/** Prospective source artifacts, recompiled against the live departure before activation. */
export const BattleCombatCapabilitySchema = z.strictObject({
  version: z.literal('source-battle-combat-v1'),
  evidenceHash: HashSchema,
  boardFingerprint: HashSchema,
  deploymentFingerprint: HashSchema,
  model: source,
  adventure: z.strictObject({
    ...source.shape,
    gameObject: SourceSchema,
    model: SourceSchema,
    initialDarkness: z.array(z.never()).length(0),
    initialDifficult: z.array(z.never()).length(0),
    initialFortified: z.array(z.never()).length(0),
  }),
  principal: z.strictObject({ ...source.shape, gameObject: SourceSchema }),
  combat: CombatClosureArtifactSchema,
  darkness: z.strictObject({
    disabled: z.boolean(),
    global: z.string().min(1).max(150),
    override: z.string().min(1).max(150),
    intrinsic: z.literal(false),
    initialTokens: z.array(z.never()).length(0),
  }),
  threats: z
    .array(z.strictObject({ ...source.shape, anchor }))
    .min(1)
    .max(20),
  terrain: z
    .array(
      z.strictObject({
        anchor,
        kind: z.enum(['bush', 'wall', 'fire', 'rock']),
        sourceHash: HashSchema,
        locator: z.string().min(1).max(1000),
        window: z.enum(['end-turn-optional', 'adjacency', 'attack-gated', 'negate-gated']),
      }),
    )
    .max(20),
  // The ordinary scenario compiler parses these with its existing strict schemas
  // and action certificates. There is no client-selected program or second FSM engine.
  terminal: z.strictObject({
    definition: z.unknown(),
    certificate: z.unknown(),
    failure: z.unknown(),
    globals: z.array(z.unknown()).max(500),
  }),
});
export type BattleCombatCapability = z.infer<typeof BattleCombatCapabilitySchema>;
