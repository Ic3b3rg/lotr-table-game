import type { Session } from './protocol';
export function scenarioMapView(session: Pick<Session, 'scenario' | 'journey' | 'mapGeneration'>) {
  const { journey, scenario: sc, mapGeneration: g } = session;
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
        spaceId: sc.spaceBindings.find((b) => b.sourceId === g.spaceId)!.id,
        name: cap!.deployment.source.texts[
          String(g.figures.length > 1 ? model.KeyPlural : model.KeySingular)
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
