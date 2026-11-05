import type { State } from '../server/state';
import type { ScenarioAction, ScenarioRequest, ScenarioPack, Scenario } from '../shared/scenario';
import { definitionId } from '../shared/preparation';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';
import { cycleUUID } from '../physical-resolution/cycle-request';
import { startPhaseEvent } from './runtime';
import { ApiError } from '../server/errors';

type Timing = 'shadow-start' | 'no-active-heroes';
function equippedCards(state: State) {
  // Source title ownership is stored separately from EquippedSkillIds. A title
  // can enter the physical skill deck without joining that controller check.
  const titles = state.physical?.snapshot.lastStand?.titles.map((t) => t.cardId) ?? [];
  return state
    .preparation!.heroes.flatMap((h) => [
      ...h.prepared,
      ...h.deck,
      ...h.discard,
      ...(state.physical?.snapshot.resolution?.revealed.find((r) => r.heroId === h.heroId)?.cards ??
        []),
    ])
    .map(definitionId)
    .filter((id) => !titles.includes(id));
}
export function validateFailureParty(state: State, pack: ScenarioPack = state.scenario!.pack) {
  const cap = pack.manifest.failure;
  if (!cap) return;
  invariant(
    equippedCards(state).every((id) => cap.partyBonus.skills.some((b) => b.cardId === id)),
    'Abilità equipaggiata senza identità fonte per il termine.',
  );
  invariant(
    cap.partyBonus.skills.every(
      (b) =>
        b.modelId !== null ||
        state.content?.skills.some((s) => s.id === b.cardId && s.kind === 'weakness'),
    ),
    'Solo le debolezze fisiche possono essere prive di modello app.',
  );
}
/** Called at the controller's two boundaries, never as a generic lossDue poll. */
export function beginHeroFailure(state: State, timing: Timing, requestId: string): boolean {
  const sc = state.scenario!,
    cap = sc.pack.manifest.failure,
    ls = state.physical?.snapshot.lastStand;
  if (sc.conclusion || !cap || !ls?.lossDue) return false;
  if (timing === 'shadow-start' && state.round?.phase !== 'action') return false;
  if (timing === 'no-active-heroes' && (!ls.terminal || !ls.heroes.every((h) => h.defeated)))
    return false;
  const { runId, heroId, instructionHash } =
    timing === 'no-active-heroes' ? ls.terminal! : ls.lossDue;
  return beginFailure(state, timing, requestId, { runId, heroId, instructionHash });
}
export function beginThreatFailure(
  state: State,
  timing: 'threat-start' | 'threat-increase',
  requestId: string,
): boolean {
  const sc = state.scenario!,
    cap = sc.pack.manifest.threatContinuations,
    rounds = sc.pack.manifest.rounds;
  if (sc.conclusion || !cap || !rounds) return false;
  const value = sc.globals[rounds.bindings.threat];
  invariant(typeof value === 'number' && Number.isInteger(value), 'Minaccia senza binding intero.');
  if (value < rounds.threat.limit) return false;
  const frame =
    timing === 'threat-increase' ? sc.rounds!.frames.find((f) => f.id === sc.rounds!.active) : null;
  if (timing === 'threat-increase') {
    invariant(
      frame?.stage === 'thresholds' &&
        frame.threat &&
        !frame.threshold &&
        !sc.pending &&
        !sc.tasks.length &&
        !state.physical!.snapshot.active,
      'Perdita prima del ritorno completo delle soglie.',
    );
    frame.stage = 'conclusion';
  } else invariant(state.round?.phase === 'action', 'Limite iniziale fuori dalla fase fonte.');
  return beginFailure(state, timing, requestId, {
    kind: 'threat',
    before: frame?.threat?.before ?? value,
    after: value,
    limit: rounds.threat.limit,
    frameId: frame?.id ?? null,
    controllerHash: cap.methods.controller.bodyHash,
  });
}
function beginFailure(
  state: State,
  timing: NonNullable<Scenario['conclusion']>['timing'],
  requestId: string,
  cause: NonNullable<Scenario['conclusion']>['cause'],
) {
  return beginConclusion(state, 'failure', timing, requestId, cause);
}

/** Only the frozen EndGame instruction can signal victory; physical results own the path. */
export function beginSourceVictory(
  state: State,
  instanceId: string,
  effectId: string,
  requestId: string,
) {
  const sc = state.scenario!,
    cap = sc.pack.manifest.lair,
    instance = sc.instances.find((i) => i.id === instanceId),
    effect = sc.effects.find((e) => e.id === effectId),
    action = sc.pack.definitions
      .find((d) => d.source === instance?.definition)
      ?.states.find((s) => s.index === effect?.state)
      ?.actions.find((a) => a.index === effect?.action),
    attempt = sc.play?.attempts.find((a) => a.id === sc.play?.active);
  invariant(
    !sc.conclusion &&
      cap &&
      instance?.prefab === cap.prefab &&
      effect?.instanceId === instanceId &&
      action?.op === 'endGame' &&
      action.success &&
      attempt?.instanceId === instanceId &&
      requestId,
    'Vittoria senza istruzione, attore e tentativo del covo.',
  );
  return beginConclusion(state, 'victory', 'source-end', requestId, {
    kind: 'source-victory',
    instanceId,
    effectId,
    instructionHash: digest(action),
    attemptId: attempt.id,
    heroId: attempt.heroId,
    playerId: attempt.playerId,
    controllerHash: sc.pack.manifest.failure!.methods.signal.bodyHash,
  });
}
function beginConclusion(
  state: State,
  outcome: NonNullable<Scenario['conclusion']>['outcome'],
  timing: NonNullable<Scenario['conclusion']>['timing'],
  requestId: string,
  cause: NonNullable<Scenario['conclusion']>['cause'],
) {
  const sc = state.scenario!,
    cap = sc.pack.manifest.failure!;
  validateFailureParty(state);
  const principal = sc.instances.find((i) => i.kind === 'principal')!;
  const cards = equippedCards(state);
  const bonus = cards.some((id) =>
    cap.partyBonus.skills.some(
      (b) => b.cardId === id && b.modelId === cap.partyBonus.requiredSkillId,
    ),
  )
    ? cap.partyBonus.amount
    : 0;
  sc.conclusion = {
    version: outcome === 'victory' ? sc.pack.manifest.lair!.version : cap.version,
    id: cycleUUID({ scenario: sc.id, requestId, timing, cause }),
    outcome,
    timing,
    cause,
    triggerRequestId: requestId,
    episodeHash: digest({
      scenario: sc,
      physical: state.physical,
      round: state.round,
      journey: state.journey,
      preparation: state.preparation,
      combat: state.combat ?? null,
    }),
    suspendedRequest: structuredClone(sc.pending),
    suspendedPrincipal: structuredClone(principal),
    stage: 'conclusion',
    xp: [],
    bonusLore: bonus,
    nextAdventureId: null,
    alternatives: [],
    completedAdventureIds: [],
    transitionCount: 0,
    campEntryCount: 0,
    campaign: null,
  };
  if (bonus) {
    sc.play!.lore += bonus;
    sc.messageLog.push({
      id: `conclusion:${sc.conclusion.id}:party-lore`,
      text: structuredClone(cap.partyBonus.text),
    });
  }
  // Keep the interrupted request and all source/physical frames as episode evidence.
  // Only the principal receives the controller's event; its terminal path owns progress.
  sc.pending = null;
  invariant(
    startPhaseEvent(
      state,
      principal.id,
      outcome === 'victory' ? sc.pack.manifest.lair!.event : cap.event,
      true,
    ),
    'Conclusione senza ricevitore principale.',
  );
  return true;
}
export function applyConclusionAction(
  state: State,
  action: Extract<ScenarioAction, { op: 'awardXP' | 'nextAdventure' | 'proceed' }>,
  source: string,
) {
  const sc = state.scenario!,
    c = sc.conclusion;
  invariant(c?.stage === 'conclusion', 'Operazione fuori dalla conclusione fonte.');
  if (action.op === 'awardXP') {
    invariant(!c.xp.length, 'Premio XP duplicato.');
    c.xp = state.preparation!.heroes.map((h) => {
      invariant(h.roleId, 'Premio senza ruolo selezionato.');
      return { heroId: h.heroId, roleId: h.roleId, amount: action.amount, source };
    });
  } else if (action.op === 'nextAdventure') {
    c.alternatives = [];
    c.nextAdventureId = action.id;
  } else {
    invariant(
      c.nextAdventureId === sc.pack.manifest.failure!.next.id && c.transitionCount === 0,
      'Passaggio senza destinazione fonte o duplicato.',
    );
    c.completedAdventureIds.push(sc.pack.identity.adventureId);
    c.transitionCount++;
    const cap = sc.pack.manifest.failure!,
      rounds = sc.pack.manifest.rounds;
    const reset = rounds
      ? [
          rounds.bindings.round,
          rounds.bindings.threat,
          rounds.bindings.darkness,
          rounds.bindings.darknessOverride,
        ]
      : [];
    if (sc.pack.manifest.followup) reset.push(sc.pack.manifest.followup.enemyPointsBinding);
    c.campaign = {
      ...(sc.pack.manifest.items
        ? {
            inventory: (state.physical?.snapshot.resolution?.resources?.itemCustody ?? []).map(
              ({ copy, cardId, modelId }) => ({ copy, cardId, modelId }),
            ),
          }
        : {}),
      heroes: state.preparation!.heroes.map((h) => ({
        heroId: h.heroId,
        roleId: h.roleId,
        status: 'active',
        lastStandDifficulty: 1,
        itemCopies: [...h.itemCopies],
        titleCopies: (state.physical!.snapshot.lastStand?.titles ?? [])
          .filter((t) => t.heroId === h.heroId)
          .map((t) => t.copy),
      })),
      sceneGlobals: Object.fromEntries(
        sc.pack.globals
          .filter((v) => reset.includes(v.name))
          .map((v) => [v.name, structuredClone(v.value)]),
      ),
      adventureRules: [],
      next: {
        source: cap.next.source,
        id: cap.next.id,
        type: cap.next.type,
        status: 'requires-content',
      },
    };
    const playerCount = sc.pack.manifest.followup?.playerCountBinding;
    if (playerCount) c.campaign.sceneGlobals[playerCount] = state.preparation!.heroes.length;
  }
}
function campaignRequest(state: State) {
  const sc = state.scenario!,
    c = sc.conclusion!,
    cap = sc.pack.manifest.failure!,
    i = sc.instances.find((i) => i.kind === 'principal')!;
  const data: Omit<ScenarioRequest, 'id' | 'fingerprint'> = {
    instanceId: i.id,
    state: i.state,
    entry: i.entry,
    action: -1,
    kind: c.stage === 'conclusion' ? 'message' : c.stage,
    text:
      c.stage === 'campaign-map'
        ? cap.next.name
        : c.stage === 'campaign-story'
          ? cap.next.story
          : cap.next.location,
    heroId: null,
    actorPlayerId: null,
    stage: 'ready',
    tileSource: null,
  };
  const id = cycleUUID({
    conclusion: c.id,
    stage: c.stage,
    command: sc.commands.length,
    campaign: c.campaign,
  });
  sc.pending = { ...data, id, fingerprint: digest({ scenarioId: sc.id, ...data, id }) };
}
export function advanceConclusion(state: State) {
  const sc = state.scenario!,
    c = sc.conclusion;
  if (!c || c.stage !== 'conclusion' || sc.pending) return;
  if (!sc.instances.find((i) => i.kind === 'principal')!.stopped) return;
  invariant(
    c.transitionCount === 1 && c.campaign && c.xp.length === state.preparation!.heroes.length,
    'Termine FSM senza completamento dell’avventura.',
  );
  c.stage = 'campaign-map';
  campaignRequest(state);
}
export function answerCampaign(
  state: State,
  playerId: string,
  command: Extract<import('../shared/protocol').ScenarioCommand, { type: 'SCENARIO_INPUT' }>,
) {
  const sc = state.scenario!,
    c = sc.conclusion!,
    q = sc.pending;
  if (
    !q ||
    command.scenarioId !== sc.id ||
    command.packFingerprint !== sc.packFingerprint ||
    command.projectionFingerprint !== sc.projectionFingerprint ||
    command.pendingId !== q.id ||
    command.sourceFingerprint !== q.fingerprint ||
    command.heroId !== null
  )
    throw new ApiError(
      409,
      'SCENARIO_REQUEST_CHANGED',
      'Il passaggio della campagna è concluso o è cambiato.',
    );
  if (command.input.kind === 'camp-role' && c.stage === 'camp') {
    const input = command.input;
    const h = state.preparation!.heroes.find((h) => h.heroId === input.heroId);
    if (!h || h.playerId !== playerId)
      throw new ApiError(403, 'HERO_NOT_YOURS', 'Scegli il ruolo soltanto per il tuo eroe.');
    const roleId = command.input.roleId;
    if (!state.content!.roles.some((r) => r.id === roleId))
      throw new ApiError(409, 'ROLE_UNAVAILABLE', 'Questo ruolo non è disponibile.');
    for (const hero of c.campaign!.heroes) if (hero.roleId === roleId) hero.roleId = null;
    c.campaign!.heroes.find((hero) => hero.heroId === h.heroId)!.roleId = roleId;
  } else if (command.input.kind === 'ack' && c.stage === 'campaign-map') c.stage = 'campaign-story';
  else if (command.input.kind === 'ack' && c.stage === 'campaign-story') {
    c.stage = 'camp';
    c.campEntryCount++;
  } else
    throw new ApiError(
      409,
      'CAMPAIGN_CAPABILITY',
      'Il campo è salvato. La prossima avventura e gli acquisti richiedono materiale ulteriore; nessuna spesa o partenza è stata applicata.',
    );
  sc.pending = null;
  campaignRequest(state);
}
