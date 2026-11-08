import { z } from 'zod';
import { HashSchema } from './generated-map';

/** Explicit prospective rules; never inferred from a historical terrain label. */
export const BattleTestTerrainPolicySchema = z.strictObject({
  version: z.literal('source-battle-test-terrain-v1'),
  rulesReference: z.literal('a31697b0dcce6cdc003d3b178b00a4d7bbc7d12efee527b8843bec8e5f38a0c4'),
  errata: z.literal('6377e29b94c9714a446a43d0a840d142bd18374febb58536b048848897e453d3'),
  italian: z.literal('0ebc7fb510bec738d333d5fdb1c4ae52f4ed8c577fa1be1083fb31f66fb2e962'),
  fire: z.literal('revealed-fate-discard-all-icons-pierce-or-smite-once-per-attack'),
  boulder: z.literal('one-fate-per-placed-token-per-negate-test'),
});
const token = z.strictObject({
  anchor: z.string().min(1).max(100),
  kind: z.enum(['fire', 'rock']),
  spaceId: z.string().min(1).max(200),
});
export const BattleTestTerrainContextSchema = z.strictObject({
  policy: BattleTestTerrainPolicySchema,
  capabilityFingerprint: HashSchema,
  boardFingerprint: HashSchema,
  tokens: z.array(token).max(20),
});
export type BattleTestTerrainContext = z.infer<typeof BattleTestTerrainContextSchema>;
export const TerrainTestViewSchema = z.strictObject({
  kind: z.enum(['attack', 'negate']),
  tokens: z.array(token.pick({ anchor: true, kind: true })).max(20),
  bouldersUsed: z.array(z.string().min(1).max(100)).max(20),
  freeRemaining: z.int().min(0).max(20),
  fire: z
    .strictObject({
      copy: HashSchema,
      name: z.string().min(1).max(1000),
      modifier: z.enum(['pierce', 'smite']),
      excludedSuccess: z.int().nonnegative(),
      excludedFate: z.int().nonnegative(),
    })
    .nullable(),
});
export type TerrainTestView = z.infer<typeof TerrainTestViewSchema>;
