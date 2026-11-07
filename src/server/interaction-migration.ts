const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const rows = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const purpose = (v: unknown) =>
  ['interaction-look', 'interaction-order'].includes(String(object(v).purpose));
const program = (v: unknown) =>
  object(v).interactionLookRules !== undefined || object(v).interactionBefore !== undefined;
const artifact = (v: unknown) =>
  object(v).interactionLook !== undefined ||
  rows(object(v).policies).some((p) =>
    rows(object(p).effects).some((e) =>
      ['before-interact-look', 'before-interact-inspiration'].includes(String(object(e).op)),
    ),
  );
const combat = (v: unknown) => {
  const c = object(v);
  return [c.operation, ...rows(c.operations)].some(
    (op) => object(op).interactionOrder !== undefined,
  );
};
const scenario = (v: unknown) => {
  const sc = object(v),
    pack = object(sc.pack),
    manifest = object(pack.manifest);
  return (
    artifact(object(manifest.campDeparture).fronts) ||
    artifact(object(manifest.battleStartup).fronts) ||
    rows(object(sc.play).attempts).some((a) => object(a).beforeInteraction !== undefined) ||
    rows(pack.definitions).some((d) =>
      rows(object(d).states).some((s) =>
        rows(object(s).actions).some(
          (a) => object(a).op === 'physical' && program(object(a).program),
        ),
      ),
    )
  );
};

/** Exact structural locations only: source variable dictionaries are inert data. */
export function hasInteractionLookForms(value: unknown): boolean {
  const state = object(value),
    p = object(state.physical),
    cycle = object(p.cycle);
  const seed = object(cycle.seed),
    fronts = object(object(p.fronts).artifact);
  const snapshot = object(p.snapshot),
    resolution = object(snapshot.resolution);
  return (
    artifact(fronts) ||
    cycle.interactionLookRules !== undefined ||
    resolution.interactionWindow !== undefined ||
    resolution.privateLooks !== undefined ||
    purpose(snapshot.active) ||
    rows(resolution.history).some((h) => purpose(object(h).active)) ||
    rows(p.runs).some((r) => program(object(r).program)) ||
    scenario(state.scenario) ||
    scenario(seed.scenario) ||
    combat(state.combat) ||
    combat(seed.combat) ||
    rows(state.episodes).some(hasInteractionLookForms)
  );
}
