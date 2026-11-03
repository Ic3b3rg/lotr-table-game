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
  return { definition, unexplored, nodes };
}
