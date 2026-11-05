import { HANDOFF_TEXT } from '../shared/scenario';
import {
  applyConclusionAction,
  beginSourceVictory,
  advanceConclusion,
  answerCampaign,
} from './conclusion';
import { playableScenarioPrefab } from '../shared/clues';
import { encounterEntry, encounterOptions } from '../shared/encounter-entry';
import { linkedDefinition } from './linked-capability';
import { validateScenarioTitle } from '../physical-resolution/scenario-title';
import { objectiveText } from './objective';
import { prepareExploration, rewardExploration, type ExplorationCommand } from './exploration';
import { preparedReward, requirePreparedCapability } from './prepared-effects';
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
import { physicalTitleSkills } from '../physical-resolution/title-skills';
import { newRound } from '../server/rounds';
import { ApiError } from '../server/errors';
import { cycleUUID } from '../physical-resolution/cycle-request';
import {
  beginEncounterPhysical,
  openSourcePhysical,
  spawnPhysicalProgram,
  encounterProgram,
} from './encounter-physical';
import { validatePhysicalProgram } from '../physical-resolution/program';
import { defeatedHeroes } from '../server/physical-defeat';
import { comparisonSort } from '../map-generation/comparison-sort';
import { materializeDeployment, deploymentText } from './deployment';
import type { Command } from '../shared/protocol';
import { persistentEffects } from '../physical-resolution/effects';
import {
  initializeScenarioPhysical,
  beginPhysicalAction,
  physicalRequestData,
  answerScenarioPhysical,
  type loadPhysicalSource,
} from './physical';

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
  value: string | number | boolean | [number, number, number],
) {
  const store = variable(sc, i, ref);
  invariant(ref.name in store, 'Binding sconosciuto.');
  invariant(typeof store[ref.name] === typeof value, 'Tipo binding cambiato.');
  store[ref.name] = value;
}
function integerValue(
  sc: Scenario,
  i: ScenarioInstance,
  value: Extract<ScenarioAction, { op: 'addInt' }>['value'],
) {
  const n = value.kind === 'literal' ? value.value : variable(sc, i, value.ref)[value.ref.name];
  invariant(typeof n === 'number' && Number.isInteger(n), 'Binding intero non numerico.');
  return n;
}
function challengeResult(
  sc: Scenario,
  i: ScenarioInstance,
  a: Extract<ScenarioAction, { op: 'challenge' }>,
  successes: number,
) {
  const prior = 'scope' in a.sum ? variable(sc, i, a.sum)[a.sum.name] : a.sum.value;
  invariant(typeof prior === 'number', 'Somma non numerica.');
  const total = Math.min(99, Math.max(0, prior + successes));
  if ('scope' in a.sum) setValue(sc, i, a.sum, total);
  const event = (
    a.bounds.find(
      (b) =>
        (typeof b.maximum === 'number'
          ? b.maximum
          : (variable(sc, i, b.maximum)[b.maximum.name] as number)) >= total,
    ) ?? a.bounds.at(-1)!
  ).event;
  return { total, event };
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
  const state = current(sc, i),
    d = definition(sc, i);
  const target = state.transitions[event] ?? d.handlers[event];
  const capability =
    state.deferredTransitions?.[event] ??
    (target === undefined ? d.deferredHandlers[event] : undefined);
  if (capability)
    throw new ApiError(
      409,
      'ROUND_SOURCE_CAPABILITY',
      'Questo seguito dell’avventura non è ancora disponibile. I progressi sono salvati.',
    );
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
  sc.events.push({ id: eventId(sc, event), event, receivers: receivers.map((i) => i.id) });
  for (const i of receivers) send(sc, i, event);
}
function eventId(sc: Scenario, event: string) {
  return sc.phase === 'action'
    ? cycleUUID({ scenario: sc.id, ordinal: sc.events.length, event })
    : randomUUID();
}
function request(state: State, data: Omit<ScenarioRequest, 'id' | 'fingerprint'>) {
  const sc = state.scenario!;
  invariant(!sc.pending, 'Popup concorrente non certificato.');
  const q = {
    ...data,
    id:
      sc.phase === 'action'
        ? cycleUUID({
            scenario: sc.id,
            data,
            command: sc.commands.length,
            active: state.physical?.snapshot.active,
          })
        : randomUUID(),
  };
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
  const explorer = sc.conclusion
    ? undefined
    : sc.explorations?.attempts.find((a) => a.id === sc.explorations?.active);
  request(state, {
    instanceId: i.id,
    state: i.state,
    entry: i.entry,
    action: a.index,
    kind,
    text: a.text,
    heroId: hero?.heroId ?? explorer?.heroId ?? null,
    actorPlayerId: hero?.playerId ?? explorer?.playerId ?? null,
    stage: 'ready',
    tileSource: a.mode === 'tile' ? visible.at(-1)!.source : null,
  });
}
function logMessage(sc: Scenario, i: ScenarioInstance, index: number) {
  const a = current(sc, i).actions.find((a) => a.index === index)!;
  if (a.op === 'message' && !a.ignoreLog) {
    const id = actionKey(i, index);
    invariant(!sc.messageLog.some((m) => m.id === id), 'Callback messaggio duplicato.');
    sc.messageLog.push({ id, text: structuredClone(a.text) });
  }
}
function complete(i: ScenarioInstance, index: number) {
  if (!i.completed.includes(index)) i.completed.push(index);
}
type SourceProbe = {
  path: number[];
  cursor: number;
  supply: { damage: number; fear: number };
};
class SourceFork extends Error {
  constructor(readonly count: number) {
    super('Source continuation branches');
  }
}
function probeChoice(probe: SourceProbe, count: number) {
  const result = probe.path[probe.cursor++];
  if (result === undefined) throw new SourceFork(count);
  invariant(result < count, 'Ramo di verifica estraneo alla fonte.');
  return result;
}
/** Traverse the real consumer on disposable mutable state, replacing only physical outcomes
 * and nonbranching deployment. No cards, random draws or source opcodes are executed elsewhere. */
function preflightContinuation(state: State, start: (work: State, probe: SourceProbe) => void) {
  const paths: number[][] = [[]];
  let runs = 0;
  while (paths.length) {
    invariant(++runs <= 10000, 'Budget verifica della continuazione superato.');
    const sc = state.scenario!,
      work: State = {
        ...state,
        scenario: { ...structuredClone({ ...sc, pack: undefined }), pack: sc.pack },
        preparation: structuredClone(state.preparation),
        round: structuredClone(state.round),
        journey: structuredClone(state.journey),
      },
      probe: SourceProbe = {
        path: paths.pop()!,
        cursor: 0,
        supply: {
          damage: state.physical?.snapshot.decks.damage.length ?? 0,
          fear: state.physical?.snapshot.decks.fear.length ?? 0,
        },
      };
    try {
      start(work, probe);
      if (work.scenario!.pack.manifest.lair) advanceConclusion(work);
      for (let n = 0; work.scenario!.pending; n++) {
        invariant(n < 2000, 'Continuazione fonte ciclica.');
        const s = work.scenario!,
          q = s.pending!;
        if (s.conclusion?.stage === 'camp') break;
        invariant(
          [
            'message',
            'objective',
            'placement',
            'exploration-markers',
            'exploration-intro',
            'exploration-outro',
            'choice',
            'hero-choice',
            'campaign-map',
            'campaign-story',
          ].includes(q.kind),
          'Richiesta fuori dalla closure degli indizi.',
        );
        const input =
          q.kind === 'hero-choice'
            ? {
                kind: 'choose-hero' as const,
                heroId:
                  work.preparation!.heroes[probeChoice(probe, work.preparation!.heroes.length)]!
                    .heroId,
              }
            : q.kind === 'choice'
              ? {
                  kind: 'choice' as const,
                  event: q.options![probeChoice(probe, q.options!.length)]!.event,
                }
              : { kind: 'ack' as const };
        const command: Extract<ScenarioCommand, { type: 'SCENARIO_INPUT' }> = {
          type: 'SCENARIO_INPUT',
          requestId: 'preflight-source-continuation-only',
          generation: work.generation,
          expectedRevision: work.revision,
          scenarioId: s.id,
          packFingerprint: s.packFingerprint,
          projectionFingerprint: s.projectionFingerprint,
          pendingId: q.id,
          sourceFingerprint: q.fingerprint,
          heroId: q.heroId,
          input,
        };
        if (s.conclusion && s.conclusion.stage !== 'conclusion')
          answerCampaign(work, q.actorPlayerId ?? work.players[0]!.id, command);
        else
          resumeScenario(work, q.actorPlayerId ?? work.players[0]!.id, command, undefined, probe);
        if (s.pack.manifest.lair) advanceConclusion(work);
      }
      invariant(
        !work.scenario!.tasks.length &&
          work.scenario!.instances.every((i) => i.stopped || i.settled),
        'Continuazione senza ritorno fonte.',
      );
    } catch (error) {
      if (error instanceof SourceFork) {
        for (let n = error.count - 1; n >= 0; n--) paths.push([...probe.path, n]);
      } else if (error instanceof ApiError) throw error;
      else
        throw new ApiError(
          409,
          'SCENARIO_CONTINUATION_CAPABILITY',
          'Il seguito obbligatorio di questa interazione o esplorazione richiede effetti ancora in sviluppo. Nessun costo, movimento o carta è stato applicato.',
        );
    }
  }
}
function execute(
  state: State,
  i: ScenarioInstance,
  a: ScenarioAction,
  probe?: SourceProbe,
  requestId?: string,
) {
  const sc = state.scenario!,
    p = projection(state);
  if (
    probe &&
    ((a.op === 'confirm' && i.kind !== 'exploration') ||
      (a.op === 'choice' &&
        sc.play?.attempts.find((a) => a.id === sc.play!.active)?.entryChoice?.state === i.state) ||
      a.op === 'sourceTest' ||
      a.op === 'challenge' ||
      (a.op === 'message' && (a.consequence || a.inspiration)))
  ) {
    invariant(
      state.physical?.version === 3 && state.physical.fronts && state.physical.lastStand,
      'Closure fisica non posseduta.',
    );
    validatePhysicalProgram(encounterProgram(state, a), state.physical.heroes.length);
    if (a.op === 'message' && a.consequence) {
      const { family, amount } = a.consequence;
      if (probe.supply[family] < amount)
        throw new ApiError(
          409,
          'SCENARIO_PHYSICAL_DECK_EMPTY',
          'Il mazzo necessario non ha carte sufficienti per il seguito obbligatorio. Nessun costo o pesca è stato applicato.',
        );
      // Reserve the full printed consequence on this path. No draw, prevention
      // choice or hypothetical return may supply a later mandatory message.
      probe.supply[family] -= amount;
    }
    if (a.op === 'message' && a.inspiration) {
      messageRequest(state, i, a);
      return;
    }
    complete(i, a.index);
    if (a.op === 'confirm') invariant(send(sc, i, a.confirmEvent), 'Conferma senza seguito fonte.');
    else if (a.op === 'choice')
      invariant(
        send(sc, i, sc.play!.attempts.find((a) => a.id === sc.play!.active)!.entryChoice!.event),
        'Impegno senza seguito fonte.',
      );
    else if (a.op === 'challenge' || a.op === 'sourceTest') {
      const successes = probeChoice(probe, 100),
        event =
          a.op === 'challenge'
            ? challengeResult(sc, i, a, successes).event
            : successes >= a.target
              ? a.passEvent
              : a.failEvent;
      invariant(send(sc, i, event), 'Prova senza ramo fonte.');
    } else logMessage(sc, i, a.index);
    return;
  }
  if (probe && a.op === 'spawnRandom') {
    invariant(sc.pack.manifest.followup && sc.enemies, 'Spawn senza capacità congelata.');
    complete(i, a.index);
    return;
  }
  switch (a.op) {
    case 'chooseHero': {
      const actor = sc.play!.attempts.find((a) => a.id === sc.play!.active)!;
      invariant(actor, 'Destinatario senza attore del tentativo.');
      request(state, {
        instanceId: i.id,
        state: i.state,
        entry: i.entry,
        action: a.index,
        kind: 'hero-choice',
        text: a.text,
        options: state.preparation!.heroes.map((h) => ({
          event: h.heroId,
          label: [
            {
              kind: 'text',
              style: 'plain',
              text: state.content!.heroes.find((d) => d.id === h.heroId)!.name.text,
            },
          ],
        })),
        heroId: actor.heroId,
        actorPlayerId: actor.playerId,
        stage: 'ready',
        tileSource: null,
      });
      return;
    }
    case 'awardTitle':
      invariant(
        sc.pack.manifest.linked && state.physical?.lastStand,
        'Titolo senza capacità fonte e fisica.',
      );
      validateScenarioTitle(state.physical.raw, sc.pack.manifest.linked.title);
      if (!probe) {
        beginEncounterPhysical(state, sc.effects.find((e) => e.id === actionKey(i, a.index))!, a);
        return;
      }
      break;
    case 'endGame':
      invariant(requestId, 'Segnale del covo senza comando fonte.');
      beginSourceVictory(state, i.id, actionKey(i, a.index), requestId);
      break;
    case 'confirm':
      if (i.kind === 'exploration') {
        complete(i, a.index);
        invariant(send(sc, i, a.confirmEvent), 'Conferma esplorazione senza seguito fonte.');
        return;
      }
      beginEncounterPhysical(state, sc.effects.find((e) => e.id === actionKey(i, a.index))!, a);
      return;
    case 'sourceTest':
    case 'challenge':
      beginEncounterPhysical(state, sc.effects.find((e) => e.id === actionKey(i, a.index))!, a);
      return;
    case 'choice': {
      const actor = sc.play!.attempts.find((a) => a.id === sc.play!.active)!;
      invariant(actor, 'Scelta senza padre incontro.');
      if (actor.entryChoice?.state === i.state && actor.entryChoice.action === a.index) {
        if (probe) {
          complete(i, a.index);
          invariant(send(sc, i, actor.entryChoice.event), 'Impegno senza seguito fonte.');
        } else
          beginEncounterPhysical(state, sc.effects.find((e) => e.id === actionKey(i, a.index))!, a);
        return;
      }
      request(state, {
        instanceId: i.id,
        state: i.state,
        entry: i.entry,
        action: a.index,
        kind: 'choice',
        text: a.text,
        options: [...encounterOptions(a, i, sc.globals), ...(a.cancel ? [a.cancel] : [])].map(
          ({ event, label }) => ({ event, label }),
        ),
        heroId: actor.heroId,
        actorPlayerId: actor.playerId,
        stage: 'ready',
        tileSource: null,
      });
      return;
    }
    case 'nullProduct':
      invariant(send(sc, i, a.falseEvent), 'Guardia nulla senza ramo fonte.');
      return;
    case 'lore':
      invariant(sc.play && sc.phase === 'action', 'Premio fuori incontro.');
      sc.play.lore += a.amount;
      break;
    case 'awardXP':
    case 'nextAdventure':
    case 'proceed':
      applyConclusionAction(state, a, actionKey(i, a.index));
      break;
    case 'physical':
      beginPhysicalAction(state, sc.effects.find((e) => e.id === actionKey(i, a.index))!, a);
      return;
    case 'getStart':
      setValue(sc, i, a.target, p.sections.find((s) => s.id === 0)!.tiles[0]!.hashId);
      break;
    case 'set':
      setValue(sc, i, a.target, structuredClone(a.value));
      break;
    case 'copyInt':
      setValue(sc, i, a.target, integerValue(sc, i, a.value));
      break;
    case 'switchInt': {
      const value = integerValue(sc, i, a.value),
        match = a.cases.find((c) => integerValue(sc, i, c.equals) === value);
      if (match) {
        invariant(send(sc, i, match.event), 'Uguaglianza senza ramo fonte.');
        return;
      }
      break;
    }
    case 'isExplored': {
      const tile = resolveTile(state, i, a.tile),
        marker = sc.explorationMarkers?.find((m) => m.tileSource === tile.source);
      invariant(
        send(
          sc,
          i,
          (
            linkedDefinition(sc.pack, i.definition)
              ? sc.tiles.some((t) => t.source === tile.source && t.visible && t.explored)
              : !marker || !marker.visible
          )
            ? a.trueEvent
            : a.falseEvent,
        ),
        'Esplorazione senza ramo fonte.',
      );
      return;
    }
    case 'focus':
      for (const ref of a.positions)
        invariant(Array.isArray(variable(sc, i, ref)[ref.name]), 'Posizione fonte non legata.');
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
      const floor = sc.pack.manifest.linked?.threat;
      const next = (v + n) | 0;
      setValue(
        sc,
        i,
        a.target,
        floor &&
          floor.definition === i.definition &&
          floor.state === i.state &&
          floor.action === a.index
          ? Math.max(0, next)
          : next,
      );
      break;
    }
    case 'subtractInt':
    case 'multiplyInt':
    case 'compareInt': {
      const value = (v: typeof a.left) =>
        v.kind === 'literal' ? v.value : variable(sc, i, v.ref)[v.ref.name];
      const left = value(a.left),
        right = value(a.right);
      invariant(
        typeof left === 'number' && typeof right === 'number',
        'Operatore intero con binding non numerico.',
      );
      if (a.op === 'subtractInt') setValue(sc, i, a.target, (left - right) | 0);
      else if (a.op === 'multiplyInt') setValue(sc, i, a.target, Math.imul(left, right));
      else {
        invariant(
          send(sc, i, left === right ? a.equalEvent : left < right ? a.lessEvent : a.greaterEvent),
          'Ramo intero non compilato.',
        );
        return;
      }
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
    case 'send': {
      const receiver = sc.instances.find((r) => r.definition === a.definition);
      invariant(receiver, 'Receiver indirizzato non inizializzato.');
      sc.events.push({ id: eventId(sc, a.event), event: a.event, receivers: [receiver.id] });
      invariant(send(sc, receiver, a.event), 'Callback indirizzato senza seguito fonte.');
      break;
    }
    case 'spawnRandom':
      invariant(sc.pack.manifest.followup && sc.enemies, 'Spawn senza capacità congelata.');
      sc.tasks.push({
        kind: 'spawnRandom',
        instanceId: i.id,
        entry: i.entry,
        action: a.index,
        stage: 'intro',
        groupIndex: 0,
        effectId: actionKey(i, a.index),
      });
      return;
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
      sc.objective = { id: a.id, text: objectiveText(a, (ref) => variable(sc, i, ref)[ref.name]) };
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
        id: sc.id,
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
      if (a.consequence || a.inspiration) {
        beginEncounterPhysical(state, sc.effects.find((e) => e.id === actionKey(i, a.index))!, a);
        return;
      }
      messageRequest(state, i, a);
      return;
    case 'explore': {
      const tile = resolveTile(state, i, a.tile),
        view = sc.tiles.find((t) => t.source === tile.source)!;
      invariant(view.visible, 'Esplorazione di tessera nascosta.');
      view.explored = true;
      sc.explorationMarkers
        ?.filter((m) => m.tileSource === tile.source)
        .forEach((m) => {
          m.visible = false;
        });
      const ordinary = i.kind === 'exploration';
      const presented = ordinary || !!a.intro;
      if (ordinary) i.visible = false;
      const adjacent: number[] = [];
      if (presented && !a.skipAdjacentSectionEvent)
        for (const s of cells(state, tile.source))
          for (const id of s.connected) {
            const section = p.spaces.find((s) => s.id === id)!.sectionId;
            if (section !== s.sectionId && !adjacent.includes(section)) adjacent.push(section);
          }
      sc.tasks.push({
        kind: 'explore',
        instanceId: i.id,
        entry: i.entry,
        action: a.index,
        tileSource: tile.source,
        spaceIndex: 0,
        stage: presented && !a.skipIntro ? 'intro' : 'pre',
        waiting: null,
        ...(presented ? { adjacent, adjacentIndex: 0 } : {}),
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
        ...(sc.pack.manifest.followup
          ? {
              remaining: p.sections
                .find((s) => s.id === a.sectionId)!
                .tiles.filter((t) => !sc.tiles.find((v) => v.source === t.source)!.visible)
                .map((t) => t.source),
              order: [],
              markers: 'unrevealed' as const,
            }
          : {}),
      });
      return;
    default: {
      const unknown: never = a;
      throw new Error(`Azione non supportata: ${String(unknown)}`);
    }
  }
  complete(i, a.index);
}
function runInstance(
  state: State,
  i: ScenarioInstance,
  synchronous = false,
  probe?: SourceProbe,
  requestId?: string,
) {
  const sc = state.scenario!;
  let progress = false;
  for (let n = 0; n < 1000; n++) {
    if (i.stopped || i.settled) return progress;
    const s = current(sc, i),
      entry = i.entry;
    for (const a of s.actions) {
      if (i.started.includes(a.index)) continue;
      if (
        synchronous &&
        ![
          'set',
          'copyInt',
          'switchInt',
          'isExplored',
          'focus',
          'flip',
          'addInt',
          'subtractInt',
          'compareInt',
          'branchBool',
          'broadcast',
          'release',
          'stop',
          'revealNode',
          'hideNode',
        ].includes(a.op)
      )
        throw new ApiError(
          409,
          'ROUND_SOURCE_CAPABILITY',
          'Questo evento della fase richiede un consumer fonte ulteriore. Nessun avanzamento è stato applicato.',
        );
      const attempt = sc.play?.attempts.find(
        (a) => a.id === sc.play?.active && a.instanceId === i.id,
      );
      if (
        attempt &&
        ['confirm', 'sourceTest', 'challenge', 'choice'].includes(a.op) &&
        defeatedHeroes(state).includes(attempt.heroId)
      ) {
        // Resolve the completed parent's callback and immediate source effects first.
        // A defeated figure cannot begin the next test or make a new hero choice.
        const d = definition(sc, i),
          waits = d.states.filter((s) => s.transitions['NODE CLICKED'] !== undefined),
          wait = d.handlers['NODE CLICKED'] !== undefined ? d.initial : waits[0]?.index;
        invariant(
          wait !== undefined && (d.handlers['NODE CLICKED'] !== undefined || waits.length === 1),
          'Incontro interrotto senza attesa fonte univoca.',
        );
        attempt.interrupted = 'hero-defeated';
        enter(sc, i, wait);
        progress = true;
        break;
      }
      i.started.push(a.index);
      sc.effects.push({
        id: actionKey(i, a.index),
        instanceId: i.id,
        state: i.state,
        entry: i.entry,
        action: a.index,
        op: a.op,
      });
      execute(state, i, a, probe, requestId);
      progress = true;
      if (i.entry !== entry || (i.stopped && !linkedDefinition(sc.pack, i.definition))) break;
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

/** Source controller dispatch: timers then principal at round end; principal at round start. */
export function processRoundEvent(state: State, event: string, end: boolean) {
  const sc = state.scenario!;
  const targets = end
    ? [
        ...sc.instances.filter((i) => i.kind === 'timer'),
        ...sc.instances.filter((i) => i.kind === 'principal'),
      ]
    : sc.instances.filter((i) => i.kind === 'principal');
  for (const i of targets) {
    const d = definition(sc, i),
      cursor = current(sc, i);
    if (i.stopped) continue;
    if (
      cursor.deferredTransitions?.[event] ||
      (cursor.transitions[event] === undefined && d.deferredHandlers[event])
    )
      throw new ApiError(
        409,
        'ROUND_SOURCE_CAPABILITY',
        'Un ricevitore della fase non è ancora disponibile. Nessun avanzamento è stato applicato.',
      );
    if (cursor.transitions[event] === undefined && d.handlers[event] === undefined) continue;
    i.processing = 1;
    sc.events.push({ id: eventId(sc, event), event, receivers: [i.id] });
    invariant(send(sc, i, event), 'Evento della fase senza handler.');
    for (let n = 0; n < 1000; n++) {
      let progress = false;
      for (const receiver of sc.instances)
        progress = runInstance(state, receiver, true) || progress;
      if (!progress) break;
      invariant(n < 999, 'Receiver della fase ciclico.');
    }
    invariant(
      !i.processing &&
        !sc.pending &&
        !sc.tasks.length &&
        sc.instances.every((i) => i.stopped || i.settled),
      'Evento della fase senza completamento sincrono.',
    );
  }
}
/** Starts one source-owned phase dispatch; pending dialogs retain the caller's frame. */
export function startPhaseEvent(state: State, id: string, event: string, processing: boolean) {
  const sc = state.scenario!,
    i = sc.instances.find((i) => i.id === id);
  invariant(i, 'Receiver della fase non inizializzato.');
  const d = definition(sc, i),
    cursor = current(sc, i);
  if (i.stopped) return false;
  if (
    cursor.deferredTransitions?.[event] ||
    (cursor.transitions[event] === undefined && d.deferredHandlers[event])
  )
    throw new ApiError(
      409,
      'ROUND_SOURCE_CAPABILITY',
      'Un seguito dell’avventura non è ancora disponibile. Nessun avanzamento è stato applicato.',
    );
  if (cursor.transitions[event] === undefined && d.handlers[event] === undefined) return false;
  if (processing) i.processing = 1;
  sc.events.push({ id: eventId(sc, event), event, receivers: [i.id] });
  invariant(send(sc, i, event), 'Evento senza ingresso fonte.');
  pump(state);
  return true;
}
export function pumpPhaseEvent(state: State) {
  pump(state);
}
function advanceTask(state: State) {
  const sc = state.scenario!,
    task = sc.tasks.at(-1);
  if (!task) return false;
  const owner = sc.instances.find((i) => i.id === task.instanceId)!;
  invariant(owner.entry === task.entry, 'Continuazione fonte scaduta.');
  if (task.kind === 'spawnRandom') {
    const a = current(sc, owner).actions.find((a) => a.index === task.action)!;
    invariant(a.op === 'spawnRandom', 'Spawn senza istruzione fonte.');
    if (task.stage === 'intro' && (a.trial || a.suffering)) {
      const effect = sc.effects.find((e) => e.id === task.effectId)!;
      task.parentId ??= openSourcePhysical(state, effect, a, spawnPhysicalProgram(state, a));
      const parent = state.physical!.snapshot.parents.find((p) => p.id === task.parentId)!;
      if (parent.status !== 'completed') {
        const active = state.physical!.snapshot.active;
        invariant(active?.runId === task.parentId, 'Prova della soglia senza figlio.');
        request(state, physicalRequestData(state, effect, active));
        return true;
      }
      sc.messageLog.push({ id: `${task.effectId}:intro`, text: structuredClone(a.text) });
      materializeDeployment(state, owner, a, task.effectId);
      task.stage = 'placements';
    }
    const attempt = sc.enemies!.attempts.find((p) => p.effectId === task.effectId);
    const group = attempt?.groups[task.groupIndex];
    if (task.stage === 'intro' || group) {
      if (group) sc.enemies!.groups.find((g) => g.id === group)!.placed = true;
      request(state, {
        instanceId: owner.id,
        state: owner.state,
        entry: owner.entry,
        action: a.index,
        kind: task.stage === 'intro' ? 'deployment-intro' : 'deployment',
        text: task.stage === 'intro' ? a.text : deploymentText(state, group!),
        heroId: null,
        actorPlayerId: null,
        stage: 'ready',
        tileSource: group ? sc.enemies!.groups.find((g) => g.id === group)!.tileSource : null,
      });
      return true;
    }
    complete(owner, task.action);
    sc.tasks.pop();
    return true;
  }
  if (task.kind === 'physical') {
    const p = state.physical!,
      parent = p.snapshot.parents.find((r) => r.id === task.parentId)!;
    if (parent.status === 'completed') {
      const a = current(sc, owner).actions.find((a) => a.index === task.action)!;
      sc.tasks.pop();
      // A resource child can complete without presenting a physical decision.
      // Its source DisplayMessage still owns an acknowledgement before FINISHED.
      if (a.op === 'message' && a.inspiration) {
        messageRequest(state, owner, a);
        return true;
      }
      complete(owner, task.action);
      if (a.op === 'confirm')
        invariant(send(sc, owner, a.confirmEvent), 'Conferma senza seguito fonte.');
      else if (a.op === 'choice') {
        const committed = sc.play!.attempts.find((a) => a.id === sc.play!.active)!.entryChoice;
        invariant(
          committed?.state === owner.state && committed.action === a.index,
          'Costo senza scelta impegnativa fonte.',
        );
        invariant(send(sc, owner, committed.event), 'Impegno senza seguito fonte.');
      } else if (a.op === 'sourceTest' || a.op === 'challenge') {
        const successes = parent.results.find((r) => r.kind === 'test')?.successes;
        invariant(successes !== undefined, 'Prova padre senza risultato.');
        let total: number | null = null;
        let challengeEvent: string | undefined;
        if (a.op === 'challenge') {
          const result = challengeResult(sc, owner, a, successes);
          total = result.total;
          challengeEvent = result.event;
        }
        const attempt = sc.play!.attempts.find((a) => a.id === sc.play!.active)!;
        sc.play!.tests.push({
          attemptId: attempt.id,
          source: parent.source,
          runId: parent.id,
          heroId: attempt.heroId,
          stat: a.stat,
          target: a.op === 'sourceTest' ? a.target : null,
          successes,
          total,
        });
        const event =
          a.op === 'sourceTest'
            ? successes >= a.target
              ? a.passEvent
              : a.failEvent
            : challengeEvent!;
        invariant(send(sc, owner, event), 'Prova senza ramo compilato.');
      } else if (a.op === 'message') logMessage(sc, owner, a.index);
      return true;
    }
    const active = p.snapshot.active;
    invariant(
      active && active.runId === task.parentId,
      'Continuazione fisica senza figlio attivo.',
    );
    const effect = sc.effects.find((e) => e.id === parent.source)!;
    request(state, physicalRequestData(state, effect, active));
    return true;
  }
  if (task.kind === 'section') {
    let tiles = projection(state).sections.find((s) => s.id === task.sectionId)!.tiles;
    if (task.remaining) {
      const p = projection(state);
      const touches = (source: string) =>
        p.spaces
          .filter((s) => s.tileSource === source)
          .some((s) =>
            s.connected.some(
              (id) =>
                sc.tiles.find((t) => t.source === p.spaces.find((s) => s.id === id)!.tileSource)!
                  .visible,
            ),
          );
      comparisonSort(task.remaining, (a, b) => Number(touches(b)) - Number(touches(a)));
      tiles = task.remaining.map((source) => tiles.find((t) => t.source === source)!);
    }
    if (task.remaining && tiles.length) {
      const tile = tiles[0]!;
      task.remaining.shift();
      task.order!.push(tile.source);
      sc.tiles.find((t) => t.source === tile.source)!.visible = true;
      const action = current(sc, owner).actions.find((a) => a.index === task.action)!;
      invariant(action.op === 'section', 'Sezione senza istruzione fonte.');
      request(state, {
        instanceId: owner.id,
        state: owner.state,
        entry: owner.entry,
        action: task.action,
        kind: 'placement',
        text: action.text.map((t) =>
          t.kind === 'text' ? { ...t, text: t.text.replaceAll('{tile}', tile.code) } : t,
        ),
        heroId: null,
        actorPlayerId: null,
        stage: 'ready',
        tileSource: tile.source,
      });
      return true;
    }
    if (task.remaining && task.markers === 'unrevealed') {
      task.markers = 'pending';
      const nodes = sc.explorationMarkers!.filter((m) => task.order!.includes(m.tileSource));
      nodes.forEach((m) => {
        m.visible = true;
      });
      const cap = sc.pack.manifest.followup!;
      request(state, {
        instanceId: owner.id,
        state: owner.state,
        entry: owner.entry,
        action: task.action,
        kind: 'exploration-markers',
        text: task.order!.length <= 1 ? cap.explorationText.single : cap.explorationText.plural,
        heroId: null,
        actorPlayerId: null,
        stage: 'ready',
        tileSource: null,
      });
      return true;
    }
    if (!task.remaining)
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
    const frame = sc.explorations?.attempts.find((a) => a.id === sc.explorations?.active);
    if (task.stage === 'intro' || task.stage === 'outro') {
      const action = current(sc, owner).actions.find((a) => a.index === task.action)!;
      invariant(
        (frame && frame.instanceId === owner.id) || (action.op === 'explore' && action.intro),
        'Presentazione senza fonte.',
      );
      const cap = sc.pack.manifest.exploration!;
      request(state, {
        instanceId: owner.id,
        state: owner.state,
        entry: owner.entry,
        action: task.action,
        kind: task.stage === 'intro' ? 'exploration-intro' : 'exploration-outro',
        text:
          task.stage === 'intro'
            ? action.op === 'explore' && action.intro
              ? action.intro
              : cap.tiles.find((t) => t.source === task.tileSource)!.intros[frame!.intro]!
            : cap.outro,
        heroId: frame?.heroId ?? null,
        actorPlayerId: frame?.playerId ?? null,
        stage: 'ready',
        tileSource: task.tileSource,
      });
      return true;
    }
    if (task.stage === 'adjacent') {
      const cap = sc.pack.manifest.exploration!,
        principal = sc.instances.find((i) => i.kind === 'principal')!;
      if (task.waiting) {
        if (!principal.stopped && principal.processing !== 0) return false;
        task.waiting = null;
      }
      if (cap.adjacent.variable && task.adjacentIndex! < task.adjacent!.length) {
        setValue(sc, principal, cap.adjacent.variable, task.adjacent![task.adjacentIndex!]!);
        task.adjacentIndex!++;
        principal.processing = 1;
        sc.events.push({
          id: eventId(sc, cap.adjacent.event),
          event: cap.adjacent.event,
          receivers: [principal.id],
        });
        invariant(send(sc, principal, cap.adjacent.event), 'Evento adiacente senza handler.');
        task.waiting = principal.id;
        return true;
      }
      const action = current(sc, owner).actions.find((a) => a.index === task.action)!;
      invariant(action.op === 'explore', 'Suite fuori esplorazione.');
      task.stage = action.skipOutro ? 'done' : 'outro';
      return true;
    }
    const spaces = cells(state, task.tileSource);
    while (task.stage !== 'done' && task.spaceIndex < spaces.length) {
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
        sc.events.push({ id: eventId(sc, event), event, receivers: [node.id] });
        send(sc, node, event);
        task.waiting = node.id;
        return true;
      }
    }
    if (task.adjacent && task.stage !== 'done') {
      task.stage = 'adjacent';
      return true;
    }
  }
  complete(owner, task.action);
  sc.tasks.pop();
  return true;
}
function pump(state: State, probe?: SourceProbe, requestId?: string) {
  const sc = state.scenario!;
  for (let n = 0; n < 2000; n++) {
    let progress = false;
    for (const i of sc.instances.filter((i) => !sc.conclusion || i.kind === 'principal'))
      progress = runInstance(state, i, false, probe, requestId) || progress;
    if (sc.pending) return;
    if (sc.conclusion) {
      if (sc.conclusion.outcome === 'victory') {
        const attempt = sc.play!.attempts.find((a) => a.id === sc.play!.active);
        if (attempt && sc.instances.find((i) => i.id === attempt.instanceId)!.stopped) {
          attempt.returned = true;
          sc.play!.active = null;
        }
      }
      return;
    }
    if (advanceTask(state)) continue;
    if (sc.phase === 'action') {
      if (
        (sc.pack.manifest.followup || sc.pack.manifest.linked) &&
        progress &&
        sc.instances.some((i) => !i.stopped && !i.settled)
      )
        continue;
      const exploration = sc.explorations?.attempts.find((a) => a.id === sc.explorations?.active);
      if (exploration) {
        const node = sc.instances.find((i) => i.id === exploration.instanceId)!;
        invariant(!sc.tasks.length && node.stopped, 'Esplorazione senza ritorno fonte.');
        exploration.returned = true;
        sc.explorations!.active = null;
      }
      const attempt = sc.play!.attempts.find((a) => a.id === sc.play!.active);
      if (attempt) {
        const node = sc.instances.find((i) => i.id === attempt.instanceId)!;
        invariant(node.settled || node.stopped, 'Incontro fermo senza richiesta.');
        attempt.returned = true;
        sc.play!.active = null;
      }
      return;
    }
    const principal = sc.instances.find((i) => i.kind === 'principal')!;
    if (!sc.tasks.length && principal.processing === 0) {
      invariant(sc.objective?.id === 0, 'Setup rilasciato senza obiettivo0.');
      request(state, {
        instanceId: principal.id,
        state: principal.state,
        entry: principal.entry,
        action: -1,
        kind: 'handoff',
        text: structuredClone(HANDOFF_TEXT),
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
export function beginScenario(
  state: State,
  parsed: ReturnType<typeof parseScenarioPack>,
  physical?: ReturnType<typeof loadPhysicalSource>,
) {
  const p = projection(state);
  validateScenarioBinding(parsed.pack, p);
  const start = p.sections.find((s) => s.id === 0)!.tiles[0]!,
    space = cells(state, start.source).find((s) => s.index === 1);
  invariant(space, 'Start Spaces[1] assente.');
  const { bindings, definition: journeyDefinition } = projectionToJourney(
    p,
    space.id,
    parsed.pack.name,
  );
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
    initialInspiration: state.preparation!.heroes.map((h) => ({
      heroId: h.heroId,
      value: h.inspiration,
    })),
    messageLog: [],
    handoffCount: 0,
    ...(parsed.pack.manifest.rounds
      ? { rounds: { version: 'source-rounds-v1' as const, active: null, frames: [] } }
      : {}),
  };
  state.scenario = sc;
  if (sc.pack.manifest.followup) {
    sc.globals[sc.pack.manifest.followup.playerCountBinding] = state.preparation!.heroes.length;
    sc.enemies = { entropy: null, cursor: 0, groups: [], attempts: [] };
    sc.explorationMarkers = sc.pack.manifest.followup.explorationNodes.map((n) => ({
      source: n.source,
      tileSource: n.tileSource,
      visible: false,
    }));
  }
  initializeScenarioPhysical(state, journeyDefinition.startSpaceId, physical);
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
  for (const row of sc.pack.manifest.followup?.instances ?? [])
    add(`static:${row.gameObject}`, row.kind, row.definition);
  for (const spaceId of p.spawnOrder) {
    const a = p.assignments.find((a) => a.spaceId === spaceId)!,
      m = sc.pack.manifest.prefabs.find((m) => m.source === a.prefab.source)!;
    add(`node:${spaceId}`, 'encounter', m.fsmSource, a.prefab.source, spaceId);
  }
  sc.cardEffects = [];
  for (const hero of state.preparation!.heroes)
    for (const copy of hero.prepared) preparedReward(state, hero.heroId, copy, 'initial');
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
  physicalPath?: string,
  probe?: SourceProbe,
) {
  const sc = state.scenario,
    q = sc?.pending;
  if (
    !sc ||
    (sc.phase !== 'setup' && sc.pack.manifest.scope !== 'original-encounter-v1') ||
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
  if (q.kind === 'deployment-intro' || q.kind === 'deployment') {
    if (input.kind !== 'ack') throw wrong();
    const task = sc.tasks.at(-1),
      a = current(sc, i).actions.find((a) => a.index === q.action)!;
    invariant(
      task?.kind === 'spawnRandom' &&
        task.instanceId === i.id &&
        task.entry === q.entry &&
        task.action === q.action &&
        a.op === 'spawnRandom',
      'Callback spawn scaduto.',
    );
    sc.messageLog.push({
      id: `${task.effectId}:${q.kind === 'deployment-intro' ? 'intro' : task.groupIndex}`,
      text: structuredClone(q.text),
    });
    if (q.kind === 'deployment-intro') {
      materializeDeployment(state, i, a, task.effectId);
      task.stage = 'placements';
    } else task.groupIndex++;
    sc.pending = null;
  } else if (q.kind === 'exploration-intro' || q.kind === 'exploration-outro') {
    if (input.kind !== 'ack') throw wrong();
    const task = sc.tasks.at(-1);
    invariant(
      task?.kind === 'explore' && task.instanceId === i.id && task.action === q.action,
      'Callback esplorazione scaduto.',
    );
    const action = current(sc, i).actions.find((a) => a.index === task.action)!;
    invariant(action.op === 'explore', 'Presentazione senza esplorazione.');
    if (q.kind === 'exploration-intro' && !action.noInspiration && !probe) rewardExploration(state);
    sc.messageLog.push({
      id: `${actionKey(i, q.action)}:${task.stage}`,
      text: structuredClone(q.text),
    });
    task.stage = q.kind === 'exploration-intro' ? 'pre' : 'done';
    sc.pending = null;
  } else if (q.kind === 'physical') {
    answerScenarioPhysical(state, playerId, command, physicalPath);
  } else if (q.kind === 'hero-choice') {
    const a = current(sc, i).actions.find((a) => a.index === q.action)!;
    if (
      a.op !== 'chooseHero' ||
      input.kind !== 'choose-hero' ||
      !q.options?.some((o) => o.event === input.heroId)
    )
      throw wrong();
    const index = state.preparation!.heroes.findIndex((h) => h.heroId === input.heroId);
    invariant(index >= 0, 'Destinatario fuori dalla Compagnia.');
    setValue(sc, i, a.target, index);
    sc.pending = null;
    complete(i, q.action);
  } else if (q.kind === 'choice') {
    const a = current(sc, i).actions.find((a) => a.index === q.action)!;
    if (
      a.op !== 'choice' ||
      input.kind !== 'choice' ||
      !q.options?.some((o) => o.event === input.event)
    )
      throw wrong();
    sc.pending = null;
    complete(i, q.action);
    invariant(send(sc, i, input.event), 'Scelta senza transizione fonte.');
  } else if (q.kind === 'scout' || q.kind === 'test') {
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
      requirePreparedCapability(sc.pack, input.prepareCopy);
      const { kind, ...choices } = input;
      applyScouting(state, playerId, {
        ...base,
        type: 'RESOLVE_SCOUT',
        scoutId: scout.id,
        ...choices,
      });
      if (input.prepareCopy)
        preparedReward(state, hero.heroId, input.prepareCopy, actionKey(i, q.action));
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
      const view = skillTestView(
          state.content,
          state.skillTest,
          physicalTitleSkills(state.physical),
        )!,
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
    logMessage(sc, i, q.action);
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
      if (sc.pack.manifest.scope === 'original-encounter-v1')
        sc.play = { active: null, lore: 0, attempts: [], tests: [] };
      if (sc.pack.manifest.exploration)
        sc.explorations = { version: 'source-exploration-v1', active: null, attempts: [] };
      return;
    }
    const task = sc.tasks.at(-1);
    if (task?.kind === 'section' && task.instanceId === i.id && task.action === q.action) {
      task.tileIndex++;
      if (task.remaining)
        sc.messageLog.push({
          id: `${actionKey(i, q.action)}:${q.kind === 'exploration-markers' ? 'markers' : q.tileSource}`,
          text: structuredClone(q.text),
        });
      if (q.kind === 'exploration-markers') task.markers = 'done';
    } else {
      logMessage(sc, i, q.action);
      complete(i, q.action);
    }
  }
  pump(state, probe, command.requestId);
}

export function exploreScenario(
  state: State,
  playerId: string,
  c: ExplorationCommand,
  entropy: string,
  grantId?: string,
  probe?: SourceProbe,
) {
  if (state.scenario!.pack.manifest.clues && !probe)
    preflightContinuation(state, (work, probe) =>
      exploreScenario(work, playerId, c, entropy, grantId, probe),
    );
  const i = prepareExploration(state, playerId, c, entropy, grantId),
    sc = state.scenario!;
  runInstance(state, i, false, probe);
  sc.events.push({ id: eventId(sc, 'NODE CLICKED'), event: 'NODE CLICKED', receivers: [i.id] });
  invariant(send(sc, i, 'NODE CLICKED'), 'Template senza ingresso.');
  pump(state, probe);
}

/** Commit the source confirmation and its one interact action together. Inspection is read-only. */
export function interactScenario(
  state: State,
  playerId: string,
  c: Extract<Command, { type: 'INTERACT_SCENARIO' }>,
  probe?: SourceProbe,
) {
  const sc = state.scenario!,
    i = sc.instances.find((i) => i.id === c.instanceId),
    round = state.round!,
    j = state.journey!;
  const fail = (code: string, message: string): never => {
    throw new ApiError(409, code, message);
  };
  if (
    sc.pack.manifest.scope !== 'original-encounter-v1' ||
    sc.phase !== 'action' ||
    !sc.play ||
    !state.physical?.lastStand
  )
    fail('SCENARIO_CAPABILITY', 'Il segnalino richiede capacità fonte non disponibili.');
  if (
    c.scenarioId !== sc.id ||
    c.packFingerprint !== sc.packFingerprint ||
    c.projectionFingerprint !== sc.projectionFingerprint ||
    !i ||
    digest(i) !== c.sourceFingerprint
  )
    fail('SCENARIO_SOURCE_CHANGED', 'Il segnalino o la fonte sono cambiati.');
  if (!playableScenarioPrefab(sc.pack, i!.prefab!) || !i!.visible || i!.stopped || !i!.settled)
    fail('SCENARIO_CAPABILITY', 'Questo segnalino non ha una continuazione disponibile.');
  if (sc.pending || sc.play!.active || state.physical!.snapshot.active)
    fail('SCENARIO_PENDING', 'Concludi la richiesta corrente.');
  const hero = state.preparation!.heroes.find((h) => h.heroId === c.heroId);
  if (!hero || hero.playerId !== playerId)
    throw new ApiError(403, 'HERO_NOT_YOURS', 'Puoi interagire soltanto con i tuoi eroi.');
  if (defeatedHeroes(state).includes(c.heroId)) fail('HERO_DEFEATED', 'Questo eroe è sconfitto.');
  if (
    round.phase !== 'action' ||
    round.id !== c.roundId ||
    round.turnId !== c.turnId ||
    round.activeHeroId !== c.heroId
  )
    fail('TURN_CHANGED', 'L’eroe non è di turno o il turno è cambiato.');
  const position = j.heroes.find((h) => h.heroId === c.heroId)!,
    space = sc.spaceBindings.find((b) => b.sourceId === i!.spaceId)?.id;
  if (position.spaceId !== space)
    fail('INTERACTION_SPACE', 'Raggiungi la casella del segnalino prima di interagire.');
  const progress = round.heroes.find((h) => h.heroId === c.heroId)!;
  if (progress.actionsUsed >= 2) fail('NO_ACTIONS', 'Questo eroe ha già usato le sue due azioni.');
  const prefab = sc.pack.manifest.prefabs.find((m) => m.source === i!.prefab)!;
  const entry = encounterEntry(sc.pack, i!, sc.globals);
  let entryChoice:
    | NonNullable<NonNullable<Scenario['play']>['attempts'][number]['entryChoice']>
    | undefined;
  if (entry?.action.op === 'choice') {
    const option = encounterOptions(entry.action, i!, sc.globals).find(
      (o) => o.event === c.choiceEvent && o.cost === 'interact',
    );
    if (!linkedDefinition(sc.pack, i!.definition) || !option)
      fail('SCENARIO_CHOICE_CHANGED', 'Scegli un’interazione disponibile nella visita corrente.');
    entryChoice = { state: entry.state, action: entry.action.index, event: option!.event };
  } else if (c.choiceEvent !== undefined)
    fail('SCENARIO_CHOICE_CHANGED', 'Questa visita non prevede l’opzione indicata.');
  const inspiration =
    prefab.nodeType === 'threat'
      ? persistentEffects(state.physical!, c.heroId).reduce(
          (n, e) => n + (e.op === 'mandatory-spend' && e.window === 'before-interact' ? e.n : 0),
          0,
        )
      : 0;
  if (hero!.inspiration < inspiration)
    fail(
      'INTERACTION_RESOURCE',
      `Le carte attive richiedono ${inspiration} ispirazione prima di questa interazione.`,
    );
  if (
    (sc.pack.manifest.clues?.encounters.includes(i!.prefab!) ||
      sc.pack.manifest.lair?.prefab === i!.prefab ||
      linkedDefinition(sc.pack, i!.definition)) &&
    !probe
  )
    preflightContinuation(state, (work, probe) => interactScenario(work, playerId, c, probe));
  progress.actionsUsed++;
  const id = cycleUUID({ scenario: sc.id, playerId, request: c.requestId });
  sc.play!.attempts.push({
    id,
    instanceId: i!.id,
    heroId: c.heroId,
    playerId,
    roundId: round.id,
    turnId: round.turnId!,
    requestId: c.requestId,
    cost: 1,
    ...(entryChoice ? { entryChoice } : {}),
    returned: false,
  });
  sc.play!.active = id;
  sc.events.push({
    id: cycleUUID({ attempt: id, event: 'NODE CLICKED' }),
    event: 'NODE CLICKED',
    receivers: [i!.id],
  });
  invariant(send(sc, i!, 'NODE CLICKED'), 'Handler incontro non compilato.');
  pump(state, probe, c.requestId);
}
