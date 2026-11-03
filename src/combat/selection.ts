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
