// Seven-section journey recipe and complete ordered pools, all entirely invented.
import { generatorFixture } from './map-freeze.mjs';
export function adventure3Generator(catalog) {
  const g = generatorFixture(catalog),
    t = g.template,
    s = t.selection;
  g.algorithm = 'session-A3-generator-pack-v1';
  g.identity.adventureId = 3;
  g.identity.adventureSource = 'example.assets:990';
  t.placement.provenance.files.push({ file: 'example.assets', sha256: '9'.repeat(64) });
  s.provenance.files.push({ file: 'example.assets', sha256: '9'.repeat(64) });
  t.geometry.provenance.files.push({ file: 'example.assets', sha256: '9'.repeat(64) });
  s.algorithm = 'source-selection-A3-v1';
  t.geometry.algorithm = 'source-map-geometry-pack-A3-v1';
  t.placement.algorithm = 'source-encounter-placement-pack-A3-v1';
  const rename = (v, delta) =>
    Array.isArray(v)
      ? v.map((x) => rename(x, delta))
      : v && typeof v === 'object'
        ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, rename(x, delta)]))
        : typeof v === 'string' && /^invented.assets:\d+$/.test(v)
          ? `invented.assets:${Number(v.split(':')[1]) + delta}`
          : v;
  for (let n = 8; n < 32; n++) {
    const shape = rename(structuredClone(t.geometry.tiles[n % 8]), n * 1000000);
    const row = s.standard[n];
    Object.assign(shape, { source: row.source, modelSource: row.modelSource, hashId: row.hashId });
    shape.spaces.forEach((space, i) => {
      space.source = row.spaces[i].source;
    });
    t.geometry.tiles.push(shape);
  }
  s.products[0].tileCodes = s.standard.slice(0, 32).map((x) => x.code);
  const original = s.sections.map((x) => structuredClone(x));
  const geometry = t.geometry.sections.map((x) => structuredClone(x));
  const placement = t.placement.sections.map((x) => structuredClone(x));
  s.sections = Array.from({ length: 7 }, (_, index) => ({
    ...structuredClone(original[index % 4]),
    index,
    source: `invented.assets:${90000 + index}`,
    start: null,
    required: [],
    traitRequirements: [],
    fixedEncounterSources: [],
    minimumSpaces: 2,
    maximumSpaces: 2,
    ignorePlayerScaling: true,
  }));
  t.geometry.sections = s.sections.map((x, i) => ({
    ...structuredClone(geometry[i % 4]),
    id: i,
    source: x.source,
  }));
  t.placement.sections = s.sections.map((x, i) => ({
    ...structuredClone(placement[i % 4]),
    index: i,
    source: x.source,
    tileEncounters: [],
    sectionEncounterSources: [],
    randomFillPercent: 0,
  }));
  s.requiredConnections = [
    [0, 1],
    [1, 3],
    [1, 4],
    [1, 5],
    [1, 6],
    [1, 2],
  ];
  return g;
}
