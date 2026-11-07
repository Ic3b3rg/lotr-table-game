import type { Session } from './protocol';
export function scenarioMapView(session: Pick<Session, 'scenario' | 'journey' | 'mapGeneration'>) {
  const { journey, scenario: sc, mapGeneration: g } = session;
  if (journey && sc?.battle) {
    const visible = sc.tiles[0]?.visible,
      cap = sc.pack.manifest.battleStartup!,
      board = cap.board as {
        compiled: {
          selectedAlternative: string;
          layouts: {
            id: string;
            placements: { id: string; cell: string | null; position: number[] }[];
            patches: { vertices: number[][] }[];
          }[];
        };
      };
    const layout = board.compiled.layouts.find((l) => l.id === board.compiled.selectedAlternative)!,
      all = layout.patches.flatMap((p) => p.vertices),
      minX = Math.min(...all.map((p) => p[0]!)),
      maxX = Math.max(...all.map((p) => p[0]!)),
      maxY = Math.max(...all.map((p) => p[1]!)),
      minY = Math.min(...all.map((p) => p[1]!)),
      scale = 700 / Math.max(maxX - minX, maxY - minY);
    const point = (v: number[]) => ({
      x: 24 + (v[0]! - minX) * scale,
      y: 24 + (maxY - v[1]!) * scale,
    });
    const groups = (sc.enemies?.groups ?? [])
      .filter((g) => g.placed)
      .map((g) => {
        const model = cap.deployment.assets.find((a) => a.source === g.source)!.data;
        return {
          ...g,
          spaceId: sc.spaceBindings.find((b) => b.sourceId === g.spaceId)!.id,
          name: cap.deployment.texts[
            String(g.figures.length > 1 ? model.KeyPlural : model.KeySingular)
          ]!,
          bonuses: g.bonuses.map((source) => {
            const b = cap.deployment.assets.find((a) => a.source === source)!.data;
            return {
              name: cap.deployment.texts[String(b.KeyName)]!,
              description: cap.deployment.texts[String(b.KeyDescription)]!,
            };
          }),
        };
      });
    const placements = sc.battle.placements
      .filter((p) => p.kind !== 'hero' && p.kind !== 'wall')
      .map((p) => {
        const a = layout.placements.find((a) => a.id === p.anchor)!;
        return {
          id: p.anchor,
          kind:
            p.kind === 'threat'
              ? ('threat' as const)
              : p.kind === 'search'
                ? ('search' as const)
                : ('terrain' as const),
          label: (
            {
              bush: 'Cespuglio',
              fire: 'Fuoco',
              rock: 'Roccia',
              threat: 'Minaccia',
              search: 'Ricerca',
            } as Record<string, string>
          )[p.kind]!,
          ...point(a.position),
        };
      });
    const markers = [
      ...placements,
      ...groups.map((g) => ({
        id: g.id,
        kind: 'enemy' as const,
        label: `${g.figures.length} ${g.name}`,
        ...point(g.position),
      })),
    ];
    const unexplored: string[] = [];
    return {
      definition: {
        ...journey.definition,
        spaces: visible ? journey.definition.spaces : [],
        connections: visible ? journey.definition.connections : [],
        walls: sc.battle.placements.some((p) => p.kind === 'wall')
          ? (journey.definition.walls ?? [])
          : [],
      },
      unexplored,
      nodes: [],
      groups,
      markers,
    };
  }
  if (!journey || !sc || g?.status !== 'frozen') return null;
  const visible = new Set(
    g.projection.spaces
      .filter((s) => sc.tiles.some((t) => t.source === s.tileSource && t.visible))
      .map((s) => sc.spaceBindings.find((b) => b.sourceId === s.id)!.id),
  );
  const unexplored = g.projection.spaces
    .filter((s) => sc.tiles.some((t) => t.source === s.tileSource && t.visible && !t.explored))
    .map((s) => sc.spaceBindings.find((b) => b.sourceId === s.id)!.id);
  const definition = {
    ...journey.definition,
    spaces: journey.definition.spaces
      .filter((s) => visible.has(s.id))
      .map((s) => ({
        ...s,
        label: s.label + (unexplored.includes(s.id) ? ' · Da esplorare' : ''),
      })),
    connections: journey.definition.connections.filter(
      ([a, b]) => visible.has(a) && visible.has(b),
    ),
  };
  const nodes = sc.instances
    .filter((i) => i.kind === 'encounter' && i.visible)
    .map((i) => ({
      instanceId: i.id,
      spaceId: sc.spaceBindings.find((b) => b.sourceId === i.spaceId)!.id,
      content: sc.pack.manifest.prefabs.find((p) => p.source === i.prefab)!,
    }));
  const cap = sc.pack.manifest.followup;
  const groups = (sc.enemies?.groups ?? [])
    .filter((g) => g.placed && g.figures.some((f) => f.health > 0))
    .map((g) => {
      const model = cap!.deployment.source.assets.find((a) => a.source === g.source)!.data;
      const bonuses = g.bonuses.map((source) => {
        const b = cap!.deployment.source.assets.find((a) => a.source === source)!.data;
        return {
          name: cap!.deployment.source.texts[String(b.KeyName)]!,
          description: cap!.deployment.source.texts[String(b.KeyDescription)]!,
        };
      });
      return {
        ...g,
        figures: g.figures.filter((f) => f.health > 0),
        spaceId: sc.spaceBindings.find((b) => b.sourceId === g.spaceId)!.id,
        name: cap!.deployment.source.texts[
          String(
            g.figures.filter((f) => f.health > 0).length > 1 ? model.KeyPlural : model.KeySingular,
          )
        ]!,
        bonuses,
      };
    });
  if (!cap) return { definition, unexplored, nodes, groups: [], markers: [] };
  // The journey presentation is an affine view of the frozen hex centres.
  const pairs = g.projection.spaces.flatMap((s) => {
    const tile = g.projection.sections
      .flatMap((s) => s.tiles)
      .find((t) => t.source === s.tileSource)!;
    const screen = journey.definition.spaces.find(
      (t) => t.id === sc.spaceBindings.find((b) => b.sourceId === s.id)!.id,
    )!;
    return tile.hexes
      .filter((h) => h.space === s.index)
      .map((h, n) => ({ world: h.worldCenter, screen: screen.hexes[n]! }));
  });
  const first = pairs[0]!,
    second = pairs.find((p) => p.world[0] !== first.world[0])!;
  const scale = (second.screen.x - first.screen.x) / (second.world[0] - first.world[0]);
  const point = (v: number[]) => ({
    x: first.screen.x + (v[0]! - first.world[0]) * scale,
    y: first.screen.y - (v[1]! - first.world[1]) * scale,
  });
  const markers = (sc.explorationMarkers ?? [])
    .filter((m) => m.visible)
    .map((m) => ({
      id: m.source,
      kind: 'exploration' as const,
      label: 'Segnalino esplorazione',
      ...point(cap!.explorationNodes.find((n) => n.source === m.source)!.position),
    }));
  const enemyMarkers = groups.map((g) => ({
    id: g.id,
    kind: 'enemy' as const,
    label: `${g.figures.length} ${g.name}${g.tokenId >= 0 ? ` · stendardo ${g.tokenId + 1}` : ''}`,
    ...point(g.position),
  }));
  return { definition, unexplored, nodes, groups, markers: [...markers, ...enemyMarkers] };
}
