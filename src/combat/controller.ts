import type { State } from '../server/state';
import type { Receipt } from '../shared/protocol';
import type {
  CombatIntent,
  CombatAttempt,
  CombatState,
  CombatView,
  CombatAttackOffer,
} from '../shared/combat-controller';
import type { PhysicalProgram } from '../shared/physical';
import type { CombatClosure } from './compiler';
import { verifyCombatClosure } from './compiler';
import { effectiveGroup, preflightCombatGroup, applyGroupHits } from './group';
import { selectGroupInstruction, groupAttackPacket, selectActivationHero } from './selection';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';
import { cycleUUID } from '../physical-resolution/cycle-request';
import { openPhysical } from '../physical-resolution/runtime';
import { defeatedHeroes, syncPhysicalDefeat } from '../server/physical-defeat';
import { definitionId } from '../shared/preparation';
import { ApiError } from '../server/errors';
import { verifySourceDeployment } from './deployment-compiler';
import { preflightCombatOperation } from './preflight';
import {
  threatMovements,
  moveEnemyOneSpace,
  groupInRange,
  activeCompany,
  activationTargets,
  activationSteps,
  placeEnemyInSpace,
} from './movement';
import { physicalLimits } from '../physical-resolution/effects';
import { applyGrantedMove } from '../server/journey-map';
import { exploreScenario } from '../scenario/runtime';
import { explorationSource, explorationProblem } from '../shared/exploration';
import { STAT_LABELS } from '../shared/skill-tests';
import { combatDarknessHeroes } from '../scenario/darkness';

const fail = (code: string, message: string): never => {
  throw new ApiError(409, code, message);
};
let cached: { key: string; artifact: CombatClosure } | null = null;
export function combatArtifact(state: State) {
  const raw = state.scenario?.pack.manifest.combat;
  if (!raw)
    return fail(
      'COMBAT_UNAVAILABLE',
      'Il combattimento non è disponibile in questa avventura salvata.',
    );
  const key = digest(raw);
  if (cached?.key === key) return cached.artifact;
  const artifact = verifyCombatClosure(raw);
  cached = { key, artifact };
  return artifact;
}
export function initialCombat(state: State): CombatState {
  const a = combatArtifact(state);
  return {
    version: 'combat-controller-v1',
    artifactFingerprint: a.fingerprint,
    entropy: digest({
      stream: 'combat-controller-v1',
      entropy: state.physical!.entropy,
      artifact: a.fingerprint,
    }),
    streams: { instruction: 0, reduction: 0, ...(a.source.shadow ? { target: 0 } : {}) },
    active: null,
    attempts: [],
    operation: null,
    operations: [],
    grants: [],
  };
}
const current = (state: State) =>
  state.combat!.attempts.find((a) => a.id === state.combat!.active)!;
const group = (state: State, id: string) => {
  const g = state.scenario!.enemies!.groups.find((g) => g.id === id);
  invariant(g, 'Gruppo non materializzato.');
  return g;
};
function alive(state: State, id: string) {
  return (
    !defeatedHeroes(state).includes(id) &&
    !state.journey!.heroes.find((h) => h.heroId === id)?.removed
  );
}
function nearby(state: State, a: string, b: string) {
  const x = state.journey!.heroes.find((h) => h.heroId === a)!.spaceId,
    y = state.journey!.heroes.find((h) => h.heroId === b)!.spaceId;
  return (
    x === y ||
    state.journey!.definition.connections.some(
      ([a, b]) => (a === x && b === y) || (b === x && a === y),
    )
  );
}
function name(state: State, id: string) {
  const g = group(state, id),
    d = verifySourceDeployment(
      state.scenario!.pack.manifest.followup!.deployment,
    ).compiled.models.find((m) => m.source === g.source)!;
  return g.figures.filter((f) => f.health > 0).length > 1 ? d.plural : d.name;
}
function inRange(state: State, heroId: string, groupId: string, ranged: boolean) {
  return groupInRange(state, heroId, group(state, groupId), ranged);
}
export function attackOffers(state: State, heroId: string): CombatAttackOffer[] {
  const a = combatArtifact(state),
    h = state.preparation!.heroes.find((h) => h.heroId === heroId)!;
  if (!alive(state, heroId)) return [];
  const weapons = h.itemCopies.flatMap((copy) => {
    const item = a.compiled.items.find((i) => i.id === definitionId(copy));
    return item?.stat && item.slots.length ? [{ copy, item }] : [];
  });
  const combinations = Array.from({ length: (1 << weapons.length) - 1 }, (_, n) =>
    weapons.filter((_, i) => (n + 1) & (1 << i)),
  ).filter((items) => items.every((i) => i.item.stat === items[0]!.item.stat));
  return (state.scenario!.enemies?.groups ?? []).flatMap((g) =>
    !g.placed || g.figures.every((f) => f.health === 0)
      ? []
      : combinations
          .filter((items) =>
            inRange(
              state,
              heroId,
              g.id,
              items.every((i) => i.item.ranged),
            ),
          )
          .map((items) => {
            const missing = preflightCombatOperation(state, a, g, heroId, 'counterattack');
            const reason = g.logic
              ? 'Il seguito di questo gruppo non è disponibile.'
              : missing.includes('boon-quantities-57')
                ? 'Una possibile conseguenza richiede benefici la cui riserva non è ancora verificata.'
                : missing.length
                  ? 'Una conseguenza necessaria non è ancora disponibile.'
                  : null;
            return {
              heroId,
              groupId: g.id,
              name: name(state, g.id),
              figures: g.figures.filter((f) => f.health > 0).length,
              itemCopies: items.map((i) => i.copy),
              stat: items[0]!.item.stat!,
              slots: items.flatMap(({ copy, item }) =>
                item.slots.map((s) => ({
                  id: digest({ copy, slot: s.id }),
                  copyId: copy,
                  cost: s.cost,
                  hits: s.hits,
                  modifiers: s.modifiers,
                  label: `${state.content!.items.find((i) => i.id === item.id)!.name.text} · ${s.cost} successi: ${s.hits} colpi${s.modifiers.length ? `, ${s.modifiers.map((m) => (m === 'stun' ? 'Stordire' : 'Perforare')).join(', ')}` : ''}`,
                })),
              ),
              reason,
            };
          }),
  );
}
function checkAttack(
  state: State,
  c: Extract<CombatIntent, { type: 'START_ATTACK' }>,
  playerId: string,
) {
  const h = state.preparation!.heroes.find((h) => h.heroId === c.heroId);
  if (!h || h.playerId !== playerId)
    throw new ApiError(403, 'HERO_NOT_YOURS', 'L’attacco spetta al proprietario dell’eroe.');
  if (!alive(state, c.heroId)) fail('HERO_DEFEATED', 'Questo eroe è sconfitto.');
  const r = state.round!;
  if (r.id !== c.roundId || r.turnId !== c.turnId || r.phase !== 'action')
    fail('TURN_CHANGED', 'Il turno è cambiato.');
  if (new Set(c.itemCopies).size !== c.itemCopies.length)
    fail('ATTACK_ITEMS', 'Ogni copia può essere selezionata una sola volta.');
  const option = attackOffers(state, c.heroId).find(
    (o) =>
      o.groupId === c.groupId &&
      o.stat === c.stat &&
      digest([...o.itemCopies].sort()) === digest([...c.itemCopies].sort()),
  );
  if (!option)
    fail(
      'ATTACK_TARGET',
      'Scegli un bersaglio vivo a portata e armi equipaggiate con la stessa caratteristica.',
    );
  if (option!.reason) fail('ATTACK_CLOSURE', option!.reason);
  const a = combatArtifact(state);
  if (
    c.replaceCopy &&
    !a.compiled.clauses.some(
      (cl) =>
        cl.cardId === definitionId(c.replaceCopy!) &&
        cl.window === 'before-test' &&
        cl.effect.op === 'replace-stat' &&
        h.prepared.includes(c.replaceCopy!),
    )
  )
    fail('ATTACK_REPLACEMENT', 'La carta per sostituire la caratteristica non è disponibile.');
  return option!;
}
export function openCombatPhysical(
  state: State,
  attempt: CombatAttempt,
  children: Extract<PhysicalProgram, { profile: 'source-fronts-v1' }>['children'],
  deferFrontier = false,
) {
  const p = state.physical!,
    a = combatArtifact(state);
  invariant(
    p.fronts && p.lastStand && p.version === 3 && !p.snapshot.active,
    'Combattimento senza consumer fisico completo.',
  );
  const resources = p.snapshot.resolution!.resources;
  if (resources)
    invariant(
      digest(resources.preparation) === digest(state.preparation),
      'Risorse di combattimento discontinue.',
    );
  const context = resources
    ? structuredClone(resources)
    : { preparation: structuredClone(state.preparation!), boons: [], depletion: [] };
  const program: Extract<PhysicalProgram, { profile: 'source-fronts-v1' }> = {
    profile: 'source-fronts-v1',
    initialCredits: p.heroes.map(() => 0),
    limits: p.heroes.map(() => ({ kind: 'requires-capability', capability: 'source-derived' })),
    darknessHeroes: combatDarknessHeroes(state),
    ...(deferFrontier ? { deferFrontier: 'combat-frontier-v1' as const } : {}),
    combat: {
      version: 'combat-windows-v1',
      roundId: state.round!.id,
      artifactFingerprint: a.fingerprint,
      clauses: a.compiled.clauses,
      heroes: a.compiled.heroes,
    },
    children,
  };
  const runId = cycleUUID({ combat: attempt.id, stage: attempt.stage, run: p.runs.length });
  const ledger = p.cycle;
  delete p.cycle;
  try {
    openPhysical(
      p,
      {
        effectId: `combat:${attempt.id}:${attempt.stage}:${p.runs.length}`,
        instanceId: 'combat-controller',
        state: state.round!.number,
        entry: p.runs.length,
        action: 0,
        parameterHash: digest(program),
      },
      program,
      context,
      {
        heroes: p.heroes.map((h) => ({
          ...h,
          spaceId: state.journey!.heroes.find((j) => j.heroId === h.heroId)!.spaceId,
        })),
        connections: state.journey!.definition.connections,
      },
      runId,
    );
  } finally {
    if (ledger) p.cycle = ledger;
  }
  attempt.runId = runId;
  state.preparation = structuredClone(p.snapshot.resolution!.resources!.preparation);
  syncPhysicalDefeat(state);
  if (p.snapshot.active) p.cycle!.pending = { type: 'START_ATTACK', runId, heroId: attempt.heroId };
}
function newAttempt(
  state: State,
  requestId: string,
  heroId: string,
  playerId: string,
  groupId: string,
  kind: CombatAttempt['kind'],
  parentId: string | null = null,
): CombatAttempt {
  const cs = state.combat!;
  if (cs.attempts.length >= 1000)
    fail('COMBAT_LIMIT', 'La sessione ha raggiunto il limite di combattimenti.');
  const attempt: CombatAttempt = {
    id: cycleUUID({ requestId, kind, groupId, parentId }),
    parentId,
    operationId: cs.operation?.id ?? null,
    heroId,
    playerId,
    groupId,
    kind,
    itemCopies: [],
    stat: null,
    cost: kind === 'hero-attack' ? 'action' : 'none',
    grantId: null,
    stage: kind === 'provocation' ? 'counterattack' : 'attack-test',
    runId: null,
    result: null,
    applied: null,
    selection: null,
    packet: null,
    outcome: null,
    frontier: null,
    movement: null,
    reward: null,
    returned: false,
  };
  cs.attempts.push(attempt);
  cs.active = attempt.id;
  return attempt;
}
/** Start only the first ready live group, preserving EnemiesInPlay order. */
export function startSourceActivation(state: State, frameId: string) {
  const cs = state.combat!,
    artifact = combatArtifact(state);
  invariant(artifact.source.shadow && !cs.active, 'Attivazione senza capacità o ritorno.');
  const g = state.scenario!.enemies!.groups.find(
    (g) => g.placed && !g.exhausted && g.figures.some((f) => f.health > 0),
  );
  if (!g) return false;
  const heroes = activeCompany(state);
  invariant(heroes.length, 'Attivazione senza eroi attivi.');
  const a = newAttempt(state, frameId, heroes[0]!.heroId, heroes[0]!.playerId, g.id, 'activation');
  a.stage = 'activation-choice';
  a.selection = selectGroupInstruction(artifact, g, cs.entropy, cs.streams);
  const instruction = selectedInstruction(state, a);
  invariant(instruction.activation, 'Istruzione senza attivazione fonte.');
  const target = instruction.activation.randomHero
    ? selectActivationHero(
        heroes.map((h) => h.heroId),
        cs.entropy,
        cs.streams,
      )
    : null;
  a.activation = {
    frameId,
    target,
    branch: null,
    recipient: null,
    movesRemaining: 0,
    stop: 0,
    interrupted: false,
    positions: [g.spaceId],
  };
  if (target) {
    a.heroId = target.heroId;
    a.playerId = heroes.find((h) => h.heroId === target.heroId)!.playerId;
  }
  return true;
}
function selectedInstruction(state: State, a: CombatAttempt) {
  return combatArtifact(state)
    .compiled.models.find((m) => m.source === a.selection!.model)!
    .instructions.find((i) => i.source === a.selection!.source)!;
}
function activationOptions(state: State, a: CombatAttempt) {
  const activation = a.activation!,
    g = group(state, a.groupId);
  const label = (id: string) => state.content!.heroes.find((h) => h.id === id)!.name.text;
  if (!activation.branch)
    return activationTargets(
      state,
      g.spaceId,
      selectedInstruction(state, a).activation!,
      activation.interrupted ? null : (activation.target?.heroId ?? null),
      effectiveGroup(combatArtifact(state), g).ranged ? 1 : 0,
    ).map((target) => ({
      ...target,
      id: `target:${target.heroId}`,
      label:
        target.branch === 'primary'
          ? `Raggiungi ${label(target.heroId)} e attacca`
          : `Alternativa: avanza verso ${label(target.heroId)}`,
    }));
  if (activation.movesRemaining)
    return activationSteps(state, g.spaceId, activation.recipient!).map((to) => {
      const ordinary = state.scenario!.spaceBindings.find((b) => b.sourceId === to)!.id;
      return {
        id: `step:${digest({ attempt: a.id, from: g.spaceId, to, positions: activation.positions })}`,
        destination: to,
        label: `Muovi ${name(state, g.id)} in ${state.journey!.definition.spaces.find((s) => s.id === ordinary)!.label}`,
      };
    });
  return [];
}
function advanceActivation(state: State, a: CombatAttempt) {
  const activation = a.activation!,
    g = group(state, a.groupId);
  if (!g.placed || g.exhausted || !g.figures.some((f) => f.health > 0)) {
    complete(state, a);
    return true;
  }
  if (!activation.branch || activation.movesRemaining) {
    if (activationOptions(state, a).length) return false;
    complete(state, a);
    return true;
  }
  if (activation.branch === 'primary' && alive(state, activation.recipient!)) {
    a.heroId = activation.recipient!;
    a.playerId = state.preparation!.heroes.find((h) => h.heroId === a.heroId)!.playerId;
    if (enemyAttack(state, a)) return true;
  }
  complete(state, a);
  return true;
}
export function startHeroAttack(
  state: State,
  playerId: string,
  c: Extract<CombatIntent, { type: 'START_ATTACK' }>,
  requestId: string,
) {
  const cs = state.combat;
  if (!cs)
    fail('COMBAT_UNAVAILABLE', 'Il combattimento non è disponibile in questa avventura salvata.');
  const option = checkAttack(state, c, playerId);
  const grant = c.grantId
    ? cs!.grants.find((g) => g.id === c.grantId && g.status === 'offered')
    : null;
  if (
    c.grantId &&
    (!grant ||
      grant.recipientHeroId !== c.heroId ||
      cs!.active !== grant.parentId ||
      current(state).stage !== 'await-grant')
  )
    fail('ATTACK_GRANT', 'La concessione d’attacco è cambiata.');
  if (!grant) {
    if (cs!.active || cs!.operation || state.physical!.snapshot.active || state.scenario!.pending)
      fail('COMBAT_PENDING', 'Concludi la conseguenza corrente.');
    if (state.round!.activeHeroId !== c.heroId) fail('TURN_CHANGED', 'Questo eroe non è di turno.');
    const progress = state.round!.heroes.find((h) => h.heroId === c.heroId)!;
    if (progress.actionsUsed >= 2) fail('NO_ACTIONS', 'Questo eroe ha già usato le due azioni.');
    progress.actionsUsed++;
  }
  const attempt = newAttempt(
    state,
    requestId,
    c.heroId,
    playerId,
    c.groupId,
    'hero-attack',
    grant?.parentId ?? null,
  );
  attempt.itemCopies = [...c.itemCopies];
  attempt.stat = c.stat;
  attempt.cost = grant ? 'grant' : 'action';
  attempt.grantId = grant?.id ?? null;
  const p = state.physical!,
    hero = p.heroes.findIndex((h) => h.heroId === c.heroId);
  const children: Extract<PhysicalProgram, { profile: 'source-fronts-v1' }>['children'] = [];
  if (grant) {
    const owner = state.preparation!.heroes.find((h) => h.heroId === grant.ownerHeroId)!;
    if (
      !alive(state, owner.heroId) ||
      !owner.prepared.includes(grant.copy) ||
      !nearby(state, owner.heroId, c.heroId)
    )
      fail('ATTACK_GRANT', 'Il costo o il destinatario della capacità non sono più legali.');
    children.push({
      kind: 'pay-attack-grant',
      hero: p.heroes.findIndex((h) => h.heroId === owner.heroId),
      recipient: hero,
      copy: grant.copy,
      clauseHash: grant.clauseHash,
    });
    grant.status = 'used';
  }
  children.push({
    kind: 'attack-test',
    hero,
    groupId: c.groupId,
    stat: c.stat,
    slots: option.slots,
    replaceCopy: c.replaceCopy,
  });
  openCombatPhysical(state, attempt, children);
  advanceCombat(state);
  return attempt;
}
function enemyAttack(state: State, attempt: CombatAttempt) {
  const a = combatArtifact(state),
    cs = state.combat!,
    g = group(state, attempt.groupId);
  const effect = effectiveGroup(a, g);
  if (!alive(state, attempt.heroId) || !g.figures.some((f) => f.health > 0)) return false;
  if (
    attempt.kind === 'hero-attack' &&
    ((!effect.elite && g.exhausted) || attempt.applied?.modifiers.includes('stun'))
  )
    return false;
  attempt.selection ??= selectGroupInstruction(a, g, cs.entropy, cs.streams);
  const executed = inRange(state, attempt.heroId, g.id, effect.ranged);
  if (!executed) {
    attempt.packet = { damage: 0, fear: 0, executed: false, reductions: [] };
    return false;
  }
  const packet = groupAttackPacket(
    a,
    g,
    attempt.selection,
    attempt.kind === 'activation'
      ? 'activation'
      : attempt.kind === 'provocation'
        ? 'provocation'
        : 'counterattack',
    cs.entropy,
    cs.streams,
  );
  attempt.packet = {
    damage: packet.damage,
    fear: packet.fear,
    executed,
    reductions: packet.reductions,
  };
  if (attempt.kind === 'hero-attack') {
    g.exhausted = true;
    if (effect.elite) g.attackReduction = (g.attackReduction ?? 0) + 1;
  }
  if (attempt.kind === 'activation') g.attackReduction = (g.attackReduction ?? 0) + 1;
  attempt.stage = 'counterattack';
  const outcome = {
    attackId: attempt.id,
    groupId: g.id,
    instructionId: attempt.selection.source,
    instructionHash: attempt.selection.fingerprint,
    recipientHeroId: attempt.heroId,
    cause:
      attempt.kind === 'activation'
        ? ('activation' as const)
        : attempt.kind === 'provocation'
          ? ('provocation' as const)
          : ('counterattack' as const),
    rootSource: `combat:${attempt.id}`,
    directSource: `combat:${attempt.id}:base`,
    returnTo: attempt.activation?.frameId ?? attempt.operationId ?? attempt.parentId ?? attempt.id,
    artifactFingerprint: a.fingerprint,
    projectionFingerprint: a.source.projectionFingerprint,
    figureIds: g.figures.filter((f) => f.health > 0).map((f) => f.id),
    offered: { damage: packet.damage, fear: packet.fear },
    negated: { damage: 0, fear: 0 },
    prevented: { damage: 0, fear: 0 },
    suffered: { damage: 0, fear: 0 },
    childSources: [],
    sealed: false,
  };
  openCombatPhysical(
    state,
    attempt,
    [
      {
        kind: 'enemy-attack',
        hero: state.physical!.heroes.findIndex((h) => h.heroId === attempt.heroId),
        negate: packet.negate,
        outcome,
        addition: null,
      },
    ],
    true,
  );
  return true;
}
function complete(state: State, attempt: CombatAttempt) {
  if (attempt.activation) {
    group(state, attempt.groupId).exhausted = true;
    const frame = state.scenario!.rounds!.frames.find((f) => f.id === attempt.activation!.frameId)!;
    invariant(
      frame.stage === 'enemies' && !frame.activated!.includes(attempt.groupId),
      'Ritorno attivazione duplicato.',
    );
    frame.activated!.push(attempt.groupId);
  }
  attempt.stage = 'completed';
  attempt.returned = true;
  attempt.runId = null;
  if (attempt.parentId) {
    state.combat!.active = attempt.parentId;
    if (attempt.kind === 'hero-attack') current(state).stage = 'after-attack';
  } else state.combat!.active = null;
}
export function advanceCombat(state: State) {
  const cs = state.combat!;
  for (let n = 0; cs.active && n < 100; n++) {
    const attempt = current(state),
      p = state.physical!;
    if (p.snapshot.active || state.scenario!.pending) return;
    if (p.cycle?.pending?.type === 'START_ATTACK') p.cycle.pending = null;
    if (attempt.stage === 'activation-choice') {
      if (advanceActivation(state, attempt)) continue;
      return;
    }
    const results = attempt.runId
      ? p.snapshot.parents.find((r) => r.id === attempt.runId)?.results
      : undefined;
    if (attempt.stage === 'attack-test') {
      const result = results?.find((r) => r.attack)?.attack;
      invariant(result, 'Attacco concluso senza risultato autorevole.');
      attempt.result = structuredClone(result);
      const applied = applyGroupHits(
        combatArtifact(state),
        group(state, attempt.groupId),
        result.hits,
        result.modifiers,
      );
      const { applied: _health, ...hitResult } = applied;
      attempt.applied = { hits: result.hits, ...hitResult };
      attempt.runId = null;
      if (applied.defeated) {
        group(state, attempt.groupId).placed = false;
        attempt.stage = 'reward';
        return;
      }
      if (enemyAttack(state, attempt)) {
        if (p.snapshot.active) return;
        continue;
      }
      attempt.stage = 'after-attack';
    } else if (attempt.stage === 'counterattack') {
      if (attempt.kind === 'provocation' && !attempt.runId) {
        if (enemyAttack(state, attempt)) {
          if (p.snapshot.active) return;
          continue;
        }
      }
      const outcome = results?.find((r) => r.enemyOutcome)?.enemyOutcome;
      if (attempt.packet?.executed) {
        invariant(outcome?.sealed, 'Contrattacco senza esito fonte chiuso.');
        attempt.outcome = structuredClone(outcome);
      }
      attempt.runId = null;
      const addition = selectedAddition(state, attempt);
      attempt.frontier = {
        addition: addition && additionDue(state, attempt) ? 'pending' : 'not-due',
        physicalRole: null,
      };
      attempt.stage = 'enemy-frontier';
    }
    if (attempt.stage === 'movement') {
      if (advanceMovement(state, attempt)) continue;
      return;
    }
    if (attempt.stage === 'enemy-frontier') {
      if (attempt.runId) {
        if (attempt.frontier!.physicalRole === 'addition') attempt.frontier!.addition = 'completed';
        attempt.runId = null;
        attempt.frontier!.physicalRole = null;
      }
      if (!additionCanResolve(state, attempt)) attempt.frontier!.addition = 'not-due';
      const choices = frontierOptions(state, attempt);
      if (choices.length === 1) {
        beginFrontier(state, attempt, choices[0]!.id);
        if (p.snapshot.active) return;
        continue;
      }
      if (choices.length) return;
      if (attempt.kind === 'provocation' || attempt.kind === 'activation') {
        complete(state, attempt);
        continue;
      }
      attempt.stage = 'after-attack';
    }
    if (!alive(state, attempt.heroId)) {
      complete(state, attempt);
      continue;
    }
    if (attempt.stage === 'after-attack') {
      if (!grantOffers(state, attempt).length) {
        complete(state, attempt);
        continue;
      }
      return;
    }
    if (attempt.stage === 'reward' || attempt.stage === 'await-grant') return;
  }
}
function selectedAddition(state: State, a: CombatAttempt) {
  if (!a.selection) return null;
  return combatArtifact(state)
    .compiled.models.find((m) => m.source === a.selection!.model)!
    .instructions.find((i) => i.source === a.selection!.source)!.addition;
}
function additionCanResolve(state: State, a: CombatAttempt) {
  return (
    alive(state, a.heroId) || selectedAddition(state, a)?.effect.op === 'move-pair-toward-threat'
  );
}
function additionDue(state: State, a: CombatAttempt) {
  const addition = selectedAddition(state, a),
    o = a.outcome;
  if (!addition || !o) return false;
  const p = addition.predicate;
  const ordinary = state.journey!.heroes.find((h) => h.heroId === a.heroId)!.spaceId;
  const source = state.scenario!.spaceBindings.find((b) => b.id === ordinary)!.sourceId;
  invariant(state.mapGeneration?.status === 'frozen', 'Conseguenza senza contesto.');
  return (
    p === 'always' ||
    (p === 'damage-positive' && o.suffered.damage > 0) ||
    (p === 'fear-positive' && o.suffered.fear > 0) ||
    (p === 'zero-damage-and-fear' && !o.suffered.damage && !o.suffered.fear) ||
    (p === 'recipient-in-darkness' &&
      (combatArtifact(state).source.shadow
        ? combatDarknessHeroes(state).includes(
            state.preparation!.heroes.findIndex((h) => h.heroId === a.heroId),
          )
        : state.mapGeneration.projection.spaces.find((s) => s.id === source)!.hasDarkness))
  );
}
function frontierOptions(state: State, a: CombatAttempt) {
  const p = state.physical!;
  const obligations = p.snapshot.areas.flatMap((area) => {
    if (!alive(state, area.heroId)) return [];
    const limits = physicalLimits(p, area.heroId);
    const due = (['damage', 'fear'] as const).filter((f) => area[f].length >= limits[f]);
    const label = state.content!.heroes.find((h) => h.id === area.heroId)!.name.text;
    return due.length > 1 && area.heroId !== a.heroId
      ? [
          {
            id: `last-stand:${area.heroId}:choose`,
            label: `${label} · scegli questo eroe per Ultimo Sforzo`,
          },
        ]
      : due.map((family) => ({
          id: `last-stand:${area.heroId}:${family}`,
          label: `${label} · Ultimo Sforzo ${family === 'damage' ? 'danni' : 'paure'}`,
        }));
  });
  if (a.frontier?.addition === 'pending' && additionCanResolve(state, a))
    obligations.push({ id: 'addition', label: 'Risolvi la conseguenza aggiuntiva dell’attacco' });
  return obligations;
}
function beginFrontier(state: State, a: CombatAttempt, choice: string) {
  invariant(
    frontierOptions(state, a).some((o) => o.id === choice),
    'Frontiera superata.',
  );
  if (choice === 'addition') {
    const addition = selectedAddition(state, a)!;
    a.frontier!.addition = 'resolving';
    if (addition.effect.op === 'move-pair-toward-threat') {
      a.stage = 'movement';
      a.movement = { done: [], selected: null, provoked: [], exploring: false };
      return;
    }
    a.frontier!.physicalRole = 'addition';
    openCombatPhysical(
      state,
      a,
      [
        {
          kind: 'combat-addition',
          hero: state.physical!.heroes.findIndex((h) => h.heroId === a.heroId),
          addition,
          outcome: a.outcome!,
        },
      ],
      true,
    );
  } else {
    const [, heroId, family] = choice.split(':');
    invariant(
      family === 'damage' || family === 'fear' || family === 'choose',
      'Famiglia P2 estranea.',
    );
    a.frontier!.physicalRole = 'last-stand';
    openCombatPhysical(
      state,
      a,
      [
        {
          kind: 'last-stand-one',
          hero: state.physical!.heroes.findIndex((h) => h.heroId === heroId),
          family: family === 'choose' ? null : family,
        },
      ],
      true,
    );
  }
}
function movementOptions(state: State, a: CombatAttempt) {
  return threatMovements(state, a).map((m) => {
    const ordinary = state.scenario!.spaceBindings.find((b) => b.sourceId === m.destination)!.id;
    return {
      ...m,
      label: `Muovi ${m.actor === 'hero' ? state.content!.heroes.find((h) => h.id === a.heroId)!.name.text : name(state, a.groupId)} verso ${state.journey!.definition.spaces.find((s) => s.id === ordinary)!.label}`,
    };
  });
}
function advanceMovement(state: State, a: CombatAttempt): boolean {
  const move = a.movement!;
  if (move.exploring) {
    if (state.scenario!.pending || state.scenario!.explorations?.active) return false;
    move.done.push('hero');
    move.selected = null;
    move.provoked = [];
    move.exploring = false;
  }
  if (move.selected) {
    const choice = movementOptions(state, a).find(
      (m) =>
        m.actor === move.selected!.actor &&
        m.from === move.selected!.from &&
        m.destination === move.selected!.destination &&
        m.targetId === move.selected!.targetId,
    );
    if (!choice) {
      move.selected = null;
      move.provoked = [];
      return true;
    }
    if (choice.actor === 'group') {
      moveEnemyOneSpace(state, a, choice.destination);
      move.done.push('group');
      move.selected = null;
      return true;
    }
    const sc = state.scenario!,
      g = sc.enemies!.groups.find(
        (g) =>
          g.placed &&
          !g.exhausted &&
          g.spaceId === choice.from &&
          g.figures.some((f) => f.health > 0) &&
          !move.provoked.includes(g.id),
      );
    if (g) {
      const missing = preflightCombatGroup(combatArtifact(state), g, {
        boons: state.physical!.snapshot.resolution!.resources!.boons,
        quantities: null,
        artifact: state.physical?.boons,
        custody: state.physical?.snapshot.resolution?.resources?.boonCustody,
        heroIds: state.physical?.heroes.map((h) => h.heroId),
      });
      invariant(!missing.length && !g.logic, 'Closure della provocazione figlia non preflightata.');
      move.provoked.push(g.id);
      const child = newAttempt(
        state,
        `${a.id}:forced-move:${move.provoked.length}`,
        a.heroId,
        a.playerId,
        g.id,
        'provocation',
        a.id,
      );
      enemyAttack(state, child);
      return true;
    }
    const from = sc.spaceBindings.find((b) => b.sourceId === choice.from)!.id,
      destination = sc.spaceBindings.find((b) => b.sourceId === choice.destination)!.id;
    invariant(state.mapGeneration?.status === 'frozen', 'Movimento senza realizzazione.');
    const space = state.mapGeneration.projection.spaces.find((s) => s.id === choice.destination)!;
    const tile = sc.tiles.find((t) => t.source === space.tileSource)!;
    if (!tile.explored) {
      const entropy = digest({
        stream: 'combat-exploration-v1',
        entropy: state.combat!.entropy,
        attempt: a.id,
        destination,
      });
      move.exploring = true;
      exploreScenario(
        state,
        a.playerId,
        {
          type: 'EXPLORE_SCENARIO',
          requestId: cycleUUID({ attempt: a.id, destination }),
          generation: state.generation,
          expectedRevision: state.revision,
          mapId: state.journey!.id,
          roundId: state.round!.id,
          turnId: state.round!.turnId,
          heroId: a.heroId,
          fromSpaceId: from,
          destinationSpaceId: destination,
          scenarioId: sc.id,
          packFingerprint: sc.packFingerprint,
          projectionFingerprint: sc.projectionFingerprint,
          sourceFingerprint: digest(explorationSource(sc, space.tileSource)),
        },
        entropy,
        a.id,
      );
      return false;
    }
    applyGrantedMove(state, a.id, a.heroId, from, destination);
    move.done.push('hero');
    move.selected = null;
    move.provoked = [];
    return true;
  }
  const options = movementOptions(state, a);
  for (const actor of ['hero', 'group'] as const)
    if (!move.done.includes(actor) && !options.some((o) => o.actor === actor))
      move.done.push(actor);
  if (move.done.length === 2) {
    a.frontier!.addition = 'completed';
    a.stage = 'enemy-frontier';
    return true;
  }
  return false;
}
function grantOffers(state: State, attempt: CombatAttempt) {
  const h = state.preparation!.heroes.find((h) => h.heroId === attempt.heroId)!;
  if (!alive(state, h.heroId)) return [];
  return combatArtifact(state)
    .compiled.clauses.filter(
      (c) => c.window === 'after-attack-after-counterattack' && c.effect.op === 'granted-attack',
    )
    .flatMap((clause) =>
      h.prepared
        .filter((copy) => definitionId(copy) === clause.cardId)
        .flatMap((copy) =>
          state
            .preparation!.heroes.filter(
              (to) =>
                to.heroId !== h.heroId &&
                alive(state, to.heroId) &&
                nearby(state, h.heroId, to.heroId),
            )
            .map((to) => {
              const options = attackOffers(state, to.heroId);
              const available = options.some((o) => !o.reason);
              return {
                id: `grant:${copy}:${to.heroId}`,
                copy,
                to: to.heroId,
                clause,
                reason: available
                  ? null
                  : 'Questo eroe non può risolvere un attacco completo al momento.',
              };
            }),
        ),
    );
}
export function combatPending(state: State): CombatView['pending'] {
  if (!state.combat?.active || state.physical?.snapshot.active) return null;
  const a = current(state),
    h = state.preparation!.heroes.find((h) => h.heroId === a.heroId)!;
  let title = '',
    heroId = h.heroId,
    actorPlayerId = h.playerId;
  let options: NonNullable<CombatView['pending']>['options'] = [];
  if (a.stage === 'activation-choice') {
    const target = a.activation!.target?.heroId;
    title = a.activation!.branch
      ? 'Scegli il prossimo passo del percorso minimo.'
      : `Scegli il destinatario legale dell’istruzione.${target ? ` Destinatario iniziale: ${state.content!.heroes.find((h) => h.id === target)!.name.text}.` : ''}`;
    options = activationOptions(state, a).map(({ id, label }) => ({ id, label }));
  } else if (a.stage === 'enemy-frontier') {
    title = 'La fonte è conclusa. Scegli l’ordine di Ultimo Sforzo e delle conseguenze simultanee.';
    options = frontierOptions(state, a);
  } else if (a.stage === 'movement') {
    title =
      'Muovete entrambi verso il segnalino minaccia più vicino, se possibile. Scegli ordine e percorso fra quelli legali.';
    options = movementOptions(state, a).map(({ id, label }) => ({ id, label }));
  } else if (a.stage === 'reward') {
    const actor = state.preparation!.heroes.find((h) => alive(state, h.heroId));
    if (!actor) return null;
    heroId = actor.heroId;
    actorPlayerId = actor.playerId;
    title = 'Il gruppo è stato sconfitto. Scegli l’eroe che ottiene 1 ispirazione.';
    options = state
      .preparation!.heroes.filter(
        (h) =>
          alive(state, h.heroId) && (h.heroId === a.heroId || nearby(state, a.heroId, h.heroId)),
      )
      .map((h) => ({
        id: `reward:${h.heroId}`,
        label: state.content!.heroes.find((x) => x.id === h.heroId)!.name.text,
      }));
  } else if (a.stage === 'after-attack') {
    title = 'Dopo l’attacco: risolvi una capacità disponibile oppure torna al turno.';
    options = [
      { id: 'close', label: 'Concludi l’attacco e torna al turno' },
      ...grantOffers(state, a).map((o) => ({
        id: o.id,
        label: `Scarta ${state.content!.skills.find((s) => s.id === o.clause.cardId)!.name.text}: 1 ispirazione e attacco di ${state.content!.heroes.find((h) => h.id === o.to)!.name.text}`,
        ...(o.reason ? { unavailable: o.reason } : {}),
      })),
    ];
  } else if (a.stage === 'await-grant') {
    const grant = state.combat.grants.find((g) => g.parentId === a.id && g.status === 'offered')!;
    heroId = grant.recipientHeroId;
    actorPlayerId = state.preparation!.heroes.find((h) => h.heroId === heroId)!.playerId;
    title =
      'Puoi risolvere l’attacco concesso. Scegli bersaglio e armi, oppure rinuncia prima del costo.';
    options = [{ id: 'decline-grant', label: 'Rinuncia all’attacco concesso' }];
  } else return null;
  if (!alive(state, heroId)) {
    const active = state.preparation!.heroes.find((h) => alive(state, h.heroId));
    if (!active) return null;
    heroId = active.heroId;
    actorPlayerId = active.playerId;
  }
  const sourceFingerprint = digest({ a, options, heroId });
  return {
    id: cycleUUID({ combat: a.id, sourceFingerprint }),
    combatId: a.id,
    sourceFingerprint,
    actorPlayerId,
    heroId,
    title,
    options,
  };
}
export function answerCombat(
  state: State,
  playerId: string,
  c: Extract<CombatIntent, { type: 'COMBAT_INPUT' }>,
  requestId: string,
) {
  const q = combatPending(state);
  if (
    !q ||
    q.combatId !== c.combatId ||
    q.id !== c.pendingId ||
    q.sourceFingerprint !== c.sourceFingerprint
  )
    fail('COMBAT_CHANGED', 'Questa scelta di combattimento è conclusa o è cambiata.');
  if (q!.actorPlayerId !== playerId)
    throw new ApiError(403, 'COMBAT_ACTOR', 'La scelta spetta al proprietario indicato.');
  const option = q!.options.find((o) => o.id === c.choice);
  if (!option || option.unavailable)
    fail('COMBAT_OPTION', option?.unavailable ?? 'La scelta non è disponibile.');
  const a = current(state);
  if (a.stage === 'activation-choice') {
    const option = activationOptions(state, a).find((o) => o.id === c.choice)!,
      activation = a.activation!;
    if ('heroId' in option) {
      activation.branch = option.branch;
      activation.recipient = option.heroId;
      a.heroId = option.heroId;
      a.playerId = state.preparation!.heroes.find((h) => h.heroId === option.heroId)!.playerId;
      activation.movesRemaining = option.moves;
      activation.stop = option.stop;
    } else {
      placeEnemyInSpace(state, group(state, a.groupId), option.destination);
      activation.positions.push(option.destination);
      activation.movesRemaining--;
    }
  } else if (a.stage === 'enemy-frontier') beginFrontier(state, a, c.choice);
  else if (a.stage === 'movement') {
    const move = movementOptions(state, a).find((m) => m.id === c.choice)!;
    a.movement!.selected = {
      actor: move.actor,
      from: move.from,
      destination: move.destination,
      targetId: move.targetId,
    };
  } else if (c.choice === 'close') complete(state, a);
  else if (c.choice === 'decline-grant') {
    state.combat!.grants.find((g) => g.parentId === a.id && g.status === 'offered')!.status =
      'declined';
    a.stage = 'after-attack';
  } else if (a.stage === 'reward') {
    const heroId = c.choice.slice('reward:'.length),
      hero = state.physical!.heroes.findIndex((h) => h.heroId === heroId),
      before = state.preparation!.heroes[hero]!.inspiration;
    openCombatPhysical(state, a, [{ kind: 'inspiration', hero, amount: 1 }]);
    a.reward = { heroId, amount: state.preparation!.heroes[hero]!.inspiration - before };
    a.runId = null;
    a.stage = 'after-attack';
  } else {
    const offer = grantOffers(state, a).find((o) => o.id === c.choice)!;
    state.combat!.grants.push({
      id: cycleUUID({ requestId, offer: c.choice }),
      parentId: a.id,
      ownerHeroId: a.heroId,
      recipientHeroId: offer.to,
      copy: offer.copy,
      clauseHash: digest(offer.clause),
      status: 'offered',
    });
    a.stage = 'await-grant';
  }
  advanceCombat(state);
  return a;
}
export function combatView(state: State): CombatView | undefined {
  if (!state.combat) return undefined;
  const a = state.combat.active ? current(state) : null;
  const grant = state.combat.grants.find((g) => g.status === 'offered' && g.parentId === a?.id);
  const turnHero = grant?.recipientHeroId ?? state.round?.activeHeroId;
  const available =
    turnHero && (!a || !!grant) && !state.physical?.snapshot.active && !state.scenario?.pending;
  const replacements = state.preparation!.heroes.flatMap((h) =>
    combatArtifact(state)
      .compiled.clauses.filter((c) => c.window === 'before-test' && c.effect.op === 'replace-stat')
      .flatMap((c) =>
        h.prepared
          .filter((copy) => definitionId(copy) === c.cardId)
          .map((copy) => ({
            heroId: h.heroId,
            copy,
            stat: c.effect.op === 'replace-stat' ? c.effect.stat : ('might' as const),
            inspiration: c.effect.op === 'replace-stat' ? c.effect.inspiration : 0,
          })),
      ),
  );
  const last = state.combat.attempts.filter((a) => a.returned).at(-1);
  const returnLabel = (a: CombatAttempt) => {
    if (a.activation && a.returned) {
      if (state.round?.phase === 'action')
        return 'L’Ombra è conclusa. Riprendete i turni nel nuovo round.';
      if (state.round?.phase === 'rally')
        return 'L’attivazione è conclusa. Proseguite con le Scoperte della compagnia.';
      return 'L’attivazione è conclusa. Proseguite con gli altri passaggi dell’Ombra.';
    }
    if (a.activation)
      return 'Riprende l’Ombra con il prossimo gruppo pronto, poi oscurità e minaccia.';
    const op = a.operationId ? state.combat!.operations.find((o) => o.id === a.operationId) : null;
    if (op?.status === 'cancelled') return op.reason!;
    return a.operationId
      ? 'Riprende il movimento o l’interazione sospesa.'
      : a.parentId
        ? 'Riprende la capacità che ha concesso l’attacco.'
        : 'Riprende il turno con le azioni e i movimenti rimasti.';
  };
  return {
    artifactFingerprint: state.combat.artifactFingerprint,
    attacks: available ? attackOffers(state, turnHero!) : [],
    replacements,
    current: a
      ? {
          id: a.id,
          heroId: a.heroId,
          kind: a.kind,
          groupId: a.groupId,
          name: name(state, a.groupId),
          stage: a.stage,
          cost: a.cost,
          returnLabel: returnLabel(a),
          instruction: a.selection
            ? (() => {
                const artifact = combatArtifact(state),
                  i = artifact.compiled.models
                    .find((m) => m.source === a.selection!.model)!
                    .instructions.find((i) => i.source === a.selection!.source)!;
                const activation = a.activation;
                const instruction =
                  activation && i.activation
                    ? activation.branch === 'alternative'
                      ? i.activation.alternative.value
                      : activation.interrupted
                        ? i.activation.interrupted.value
                        : i.activation.primary.value.replaceAll(
                            '{0}',
                            activation.target
                              ? state.content!.heroes.find(
                                  (h) => h.id === activation.target!.heroId,
                                )!.name.text
                              : '',
                          )
                    : null;
                return (
                  (instruction ? instruction + '\n\n' : '') +
                  (activation?.branch === 'alternative'
                    ? ''
                    : i.text.value +
                      (i.addition
                        ? '\n\n' +
                          artifact.source.texts.find((t) => t.key === i.addition!.key)!.value
                        : ''))
                );
              })()
            : null,
          packet: a.packet,
          result: a.result,
          applied: a.applied,
          ...(a.activation
            ? {
                activation: {
                  initialHeroId: a.activation.target?.heroId ?? null,
                  recipientHeroId: a.activation.recipient,
                  branch: a.activation.branch,
                  movesRemaining: a.activation.movesRemaining,
                },
              }
            : {}),
        }
      : null,
    pending: combatPending(state),
    grant: grant ? { id: grant.id, heroId: grant.recipientHeroId, parentId: grant.parentId } : null,
    last: last
      ? {
          heroId: last.heroId,
          name: name(state, last.groupId),
          kind: last.kind,
          hits: last.result?.hits ?? null,
          returnLabel: returnLabel(last),
        }
      : null,
  };
}

/** Ready groups are kept in deployment order; each completed provocation has a durable return. */
export function nextProvocation(state: State) {
  const cs = state.combat!,
    op = cs.operation;
  if (!op || cs.active || !alive(state, op.origin.heroId)) return false;
  const ordinary = state.journey!.heroes.find((h) => h.heroId === op.origin.heroId)!.spaceId;
  const source = state.scenario!.spaceBindings.find((b) => b.id === ordinary)!.sourceId;
  const groups = state.scenario!.enemies!.groups.filter(
    (g) =>
      g.placed &&
      !g.exhausted &&
      g.spaceId === source &&
      g.figures.some((f) => f.health > 0) &&
      !op.provoked.includes(g.id),
  );
  for (const g of groups) {
    const missing = preflightCombatOperation(
      state,
      combatArtifact(state),
      g,
      op.origin.heroId,
      'provocation',
    );
    if (g.logic || missing.length)
      fail(
        'PROVOCATION_CLOSURE',
        missing.includes('boon-quantities-57')
          ? 'La provocazione può richiedere benefici la cui riserva non è ancora verificata. Nessun costo o movimento è stato applicato.'
          : 'La provocazione richiede una conseguenza non ancora disponibile. Nessun costo o movimento è stato applicato.',
      );
  }
  const g = groups[0];
  if (!g) return false;
  op.provoked.push(g.id);
  const attempt = newAttempt(
    state,
    op.requestId,
    op.origin.heroId,
    op.playerId,
    g.id,
    'provocation',
  );
  enemyAttack(state, attempt);
  advanceCombat(state);
  return true;
}
