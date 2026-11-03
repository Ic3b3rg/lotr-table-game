import { randomUUID } from 'node:crypto';
import type { State } from '../server/state';
import type { ScenarioCommand } from '../shared/protocol';
import type {
  Scenario,
  ScenarioAction,
  ScenarioInstance,
  ScenarioRequest,
  SourceText,
  VariableRef,
} from '../shared/scenario';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';
import { projectionToJourney } from './geometry';
import { validateScenarioBinding, type parseScenarioPack } from './pack';
import { applyScouting } from '../server/scouting';
import { applySkillTest } from '../server/skill-tests';
import { skillTestView } from '../shared/skill-tests';
import { newRound } from '../server/rounds';
import { ApiError } from '../server/errors';

const projection = (state: State) => {
  invariant(state.mapGeneration?.status === 'frozen', 'Realizzazione non disponibile.');
  return state.mapGeneration.projection;
};
const definition = (sc: Scenario, i: ScenarioInstance) =>
  sc.pack.definitions.find((d) => d.source === i.definition)!;
const current = (sc: Scenario, i: ScenarioInstance) =>
  definition(sc, i).states.find((s) => s.index === i.state)!;
const cells = (state: State, tileSource: string) =>
  projection(state)
    .spaces.filter((s) => s.tileSource === tileSource)
    .sort((a, b) => a.index - b.index);
const actionKey = (i: ScenarioInstance, a: number) => `${i.id}:${i.entry}:${a}`;
function variable(sc: Scenario, i: ScenarioInstance, ref: VariableRef) {
  return ref.scope === 'global' ? sc.globals : i.variables;
}
function setValue(
  sc: Scenario,
  i: ScenarioInstance,
  ref: VariableRef,
  value: number | boolean | [number, number, number],
) {
  const store = variable(sc, i, ref);
  invariant(ref.name in store, 'Binding sconosciuto.');
  invariant(typeof store[ref.name] === typeof value, 'Tipo binding cambiato.');
  store[ref.name] = value;
}
function resolveTile(
  state: State,
  i: ScenarioInstance,
  value: Extract<ScenarioAction, { op: 'revealTile' }>['tile'],
) {
  const p = projection(state),
    sc = state.scenario!;
  const hash =
    value.kind === 'start'
      ? p.sections.find((s) => s.id === 0)!.tiles[0]!.hashId
      : value.kind === 'hash'
        ? value.value
        : variable(sc, i, value.ref)[value.ref.name];
  const tile = p.sections.flatMap((s) => s.tiles).find((t) => t.hashId === hash);
  invariant(tile, 'Tile binding non valido.');
  return tile;
}
function enter(sc: Scenario, i: ScenarioInstance, state: number) {
  invariant(
    definition(sc, i).states.some((s) => s.index === state),
    'Stato non compilato.',
  );
  i.state = state;
  i.entry++;
  i.started = [];
  i.completed = [];
  i.settled = false;
}
function send(sc: Scenario, i: ScenarioInstance, event: string) {
  if (i.stopped) return false;
  const target = current(sc, i).transitions[event] ?? definition(sc, i).handlers[event];
  if (target === undefined) return false;
  enter(sc, i, target);
  return true;
}
function broadcast(sc: Scenario, event: string) {
  invariant(
    !sc.instances.some((i) => !i.stopped && definition(sc, i).deferredHandlers[event]),
    'Broadcast richiede un ricevitore non compilato.',
  );
  const receivers = sc.instances.filter(
    (i) => !i.stopped && definition(sc, i).handlers[event] !== undefined,
  );
  sc.events.push({ id: randomUUID(), event, receivers: receivers.map((i) => i.id) });
  for (const i of receivers) send(sc, i, event);
}
function request(state: State, data: Omit<ScenarioRequest, 'id' | 'fingerprint'>) {
  const sc = state.scenario!;
  invariant(!sc.pending, 'Popup concorrente non certificato.');
  const q = { ...data, id: randomUUID() };
  sc.pending = { ...q, fingerprint: digest({ scenarioId: sc.id, ...q }) };
}
function messageRequest(
  state: State,
  i: ScenarioInstance,
  a: Extract<ScenarioAction, { op: 'message' }>,
) {
  const sc = state.scenario!,
    kind =
      a.mode === 'scout'
        ? 'scout'
        : a.mode === 'spirit'
          ? 'test'
          : a.mode === 'tile'
            ? 'placement'
            : a.mode === 'objective'
              ? 'objective'
              : 'message';
  const hero =
    kind === 'scout' || kind === 'test'
      ? state.preparation!.heroes.find(
          (h) =>
            !sc.completedSetup.some(
              (c) => c.kind === kind && c.heroId === h.heroId && c.source === actionKey(i, a.index),
            ),
        )
      : null;
  invariant((kind !== 'scout' && kind !== 'test') || hero, 'Completamenti setup incoerenti.');
  const visible = sc.tiles.filter((t) => t.visible);
  request(state, {
    instanceId: i.id,
    state: i.state,
    entry: i.entry,
    action: a.index,
    kind,
    text: a.text,
    heroId: hero?.heroId ?? null,
    actorPlayerId: hero?.playerId ?? null,
    stage: 'ready',
    tileSource: a.mode === 'tile' ? visible.at(-1)!.source : null,
  });
}
function complete(i: ScenarioInstance, index: number) {
  if (!i.completed.includes(index)) i.completed.push(index);
}
function execute(state: State, i: ScenarioInstance, a: ScenarioAction) {
  const sc = state.scenario!,
    p = projection(state);
  switch (a.op) {
    case 'getStart':
      setValue(sc, i, a.target, p.sections.find((s) => s.id === 0)!.tiles[0]!.hashId);
      break;
    case 'set':
      setValue(sc, i, a.target, structuredClone(a.value));
      break;
    case 'flip': {
      const v = variable(sc, i, a.target)[a.target.name];
      invariant(typeof v === 'boolean', 'BoolFlip richiede bool.');
      setValue(sc, i, a.target, !v);
      break;
    }
    case 'addInt': {
      const v = variable(sc, i, a.target)[a.target.name],
        n =
          a.value.kind === 'literal'
            ? a.value.value
            : variable(sc, i, a.value.ref)[a.value.ref.name];
      invariant(typeof v === 'number' && typeof n === 'number', 'IntAdd richiede int.');
      setValue(sc, i, a.target, (v + n) | 0);
      break;
    }
    case 'getTile':
    case 'getPosition': {
      const space = p.spaces.find((s) => s.id === i.spaceId);
      invariant(space, 'Space non assegnata prima di initialization.');
      const tile = p.sections.flatMap((s) => s.tiles).find((t) => t.source === space.tileSource)!;
      setValue(
        sc,
        i,
        a.target,
        a.op === 'getTile' ? tile.hashId : structuredClone(space.nodePosition),
      );
      break;
    }
    case 'branchBool': {
      const v = variable(sc, i, a.ref)[a.ref.name];
      invariant(typeof v === 'boolean', 'CheckBool richiede bool.');
      invariant(send(sc, i, v ? a.trueEvent : a.falseEvent), 'Ramo non compilato.');
      return;
    }
    case 'broadcast':
      broadcast(sc, a.event);
      break;
    case 'release':
      i.processing = 0;
      break;
    case 'stop':
      i.stopped = true;
      i.settled = true;
      break;
    case 'revealNode':
      i.visible = true;
      break;
    case 'hideNode':
      i.visible = false;
      break;
    case 'threat':
      if (!sc.threats.some((t) => t.source === a.source))
        sc.threats.push({ source: a.source, threshold: a.threshold });
      break;
    case 'objective':
      sc.objective = { id: a.id, text: structuredClone(a.text) };
      break;
    case 'revealTile':
      sc.tiles.find((t) => t.source === resolveTile(state, i, a.tile).source)!.visible = true;
      break;
    case 'highlight': {
      const tile = resolveTile(state, i, a.tile),
        space = cells(state, tile.source).find((s) => s.index === a.spaceIndex);
      invariant(space, 'Indice Spaces fonte assente.');
      const { definition } = projectionToJourney(p, space.id, sc.pack.name);
      invariant(!state.journey, 'Piazzamento eroi ripetuto.');
      state.journey = {
        id: randomUUID(),
        definition,
        travel: null,
        heroes: state.preparation!.heroes.map((h) => ({
          heroId: h.heroId,
          spaceId: definition.startSpaceId,
        })),
      };
      break;
    }
    case 'message':
      messageRequest(state, i, a);
      return;
    case 'explore': {
      const tile = resolveTile(state, i, a.tile),
        view = sc.tiles.find((t) => t.source === tile.source)!;
      invariant(view.visible, 'Esplorazione di tessera nascosta.');
      view.explored = true;
      sc.tasks.push({
        kind: 'explore',
        instanceId: i.id,
        entry: i.entry,
        action: a.index,
        tileSource: tile.source,
        spaceIndex: 0,
        stage: 'pre',
        waiting: null,
      });
      return;
    }
    case 'section':
      sc.tasks.push({
        kind: 'section',
        instanceId: i.id,
        entry: i.entry,
        action: a.index,
        sectionId: a.sectionId,
        tileIndex: 0,
      });
      return;
    default: {
      const unknown: never = a;
      throw new Error(`Azione non supportata: ${String(unknown)}`);
    }
  }
  complete(i, a.index);
}
function runInstance(state: State, i: ScenarioInstance) {
  const sc = state.scenario!;
  let progress = false;
  for (let n = 0; n < 1000; n++) {
    if (i.stopped || i.settled) return progress;
    const s = current(sc, i),
      entry = i.entry;
    for (const a of s.actions) {
      if (i.started.includes(a.index)) continue;
      i.started.push(a.index);
      sc.effects.push({
        id: actionKey(i, a.index),
        instanceId: i.id,
        state: i.state,
        entry: i.entry,
        action: a.index,
        op: a.op,
      });
      execute(state, i, a);
      progress = true;
      if (i.entry !== entry || i.stopped) break;
    }
    if (i.entry !== entry) continue;
    if (i.stopped) return progress;
    if (s.actions.some((a) => !i.completed.includes(a.index))) return progress;
    i.settled = true;
    if (send(sc, i, 'FINISHED')) continue;
    return progress;
  }
  throw new Error('Limite transizioni startup superato.');
}
function advanceTask(state: State) {
  const sc = state.scenario!,
    task = sc.tasks.at(-1);
  if (!task) return false;
  const owner = sc.instances.find((i) => i.id === task.instanceId)!;
  invariant(owner.entry === task.entry, 'Continuazione fonte scaduta.');
  if (task.kind === 'section') {
    const tiles = projection(state).sections.find((s) => s.id === task.sectionId)!.tiles;
    while (task.tileIndex < tiles.length) {
      const tile = tiles[task.tileIndex]!,
        view = sc.tiles.find((t) => t.source === tile.source)!;
      if (view.visible) {
        task.tileIndex++;
        continue;
      }
      view.visible = true;
      const action = current(sc, owner).actions.find((a) => a.index === task.action)!;
      invariant(action.op === 'section', 'Continuazione sezione non valida.');
      const text: SourceText = action.text.map((t) =>
        t.kind === 'text' ? { ...t, text: t.text.replaceAll('{tile}', tile.code) } : t,
      );
      request(state, {
        instanceId: owner.id,
        state: owner.state,
        entry: owner.entry,
        action: task.action,
        kind: 'placement',
        text,
        heroId: null,
        actorPlayerId: null,
        stage: 'ready',
        tileSource: tile.source,
      });
      return true;
    }
  } else {
    const spaces = cells(state, task.tileSource);
    while (task.spaceIndex < spaces.length) {
      const node = sc.instances.find(
        (i) => i.kind === 'encounter' && i.spaceId === spaces[task.spaceIndex]!.id,
      );
      if (!node) {
        task.spaceIndex++;
        task.stage = 'pre';
        continue;
      }
      if (task.waiting) {
        if (!node.stopped && node.processing !== 0) return false;
        task.waiting = null;
      }
      if (task.stage === 'next') {
        task.spaceIndex++;
        task.stage = 'pre';
        continue;
      }
      const event = task.stage === 'pre' ? 'PRE_REVEAL' : 'REVEALED';
      task.stage = task.stage === 'pre' ? 'revealed' : 'next';
      if (!node.stopped && definition(sc, node).handlers[event] !== undefined) {
        node.processing = 1;
        if (event === 'REVEALED') node.visible = true;
        sc.events.push({ id: randomUUID(), event, receivers: [node.id] });
        send(sc, node, event);
        task.waiting = node.id;
        return true;
      }
    }
  }
  complete(owner, task.action);
  sc.tasks.pop();
  return true;
}
function pump(state: State) {
  const sc = state.scenario!;
  for (let n = 0; n < 2000; n++) {
    let progress = false;
    for (const i of sc.instances) progress = runInstance(state, i) || progress;
    if (sc.pending) return;
    if (advanceTask(state)) continue;
    const principal = sc.instances.find((i) => i.kind === 'principal')!;
    if (!sc.tasks.length && principal.processing === 0) {
      invariant(sc.objective?.id === 0, 'Setup rilasciato senza obiettivo0.');
      request(state, {
        instanceId: principal.id,
        state: principal.state,
        entry: principal.entry,
        action: -1,
        kind: 'handoff',
        text: [
          {
            kind: 'text',
            text: 'L’avvio è completo. Inizia la Fase di Azione e scegli il primo eroe di turno.',
            style: 'plain',
          },
        ],
        heroId: null,
        actorPlayerId: null,
        stage: 'ready',
        tileSource: null,
      });
      return;
    }
    if (!progress) throw new Error('Startup fermo senza richiesta completabile.');
  }
  throw new Error('Limite executor startup superato.');
}
export function beginScenario(state: State, parsed: ReturnType<typeof parseScenarioPack>) {
  const p = projection(state);
  validateScenarioBinding(parsed.pack, p);
  const start = p.sections.find((s) => s.id === 0)!.tiles[0]!,
    space = cells(state, start.source).find((s) => s.index === 1);
  invariant(space, 'Start Spaces[1] assente.');
  const { bindings } = projectionToJourney(p, space.id, parsed.pack.name);
  const sc: Scenario = {
    id: randomUUID(),
    pack: structuredClone(parsed.pack),
    packFingerprint: parsed.fingerprint,
    projectionFingerprint: p.fingerprint,
    phase: 'setup',
    globals: Object.fromEntries(parsed.pack.globals.map((v) => [v.name, structuredClone(v.value)])),
    instances: [],
    tiles: p.sections
      .flatMap((s) => s.tiles)
      .map((t) => ({ source: t.source, visible: false, explored: false })),
    spaceBindings: bindings,
    tasks: [],
    pending: null,
    objective: null,
    threats: [],
    completedSetup: [],
    effects: [],
    events: [],
    commands: [],
    handoffCount: 0,
  };
  state.scenario = sc;
  const add = (
    id: string,
    kind: ScenarioInstance['kind'],
    source: string,
    prefab: string | null = null,
    spaceId: string | null = null,
  ) => {
    const d = sc.pack.definitions.find((d) => d.source === source)!;
    const i: ScenarioInstance = {
      id,
      kind,
      definition: source,
      prefab,
      spaceId,
      state: d.initial,
      entry: 0,
      started: [],
      completed: [],
      settled: false,
      processing: 0,
      stopped: false,
      visible: false,
      variables: Object.fromEntries(d.variables.map((v) => [v.name, structuredClone(v.value)])),
    };
    sc.instances.push(i);
    runInstance(state, i);
    invariant(
      !sc.pending && !sc.tasks.length,
      'Initialization richiede una capacità non certificata.',
    );
    return i;
  };
  const principal = add('principal', 'principal', sc.pack.principal);
  sc.pack.timers.forEach((t, n) => add(`timer-${n}`, 'timer', t));
  for (const spaceId of p.spawnOrder) {
    const a = p.assignments.find((a) => a.spaceId === spaceId)!,
      m = sc.pack.manifest.prefabs.find((m) => m.source === a.prefab.source)!;
    add(`node:${spaceId}`, 'encounter', m.fsmSource, a.prefab.source, spaceId);
  }
  principal.processing = 1;
  invariant(send(sc, principal, 'SCENARIO_BEGIN'), 'SCENARIO_BEGIN non compilato.');
  pump(state);
}
function renewed(state: State, q: ScenarioRequest, stage: 'ready' | 'revealed') {
  state.scenario!.pending = null;
  const { id, fingerprint, ...data } = q;
  request(state, { ...data, stage });
}
export function resumeScenario(
  state: State,
  playerId: string,
  command: Extract<ScenarioCommand, { type: 'SCENARIO_INPUT' }>,
) {
  const sc = state.scenario,
    q = sc?.pending;
  if (
    !sc ||
    sc.phase !== 'setup' ||
    sc.id !== command.scenarioId ||
    sc.packFingerprint !== command.packFingerprint ||
    sc.projectionFingerprint !== command.projectionFingerprint ||
    !q ||
    q.id !== command.pendingId ||
    q.fingerprint !== command.sourceFingerprint ||
    q.heroId !== command.heroId
  )
    throw new ApiError(
      409,
      'SCENARIO_REQUEST_CHANGED',
      'Questa richiesta fonte è conclusa o è cambiata.',
    );
  if (q.actorPlayerId && q.actorPlayerId !== playerId)
    throw new ApiError(
      403,
      'SCENARIO_ACTOR',
      'Questa richiesta spetta al giocatore che controlla l’eroe indicato.',
    );
  const i = sc.instances.find((i) => i.id === q.instanceId)!;
  const input = command.input,
    base = {
      requestId: command.requestId,
      generation: command.generation,
      expectedRevision: command.expectedRevision,
    };
  const wrong = () =>
    new ApiError(
      409,
      'SCENARIO_INPUT_REQUIRED',
      'Completa l’operazione richiesta dall’avventura; non basta una conferma.',
    );
  if (q.kind === 'scout' || q.kind === 'test') {
    const hero = state.preparation!.heroes.find((h) => h.heroId === q.heroId)!;
    if (q.kind === 'scout') {
      if (q.stage === 'ready') {
        if (input.kind !== 'scout-reveal') throw wrong();
        applyScouting(state, playerId, {
          ...base,
          type: 'START_SCOUT',
          heroId: hero.heroId,
          count: 2,
        });
        renewed(state, q, 'revealed');
        return;
      }
      if (input.kind !== 'scout-resolve') throw wrong();
      const scout = state.scout!;
      const { kind, ...choices } = input;
      applyScouting(state, playerId, {
        ...base,
        type: 'RESOLVE_SCOUT',
        scoutId: scout.id,
        ...choices,
      });
      sc.completedSetup.push({
        kind: 'scout',
        heroId: hero.heroId,
        source: actionKey(i, q.action),
        requestId: q.id,
        serviceId: scout.id,
        revealed: [...scout.revealed],
        converted: 0,
        outcome: null,
        reward: 0,
      });
    } else {
      if (q.stage === 'ready') {
        if (input.kind !== 'test-reveal') throw wrong();
        applySkillTest(state, playerId, {
          ...base,
          type: 'START_SKILL_TEST',
          heroId: hero.heroId,
          stat: 'spirit',
          modifier: 0,
          target: 1,
        });
        renewed(state, q, 'revealed');
        return;
      }
      if (input.kind === 'convert') {
        applySkillTest(state, playerId, {
          ...base,
          type: 'CONVERT_FATE',
          testId: state.skillTest!.id,
        });
        renewed(state, q, 'revealed');
        return;
      }
      if (input.kind !== 'test-resolve') throw wrong();
      applySkillTest(state, playerId, {
        ...base,
        type: 'RESOLVE_SKILL_TEST',
        testId: state.skillTest!.id,
      });
      const view = skillTestView(state.content, state.skillTest)!,
        limit = state.content!.heroes.find((h) => h.id === hero.heroId)!.stats.inspiration;
      const reward = view.outcome === 'pass' && hero.inspiration < limit ? 1 : 0;
      hero.inspiration += reward;
      sc.completedSetup.push({
        kind: 'test',
        heroId: hero.heroId,
        source: actionKey(i, q.action),
        requestId: q.id,
        serviceId: view.id,
        revealed: [...view.revealed],
        converted: view.converted,
        outcome: view.outcome === 'pass' ? 'pass' : 'fail',
        reward,
      });
    }
    sc.pending = null;
    if (
      state.preparation!.heroes.some(
        (h) =>
          !sc.completedSetup.some(
            (c) =>
              c.kind === q.kind && c.heroId === h.heroId && c.source === actionKey(i, q.action),
          ),
      )
    ) {
      const a = current(sc, i).actions.find((a) => a.index === q.action)!;
      invariant(a.op === 'message', 'Setup senza messaggio fonte.');
      messageRequest(state, i, a);
      return;
    }
    complete(i, q.action);
  } else {
    if (input.kind !== 'ack') throw wrong();
    sc.pending = null;
    if (q.kind === 'handoff') {
      invariant(
        sc.handoffCount === 0 && !state.round && state.journey,
        'Handoff duplicato o mappa assente.',
      );
      state.round = newRound(state, 1);
      sc.phase = 'action';
      sc.handoffCount = 1;
      return;
    }
    const task = sc.tasks.at(-1);
    if (task?.kind === 'section' && task.instanceId === i.id && task.action === q.action)
      task.tileIndex++;
    else complete(i, q.action);
  }
  pump(state);
}
