import { z } from 'zod';
import { HashSchema } from '../shared/generated-map';
import { digest } from '../map-freeze/hash';
import { bounded, check, unique, id } from './model';
import { verifyCombatArtifact, type CombatArtifact } from './compiler';
import {
  SeedSchema,
  CommandSchema,
  SpawnCommandSchema,
  type CombatSeed,
  type Command,
  type KernelState,
  type Receipt,
  type Gate,
  type JournalEntry,
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
  const used = seed.availability.inPlay + seed.availability.pending + seed.availability.reserved;
  check(used <= a.compiled.enemy.capacity, 'Disponibilità oltre capacità.');
  return {
    revision: 0,
    budget: seed.budget,
    availability: { ...seed.availability, available: a.compiled.enemy.capacity - used },
    group: null,
  };
}

function transition(
  a: CombatArtifact,
  seed: CombatSeed,
  previous: KernelState,
  command: Command,
): { state: KernelState; receipt: Receipt } | Gate {
  const state = structuredClone(previous),
    recipe = a.compiled.spawns.find((s) => s.id === command.spawnId);
  check(recipe, 'Spawn estraneo.');
  check(!state.group, 'Logica già collegata a un gruppo.');
  const { available } = state.availability;
  if (available > 0 && available < recipe.size)
    return { status: 'gated', gates: ['spawn-availability-unproven'] };
  const localBudget = state.budget + recipe.points;
  // Native eligibility checks one figure; specified-size spawning does not recalculate size.
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
  state.revision++;
  return {
    state,
    receipt: {
      id: command.id,
      status: failed ? 'failed' : 'spawned',
      reason: failed ? (available === 0 ? 'no-availability' : 'budget-ineligible') : null,
      continuation: { kind: 'source-event', origin: recipe.origin, ...branch },
    },
  };
}

class CombatKernel {
  #artifact: CombatArtifact;
  #seed: CombatSeed;
  #state: KernelState;
  #journal: JournalEntry[] = [];
  constructor(artifact: CombatArtifact, seed: CombatSeed) {
    this.#artifact = artifact;
    this.#seed = seed;
    this.#state = initialState(artifact, seed);
  }
  #command(command: Command): Receipt | Gate {
    const prior = this.#journal.find((j) => j.command.id === command.id);
    if (prior) {
      check(digest(prior.command) === digest(command), 'Intento duplicato con payload diverso.');
      return structuredClone(prior.receipt);
    }
    check(this.#journal.length < 1000, 'Budget journal kernel raggiunto.');
    const result = transition(this.#artifact, this.#seed, this.#state, command);
    if ('status' in result) return result;
    this.#state = result.state;
    this.#journal.push({
      command: structuredClone(command),
      receipt: structuredClone(result.receipt),
    });
    return structuredClone(result.receipt);
  }
  spawn(raw: unknown) {
    bounded(raw);
    const input = z.strictObject({ id, spawnId: id }).parse(raw);
    return this.#command(SpawnCommandSchema.parse({ kind: 'spawn', ...input }));
  }
  view(): KernelState {
    return structuredClone(this.#state);
  }
  checkpoint() {
    const data = {
      format: 'combat-checkpoint-v1' as const,
      artifact: this.#artifact,
      artifactFingerprint: this.#artifact.fingerprint,
      projectionFingerprint: this.#artifact.projectionFingerprint,
      seed: this.#seed,
      seedFingerprint: digest(this.#seed),
      journal: this.#journal,
      state: this.#state,
    };
    return structuredClone({ ...data, fingerprint: digest(data) });
  }
}
export function createCombatKernel(artifact: unknown, rawSeed: unknown) {
  bounded(rawSeed);
  return new CombatKernel(verifyCombatArtifact(artifact), SeedSchema.parse(rawSeed));
}
const CheckpointSchema = z.strictObject({
  format: z.literal('combat-checkpoint-v1'),
  artifact: z.unknown(),
  artifactFingerprint: HashSchema,
  projectionFingerprint: HashSchema,
  seed: SeedSchema,
  seedFingerprint: HashSchema,
  journal: z.array(z.strictObject({ command: CommandSchema, receipt: z.unknown() })).max(1000),
  state: z.unknown(),
  fingerprint: HashSchema,
});
export function restoreCombatKernel(
  raw: unknown,
  expected?: { artifactFingerprint?: string; projectionFingerprint?: string },
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
  const kernel = new CombatKernel(a, c.seed);
  for (const entry of c.journal) {
    const { kind: _, ...input } = entry.command;
    const receipt = kernel.spawn(input);
    check(digest(receipt) === digest(entry.receipt), 'Receipt kernel incoerente.');
  }
  check(digest(kernel.checkpoint()) === digest(raw), 'Checkpoint diverso dal replay completo.');
  return kernel;
}
