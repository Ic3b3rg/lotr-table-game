import { createHash } from 'node:crypto';
import {
  SourceRandom,
  sourceShuffle,
  FLOAT32_POLICY,
  type SourceRandomState,
} from '../map-generation/primitives';
import { parseSelectionInput, type SelectionInput, type Tile } from './model';
import { createPools, collectPools, shuffleAndMerge } from './pools';

type TraceEvent = { stage: string; operation: string; samples: number; [key: string]: unknown };
type Match = { trait: number; tileSource: string; spaceIndex: number };
type SectionState = {
  id: number;
  source: string;
  extraSpaces: number;
  available: Tile[];
  spacesFromAvailableTiles: number;
  isSeeded: boolean;
  requiredConnectedSectionIds: number[];
  traitMatching: Match[] | null;
  traitsEvaluated: boolean;
};
type TrieNode = { value: number; children: TrieNode[] };

/** Source SequenceTree: no terminal marker; the final node loses its children. */
class PrefixTree {
  children: TrieNode[] = [];
  add(sequence: number[]): void {
    let children = this.children;
    for (const value of sequence) {
      let node = children.find((n) => n.value === value);
      if (!node) {
        node = { value, children: [] };
        children.push(node);
      }
      children = node.children;
    }
    children.length = 0;
  }
  wouldExist(sequence: number[], value: number): boolean {
    let children = this.children;
    for (const item of sequence) {
      const next = children.find((n) => n.value === item);
      if (!next) return false;
      children = next.children;
    }
    return children.some((n) => n.value === value);
  }
  get count(): number {
    let count = 0;
    const stack = [...this.children];
    while (stack.length) {
      const node = stack.pop()!;
      count++;
      stack.push(...node.children);
    }
    return count;
  }
  clear(): void {
    this.children = [];
  }
}

class SelectionStop extends Error {
  constructor(
    readonly kind: 'source-failure' | 'administrative-stop',
    message: string,
  ) {
    super(message);
  }
}

/** All mutable attempt state belongs here, separate from host/session/gameplay RNG. */
class Selection {
  private random: SourceRandom | null = null;
  private stage = 'pools';
  private operations = 0;
  private trace: TraceEvent[] = [];
  private checkpoints: { stage: string; rng: SourceRandomState }[] = [];
  private standard: Tile[];
  private standardFlags: Map<number, { tile: Tile; used: boolean }>;
  private customFlags: Map<number, { tile: Tile; used: boolean }>;
  private sections: SectionState[];
  private models: Map<string, Tile>;
  private sequence: number[] = [];
  private history: { sectionId: number; tileId: number }[] = [];
  private invalid = new PrefixTree();
  private scalingOrder: number[];
  private pools: ReturnType<typeof createPools>;

  constructor(private input: SelectionInput) {
    this.scalingOrder = input.sections.map((s) => s.index);
    this.pools = createPools(input);
    this.standard = [...input.standard];
    this.standardFlags = new Map(
      input.standard.map((tile) => [tile.hashId, { tile, used: false }]),
    );
    this.customFlags = new Map(input.custom.map((tile) => [tile.hashId, { tile, used: false }]));
    this.models = new Map(
      [...input.standard, ...input.custom].map((tile) => [tile.modelSource, tile]),
    );
    this.sections = input.sections.map((s) => ({
      id: s.index,
      source: s.source,
      extraSpaces: 0,
      available: [],
      spacesFromAvailableTiles: 0,
      isSeeded: false,
      requiredConnectedSectionIds: [],
      traitMatching: s.traitRequirements.length ? null : [],
      traitsEvaluated: s.traitRequirements.length === 0,
    }));
  }
  private begin = (stage: string): void => {
    this.stage = stage;
  };
  private tick = (): void => {
    if (this.operations >= this.input.budget.maxOperations)
      throw new SelectionStop('administrative-stop', 'Budget amministrativo esaurito.');
    this.operations++;
  };
  private emit = (operation: string, details: Record<string, unknown>): void => {
    this.trace.push({
      stage: this.stage,
      operation,
      samples: this.random?.snapshot().samples ?? 0,
      ...details,
    });
  };
  private checkpoint = (stage: string): void => {
    this.stage = stage;
    this.checkpoints.push({ stage, rng: this.random!.snapshot() });
  };
  private fail(message: string): never {
    throw new SelectionStop('source-failure', message);
  }
  private hash(reserved: NonNullable<SelectionInput['sections'][number]['start']>): number {
    return this.models.get(reserved.modelSource)!.hashId;
  }
  private bucket(hash: number) {
    return this.customFlags.has(hash) ? this.customFlags : this.standardFlags;
  }
  private remove(hash: number): Tile | null {
    const flag = this.bucket(hash).get(hash);
    if (!flag) throw new Error(`TileBucket.RemoveTile: HashId assente ${hash}.`);
    if (flag.used) return null;
    flag.used = true;
    return flag.tile;
  }
  private returnTile(tile: Tile): void {
    this.bucket(tile.hashId).get(tile.hashId)!.used = false;
  }
  private add(section: SectionState, tile: Tile): void {
    const owned = this.pools!.ownedCodes.has(tile.code);
    if (owned) {
      if (this.input.sections[section.id]!.traitRequirements.length) {
        section.traitsEvaluated = false;
        section.traitMatching = null;
      }
      section.available.push(tile);
      section.spacesFromAvailableTiles += tile.spaces.length;
    }
    this.emit('seed', {
      sectionId: section.id,
      tileSource: tile.source,
      hashId: tile.hashId,
      added: owned,
      reason: owned ? 'owned' : 'unowned-phantom',
      spacesFromAvailableTiles: section.spacesFromAvailableTiles,
    });
  }
  private alreadySeeded(hash: number): boolean {
    return this.sections.some((s) => s.available.some((t) => t.hashId === hash));
  }
  private canSectionUse(section: SectionState, hash: number): boolean {
    return this.sections.every((s) => {
      if (s.id === section.id) return true;
      const definition = this.input.sections[s.id]!;
      return (
        !(definition.start && this.hash(definition.start) === hash) &&
        !definition.required.some((r) => this.hash(r) === hash) &&
        !s.available.some((t) => t.hashId === hash)
      );
    });
  }
  private traitCount(tiles: Tile[], trait: number): number {
    // Tile.GetSpaceCount(SpaceTraits) calls HasAny, unlike matching's full mask.
    return tiles.reduce((n, t) => n + t.spaces.filter((s) => (s.traits & trait) !== 0).length, 0);
  }
  private trySeed(section: SectionState, traitOnly: boolean): number | null {
    const definition = this.input.sections[section.id]!;
    for (const original of this.standard) {
      this.tick();
      const hash = original.hashId;
      let reason: string | null = null;
      if (!this.canSectionUse(section, hash)) reason = 'reservation-or-other-section';
      else if (this.alreadySeeded(hash)) reason = 'already-seeded';
      if (reason) {
        this.emit('reject', { sectionId: section.id, hashId: hash, reason });
        continue;
      }
      const tile = this.remove(hash);
      if (!tile) {
        this.emit('reject', { sectionId: section.id, hashId: hash, reason: 'bucket-used' });
        continue;
      }
      if (!this.canSectionUse(section, hash)) reason = 'reservation-or-other-section';
      else if ((tile.set & ~definition.allowedTileSets) !== 0) reason = 'tile-set';
      else if (this.alreadySeeded(tile.oppositeHashId)) reason = 'opposite-seeded';
      else if (
        tile.spaces.length + section.spacesFromAvailableTiles >
        definition.maximumSpaces + section.extraSpaces
      )
        reason = 'maximum';
      else if (this.invalid.wouldExist(this.sequence, hash)) reason = 'invalid-prefix';
      else if (
        traitOnly &&
        !definition.traitRequirements.some(
          (r) =>
            this.traitCount([tile], r.trait) > 0 &&
            this.traitCount(section.available, r.trait) < r.count,
        )
      )
        reason = 'no-trait-improvement';
      if (reason) {
        this.returnTile(tile);
        this.emit('reject', {
          sectionId: section.id,
          tileSource: tile.source,
          hashId: hash,
          reason,
        });
        continue;
      }
      this.add(section, tile);
      return tile.hashId;
    }
    this.emit('seed-failed', { sectionId: section.id });
    return null;
  }
  private matching(section: SectionState): boolean {
    section.traitsEvaluated = false;
    section.traitMatching = null;
    const finish = (matches: Match[] | null): boolean => {
      section.traitMatching = matches;
      section.traitsEvaluated = true;
      return matches !== null;
    };
    const requirements = this.input.sections[section.id]!.traitRequirements;
    if (!requirements.length) {
      return finish([]);
    }
    if (!section.available.length) {
      return finish(null);
    }
    const slots = requirements.flatMap((r) => Array<number>(r.count).fill(r.trait));
    const spaces = section.available.flatMap((t) =>
      t.spaces
        .filter((s) => s.traits !== 0)
        .map((s) => ({ tileSource: t.source, spaceIndex: s.index, traits: s.traits })),
    );
    const reserved: number[] = [];
    let requirement = 0,
      start = 0;
    while (requirement < slots.length) {
      this.tick();
      let found = -1;
      for (let i = start; i < spaces.length; i++) {
        this.tick();
        if (
          !reserved.includes(i) &&
          (slots[requirement]! & spaces[i]!.traits) === slots[requirement]
        ) {
          found = i;
          break;
        }
      }
      if (found >= 0) {
        reserved.push(found);
        requirement++;
        start = 0;
      } else {
        if (!reserved.length) {
          return finish(null);
        }
        start = reserved.pop()! + 1;
        requirement--;
      }
    }
    return finish(
      reserved.map((index, i) => ({
        trait: slots[i]!,
        tileSource: spaces[index]!.tileSource,
        spaceIndex: spaces[index]!.spaceIndex,
      })),
    );
  }
  private sizeMet(section: SectionState): boolean {
    return (
      section.available.reduce((n, t) => n + t.spaces.length, 0) >=
      this.input.sections[section.id]!.minimumSpaces + section.extraSpaces
    );
  }
  private clearSearch(): void {
    this.emit('clear-search', {
      sequence: [...this.sequence],
      invalidCount: this.invalid.count,
      historyLength: this.history.length,
    });
    this.sequence = [];
    this.history = [];
    this.invalid.clear();
  }
  private cycle(phase: 'traits' | 'minimum'): void {
    this.stage = phase;
    let id = 0;
    const met = (section: SectionState) =>
      phase === 'traits' ? this.matching(section) : this.sizeMet(section);
    while (!this.sections.every(met)) {
      this.tick();
      const section = this.sections[id]!;
      if (met(section)) {
        id = (id + 1) % this.sections.length;
        continue;
      }
      const tileId = this.trySeed(section, phase === 'traits');
      if (tileId !== null) {
        this.sequence.push(tileId);
        this.history.push({ sectionId: id, tileId });
        id = (id + 1) % this.sections.length;
      } else {
        if (this.sequence.length === 0)
          this.fail(`Requisito ${phase} esaurito nella sezione ${id}.`);
        const failedSequence = [...this.sequence];
        this.invalid.add(this.sequence);
        const popped = this.history.pop()!;
        const target = this.sections[popped.sectionId]!;
        // RemoveFromAvailableTiles removes the LAST matching HashId, if present.
        let at = -1;
        for (let i = 0; i < target.available.length; i++)
          if (target.available[i]!.hashId === popped.tileId) at = i;
        let returned: string | null = null;
        if (at >= 0) {
          const tile = target.available[at]!;
          if (this.input.sections[target.id]!.traitRequirements.length) {
            target.traitsEvaluated = false;
            target.traitMatching = null;
          }
          target.spacesFromAvailableTiles -= tile.spaces.length;
          this.returnTile(tile);
          target.available.splice(at, 1);
          returned = tile.source;
        }
        this.sequence.pop();
        id = popped.sectionId;
        this.emit('rollback', {
          sectionId: id,
          hashId: popped.tileId,
          returned,
          failedSequence,
          invalidCount: this.invalid.count,
          sequence: [...this.sequence],
        });
      }
    }
    this.clearSearch();
    this.checkpoint(`${phase}-complete`);
  }
  run() {
    let status: 'selected' | 'source-failure' | 'administrative-stop' = 'selected';
    let failure: {
      stage: string;
      message: string;
      sourceErrorCode?: number;
      policy?: string;
      operationFailure?: boolean;
    } | null = null;
    try {
      const observe = {
        tick: this.tick,
        begin: this.begin,
        emit: this.emit,
        checkpoint: this.checkpoint,
      };
      collectPools(this.input, this.pools, observe);
      this.random = new SourceRandom(this.input.context.seed);
      this.stage = 'standard-shuffle';
      sourceShuffle(this.standard, this.random);
      this.checkpoint(this.stage);
      this.stage = 'scaling';
      if (
        this.input.context.heroCount > 1 &&
        this.input.sections.some((section) => !section.ignorePlayerScaling)
      ) {
        sourceShuffle(this.scalingOrder, this.random);
        let remaining = (this.input.context.heroCount - 1) * 2;
        while (remaining > 0)
          for (const id of this.scalingOrder) {
            this.tick();
            if (!this.input.sections[id]!.ignorePlayerScaling) {
              this.sections[id]!.extraSpaces++;
              remaining--;
              if (remaining === 0) break;
            }
          }
      }
      this.checkpoint('scaling');
      shuffleAndMerge(this.pools, this.random, observe);
      this.checkpoint('coroutine-entry');
      this.stage = 'initialize';
      for (const section of this.sections) this.emit('section-id', { sectionId: section.id });
      for (const section of this.sections) {
        for (const [a, b] of this.input.requiredConnections) {
          const neighbor = section.id === a ? b : section.id === b ? a : null;
          if (neighbor !== null && !section.requiredConnectedSectionIds.includes(neighbor))
            section.requiredConnectedSectionIds.push(neighbor);
        }
        this.emit('section-initialized', {
          sectionId: section.id,
          requiredConnectedSectionIds: [...section.requiredConnectedSectionIds],
        });
      }
      for (const phase of ['starts', 'required'] as const) {
        this.stage = phase;
        for (const section of this.sections) {
          this.tick();
          const s = this.input.sections[section.id]!;
          const reservations = phase === 'starts' ? (s.start ? [s.start] : []) : s.required;
          for (const r of reservations) {
            const tile = this.remove(this.hash(r));
            if (!tile) this.fail(`Tessera ${phase} non disponibile nella sezione ${section.id}.`);
            this.add(section, tile);
          }
        }
        this.checkpoint(`${phase}-complete`);
      }
      this.cycle('traits');
      this.cycle('minimum');
      this.stage = 'optional';
      let id = 0;
      while (!this.sections.every((s) => s.isSeeded)) {
        this.tick();
        const section = this.sections[id]!;
        if (!section.isSeeded) {
          const draw = this.random.nextFloat32(0, 1);
          section.isSeeded = draw > this.input.sections[id]!.relativeSizeFactor;
          this.emit('size-draw', { sectionId: id, draw, isSeeded: section.isSeeded });
          if (!section.isSeeded && this.trySeed(section, false) === null) section.isSeeded = true;
        }
        id = (id + 1) % this.sections.length;
      }
      for (const section of this.sections) this.matching(section);
      this.checkpoint('selection-boundary');
    } catch (error) {
      status = error instanceof SelectionStop ? error.kind : 'source-failure';
      failure = {
        stage: this.stage,
        message: error instanceof Error ? error.message : 'Operazione fonte non riuscita.',
        ...(error instanceof SelectionStop
          ? status === 'source-failure'
            ? { sourceErrorCode: 2 }
            : { policy: this.input.budget.policy }
          : { operationFailure: true }),
      };
      this.emit('failure', failure);
    }
    const bucketResult = (flags: typeof this.standardFlags) =>
      [...flags.values()].map(({ tile, used }) => ({
        source: tile.source,
        hashId: tile.hashId,
        used,
        owned: this.pools.ownedCodes.has(tile.code),
      }));
    const { ownedCodes, ...pools } = this.pools;
    const common = {
      formatVersion: 1 as const,
      algorithm: this.input.algorithm,
      scope: 'selection-only' as const,
      floatPolicy: FLOAT32_POLICY,
      executionPolicy: this.input.budget.policy,
      inputFingerprint: createHash('sha256').update(JSON.stringify(this.input)).digest('hex'),
      input: this.input,
      pools,
      standardOrder: this.standard.map((t) => t.source),
      scalingOrder: this.scalingOrder,
      sections: this.sections.map(({ available, ...s }) => ({
        ...s,
        availableTiles: available.map((t) => t.source),
        traitsMet: s.traitsEvaluated ? s.traitMatching !== null : null,
        minimumMet: this.sizeMet(this.sections[s.id]!),
      })),
      buckets: {
        standard: bucketResult(this.standardFlags),
        custom: bucketResult(this.customFlags),
      },
      search: {
        sequence: this.sequence,
        history: this.history,
        invalidSequences: this.invalid.children,
        invalidCount: this.invalid.count,
      },
      trace: this.trace,
      checkpoints: this.checkpoints,
      rng: this.random?.snapshot() ?? null,
      operations: this.operations,
    };
    return status === 'selected'
      ? {
          ...common,
          status,
          checkpoint: 'after-optional-before-local-edges' as const,
          failure: null,
        }
      : { ...common, status, checkpoint: null, failure: failure! };
  }
}

export function selectMapTiles(value: unknown) {
  return new Selection(parseSelectionInput(value)).run();
}
export type SelectionResult = ReturnType<typeof selectMapTiles>;
