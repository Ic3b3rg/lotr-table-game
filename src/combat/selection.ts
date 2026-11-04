import { createHash } from 'node:crypto';
import { digest } from '../map-freeze/hash';
import { check } from './model';
import type { CombatArtifact } from './compiler';
import type { CombatSeed, KernelState, EnemySelection } from './kernel-model';

/** Separate, versioned enemy stream. Saved population and result are checked by replay. */
export function selectInstruction(
  a: CombatArtifact,
  seed: CombatSeed,
  state: KernelState,
  id: string,
  heroId: string,
  cause: EnemySelection['cause'],
): EnemySelection {
  const group = state.group!;
  const size = group.figures.filter((f) => f.health > 0).length;
  const eligible = a.compiled.instructions.filter((i) => i.minimum <= size && size <= i.maximum);
  check(eligible.length > 0, 'Nessuna istruzione eleggibile.');
  const population = eligible.map((i) => ({ source: i.source, fingerprint: digest(i) }));
  const cursorBefore = state.randomCursor;
  const bound = 0x100000000 - (0x100000000 % eligible.length);
  let index = -1;
  for (let n = 0; n < 128; n++) {
    const word = createHash('sha256')
      .update(`combat-enemy-v1:${seed.entropy}:${state.randomCursor++}`)
      .digest()
      .readUInt32BE(0);
    if (word < bound) {
      index = word % eligible.length;
      break;
    }
  }
  check(index >= 0, 'Budget RNG nemico superato.');
  const i = eligible[index]!,
    row = i.damage.find((d) => d.size === size)!;
  const selected: EnemySelection = {
    id,
    algorithm: 'combat-enemy-sha256-rejection-v1',
    stream: 'enemy-instruction',
    groupId: group.id,
    heroId,
    cause,
    size,
    population,
    cursorBefore,
    cursorAfter: state.randomCursor,
    index,
    source: i.source,
    fingerprint: digest(i),
    damage: row.damage,
    fear: row.fear,
    negate: i.negate,
    addition: structuredClone(i.addition),
    dependencies: [...new Set(['physical-consequences-p2' as const, ...i.dependencies])],
  };
  state.selections.push(selected);
  return selected;
}

import type { CombatClosure } from './compiler';
import type { DeployedGroup } from '../shared/deployment';
import type { CombatStreams, InstructionSelection } from '../shared/combat';
import { effectiveGroup } from './group';

function groupIndex(
  entropy: string,
  streams: CombatStreams,
  stream: keyof CombatStreams,
  length: number,
) {
  check(length > 0 && length <= 1000, 'Popolazione RNG invalida.');
  const bound = 0x100000000 - (0x100000000 % length);
  for (let n = 0; n < 128; n++) {
    check(streams[stream] < 1000000, 'Budget casualità superato.');
    const word = createHash('sha256')
      .update(`combat-group-v1:${stream}:${entropy}:${streams[stream]++}`)
      .digest()
      .readUInt32BE(0);
    if (word < bound) return word % length;
  }
  throw new Error('Budget selezione combattimento superato.');
}
export function selectGroupInstruction(
  a: CombatClosure,
  group: DeployedGroup,
  entropy: string,
  streams: CombatStreams,
): InstructionSelection {
  const { model } = effectiveGroup(a, group);
  const size = group.figures.filter((f) => f.health > 0).length;
  check(size > 0, 'Gruppo sconfitto.');
  const pool = model.instructions.filter((i) => i.minimum <= size && size <= i.maximum);
  check(pool.length, 'Pool istruzioni vuoto.');
  const before = streams.instruction;
  const index = groupIndex(entropy, streams, 'instruction', pool.length);
  const instruction = pool[index]!;
  return {
    algorithm: 'combat-group-sha256-rejection-v1',
    groupId: group.id,
    model: model.source,
    size,
    population: pool.map((i) => ({ source: i.source, fingerprint: digest(i) })),
    source: instruction.source,
    fingerprint: digest(instruction),
    cursorBefore: before,
    cursorAfter: streams.instruction,
    index,
  };
}
export function groupAttackPacket(
  a: CombatClosure,
  group: DeployedGroup,
  selection: InstructionSelection,
  cause: 'counterattack' | 'provocation',
  entropy: string,
  streams: CombatStreams,
) {
  const { model, bonuses, elite, ranged } = effectiveGroup(a, group);
  const instruction = model.instructions.find((i) => i.source === selection.source);
  check(
    instruction &&
      selection.groupId === group.id &&
      selection.model === model.source &&
      digest(instruction) === selection.fingerprint,
    'Istruzione trattenuta estranea/alterata.',
  );
  const size = group.figures.filter((f) => f.health > 0).length;
  check(size > 0, 'Attacco senza figure vive.');
  // A retained selection is not filtered again when a child removed figures.
  const row = instruction.damage.find((d) => d.size === size);
  let damage = (row?.damage ?? 0) + bonuses.reduce((n, b) => n + b.damage, 0);
  let fear = (row?.fear ?? 0) + bonuses.reduce((n, b) => n + b.fear, 0);
  const offered = { damage, fear };
  const reductions: { family: 'damage' | 'fear'; cursorBefore: number; cursorAfter: number }[] = [];
  if (cause === 'counterattack' && elite)
    for (let n = 0; n < (group.attackReduction ?? 0) && damage + fear > 1; n++) {
      const cursorBefore = streams.reduction;
      const family =
        damage && fear
          ? groupIndex(entropy, streams, 'reduction', 2)
            ? 'fear'
            : 'damage'
          : damage
            ? 'damage'
            : 'fear';
      if (family === 'damage') damage--;
      else fear--;
      reductions.push({ family, cursorBefore, cursorAfter: streams.reduction });
    }
  return {
    source: instruction.source,
    instructionHash: selection.fingerprint,
    size,
    damage,
    fear,
    offered,
    reductions,
    negate: instruction.negate,
    addition: instruction.addition,
    text: instruction.text.value,
    elite,
    ranged,
  };
}
