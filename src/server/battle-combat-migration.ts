const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const rows = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const scenario = (v: unknown) => {
  const manifest = object(object(object(v).pack).manifest);
  return (
    object(manifest.campDeparture).combat !== undefined ||
    object(manifest.battleStartup).combat !== undefined ||
    manifest.scope === 'battle-combat-v1'
  );
};

/** Only actual capability locations; dictionaries, prose and historical A1 combat remain data. */
export function hasBattleCombatForms(value: unknown): boolean {
  const state = object(value),
    seed = object(object(object(state.physical).cycle).seed);
  return (
    scenario(state.scenario) ||
    scenario(seed.scenario) ||
    rows(state.episodes).some(hasBattleCombatForms)
  );
}
