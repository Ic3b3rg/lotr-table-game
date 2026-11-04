import { digest } from '../map-freeze/hash';
import { bounded, check, unique } from './model';
import type { CombatArtifact } from './compiler';
import {
  AttackResultSchema,
  ExternalResultSchema,
  type Command,
  type CombatSeed,
  type KernelState,
  type Proof,
  type TrustedCombatPort,
  type AttackQuery,
  type ExternalQuery,
  type Receipt,
  type Gate,
  type Continuation,
  type EnemySelection,
  type ScenarioCallback,
} from './kernel-model';
import { selectInstruction } from './selection';
import { resolveFigureHits } from './figures';

function inRange(a: CombatArtifact, from: string, to: string, ranged: boolean): boolean {
  return (
    from === to ||
    (ranged &&
      a.source.projection.movementGraph.edges.some(
        ({ a: x, b: y }) => (x === from && y === to) || (y === from && x === to),
      ))
  );
}
function hero(state: KernelState, heroId: string) {
  const h = state.heroes.find((h) => h.heroId === heroId);
  check(h && !h.defeated, 'Eroe estraneo/sconfitto.');
  return h;
}
function boundProof(
  result: {
    artifactFingerprint: string;
    projectionFingerprint: string;
    contextFingerprint: string;
  },
  query: AttackQuery | ExternalQuery,
) {
  check(
    result.artifactFingerprint === query.artifactFingerprint &&
      result.projectionFingerprint === query.projectionFingerprint &&
      result.contextFingerprint === digest(query),
    'Risultato fidato cross-source/contesto.',
  );
}
export function planAttack(
  a: CombatArtifact,
  seed: CombatSeed,
  state: KernelState,
  command: Extract<Command, { kind: 'plan' }>,
  port: TrustedCombatPort,
  replayProof: Proof | null,
): { receipt: Receipt; proof: Proof } | Gate {
  const group = state.group!;
  check(!state.pendingPlan, 'Piano già aperto.');
  const h = hero(state, command.heroId);
  if (h.requiredHooks.length) return { status: 'gated', gates: h.requiredHooks };
  const equipped = a.source.projection.context.heroes.find(
    (h) => h.catalogId === command.heroId,
  )!.items;
  unique(command.itemCopies, 'Oggetto selezionato');
  const items = command.itemCopies.map((copy) => {
    const binding = equipped.find((i) => i.copy === copy),
      item = a.compiled.items.find((i) => i.id === binding?.catalogId);
    check(
      item?.stat === command.stat && item.slots.length > 0,
      'Oggetto estraneo/non arma o caratteristica discordante.',
    );
    return { copy, item };
  });
  check(
    inRange(
      a,
      h.spaceId,
      group.position.spaceId,
      items.every((i) => i.item.ranged),
    ),
    'Bersaglio fuori range.',
  );
  unique(
    command.slots.map((s) => `${s.copyId}\0${s.slotId}`),
    'Slot',
  );
  const slots = command.slots.map((choice) => {
    const slot = items
      .find((i) => i.copy === choice.copyId)
      ?.item.slots.find((s) => s.id === choice.slotId);
    check(slot, 'Slot non appartenente agli oggetti equipaggiati selezionati.');
    return { choice, slot };
  });
  if (!replayProof && !port.attackResult) return { status: 'gated', gates: ['attack-controller'] };
  check(!replayProof || replayProof.kind === 'attack', 'Prova di tipo errato.');
  const query: AttackQuery = {
    kind: 'completed-attack-test-v1',
    id: command.id,
    runId: seed.id,
    artifactFingerprint: a.fingerprint,
    projectionFingerprint: a.projectionFingerprint,
    stateFingerprint: digest(state),
    groupId: group.id,
    heroId: h.heroId,
    spaceId: h.spaceId,
    itemCopies: command.itemCopies,
    stat: command.stat,
  };
  const raw =
    replayProof?.kind === 'attack'
      ? replayProof.result
      : port.attackResult!(structuredClone(query));
  bounded(raw);
  const result = AttackResultSchema.parse(raw);
  boundProof(result, query);
  check(
    result.heroId === h.heroId && result.stat === command.stat,
    'Prova di altro eroe/caratteristica.',
  );
  unique(result.successes, 'Successo');
  unique(result.requiredHooks, 'Hook risultato');
  check(!state.usedResultIds.includes(result.id), 'Risultato prova già speso.');
  check(
    a.source.projection.spaces.some((s) => s.id === result.afterTest.spaceId),
    'Posizione dopo-prova non congelata.',
  );
  if (result.requiredHooks.length) return { status: 'gated', gates: result.requiredHooks };
  let spent = 0;
  const allocations = slots.map(({ choice, slot }) => {
    check(spent + slot.cost <= result.successes.length, 'Successi insufficienti per gli slot.');
    const successes = result.successes.slice(spent, spent + slot.cost);
    spent += slot.cost;
    return { ...choice, successes };
  });
  const data = {
    id: command.id,
    resultId: result.id,
    heroId: h.heroId,
    groupId: group.id,
    revision: state.revision,
    stateFingerprint: digest(state),
    artifactFingerprint: a.fingerprint,
    projectionFingerprint: a.projectionFingerprint,
    allocations,
    hits: slots.reduce((n, s) => n + s.slot.hits, 0),
    modifiers: [...new Set(slots.flatMap((s) => s.slot.modifiers))],
    unspent: result.successes.slice(spent),
    afterTest: result.afterTest,
  };
  const plan = { ...data, fingerprint: digest(data) };
  state.pendingPlan = plan;
  state.usedResultIds.push(result.id);
  return {
    receipt: { id: command.id, status: 'planned', plan },
    proof: { kind: 'attack', result },
  };
}

function physicalContinuation(
  a: CombatArtifact,
  seed: CombatSeed,
  state: KernelState,
  id: string,
  heroId: string,
  cause: EnemySelection['cause'],
  returnTo: { kind: 'after-attack' | 'movement' | 'interaction'; id: string },
): Continuation {
  const group = state.group!;
  // Eligibility and selection precede range; never filter a missing addition consumer.
  const selection = selectInstruction(a, seed, state, id, heroId, cause);
  const h = state.heroes.find((h) => h.heroId === heroId)!;
  if (!inRange(a, h.spaceId, group.position.spaceId, a.compiled.enemy.ranged)) {
    check(cause === 'counterattack', 'Provocazione fuori range.');
    return { kind: 'after-attack', heroId, reason: 'out-of-range', selection };
  }
  if (cause === 'counterattack') group.exhausted = true;
  const continuation: Continuation = {
    kind: 'physical',
    status: 'pending-consumer',
    cause,
    heroId,
    groupId: group.id,
    selection,
    dependencies: selection.dependencies,
    returnTo,
  };
  state.suspended = continuation;
  return continuation;
}

export function applyHits(a: CombatArtifact, state: KernelState, hits: number, pierce: boolean) {
  const { removed, unusedHits } = resolveFigureHits(state.group!.figures, hits, pierce);
  state.availability.inPlay -= removed.length;
  state.availability.available += removed.length;
  if (state.group!.figures.every((f) => f.health === 0)) state.group!.status = 'defeated';
  return { removed, unusedHits };
}

function defeated(
  state: KernelState,
  id: string,
  heroId: string | null,
  cause: ScenarioCallback['cause'],
): ScenarioCallback {
  const group = state.group!;
  check(!state.callbacks.some((c) => c.groupId === group.id), 'Callback di gruppo già emesso.');
  const continuation: ScenarioCallback = {
    kind: 'scenario-callback',
    id: `${id}/defeated`,
    groupId: group.id,
    heroId,
    cause,
    target: group.logic.fsm,
    event: 'DEFEATED',
    state: group.logic.defeatedState,
    dependencies: ['scenario-continuation'],
  };
  state.callbacks.push(continuation);
  state.suspended = continuation;
  return continuation;
}
export function applyPlan(
  a: CombatArtifact,
  seed: CombatSeed,
  state: KernelState,
  command: Extract<Command, { kind: 'apply' }>,
): Receipt {
  const plan = state.pendingPlan,
    group = state.group!;
  check(
    plan &&
      plan.fingerprint === command.planFingerprint &&
      plan.groupId === group.id &&
      plan.revision + 1 === state.revision,
    'Piano stale/estraneo o già applicato.',
  );
  const h = state.heroes.find((h) => h.heroId === plan.heroId)!;
  Object.assign(h, plan.afterTest);
  const result = applyHits(a, state, plan.hits, plan.modifiers.includes('pierce'));
  state.pendingPlan = null;
  const stun = plan.modifiers.includes('stun');
  if (stun) group.exhausted = true;
  let continuation: Continuation;
  if (group.status === 'defeated') continuation = defeated(state, command.id, h.heroId, 'attack');
  else if (seed.activation) {
    continuation = {
      kind: 'resume-activation',
      activation: seed.activation,
      status: 'pending-consumer',
      exhausted: group.exhausted,
      dependencies: ['shadow-runtime'],
    };
    state.suspended = continuation;
  } else if (stun || group.exhausted || h.defeated)
    continuation = {
      kind: 'after-attack',
      heroId: h.heroId,
      reason: stun ? 'stun' : h.defeated ? 'attacker-defeated' : 'exhausted',
      selection: null,
    };
  else
    continuation = physicalContinuation(
      a,
      seed,
      state,
      `${command.id}/instruction`,
      h.heroId,
      'counterattack',
      { kind: 'after-attack', id: plan.id },
    );
  return { id: command.id, status: 'applied', hits: plan.hits, ...result, continuation };
}
export function applyExternal(
  a: CombatArtifact,
  seed: CombatSeed,
  state: KernelState,
  command: Extract<Command, { kind: 'external' }>,
  port: TrustedCombatPort,
  replayProof: Proof | null,
): { receipt: Receipt; proof: Proof } | Gate {
  check(!state.pendingPlan, 'Piano attacco aperto.');
  if (!replayProof && !port.externalEffect)
    return { status: 'gated', gates: ['external-effect-adapter'] };
  check(!replayProof || replayProof.kind === 'external', 'Prova esterna di tipo errato.');
  const query: ExternalQuery = {
    kind: 'external-effect-v1',
    id: command.id,
    effectId: command.effectId,
    runId: seed.id,
    artifactFingerprint: a.fingerprint,
    projectionFingerprint: a.projectionFingerprint,
    stateFingerprint: digest(state),
    groupId: state.group!.id,
  };
  const raw =
    replayProof?.kind === 'external'
      ? replayProof.result
      : port.externalEffect!(structuredClone(query));
  bounded(raw);
  const result = ExternalResultSchema.parse(raw);
  boundProof(result, query);
  unique(result.modifiers, 'Modificatore');
  check(!state.usedResultIds.includes(result.id), 'Effetto già applicato.');
  state.usedResultIds.push(result.id);
  const applied = applyHits(a, state, result.hits, result.modifiers.includes('pierce'));
  if (result.modifiers.includes('stun')) state.group!.exhausted = true;
  const continuation: Continuation =
    state.group!.status === 'defeated'
      ? defeated(state, command.id, null, 'external-effect')
      : { kind: 'external-complete' };
  return {
    receipt: { id: command.id, status: 'applied', hits: result.hits, ...applied, continuation },
    proof: { kind: 'external', result },
  };
}
export function provoke(
  a: CombatArtifact,
  seed: CombatSeed,
  state: KernelState,
  command: Extract<Command, { kind: 'provoke' }>,
): Receipt {
  check(!state.pendingPlan, 'Piano attacco aperto.');
  const h = hero(state, command.heroId),
    group = state.group!;
  const reason = group.exhausted
    ? 'exhausted'
    : h.spaceId !== group.position.spaceId
      ? 'out-of-range'
      : null;
  return {
    id: command.id,
    status: 'provoked',
    continuation: reason
      ? { kind: 'provocation-skipped', reason, returnTo: command.returnTo }
      : physicalContinuation(
          a,
          seed,
          state,
          `${command.id}/instruction`,
          h.heroId,
          'provocation',
          command.returnTo,
        ),
  };
}
