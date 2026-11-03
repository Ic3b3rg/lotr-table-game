import type { State } from '../server/state';
import type { Scenario, ScenarioAction, ScenarioInstance } from '../shared/scenario';
import { invariant } from '../map-freeze/validate';

export type SourceEffect = Scenario['effects'][number];

export function sourceCursor(state: State, effect: SourceEffect) {
  const sc = state.scenario!;
  const instance = sc.instances.find((i) => i.id === effect.instanceId);
  const definition = sc.pack.definitions.find((d) => d.source === instance?.definition);
  const action = definition?.states
    .find((s) => s.index === effect.state)
    ?.actions.find((a) => a.index === effect.action);
  invariant(instance && action, 'Cursore senza azione fonte.');
  const completed =
    effect.entry < instance.entry ||
    (effect.entry === instance.entry && instance.completed.includes(effect.action));
  return { instance, action, completed };
}

export function sourceTile(
  state: State,
  instance: ScenarioInstance,
  target: Extract<ScenarioAction, { op: 'revealTile' }>['tile'],
) {
  invariant(state.mapGeneration?.status === 'frozen', 'Cursore senza mappa congelata.');
  const projection = state.mapGeneration.projection;
  const hash =
    target.kind === 'start'
      ? projection.sections.find((s) => s.id === 0)!.tiles[0]!.hashId
      : target.kind === 'hash'
        ? target.value
        : (target.ref.scope === 'local' ? instance.variables : state.scenario!.globals)[
            target.ref.name
          ];
  const tile = projection.sections.flatMap((s) => s.tiles).find((t) => t.hashId === hash);
  invariant(tile, 'Tessera del cursore fonte assente.');
  return tile;
}
