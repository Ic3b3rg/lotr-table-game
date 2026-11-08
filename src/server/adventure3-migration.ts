const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const rows = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
function scenario(value: unknown) {
  const s = object(value),
    pack = object(s.pack),
    m = object(pack.manifest);
  return (
    s.journeyStartup !== undefined ||
    m.journeyStartup !== undefined ||
    object(m.campDeparture).version === 'source-camp-departure-A3-v1' ||
    [m.campDeparture, m.battleStartup].some((d) => object(d).continuation !== undefined) ||
    object(pack.identity).adventureId === 3 ||
    rows(pack.definitions).some((d) =>
      rows(object(d).states).some((state) =>
        rows(object(state).actions).some((value) => {
          const a = object(value);
          return (
            a.op === 'delay' ||
            a.randomSpace !== undefined ||
            a.scoutCount !== undefined ||
            (a.op === 'section' && typeof a.sectionId === 'number' && a.sectionId > 3)
          );
        }),
      ),
    )
  );
}
/** Inspect actual authority/origin fields, never arbitrary text, keys or metadata dictionaries. */
export function hasAdventure3Forms(value: unknown) {
  const state = object(value);
  if (rows(state.episodes).length > 1) return true;
  return [state, ...rows(state.episodes)].some((value) => {
    const d = object(value),
      physical = object(d.physical),
      cycle = object(physical.cycle),
      seed = object(cycle.seed);
    const projection = object(object(d.mapGeneration).projection),
      context = object(projection.context);
    return (
      cycle.version === 4 ||
      object(seed.departure).version === 'camp-departure-v2' ||
      rows(cycle.records).some((r) => object(r).generation !== undefined) ||
      scenario(d.scenario) ||
      scenario(seed.scenario) ||
      projection.algorithm === 'frozen-A3-v1' ||
      context.policy === 'camp-A3-v1' ||
      context.adventureId === 3
    );
  });
}
export function assertLinearArchiveShape(value: unknown) {
  const s = object(value);
  for (const archive of rows(s.episodes)) {
    const d = object(archive);
    if (
      ['episodes', 'players', 'commands', 'generation', 'schemaVersion', 'settings'].some(
        (k) => k in d,
      )
    )
      throw new Error('Archivio lineare con State o registro annidato.');
  }
}
