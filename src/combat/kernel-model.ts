import { z } from 'zod';
import { HashSchema } from '../shared/generated-map';
import {
  id,
  count,
  dependency,
  stat,
  modifier,
  type Addition,
  type Dependency,
  type Modifier,
  type Stat,
} from './model';
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
  activation: z.strictObject({ instructionSource: id, heroId: id }).nullable().default(null),
});
export type CombatSeed = z.infer<typeof SeedSchema>;
export const SpawnCommandSchema = z.strictObject({ kind: z.literal('spawn'), id, spawnId: id });
export const PlanCommandSchema = z.strictObject({
  kind: z.literal('plan'),
  id,
  heroId: id,
  itemCopies: z.array(id).min(1).max(3),
  stat,
  slots: z.array(z.strictObject({ copyId: id, slotId: id })).max(32),
});
export const ApplyCommandSchema = z.strictObject({
  kind: z.literal('apply'),
  id,
  planFingerprint: HashSchema,
});
export const ExternalCommandSchema = z.strictObject({
  kind: z.literal('external'),
  id,
  effectId: id,
});
export const ProvokeCommandSchema = z.strictObject({
  kind: z.literal('provoke'),
  id,
  heroId: id,
  returnTo: z.strictObject({ kind: z.enum(['movement', 'interaction']), id }),
});
export const CommandSchema = z.discriminatedUnion('kind', [
  SpawnCommandSchema,
  PlanCommandSchema,
  ApplyCommandSchema,
  ExternalCommandSchema,
  ProvokeCommandSchema,
]);
export type Command = z.infer<typeof CommandSchema>;
const proofContext = {
  id,
  contextFingerprint: HashSchema,
  artifactFingerprint: HashSchema,
  projectionFingerprint: HashSchema,
};
export const AttackResultSchema = z.strictObject({
  ...proofContext,
  heroId: id,
  stat,
  successes: z.array(id).max(100),
  afterTest: z.strictObject({ spaceId: id, defeated: z.boolean() }),
  requiredHooks: z.array(dependency).max(16),
});
export const ExternalResultSchema = z.strictObject({
  ...proofContext,
  hits: count,
  modifiers: z.array(modifier).max(2),
  evidence: z.strictObject({ file: id, locator: id, sha256: HashSchema }),
});
export const ProofSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('attack'), result: AttackResultSchema }),
  z.strictObject({ kind: z.literal('external'), result: ExternalResultSchema }),
]);
export type Proof = z.infer<typeof ProofSchema>;
export type AttackQuery = {
  kind: 'completed-attack-test-v1';
  id: string;
  runId: string;
  artifactFingerprint: string;
  projectionFingerprint: string;
  stateFingerprint: string;
  groupId: string;
  heroId: string;
  spaceId: string;
  itemCopies: string[];
  stat: Stat;
};
export type ExternalQuery = {
  kind: 'external-effect-v1';
  id: string;
  effectId: string;
  runId: string;
  artifactFingerprint: string;
  projectionFingerprint: string;
  stateFingerprint: string;
  groupId: string;
};
/** Host-only port reads already completed results. Never expose this port through a game command. */
export type TrustedCombatPort = {
  attackResult?: (query: Readonly<AttackQuery>) => unknown;
  externalEffect?: (query: Readonly<ExternalQuery>) => unknown;
};
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
export type AttackPlan = {
  id: string;
  resultId: string;
  heroId: string;
  groupId: string;
  revision: number;
  stateFingerprint: string;
  artifactFingerprint: string;
  projectionFingerprint: string;
  allocations: { copyId: string; slotId: string; successes: string[] }[];
  hits: number;
  modifiers: Modifier[];
  unspent: string[];
  afterTest: z.infer<typeof AttackResultSchema>['afterTest'];
  fingerprint: string;
};
export type EnemySelection = {
  id: string;
  algorithm: 'combat-enemy-sha256-rejection-v1';
  stream: 'enemy-instruction';
  groupId: string;
  heroId: string;
  cause: 'counterattack' | 'provocation';
  size: number;
  population: { source: string; fingerprint: string }[];
  cursorBefore: number;
  cursorAfter: number;
  index: number;
  source: string;
  fingerprint: string;
  damage: number;
  fear: number;
  negate: Stat;
  addition: Addition | null;
  dependencies: Dependency[];
};
export type ScenarioCallback = {
  kind: 'scenario-callback';
  id: string;
  groupId: string;
  heroId: string | null;
  cause: 'attack' | 'external-effect';
  target: string;
  event: 'DEFEATED';
  state: number;
  dependencies: Dependency[];
};
export type Continuation =
  | { kind: 'source-event'; origin: SpawnRecipe['origin']; event: string; state: number }
  | {
      kind: 'physical';
      status: 'pending-consumer';
      cause: 'counterattack' | 'provocation';
      heroId: string;
      groupId: string;
      selection: EnemySelection;
      dependencies: Dependency[];
      returnTo: { kind: 'after-attack' | 'movement' | 'interaction'; id: string };
    }
  | {
      kind: 'after-attack';
      heroId: string;
      reason: 'stun' | 'exhausted' | 'out-of-range' | 'attacker-defeated';
      selection: EnemySelection | null;
    }
  | { kind: 'external-complete' }
  | {
      kind: 'provocation-skipped';
      reason: 'exhausted' | 'out-of-range';
      returnTo: { kind: 'movement' | 'interaction'; id: string };
    }
  | {
      kind: 'resume-activation';
      activation: NonNullable<CombatSeed['activation']>;
      status: 'pending-consumer';
      exhausted: boolean;
      dependencies: Dependency[];
    }
  | ScenarioCallback;
export type KernelState = {
  revision: number;
  budget: number;
  availability: CombatSeed['availability'] & { available: number };
  group: Group | null;
  heroes: CombatSeed['heroes'];
  pendingPlan: AttackPlan | null;
  usedResultIds: string[];
  selections: EnemySelection[];
  randomCursor: number;
  callbacks: ScenarioCallback[];
  suspended: Continuation | null;
};
export type Receipt =
  | { id: string; status: 'spawned' | 'failed'; continuation: Continuation; reason: string | null }
  | { id: string; status: 'planned'; plan: AttackPlan }
  | {
      id: string;
      status: 'applied';
      hits: number;
      unusedHits: number;
      removed: string[];
      continuation: Continuation;
    }
  | { id: string; status: 'provoked'; continuation: Continuation };
export type Gate = { status: 'gated'; gates: string[] };
export type JournalEntry = { command: Command; proof: Proof | null; receipt: Receipt };
