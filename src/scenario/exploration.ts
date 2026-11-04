import type { State } from '../server/state';
import type { Command } from '../shared/protocol';
import type { ScenarioInstance } from '../shared/scenario';
import { explorationProblem, explorationSource } from '../shared/exploration';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';
import { cycleUUID } from '../physical-resolution/cycle-request';
import { PhysicalRandom } from '../physical-resolution/random';
import { openPhysical } from '../physical-resolution/runtime';
import { applyGrantedMove, applyJourneyCommand } from '../server/journey-map';
import { defeatedHeroes } from '../server/physical-defeat';
import { ApiError } from '../server/errors';

export function prepareExploration(
  state: State,
  playerId: string,
  c: Extract<Command, { type: 'EXPLORE_SCENARIO' }>,
  entropy: string,
  grantId?: string,
): ScenarioInstance {
  const sc = state.scenario!,
    p = state.mapGeneration;
  const fail = (code: string, message: string): never => {
    throw new ApiError(409, code, message);
  };
  if (
    sc.pack.manifest.scope !== 'original-encounter-v1' ||
    !sc.explorations ||
    p?.status !== 'frozen'
  )
    fail('EXPLORATION_CAPABILITY', 'L’esplorazione di questa fonte non è disponibile.');
  invariant(p?.status === 'frozen', 'Realizzazione assente.');
  const source = sc.spaceBindings.find((b) => b.id === c.destinationSpaceId)?.sourceId;
  const space = p.projection.spaces.find((s) => s.id === source);
  if (
    !space ||
    sc.id !== c.scenarioId ||
    sc.packFingerprint !== c.packFingerprint ||
    sc.projectionFingerprint !== c.projectionFingerprint ||
    digest(explorationSource(sc, space.tileSource)) !== c.sourceFingerprint
  )
    fail('SCENARIO_SOURCE_CHANGED', 'La destinazione o la fonte sono cambiate.');
  const view = sc.tiles.find((t) => t.source === space!.tileSource)!;
  if (!view?.visible || view.explored)
    fail('EXPLORATION_UNAVAILABLE', 'Scegli una tessera visibile ancora da esplorare.');
  const problem = explorationProblem(sc, p.projection, space!.tileSource);
  if (problem) fail('EXPLORATION_CAPABILITY', problem);
  if (
    sc.phase !== 'action' ||
    sc.pending ||
    sc.play?.active ||
    sc.explorations!.active ||
    state.physical?.snapshot.active ||
    state.physical?.cycle?.pending
  )
    fail('SCENARIO_PENDING', 'Concludi la richiesta corrente prima di esplorare.');
  if (defeatedHeroes(state).includes(c.heroId)) fail('HERO_DEFEATED', 'Questo eroe è sconfitto.');
  // The existing journey interface owns position, adjacency, player, turn and budget checks.
  if (grantId) applyGrantedMove(state, grantId, c.heroId, c.fromSpaceId, c.destinationSpaceId);
  else applyJourneyCommand(state, playerId, { ...c, type: 'MOVE_HERO' }, null);
  const d = sc.pack.definitions.find((d) => d.source === sc.pack.manifest.exploration!.definition)!;
  const id = cycleUUID({ scenario: sc.id, playerId, request: c.requestId, kind: 'exploration' });
  const instance: ScenarioInstance = {
    id: `exploration:${space!.tileSource}`,
    kind: 'exploration',
    definition: d.source,
    prefab: null,
    spaceId: space!.id,
    state: d.initial,
    entry: 0,
    started: [],
    completed: [],
    settled: false,
    processing: 0,
    stopped: false,
    visible: true,
    variables: Object.fromEntries(d.variables.map((v) => [v.name, structuredClone(v.value)])),
  };
  invariant(!sc.instances.some((i) => i.id === instance.id), 'Esplorazione ripetuta.');
  sc.instances.push(instance);
  const presentations = sc.pack.manifest.exploration!.tiles.find(
    (t) => t.source === space!.tileSource,
  )!.intros;
  sc.explorations!.attempts.push({
    id,
    instanceId: instance.id,
    tileSource: space!.tileSource,
    heroId: c.heroId,
    playerId,
    roundId: c.roundId,
    turnId: c.turnId,
    requestId: c.requestId,
    fromSpaceId: c.fromSpaceId,
    destinationSpaceId: c.destinationSpaceId,
    movesRemaining: state.journey!.travel?.remaining ?? 0,
    movementCost: 1,
    actionCost: 0,
    entropy,
    intro: new PhysicalRandom(entropy).index(presentations.length),
    reward: 0,
    returned: false,
  });
  sc.explorations!.active = id;
  return instance;
}

/** Reward is a real physical resource run, so later physical contexts remain continuous. */
export function rewardExploration(state: State) {
  const sc = state.scenario!,
    frame = sc.explorations!.attempts.find((a) => a.id === sc.explorations!.active)!;
  const amount = sc.pack.manifest.exploration!.inspiration;
  if (!amount) return;
  const task = sc.tasks.at(-1),
    instance = sc.instances.find((i) => i.id === frame.instanceId)!;
  invariant(
    task?.kind === 'explore' && task.instanceId === instance.id && task.entry === instance.entry,
    'Ricompensa senza cursore esplorazione.',
  );
  const action = sc.pack.definitions
    .find((d) => d.source === instance.definition)!
    .states.find((s) => s.index === instance.state)!
    .actions.find((a) => a.index === task.action)!;
  invariant(action.op === 'explore', 'Ricompensa fuori dall’azione fonte.');
  const p = state.physical!,
    before = state.preparation!.heroes.find((h) => h.heroId === frame.heroId)!.inspiration;
  const resources = p.snapshot.resolution!.resources;
  if (resources)
    invariant(
      digest(resources.preparation) === digest(state.preparation),
      'Risorse esplorazione discontinue.',
    );
  const ledger = p.cycle;
  delete p.cycle;
  try {
    openPhysical(
      p,
      {
        effectId: `exploration-reward:${frame.id}`,
        instanceId: frame.instanceId,
        state: instance.state,
        entry: task.entry,
        action: task.action,
        parameterHash: action.origin.parameterHash,
      },
      {
        profile: 'source-fronts-v1',
        initialCredits: p.heroes.map(() => 0),
        limits: p.heroes.map(() => ({ kind: 'requires-capability', capability: 'source-derived' })),
        darknessHeroes: [],
        children: [
          {
            kind: 'inspiration',
            hero: p.heroes.findIndex((h) => h.heroId === frame.heroId),
            amount,
          },
        ],
      },
      resources
        ? structuredClone(resources)
        : { preparation: structuredClone(state.preparation!), depletion: [], boons: [] },
      {
        heroes: p.heroes.map((h) => ({
          ...h,
          spaceId: state.journey!.heroes.find((j) => j.heroId === h.heroId)!.spaceId,
        })),
        connections: structuredClone(state.journey!.definition.connections),
      },
      cycleUUID({ explorationReward: frame.id }),
    );
  } finally {
    if (ledger) p.cycle = ledger;
  }
  invariant(!p.snapshot.active, 'Ricompensa con conseguenza inattesa.');
  state.preparation = structuredClone(p.snapshot.resolution!.resources!.preparation);
  frame.reward =
    state.preparation.heroes.find((h) => h.heroId === frame.heroId)!.inspiration - before;
}
