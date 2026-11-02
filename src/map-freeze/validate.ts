import { ProjectionSchema, type Projection, type GenerationContext } from '../shared/generated-map';
import { SourceRandom } from '../map-generation/primitives';
import { rotate, canMatch, isConnection } from '../map-geometry/geometry';
import {
  add,
  subtract,
  cubeKey,
  directionCube,
  normalizeDirection,
  edgeKey,
} from '../map-geometry/model';
import { plus, turn, transform, f, sqr, minus } from '../map-assembly/physical';
import type { Vector } from '../map-assembly/model';
import { digest } from './hash';

export const MAX_PROJECTION_BYTES = 1024 * 1024;
export function invariant(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(`Realizzazione: ${message}`);
}
const same = (a: unknown, b: unknown) => digest(a) === digest(b);
function unique(values: unknown[], label: string) {
  invariant(new Set(values).size === values.length, `${label} duplicati.`);
}
export function validateContext(c: GenerationContext) {
  invariant(
    c.heroCount === c.heroes.length && same(c.ownedProductIds, [0]),
    'Contesto H/prodotti incoerente.',
  );
  unique(
    c.heroes.map((h) => h.catalogId),
    'Eroi',
  );
  unique(
    c.heroes.map((h) => h.id),
    'HeroModel',
  );
  unique(
    c.heroes.map((h) => h.source),
    'Fonti eroi',
  );
  unique(
    c.heroes.flatMap((h) => h.items.map((i) => i.copy)),
    'Copie equipaggiate',
  );
  invariant(
    same(
      c.groupItemIds,
      c.groupItems.map((i) => i.id),
    ),
    'Inventario compagnia incoerente.',
  );
  for (const h of c.heroes)
    invariant(
      same(
        h.itemIds,
        h.items.map((i) => i.id),
      ) && h.items.every((i) => i.copy.slice(0, i.copy.lastIndexOf(':')) === i.catalogId),
      'Inventario eroe incoerente.',
    );
  for (const ids of [c.usedEncounterIds, c.usedGroupIds, c.unlockedChainIds]) unique(ids, 'Storia');
}
function validateGeometry(p: Projection) {
  unique(
    p.provenance.files.map((v) => v.file),
    'File fonte',
  );
  const declared = new Set(p.provenance.files.map((v) => v.file));
  const checkSource = (s: string) =>
    invariant(declared.has(s.slice(0, s.lastIndexOf(':'))), 'File fonte non dichiarato.');
  const visit = (v: unknown, key = ''): void => {
    if (
      typeof v === 'string' &&
      (key === 'source' || key.endsWith('Source') || key.endsWith('Sources'))
    )
      checkSource(v);
    else if (Array.isArray(v)) v.forEach((value) => visit(value, key));
    else if (v && typeof v === 'object')
      Object.entries(v).forEach(([name, value]) => visit(value, name));
  };
  visit(p.context);
  visit(p.sections);
  visit(p.selectedModels);
  visit(p.chosenGroup);
  visit(p.geometrySettings);
  invariant(
    same(
      p.sections.map((s) => s.id),
      [0, 1, 2, 3],
    ),
    'Ordine builder incompleto.',
  );
  invariant(same([...p.mapOrder].sort(), [0, 1, 2, 3]), 'Ordine mappa incompleto.');
  const tiles = p.sections.flatMap((s) => s.tiles);
  unique(
    tiles.map((t) => t.source),
    'Tessere',
  );
  unique(
    tiles.map((t) => t.hashId),
    'HashId tessere',
  );
  invariant(
    !tiles.some((t) => tiles.some((o) => o.hashId === t.oppositeHashId)),
    'Facce opposte presenti insieme.',
  );
  const spaces = new Map(p.spaces.map((s) => [s.id, s]));
  unique(
    p.spaces.map((s) => s.id),
    'Caselle',
  );
  const occupancy = new Map<
    string,
    {
      tile: (typeof tiles)[number];
      section: Projection['sections'][number];
      hex: (typeof tiles)[number]['hexes'][number];
    }
  >();
  const expectedSpaceOrder: string[] = [];
  for (const s of p.sections) {
    invariant(p.geometrySettings.sections[s.id]!.source === s.source, 'Fonte sezione incoerente.');
    for (const t of s.tiles) {
      const shape = t.shape;
      invariant(
        t.source === shape.source &&
          t.modelSource === shape.modelSource &&
          t.hashId === shape.hashId &&
          t.compositeRotation === normalizeDirection(t.rotation + s.rotation),
        'Identità/rotazione tessera incoerente.',
      );
      invariant(t.hexes.length === shape.hexes.length, 'Esagoni mancanti.');
      const localOffset = subtract(
        t.hexes[0]!.sectionCoords,
        rotate(t.hexes[0]!.tileCoords, t.rotation),
      );
      const point = (v: Vector) =>
        plus(s.position, turn(plus(t.localPosition, turn(v, t.rotation)), s.rotation));
      invariant(same(t.worldPosition, point([0, 0, 0])), 'Posa display incoerente.');
      unique(
        shape.spaces.map((v) => v.source),
        'Fonti caselle',
      );
      unique(
        shape.hexes.map((v) => v.source),
        'Fonti esagoni',
      );
      unique(
        shape.edges.map((v) => edgeKey(v.hex, v.direction)),
        'Bordi',
      );
      for (const h of t.hexes) {
        const source = shape.hexes[h.index];
        invariant(
          source &&
            h.index === t.hexes.indexOf(h) &&
            h.source === source.source &&
            same(h.tileCoords, source.coords) &&
            h.space === source.space &&
            h.space < shape.spaces.length,
          'Esagono/fonte non coerente.',
        );
        invariant(
          same(h.sectionCoords, add(rotate(h.tileCoords, t.rotation), localOffset)) &&
            same(h.globalCoords, add(s.cubeOrigin, rotate(h.sectionCoords, s.rotation))),
          'Posa cubica incoerente.',
        );
        invariant(
          same(h.worldCenter, point(transform([0, 0, 0], source.transform))),
          'Centro display incoerente.',
        );
        const key = cubeKey(h.globalCoords);
        invariant(!occupancy.has(key), 'Occupancy sovrapposta.');
        occupancy.set(key, { tile: t, section: s, hex: h });
      }
      shape.spaces.forEach((original, index) => {
        const id = `${t.source}/space/${index}`,
          space = spaces.get(id);
        expectedSpaceOrder.push(id);
        invariant(
          space &&
            space.source === original.source &&
            space.tileSource === t.source &&
            space.index === index &&
            space.sectionId === s.id &&
            space.traits === original.traits &&
            space.hasDarkness === original.hasDarkness,
          'Casella/fonte incoerente.',
        );
        invariant(
          same(
            space.hexes,
            t.hexes.filter((h) => h.space === index).map((h) => h.globalCoords),
          ) && same(space.nodePosition, point(transform([0, 0, 0], original.nodeAnchor))),
          'Geometria casella incoerente.',
        );
        unique(original.serializedConnectedSpaces, 'Adiacenze autoriali');
        invariant(
          original.serializedConnectedSpaces.every(
            (n) => n !== index && shape.spaces[n]?.serializedConnectedSpaces.includes(index),
          ),
          'Adiacenza autoriale non reciproca.',
        );
      });
    }
    invariant(same(s.boundingSphere.position, s.position), 'Centro bounds incoerente.');
    let max = 0;
    for (const t of s.tiles)
      for (const h of t.hexes) max = Math.max(max, sqr(minus(h.worldCenter, s.position)));
    invariant(s.boundingSphere.radius === f(Math.sqrt(max)), 'Raggio bounds incoerente.');
  }
  invariant(
    same(
      p.spaces.map((s) => s.id),
      expectedSpaceOrder,
    ),
    'Ordine/numero caselle incoerente.',
  );
  unique(p.allSpaces, 'allSpaces');
  invariant(
    same([...p.allSpaces].sort(), [...spaces.keys()].sort()),
    'Shuffle caselle incompleto.',
  );
  const contacts: Projection['contacts'] = [],
    seen = new Set<string>();
  const sourceLinks = new Map(p.spaces.map((s) => [s.id, [] as string[]]));
  const endpoint = (h: ReturnType<typeof occupancy.get> & {}, direction: number) => ({
    sectionId: h.section.id,
    tileSource: h.tile.source,
    hashId: h.tile.hashId,
    hex: h.hex.index,
    coords: h.hex.globalCoords,
    tileCoords: h.hex.tileCoords,
    direction,
    intrinsicDirection: normalizeDirection(direction - h.tile.compositeRotation),
    spaceId: `${h.tile.source}/space/${h.hex.space}`,
  });
  for (const h of occupancy.values())
    for (let direction = 0; direction < 6; direction++) {
      const neighbor = occupancy.get(cubeKey(add(h.hex.globalCoords, directionCube(direction))));
      if (!neighbor) continue;
      const a = endpoint(h, direction),
        b = endpoint(neighbor, normalizeDirection(direction + 3));
      const ours = h.tile.shape.edges.find(
          (e) => e.hex === a.hex && e.direction === a.intrinsicDirection,
        ),
        other = neighbor.tile.shape.edges.find(
          (e) => e.hex === b.hex && e.direction === b.intrinsicDirection,
        );
      const traversal = !!ours && !!other && isConnection(ours, other);
      if (a.tileSource !== b.tileSource) {
        invariant(ours && other, 'Bordo contatto mancante.');
        const key = [`${a.tileSource}/${a.hex}`, `${b.tileSource}/${b.hex}`].sort().join('|');
        if (!seen.has(key)) {
          seen.add(key);
          const allowed =
            a.sectionId === b.sectionId ||
            !p.geometrySettings.invalidConnections.some(
              ([x, y]) =>
                (x === a.sectionId && y === b.sectionId) ||
                (x === b.sectionId && y === a.sectionId),
            );
          contacts.push({
            a,
            b,
            edges: [ours, other],
            compatible: canMatch(ours, other),
            traversable: traversal,
            allowed,
          });
        }
      }
      if (a.spaceId !== b.spaceId && traversal) {
        const links = sourceLinks.get(a.spaceId)!,
          back = sourceLinks.get(b.spaceId)!;
        if (!links.includes(b.spaceId)) links.push(b.spaceId);
        if (!back.includes(a.spaceId)) back.push(a.spaceId);
      }
    }
  invariant(same(contacts, p.contacts), 'Contatti geometrici incompleti o incoerenti.');
  for (const s of p.spaces)
    invariant(same(s.connected, sourceLinks.get(s.id)), 'Grafo fonte incoerente.');
  for (const [a, b] of p.requiredConnections)
    invariant(
      contacts.some(
        (c) =>
          c.allowed &&
          c.traversable &&
          ((c.a.sectionId === a && c.b.sectionId === b) ||
            (c.a.sectionId === b && c.b.sectionId === a)),
      ),
      'Join richiesto assente.',
    );
  const edges = new Map<string, Projection['movementGraph']['edges'][number]>();
  const connect = (
    from: string,
    to: string,
    proof: Projection['movementGraph']['edges'][number]['provenance'][number],
  ) => {
    const a = from < to ? from : to,
      b = from < to ? to : from,
      key = JSON.stringify([a, b]),
      existing = edges.get(key);
    if (existing) existing.provenance.push(proof);
    else edges.set(key, { a, b, provenance: [proof] });
  };
  for (const t of tiles)
    t.shape.spaces.forEach((s, index) => {
      for (const n of s.serializedConnectedSpaces)
        if (index < n)
          connect(`${t.source}/space/${index}`, `${t.source}/space/${n}`, {
            kind: 'intra-tile-authoring',
            tileSource: t.source,
            spaceIndices: [index, n],
            spaceSources: [s.source, t.shape.spaces[n]!.source],
          });
    });
  contacts.forEach((c, contactIndex) => {
    if (c.allowed && c.traversable)
      connect(c.a.spaceId, c.b.spaceId, { kind: 'inter-tile-contact', contactIndex });
  });
  const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  const ordered = [...edges.values()].sort((a, b) => compare(a.a, b.a) || compare(a.b, b.b));
  invariant(same(ordered, p.movementGraph.edges), 'Grafo movimento incoerente.');
  const connected = new Map(p.spaces.map((s) => [s.id, [] as string[]]));
  for (const e of ordered) {
    connected.get(e.a)!.push(e.b);
    connected.get(e.b)!.push(e.a);
  }
  connected.forEach((v) => v.sort(compare));
  const queue = [p.spaces[0]!.id],
    visited = new Set(queue);
  for (let i = 0; i < queue.length; i++)
    for (const n of connected.get(queue[i]!)!)
      if (!visited.has(n)) {
        visited.add(n);
        queue.push(n);
      }
  invariant(
    queue.length === p.spaces.length && same(p.movementGraph.components, [queue]),
    'Movimento disconnesso.',
  );
}
function validateEncounters(p: Projection) {
  const bySpace = new Map(p.spaces.map((s) => [s.id, s])),
    models = new Map(p.selectedModels.map((m) => [m.source, m]));
  unique(
    p.assignments.map((a) => a.spaceId),
    'Assegnazioni',
  );
  unique(
    p.assignments.map((a) => a.placementOrdinal),
    'Ordine placement',
  );
  unique(
    p.selectedModels.map((m) => m.source),
    'Modelli',
  );
  unique(
    p.selectedModels.map((m) => m.id),
    'ID incontri',
  );
  invariant(
    same([...models.keys()], [...new Set(p.assignments.map((a) => a.modelSource))]),
    'Modelli selezionati incompleti.',
  );
  const tiles = p.sections.flatMap((s) => s.tiles),
    placedIds = new Set<number>();
  for (const a of [...p.assignments].sort((a, b) => a.placementOrdinal - b.placementOrdinal)) {
    const s = bySpace.get(a.spaceId),
      m = models.get(a.modelSource);
    invariant(
      s &&
        m &&
        m.id === a.encounterId &&
        s.encounterId === a.encounterId &&
        same(a.prefab, m.prefab) &&
        same(a.nodePosition, s.nodePosition),
      'Assegnazione/prefab incoerente.',
    );
    invariant(
      m.id === m.selection.id && m.source === m.selection.source && m.index === m.selection.index,
      'Identità EncounterModel incoerente.',
    );
    const path = m.prefab.path.replaceAll('\\', '/');
    invariant(
      /^Assets\/Resources\/.+\.prefab$/i.test(path) &&
        path.slice(17, -7).toLowerCase() === m.prefab.resourceKey,
      'Prefab.Path non risolto.',
    );
    invariant(
      !placedIds.has(a.encounterId) || a.origin.stage === 'item',
      'ID incontro ripetuto fuori dallo stage item.',
    );
    placedIds.add(a.encounterId);
    invariant(
      a.origin.sectionId === null || a.origin.sectionId === s.sectionId,
      'Origine sezione incoerente.',
    );
    const group = a.origin.stage.startsWith('group-');
    invariant(
      group ? a.origin.groupSource === p.chosenGroup.source : a.origin.groupSource === null,
      'Origine gruppo incoerente.',
    );
    if (a.origin.stage !== 'fixed-tile') {
      const tile = tiles.find((t) => t.source === s.tileSource)!;
      invariant(
        m.specificTileModelSource !== null
          ? m.specificTileModelSource === tile.modelSource && m.specificSpaceIndex === s.index
          : (s.traits & m.requiredTraits) === m.requiredTraits &&
              (s.traits & m.excludedTraits) === 0,
        'Requisiti incontro incompatibili.',
      );
    }
  }
  invariant(
    p.spaces.every((s) =>
      s.encounterId === -1
        ? !p.assignments.some((a) => a.spaceId === s.id)
        : p.assignments.some((a) => a.spaceId === s.id),
    ),
    'Casella assegnata senza modello.',
  );
  invariant(
    same(
      p.spawnOrder,
      p.allSpaces.filter((id) => p.assignments.some((a) => a.spaceId === id)),
    ),
    'Ordine spawn incoerente.',
  );
  for (const source of p.chosenGroup.requiredSources)
    invariant(
      p.assignments.some((a) => a.modelSource === source),
      'Gruppo required incompleto.',
    );
  invariant(
    p.chosenGroup.optionalSources.filter((source) =>
      p.assignments.some((a) => a.modelSource === source),
    ).length >= p.chosenGroup.requiredOptionalCount,
    'Gruppo optional incompleto.',
  );
  const history = {
    usedEncounterIds: [...p.context.usedEncounterIds],
    usedGroupIds: [...p.context.usedGroupIds],
    unlockedChainIds: p.context.unlockedChainIds,
  };
  for (const id of p.spawnOrder) {
    const value = bySpace.get(id)!.encounterId;
    if (!history.usedEncounterIds.includes(value)) history.usedEncounterIds.push(value);
  }
  if (!history.usedGroupIds.includes(p.chosenGroup.id)) history.usedGroupIds.push(p.chosenGroup.id);
  invariant(same(history, p.history), 'Storia post-build incoerente.');
  invariant(
    same(p.closure.selectedPrefabSources, [...new Set(p.assignments.map((a) => a.prefab.source))]),
    'Closure prefab incompleta.',
  );
}
/** Offline semantic validation; never invokes generator, draws or prefab effects. */
export function validateProjection(raw: unknown): Projection {
  invariant(
    Buffer.byteLength(JSON.stringify(raw)) <= MAX_PROJECTION_BYTES,
    'Proiezione troppo grande.',
  );
  const p = ProjectionSchema.parse(JSON.parse(JSON.stringify(raw))),
    { fingerprint, ...data } = p;
  invariant(
    digest(data) === fingerprint && digest(p.context) === p.contextFingerprint,
    'Fingerprint incoerente.',
  );
  validateContext(p.context);
  invariant(
    same(p.rng.initial, new SourceRandom(p.successfulSeed).snapshot()),
    'RNG iniziale incoerente.',
  );
  invariant(
    p.rng.geometry.seed === p.successfulSeed &&
      p.rng.final.seed === p.successfulSeed &&
      p.rng.final.samples >= p.rng.geometry.samples,
    'RNG al confine incoerente.',
  );
  p.attempts.forEach((a, i) =>
    invariant(
      a.index === i &&
        a.seed === ((p.requestedSeed + i) | 0) &&
        a.status === 'source-failure' &&
        a.sourceErrorCode !== null,
      'Retry incoerenti.',
    ),
  );
  invariant(
    p.successfulSeed === ((p.requestedSeed + p.attempts.length) | 0),
    'Seed riuscito incoerente.',
  );
  validateGeometry(p);
  validateEncounters(p);
  return p;
}
