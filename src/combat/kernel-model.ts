import { z } from 'zod';
import { HashSchema } from '../shared/generated-map';
import { id, count, dependency } from './model';
import type { CombatArtifact } from './compiler';

export const SeedSchema = z.strictObject({
  id,
  entropy: HashSchema,
  budget: count,
  availability: z.strictObject({ inPlay: count, pending: count, reserved: count }),
  heroes: z
    .array(
      z.strictObject({
        heroId: id,
        spaceId: id,
        defeated: z.boolean(),
        requiredHooks: z.array(dependency).max(16),
      }),
    )
    .min(1)
    .max(5),
});
export type CombatSeed = z.infer<typeof SeedSchema>;
export const SpawnCommandSchema = z.strictObject({ kind: z.literal('spawn'), id, spawnId: id });
export const CommandSchema = SpawnCommandSchema;
export type Command = z.infer<typeof CommandSchema>;
export type SpawnRecipe = CombatArtifact['compiled']['spawns'][number];
export type Group = {
  id: string;
  source: string;
  spawnId: string;
  position: SpawnRecipe['position'];
  logic: SpawnRecipe['logic'];
  exhausted: boolean;
  status: 'in-play' | 'defeated';
  figures: { id: string; health: number; armor: number; sorcery: number }[];
};
export type KernelState = {
  revision: number;
  budget: number;
  availability: CombatSeed['availability'] & { available: number };
  group: Group | null;
};
export type Continuation = {
  kind: 'source-event';
  origin: SpawnRecipe['origin'];
  event: string;
  state: number;
};
export type Receipt = {
  id: string;
  status: 'spawned' | 'failed';
  continuation: Continuation;
  reason: string | null;
};
export type Gate = { status: 'gated'; gates: string[] };
export type JournalEntry = { command: Command; receipt: Receipt };
