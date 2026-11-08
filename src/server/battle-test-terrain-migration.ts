const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const rows = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
function scenario(v: unknown) {
  const m = object(object(object(v).pack).manifest);
  return [m.campDeparture, m.battleStartup].some(
    (d) => object(object(d).combat).testTerrain !== undefined,
  );
}
function snapshot(v: unknown) {
  const r = object(object(v).resolution),
    test = object(r.sourceTest);
  return (
    test.terrain !== undefined ||
    rows(test.cards).some(
      (c) => object(c).copy !== undefined || object(c).excluded !== undefined,
    ) ||
    object(object(v).active).purpose === 'terrain-test' ||
    rows(r.history).some((h) => object(object(h).active).purpose === 'terrain-test')
  );
}
/** Inspect structural locations, never recursive bans on ordinary dictionary keys. */
export function hasBattleTestTerrainForms(value: unknown): boolean {
  const s = object(value),
    p = object(s.physical),
    seed = object(object(p.cycle).seed);
  return (
    scenario(s.scenario) ||
    scenario(seed.scenario) ||
    snapshot(p.snapshot) ||
    rows(p.runs).some((r) => object(object(r).spatial).testTerrain !== undefined) ||
    rows(s.episodes).some(hasBattleTestTerrainForms)
  );
}
