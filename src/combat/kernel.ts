import { z } from 'zod';
import { HashSchema } from '../shared/generated-map';
import { digest } from '../map-freeze/hash';
import { bounded, check, unique } from './model';
import { verifyCombatArtifact, type CombatArtifact } from './compiler';
import { planAttack, applyPlan, applyExternal, provoke } from './attack';
import {
  SeedSchema,
  CommandSchema,
  SpawnCommandSchema,
  PlanCommandSchema,
  ApplyCommandSchema,
  ExternalCommandSchema,
  ProvokeCommandSchema,
  ProofSchema,
  type CombatSeed,
  type Command,
  type KernelState,
  type Receipt,
  type Gate,
  type JournalEntry,
  type TrustedCombatPort,
  type Proof,
} from './kernel-model';

function initialState(a: CombatArtifact, seed: CombatSeed): KernelState {
  const expected = a.source.projection.context.heroes;
  unique(
    seed.heroes.map((h) => h.heroId),
    'Eroe kernel',
  );
  check(
    seed.heroes.length === expected.length &&
      expected.every((h) => seed.heroes.some((s) => s.heroId === h.catalogId)),
    'Compagnia kernel cross-source.',
  );
  for (const h of seed.heroes) {
    check(
      a.source.projection.spaces.some((s) => s.id === h.spaceId),
      'Posizione eroe non congelata.',
    );
    unique(h.requiredHooks, 'Hook eroe');
  }
  if (seed.activation)
    check(
      a.compiled.instructions.some((i) => i.source === seed.activation!.instructionSource) &&
        seed.heroes.some((h) => h.heroId === seed.activation!.heroId),
      'Attivazione interrotta cross-source.',
    );
  const used = seed.availability.inPlay + seed.availability.pending + seed.availability.reserved;
  check(used <= a.compiled.enemy.capacity, 'Disponibilità oltre capacità.');
  return {
    revision: 0,
    budget: seed.budget,
    availability: { ...seed.availability, available: a.compiled.enemy.capacity - used },
    group: null,
    heroes: structuredClone(seed.heroes),
    pendingPlan: null,
    usedResultIds: [],
    selections: [],
    randomCursor: 0,
    callbacks: [],
    suspended: null,
  };
}
function spawn(
  a: CombatArtifact,
  seed: CombatSeed,
  state: KernelState,
  command: Extract<Command, { kind: 'spawn' }>,
): Receipt | Gate {
  const recipe = a.compiled.spawns.find((s) => s.id === command.spawnId);
  check(recipe, 'Spawn estraneo.');
  check(!state.group, 'Logica già collegata a un gruppo.');
  const { available } = state.availability;
  if (available > 0 && available < recipe.size)
    return { status: 'gated', gates: ['spawn-availability-unproven'] };
  const localBudget = state.budget + recipe.points;
  // Native eligibility checks one figure; specified-size spawning never recalculates size.
  const failed =
    available === 0 || localBudget < a.compiled.enemy.costs.find((c) => c.size === 1)!.points;
  const branch = failed ? recipe.failure : recipe.success;
  if (!failed) {
    state.budget = Math.max(0, Math.min(localBudget - recipe.cost, seed.heroes.length * 5));
    state.availability.inPlay += recipe.size;
    state.availability.available -= recipe.size;
    const { health, armor, sorcery } = a.compiled.enemy.stats;
    state.group = {
      id: `${seed.id}/group`,
      source: a.compiled.enemy.source,
      spawnId: recipe.id,
      position: structuredClone(recipe.position),
      logic: structuredClone(recipe.logic),
      exhausted: false,
      status: 'in-play',
      figures: Array.from({ length: recipe.size }, (_, n) => ({
        id: `${seed.id}/figure/${n}`,
        health,
        armor,
        sorcery,
      })),
    };
  }
  return {
    id: command.id,
    status: failed ? 'failed' : 'spawned',
    reason: failed ? (available === 0 ? 'no-availability' : 'budget-ineligible') : null,
    continuation: { kind: 'source-event', origin: recipe.origin, ...branch },
  };
}
function transition(
  a: CombatArtifact,
  seed: CombatSeed,
  previous: KernelState,
  command: Command,
  port: TrustedCombatPort,
  replayProof: Proof | null,
): { state: KernelState; receipt: Receipt; proof: Proof | null } | Gate {
  const state = structuredClone(previous);
  if (state.suspended) {
    const s = state.suspended;
    return {
      status: 'gated',
      gates:
        s.kind === 'physical' || s.kind === 'scenario-callback' || s.kind === 'resume-activation'
          ? s.dependencies
          : ['scenario-continuation'],
    };
  }
  let receipt: Receipt;
  let proof: Proof | null = null;
  if (command.kind === 'spawn') {
    const r = spawn(a, seed, state, command);
    if (r.status === 'gated') return r;
    receipt = r;
  } else {
    check(state.group?.status === 'in-play', 'Gruppo assente/sconfitto.');
    if (command.kind === 'plan' || command.kind === 'external') {
      const r =
        command.kind === 'plan'
          ? planAttack(a, seed, state, command, port, replayProof)
          : applyExternal(a, seed, state, command, port, replayProof);
      if ('status' in r) return r;
      receipt = r.receipt;
      proof = r.proof;
    } else if (command.kind === 'apply') receipt = applyPlan(a, seed, state, command);
    else receipt = provoke(a, seed, state, command);
  }
  state.revision++;
  return { state, receipt, proof };
}
class CombatKernel {
  #artifact: CombatArtifact;
  #seed: CombatSeed;
  #state: KernelState;
  #journal: JournalEntry[] = [];
  #port: TrustedCombatPort;
  constructor(
    artifact: CombatArtifact,
    seed: CombatSeed,
    port: TrustedCombatPort = {},
    replay: { command: Command; proof: Proof | null; receipt: unknown }[] = [],
  ) {
    this.#artifact = artifact;
    this.#seed = seed;
    this.#state = initialState(artifact, seed);
    this.#port = port;
    for (const entry of replay)
      check(
        digest(this.#command(entry.command, entry.proof)) === digest(entry.receipt),
        'Receipt kernel incoerente.',
      );
  }
  #command(command: Command, replayProof: Proof | null = null): Receipt | Gate {
    const prior = this.#journal.find((j) => j.command.id === command.id);
    if (prior) {
      check(digest(prior.command) === digest(command), 'Intento duplicato con payload diverso.');
      return structuredClone(prior.receipt);
    }
    check(this.#journal.length < 1000, 'Budget journal kernel raggiunto.');
    const result = transition(
      this.#artifact,
      this.#seed,
      this.#state,
      command,
      this.#port,
      replayProof,
    );
    if ('status' in result) return structuredClone(result);
    const entry = {
      command: structuredClone(command),
      proof: structuredClone(result.proof),
      receipt: structuredClone(result.receipt),
    };
    bounded({
      ...this.#checkpointData(result.state, [...this.#journal, entry]),
      fingerprint: '0'.repeat(64),
    });
    this.#state = result.state;
    this.#journal.push(entry);
    return structuredClone(result.receipt);
  }
  spawn(raw: unknown) {
    bounded(raw);
    return this.#command({ kind: 'spawn', ...SpawnCommandSchema.omit({ kind: true }).parse(raw) });
  }
  planAttack(raw: unknown) {
    bounded(raw);
    return this.#command({ kind: 'plan', ...PlanCommandSchema.omit({ kind: true }).parse(raw) });
  }
  applyPlan(raw: unknown) {
    bounded(raw);
    return this.#command({ kind: 'apply', ...ApplyCommandSchema.omit({ kind: true }).parse(raw) });
  }
  applyExternal(raw: unknown) {
    bounded(raw);
    return this.#command({
      kind: 'external',
      ...ExternalCommandSchema.omit({ kind: true }).parse(raw),
    });
  }
  provoke(raw: unknown) {
    bounded(raw);
    return this.#command({
      kind: 'provoke',
      ...ProvokeCommandSchema.omit({ kind: true }).parse(raw),
    });
  }
  view(): KernelState {
    return structuredClone(this.#state);
  }
  #checkpointData(state = this.#state, journal = this.#journal) {
    return {
      format: 'combat-checkpoint-v1' as const,
      artifact: this.#artifact,
      artifactFingerprint: this.#artifact.fingerprint,
      projectionFingerprint: this.#artifact.projectionFingerprint,
      seed: this.#seed,
      seedFingerprint: digest(this.#seed),
      journal,
      state,
    };
  }
  checkpoint() {
    const data = this.#checkpointData();
    return structuredClone({ ...data, fingerprint: digest(data) });
  }
}
export function createCombatKernel(
  artifact: unknown,
  rawSeed: unknown,
  port: TrustedCombatPort = {},
) {
  bounded(rawSeed);
  return new CombatKernel(verifyCombatArtifact(artifact), SeedSchema.parse(rawSeed), port);
}
const CheckpointSchema = z.strictObject({
  format: z.literal('combat-checkpoint-v1'),
  artifact: z.unknown(),
  artifactFingerprint: HashSchema,
  projectionFingerprint: HashSchema,
  seed: SeedSchema,
  seedFingerprint: HashSchema,
  journal: z
    .array(
      z.strictObject({
        command: CommandSchema,
        proof: ProofSchema.nullable(),
        receipt: z.unknown(),
      }),
    )
    .max(1000),
  state: z.unknown(),
  fingerprint: HashSchema,
});
export function restoreCombatKernel(
  raw: unknown,
  expected?: { artifactFingerprint?: string; projectionFingerprint?: string },
  port: TrustedCombatPort = {},
) {
  bounded(raw);
  const c = CheckpointSchema.parse(raw);
  const a = verifyCombatArtifact(c.artifact, {
    fingerprint: c.artifactFingerprint,
    projectionFingerprint: c.projectionFingerprint,
  });
  if (expected?.artifactFingerprint)
    check(expected.artifactFingerprint === a.fingerprint, 'Checkpoint cross-source artifact.');
  if (expected?.projectionFingerprint)
    check(
      expected.projectionFingerprint === a.projectionFingerprint,
      'Checkpoint cross-source proiezione.',
    );
  const kernel = new CombatKernel(a, c.seed, port, c.journal);
  check(digest(kernel.checkpoint()) === digest(raw), 'Checkpoint diverso dal replay completo.');
  return kernel;
}
