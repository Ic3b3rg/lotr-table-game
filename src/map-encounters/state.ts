import { createHash } from 'node:crypto';
import type { AssemblyResult } from '../map-assembly/assembly';
import { AssemblyStop, SearchClock, type TraceEvent } from '../map-assembly/execution';
import { PrefixTree } from '../map-assembly/local-layout';
import { SourceRandom } from '../map-generation/primitives';
import type { EncounterInput } from './model';

export const fingerprint = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function freeze<T>(value: T): T {
  const stack: unknown[] = [value];
  while (stack.length) {
    const v = stack.pop();
    if (v && typeof v === 'object' && !Object.isFrozen(v)) {
      Object.freeze(v);
      for (const child of Object.values(v)) stack.push(child);
    }
  }
  return value;
}
export type Space = Omit<AssemblyResult['spaces'][number], 'encounterId'> & { encounterId: number };
export type Origin = { stage: string; sectionId: number | null; groupSource: string | null };
export type Assignment = {
  spaceId: string;
  encounterId: number;
  modelSource: string;
  origin: Origin;
  placementOrdinal: number;
};
export class EncounterState {
  readonly random: SourceRandom | null;
  readonly clock: SearchClock;
  readonly spaces: Space[];
  readonly bySpace: Map<string, Space>;
  readonly models;
  readonly selectionModels;
  readonly allModels: Set<string>;
  readonly ownedModels: Set<string>;
  readonly tiles;
  readonly assignments = new Map<string, Assignment>();
  readonly allSpaces: Space[];
  readonly allSpacesBeforeShuffle: string[];
  readonly trace: TraceEvent[] = [];
  readonly sequence: number[] = [];
  readonly history: { encounterId: number; tileId: number; spaceIndex: number; spaceId: string }[] =
    [];
  invalid = new PrefixTree();
  stage = 'assembly-boundary';
  operations = 0;
  sectionCursor: number | null = null;
  groupCursor: number | null = null;
  modelCursor: number | null = null;
  spaceCursor: number | null = null;
  remainingCount: number | null = null;
  placementOrdinal = 0;
  eligibleGroups: string[] = [];
  chosenGroup: string | null = null;
  readonly usedEncounterIds: number[];
  readonly usedGroupIds: number[];
  readonly spawnOrder: (Assignment & { spawnOrdinal: number })[] = [];
  constructor(
    readonly input: EncounterInput,
    readonly assembly: AssemblyResult,
  ) {
    this.random = assembly.rng ? SourceRandom.restore(assembly.rng) : null;
    this.clock = new SearchClock(input.execution.clock, input.execution.maxTraceEvents);
    this.spaces = structuredClone(assembly.spaces);
    this.bySpace = new Map(this.spaces.map((s) => [s.id, s]));
    this.allSpaces = [...this.spaces];
    this.allSpacesBeforeShuffle = this.spaces.map((s) => s.id);
    this.tiles = new Map(assembly.sections.flatMap((s) => s.tiles).map((t) => [t.source, t]));
    this.models = new Map(input.placement.models.map((m) => [m.source, m]));
    this.selectionModels = new Map(input.assembly.selection.encounters.map((e) => [e.source, e]));
    const products = input.assembly.selection.products;
    this.allModels = new Set(products.flatMap((p) => p.encounterSources));
    this.ownedModels = new Set(
      products
        .filter((p) => input.assembly.selection.context.ownedProductIds.includes(p.id))
        .flatMap((p) => p.encounterSources),
    );
    this.usedEncounterIds = [...input.assembly.selection.context.usedEncounterIds];
    this.usedGroupIds = [...input.assembly.selection.context.usedGroupIds];
  }
  tick(site: string): void {
    if (this.operations >= this.input.execution.maxOperations)
      throw new AssemblyStop(
        'administrative-stop',
        'operation-budget',
        'Budget amministrativo incontri esaurito.',
      );
    this.operations++;
    this.clock.observe({
      stage: this.stage,
      site,
      operation: this.operations,
      samples: this.random?.snapshot().samples ?? 0,
      depth: this.sequence.length,
    });
  }
  emit(operation: string, details: Record<string, unknown>): void {
    if (this.trace.length >= this.input.execution.maxTraceEvents)
      throw new AssemblyStop(
        'administrative-stop',
        'trace-budget',
        'Budget traccia incontri esaurito.',
      );
    this.trace.push({
      stage: this.stage,
      operation,
      ordinal: this.trace.length,
      samples: this.random?.snapshot().samples ?? 0,
      ...structuredClone(details),
    });
  }
  fail(reason: string): never {
    throw new AssemblyStop('source-failure', reason, 'InvalidParameters: ' + reason, 2);
  }
  draw(site: string, min: number, max: number): number {
    this.tick(site);
    const before = this.random!.snapshot().samples;
    const value = this.random!.nextInt(min, max);
    this.emit('draw', { site, min, max, value, samplesBefore: before });
    return value;
  }
  shuffle<T>(items: T[], site: string, key: (value: T) => string): void {
    const before = items.map(key);
    for (let i = 0; i < items.length; i++) {
      const j = this.draw(site, 0, items.length);
      [items[i], items[j]] = [items[j]!, items[i]!];
    }
    this.emit('shuffle', {
      site,
      before,
      after: items.map(key),
      collectionFingerprint: fingerprint(before),
    });
  }
  has(id: number): boolean {
    return this.spaces.some((s) => s.encounterId === id);
  }
  assign(space: Space, source: string, origin: Origin): Space {
    const model = this.models.get(source)!;
    space.encounterId = model.id;
    const assignment = {
      spaceId: space.id,
      encounterId: model.id,
      modelSource: source,
      origin,
      placementOrdinal: this.placementOrdinal++,
    };
    this.assignments.set(space.id, assignment);
    this.emit('assign', assignment);
    return space;
  }
  clearSearch(clearInvalid: boolean): void {
    this.history.length = 0;
    this.sequence.length = 0;
    if (clearInvalid) this.invalid = new PrefixTree();
    this.emit('clear-search', { clearInvalid, invalidSequences: this.invalid.children });
  }
}
