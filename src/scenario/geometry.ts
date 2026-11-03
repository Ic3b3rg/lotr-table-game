import type { Projection } from '../shared/generated-map';
import { JourneyDefinitionSchema } from '../shared/journey-map';
import { transform, turn, plus } from '../map-assembly/physical';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';

/** Presentation only: all movement edges come from the frozen movementGraph. */
export function projectionToJourney(p: Projection, startSpace: string, label: string) {
  const bindings = p.spaces.map((s) => ({
    sourceId: s.id,
    id: `space-${Buffer.from(s.id).toString('base64url')}`,
  }));
  const id = (source: string) => {
    const found = bindings.find((b) => b.sourceId === source);
    invariant(found, 'Casella senza binding.');
    return found.id;
  };
  const points = p.spaces.map((s) => {
    const tile = p.sections.flatMap((s) => s.tiles).find((t) => t.source === s.tileSource)!;
    const hexes = tile.hexes
      .filter((h) => h.space === s.index)
      .map((h) => {
        const shape = tile.shape.hexes[h.index]!;
        invariant(shape.render?.polygon.length === 6, 'Poligono fonte mancante.');
        const polygon = shape.render.polygon.map((v) =>
          plus(turn(transform(v, shape.transform), tile.compositeRotation), tile.worldPosition),
        );
        // Mesh vertex buffers are not ordered polygon rings. Sort this convex hex by angle.
        polygon.sort(
          (a, b) =>
            Math.atan2(a[1] - h.worldCenter[1], a[0] - h.worldCenter[0]) -
            Math.atan2(b[1] - h.worldCenter[1], b[0] - h.worldCenter[0]),
        );
        return { center: h.worldCenter, polygon };
      });
    return { space: s, hexes };
  });
  const all = points.flatMap((s) => [
    s.space.nodePosition,
    ...s.hexes.flatMap((h) => [h.center, ...h.polygon]),
  ]);
  const minX = Math.min(...all.map((v) => v[0])),
    maxX = Math.max(...all.map((v) => v[0]));
  const minY = Math.min(...all.map((v) => v[1])),
    maxY = Math.max(...all.map((v) => v[1]));
  const scale = Math.min(40, 7800 / Math.max(1, maxX - minX, maxY - minY)),
    margin = 24;
  const point = (v: number[]) => ({
    x: margin + (v[0]! - minX) * scale,
    y: margin + (maxY - v[1]!) * scale,
  });
  const definition = JourneyDefinitionSchema.parse({
    id: `generated-${p.fingerprint.slice(0, 24)}`,
    label,
    source: {
      name: p.provenance.sourceVersion,
      sha256: p.fingerprint,
      reference: 'Frozen projection; movementGraph; source mesh polygons',
    },
    width: Math.max(64, Math.ceil((maxX - minX) * scale + margin * 2)),
    height: Math.max(64, Math.ceil((maxY - minY) * scale + margin * 2)),
    startSpaceId: id(startSpace),
    spaces: points.map(({ space: s, hexes }) => ({
      id: id(s.id),
      label: `${p.sections.flatMap((s) => s.tiles).find((t) => t.source === s.tileSource)!.code} · Casella ${s.index + 1}`,
      ...point(s.nodePosition),
      hexes: hexes.map((h) => ({ ...point(h.center), polygon: h.polygon.map(point) })),
    })),
    connections: p.movementGraph.edges.map((e) => [id(e.a), id(e.b)]),
  });
  return { definition, bindings, fingerprint: digest(definition) };
}
