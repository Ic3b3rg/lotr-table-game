import { createHash } from 'node:crypto';
import { SourceRandom, FLOAT32_POLICY } from '../map-generation/primitives';
import { rotate } from '../map-geometry/geometry';
import { subtract, edgeKey } from '../map-geometry/model';
import { selectMapTiles } from '../map-selection/selection';
import { InputError, parseAssemblyInput, type AssemblyInput } from './model';
import { NUMERICAL_POLICY } from './physical';
import { AssemblyStop, SearchClock, type TraceEvent } from './execution';
import type { World, SectionState, TileState } from './state';
import {
  center,
  composite,
  localTileEdges,
  mapEdges,
  recenter,
  sectionEdges,
  sphere,
  tilePoint,
} from './state';
import { layoutTiles, PrefixTree, type LocalSearch } from './local-layout';
import { layoutSections, sectionOrders, type SectionSearch } from './section-layout';
import { calculateGraph } from './graph';

const fingerprint = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
function freeze<T>(value: T): T {
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
class Assembly {
  private readonly selection;
  private readonly world: World;
  private readonly random: SourceRandom | null;
  private readonly selectedSources: Set<string>;
  private readonly map: SectionState[] = [];
  private readonly clock: SearchClock;
  private readonly trace: TraceEvent[] = [];
  private readonly local: LocalSearch = {
    sequence: [],
    history: [],
    invalid: new PrefixTree(),
    sectionCursor: 0,
    activeSectionId: 0,
    targetCursor: 0,
    anchorCursor: 0,
    contactCursor: 0,
    tileToAttach: null,
  };
  private readonly sections: SectionSearch = {
    index: 0,
    localMin: 4,
    localMinSearchStartTime: 0,
    rollbackSectionId: 0,
    targetCursor: 0,
    anchorCursor: 0,
    contactCursor: 0,
  };
  private stage = 'selection-boundary';
  private operations = 0;
  private firstOrder: number[] = [];
  private sortedOrder: number[] = [];
  private graph: ReturnType<typeof calculateGraph> | null = null;
  constructor(private readonly input: AssemblyInput) {
    this.selection = selectMapTiles(input.selection);
    this.random = this.selection.rng ? SourceRandom.restore(this.selection.rng) : null;
    this.clock = new SearchClock(input.execution.clock, input.execution.maxTraceEvents);
    const tiles = new Map<string, TileState>(
      input.geometry.tiles.map((shape) => [
        shape.source,
        {
          shape,
          rotation: 0,
          globals: shape.hexes.map((h) => [...h.coords]),
          localCoords: null,
          position: [...shape.resetPosition],
          sectionId: null,
          parentSectionId: null,
          localEdges: [],
          edges: new Map(shape.edges.map((e) => [edgeKey(e.hex, e.direction), e])),
        },
      ]),
    );
    const sections: SectionState[] = input.geometry.sections.map((s) => ({
      id: s.id,
      tiles: [],
      available: this.selection.sections[s.id]!.availableTiles.map((r) => tiles.get(r)!),
      position: [...s.position],
      rotation: 0,
      radius: null,
      localEdges: [],
      placements: [],
      tilePlacements: [],
      isFinished: false,
      lastAttachedTileId: -1,
      spacesFromAvailableTiles: this.selection.sections[s.id]!.spacesFromAvailableTiles,
      required: [...this.selection.sections[s.id]!.requiredConnectedSectionIds],
    }));
    this.world = { input, tiles, sections };
    this.selectedSources = new Set(this.selection.sections.flatMap((s) => s.availableTiles));
  }
  private context = (site: string) => ({
    stage: this.stage,
    site,
    operation: this.operations,
    samples: this.random?.snapshot().samples ?? 0,
    depth: this.map.length,
  });
  private time = (site: string): number => this.clock.observe(this.context(site));
  private tick = (site: string): void => {
    if (this.operations >= this.input.execution.maxOperations)
      throw new AssemblyStop(
        'administrative-stop',
        'operation-budget',
        'Budget amministrativo di operazioni esaurito.',
      );
    this.operations++;
    this.time(site);
  };
  private emit = (operation: string, details: Record<string, unknown>): void => {
    if (this.trace.length >= this.input.execution.maxTraceEvents)
      throw new AssemblyStop(
        'administrative-stop',
        'trace-budget',
        'Budget della traccia esaurito.',
      );
    this.trace.push({
      stage: this.stage,
      operation,
      samples: this.random?.snapshot().samples ?? 0,
      ordinal: this.trace.length,
      ...structuredClone(details),
    });
  };
  run() {
    let status:
      | 'geometry-complete'
      | 'source-failure'
      | 'source-operation-exception'
      | 'administrative-stop' = 'geometry-complete';
    let failure: {
      stage: string;
      reason: string;
      message: string;
      sourceErrorCode: number | null;
    } | null = null;
    const o = { tick: this.tick, emit: this.emit };
    try {
      if (this.selection.status !== 'selected')
        throw new AssemblyStop(
          this.selection.status === 'administrative-stop'
            ? 'administrative-stop'
            : this.selection.failure?.operationFailure
              ? 'source-operation-exception'
              : 'source-failure',
          'selection-failed',
          this.selection.failure?.message ?? 'Selezione non riuscita.',
          this.selection.failure?.sourceErrorCode ?? null,
        );
      this.time('assembly-start');
      this.stage = 'local-edges';
      for (const s of this.world.sections)
        for (const t of s.available) {
          this.tick('tile-local-edges');
          t.localEdges = localTileEdges(t);
        }
      this.emit('clear-layout-search', {
        selectionSequence: this.selection.search.sequence,
        selectionHistory: this.selection.search.history,
        selectionTrieCount: this.selection.search.invalidCount,
      });
      this.stage = 'intra-section';
      layoutTiles(this.world, this.random!, this.local, o);
      for (const s of this.world.sections)
        for (const t of s.tiles) t.localCoords = t.globals.map((c) => [...c]);
      this.stage = 'recenter';
      for (const s of this.world.sections) {
        this.tick('recenter');
        const before = s.tiles.map((t) => ({ tileSource: t.shape.source, globals: t.globals }));
        const adjustment = recenter(this.world, s);
        this.emit('recenter', {
          sectionId: s.id,
          ...adjustment,
          cubesBefore: before,
          cubesAfter: s.tiles.map((t) => ({ tileSource: t.shape.source, globals: t.globals })),
        });
      }
      for (const s of this.world.sections) s.localEdges = sectionEdges(this.world, s);
      const orders = sectionOrders(this.world);
      this.firstOrder = orders.first;
      this.sortedOrder = orders.sorted;
      this.emit('section-orders', {
        firstSortOrder: this.firstOrder,
        sortedBuilderOrder: this.sortedOrder,
      });
      this.stage = 'inter-section';
      layoutSections(this.world, this.sortedOrder, this.map, this.sections, o, this.time);
      this.stage = 'graph';
      this.graph = calculateGraph(this.world, o);
      if (this.graph.graph.sourceSectionCheck.some((s) => !s.connected))
        throw new AssemblyStop(
          'source-failure',
          'section-without-connected-space',
          'Almeno una sezione non ha caselle collegate (check fonte).',
          2,
        );
      this.emit('graph-check', {
        sourceSectionCheck: this.graph.graph.sourceSectionCheck,
        components: this.graph.graph.components,
        requiredJoins: this.graph.graph.requiredJoins,
      });
      this.time('geometry-boundary');
      this.stage = 'geometry-boundary';
    } catch (error) {
      if (error instanceof InputError) throw error;
      const stop =
        error instanceof AssemblyStop
          ? error
          : new AssemblyStop(
              'source-operation-exception',
              'source-operation',
              error instanceof Error ? error.message : 'Operazione fonte non riuscita.',
            );
      status = stop.kind;
      failure = {
        stage: this.stage,
        reason: stop.reason,
        message: stop.message,
        sourceErrorCode: stop.sourceErrorCode,
      };
      this.trace.push({
        operation: 'failure',
        samples: this.random?.snapshot().samples ?? 0,
        ordinal: this.trace.length,
        ...failure,
      });
    }
    this.clock.finish();
    const tileResult = (t: TileState) => ({
      source: t.shape.source,
      hashId: t.shape.hashId,
      modelSource: t.shape.modelSource,
      sectionId: t.sectionId,
      parentSectionId: t.parentSectionId,
      localRotations: t.rotation,
      compositeRotations: composite(this.world, t),
      localDisplayPosition: t.position,
      worldDisplayPosition: tilePoint(this.world, t, [0, 0, 0]),
      localOutsideEdges: t.localEdges,
      hexes: t.shape.hexes.map((h, i) => ({
        source: h.source,
        index: i,
        tileCoords: h.coords,
        globalCoords: t.globals[i]!,
        sectionCoords: t.localCoords?.[i] ?? null,
        space: h.space,
        worldCenter: center(this.world, t, i),
      })),
    });
    const { invalid, ...localState } = this.local;
    const result = {
      formatVersion: 1 as const,
      algorithm: this.input.algorithm,
      scope: 'geometry-only' as const,
      status,
      checkpoint:
        status === 'geometry-complete' ? ('after-graph-before-all-spaces-shuffle' as const) : null,
      failure,
      numericalPolicy: NUMERICAL_POLICY,
      floatPolicy: FLOAT32_POLICY,
      clockPolicy: this.input.execution.clock.policy,
      sourceParity: 'not-certified' as const,
      inputFingerprint: fingerprint(this.input),
      geometryFingerprint: fingerprint(this.input.geometry),
      selectionInputFingerprint: this.selection.inputFingerprint,
      input: this.input,
      selection: this.selection,
      builderOrder: [0, 1, 2, 3],
      firstSortOrder: this.firstOrder,
      sortedBuilderOrder: this.sortedOrder,
      mapOrder: this.map.map((s) => s.id),
      sections: this.world.sections.map((s) => ({
        id: s.id,
        source: this.input.geometry.sections[s.id]!.source,
        tiles: s.tiles.map(tileResult),
        availableTiles: s.available.map((t) => t.shape.source),
        spacesFromAvailableTiles: s.spacesFromAvailableTiles,
        extraSpaces: this.selection.sections[s.id]!.extraSpaces,
        isSeeded: this.selection.sections[s.id]!.isSeeded,
        isFinished: s.isFinished,
        lastAttachedTileId: s.lastAttachedTileId,
        requiredConnectedSectionIds: s.required,
        localRotations: s.rotation,
        displayPosition: s.position,
        cubeOrigin: s.tiles[0]?.localCoords
          ? subtract(s.tiles[0].globals[0]!, rotate(s.tiles[0].localCoords[0]!, s.rotation))
          : null,
        boundsDirty: s.radius === null,
        cachedRadius: s.radius,
        boundingSphere: s.tiles.length ? sphere(this.world, s) : null,
        localOutsideEdges: s.localEdges,
        outsideEdges: sectionEdges(this.world, s),
        tilePlacements: s.tilePlacements,
        sectionPlacements: s.placements,
      })),
      tileStates: [...this.world.tiles.values()]
        .filter((t) => this.selectedSources.has(t.shape.source))
        .map(tileResult),
      mapOutsideEdges: mapEdges(this.world, this.map),
      counts: {
        sections: this.map.length,
        tiles: this.world.sections.reduce((n, s) => n + s.tiles.length, 0),
        hexes: this.world.sections.reduce(
          (n, s) => n + s.tiles.reduce((m, t) => m + t.globals.length, 0),
          0,
        ),
        spaces: this.graph?.spaces.length ?? 0,
      },
      spaces: this.graph?.spaces ?? [],
      contacts: this.graph?.contacts ?? [],
      graph: this.graph?.graph ?? null,
      search: {
        local: {
          ...localState,
          invalidSequences: invalid.children,
          invalidCount: invalid.count,
        },
        sections: this.sections,
        stage: this.stage,
        operations: this.operations,
      },
      trace: this.trace,
      clock: {
        policy: this.input.execution.clock.policy,
        pollingPolicy: 'assembly-search-sites-v1',
        cursor: this.clock.cursor,
        observations: this.clock.observations,
      },
      rng: this.random?.snapshot() ?? null,
    };
    return status === 'geometry-complete'
      ? freeze({
          ...result,
          status: 'geometry-complete' as const,
          checkpoint: 'after-graph-before-all-spaces-shuffle' as const,
          failure: null,
          graph: this.graph!.graph,
        })
      : freeze({ ...result, status, checkpoint: null, failure: failure! });
  }
}
/** Versioned, validated raw input; immutable result. No checkpoint input is accepted. */
export function assembleMap(value: unknown) {
  return new Assembly(parseAssemblyInput(value)).run();
}
export type AssemblyResult = ReturnType<typeof assembleMap>;
