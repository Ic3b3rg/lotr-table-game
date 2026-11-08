const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const rows = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
function program(value: unknown) {
  const p = object(value);
  return (
    p.profile === 'source-fronts-v1' &&
    rows(p.children).some((value) => {
      const child = object(value);
      return (
        ['combat-addition', 'enemy-attack'].includes(String(child.kind)) &&
        object(object(child.addition).effect).op === 'discard-boons'
      );
    })
  );
}

function scenario(value: unknown) {
  const s = object(value),
    manifest = object(object(s.pack).manifest),
    rounds = object(s.rounds),
    source = object(object(manifest.combat).source);
  return (
    [manifest.campDeparture, manifest.battleStartup].some(
      (d) => object(d).battleRounds !== undefined,
    ) ||
    object(manifest.rounds).version === 'source-battle-rounds-v1' ||
    object(manifest.followup).version === 'source-battle-followup-v1' ||
    object(source.shadow).version === 'source-battle-shadow-v1' ||
    source.scriptedGroups !== undefined ||
    rows(source.additions).some((a) => object(object(a).effect).op === 'discard-boons') ||
    rows(object(source.shadow).instructions).some(
      (i) => object(i).alternativeTarget !== undefined,
    ) ||
    rows(object(s.pack).definitions).some((d) =>
      rows(object(d).states).some((t) =>
        rows(object(t).actions).some(
          (a) =>
            [
              'sourceInt',
              'battleThreat',
              'sumInt',
              'divideInt',
              'whenTrue',
              'battleSpawn',
              'battleReady',
              'battleExhaust',
              'battleVisible',
              'battleNode',
              'battleReserve',
            ].includes(String(object(a).op)) ||
            object(a).battleSuffering !== undefined ||
            object(a).battlePlacement !== undefined ||
            (object(a).op === 'physical' && program(object(a).program)),
        ),
      ),
    ) ||
    object(s.conclusion).version === 'source-battle-victory-v1' ||
    rounds.version === 'source-battle-rounds-v1' ||
    rounds.battle !== undefined ||
    rows(object(s.enemies).groups).some((g) => object(g).battleRecipe !== undefined) ||
    rows(object(s.enemies).attempts).some((a) => object(a).battleWave !== undefined)
  );
}

/** Actual save locations only: ordinary dictionary names never become capabilities. */
export function hasBattleRoundForms(value: unknown): boolean {
  const s = object(value),
    physical = object(s.physical),
    seed = object(object(physical.cycle).seed);
  return (
    scenario(s.scenario) ||
    scenario(seed.scenario) ||
    rows(physical.runs).some((run) => program(object(run).program)) ||
    rows(s.episodes).some(hasBattleRoundForms)
  );
}
