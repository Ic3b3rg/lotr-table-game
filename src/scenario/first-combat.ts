import type { ScenarioPack } from '../shared/scenario';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';
import { verifyCombatClosure } from '../combat/compiler';
import { verifySourceDeployment } from '../combat/deployment-compiler';
import type { State } from '../server/state';
import type { Projection } from '../shared/generated-map';
import type { ScenarioAction } from '../shared/scenario';
import type { DeployedGroup } from '../shared/deployment';
import { cycleUUID } from '../physical-resolution/cycle-request';
import { createFigures } from '../combat/figures';
import { assignGroupTokens } from '../combat/deployment';
import { boonAcquisitionProblems } from '../physical-resolution/boon-stock';
import { ApiError } from '../server/errors';

export function firstCombatDefinition(pack: ScenarioPack, source: string) {
  return (
    pack.manifest.firstCombat?.definitions.some(
      (d) => d.role === 'person' && d.source === source,
    ) ?? false
  );
}

/** A single optional source bridge. It grants no permission to other prefabs or receivers. */
export function validateFirstCombat(pack: ScenarioPack) {
  const cap = pack.manifest.firstCombat;
  const additions = pack.definitions.flatMap((d) =>
    d.states.flatMap((s) =>
      s.actions
        .filter(
          (a) =>
            a.op === 'spawnFixed' || a.op === 'removeEnemies' || (a.op === 'message' && a.boon),
        )
        .map((a) => ({ d, s, a })),
    ),
  );
  if (!cap) {
    invariant(!additions.length, 'Primo scontro senza capacità congelata.');
    return;
  }
  const prefab = pack.manifest.prefabs.find((p) => p.source === cap.prefab);
  const role = (name: string) => {
    const row = cap.definitions.find((d) => d.role === name);
    const d = pack.definitions.find((d) => d.source === row?.source);
    invariant(row && d && row.definitionHash === digest(d), 'Owner del primo scontro alterato.');
    return d;
  };
  invariant(
    new Set(cap.definitions.map((d) => d.source)).size === 4 &&
      new Set(cap.definitions.map((d) => d.role)).size === 4,
    'Owner duplicati del primo scontro.',
  );
  const person = role('person'),
    principal = role('principal'),
    timer = role('timer'),
    logic = role('logic');
  invariant(new Set(Object.values(cap.events)).size === 7, 'Eventi del primo scontro ambigui.');
  for (const [event, owner] of [
    [cap.events.normal, principal],
    [cap.events.variant, principal],
    [cap.events.arm, timer],
    [cap.events.revealed, timer],
    [cap.events.escape, timer],
    [cap.events.hide, person],
  ] as const) {
    const receivers = pack.definitions.filter((d) => d.handlers[event] !== undefined);
    invariant(
      receivers.length === 1 &&
        receivers[0] === owner &&
        pack.definitions.every((d) => !d.deferredHandlers[event]),
      'Receiver del primo scontro incompleto o estraneo.',
    );
  }
  invariant(
    pack.manifest.scope === 'original-encounter-v1' &&
      prefab &&
      prefab.fsmSource === person.source &&
      digest(prefab) === cap.prefabHash &&
      principal.source === pack.principal &&
      pack.timers.includes(timer.source) &&
      pack.manifest.combat?.fingerprint === cap.combatFingerprint &&
      digest(pack.manifest.followup) === cap.followupFingerprint &&
      digest(pack.manifest.rounds) === cap.roundsFingerprint &&
      digest(pack.manifest.failure ?? null) === cap.failureFingerprint &&
      pack.manifest.followup?.projectionFingerprint === cap.projectionFingerprint &&
      pack.manifest.rounds?.configuration.difficulty === cap.configuration.difficulty &&
      pack.manifest.rounds.configuration.mapType === cap.configuration.mapType &&
      pack.manifest.followup.instances.filter(
        (i) => i.definition === logic.source && i.kind === 'logic' && !i.hasNode,
      ).length === 1 &&
      !pack.manifest.playablePrefabs?.includes(prefab.source) &&
      !pack.manifest.clues?.encounters.includes(prefab.source) &&
      !pack.manifest.linked?.encounters.some((e) => e.prefab === prefab.source) &&
      ![
        pack.manifest.items?.prefab,
        pack.manifest.baseProducts?.prefab,
        pack.manifest.lair?.prefab,
      ].includes(prefab.source),
    'Primo scontro senza contesto, prefab, logica e controller corrispondenti.',
  );
  const source = verifySourceDeployment(pack.manifest.followup.deployment),
    model = source.compiled.models.find((m) => m.source === cap.model.source);
  invariant(
    model &&
      model.maximum === 3 &&
      model.capacity === 6 &&
      model.costs.find((c) => c.size === 2)?.points === 13 &&
      source.source.assets.some(
        (a) => a.source === model.source && a.objectHash === cap.model.objectHash,
      ) &&
      verifyCombatClosure(pack.manifest.combat).compiled.models.some(
        (m) => m.source === model.source,
      ) &&
      [cap.pose.gameObject, cap.pose.tileSource, cap.pose.tileModel, cap.pose.spaceSource].every(
        (s) => pack.sources.some((f) => f.file === s.split(':')[0]),
      ),
    'Modello o posa del primo gruppo non attestati.',
  );
  const at = (d: typeof person, index: number | undefined) =>
    d.states.find((s) => s.index === index);
  const normal = at(principal, principal.handlers[cap.events.normal]),
    variant = at(principal, principal.handlers[cap.events.variant]);
  invariant(
    normal &&
      variant &&
      normal !== variant &&
      [normal, variant].every(
        (s, n) =>
          s.actions.length === 1 &&
          s.actions[0]?.op === 'spawnFixed' &&
          s.actions[0].model === cap.model.source &&
          s.actions[0].logic === logic.source &&
          s.actions[0].spaceId === cap.pose.spaceId &&
          s.actions[0].grant === (n === 1) &&
          s.transitions[s.actions[0].successEvent] !== undefined &&
          s.transitions[s.actions[0].failureEvent] !== undefined,
      ),
    'Spawn normale/variante o concessione fuori dal proprio owner.',
  );
  const arm = at(timer, timer.handlers[cap.events.arm]),
    visible = at(timer, timer.handlers[cap.events.revealed]);
  invariant(
    arm?.actions.length === 1 &&
      arm.actions[0]?.op === 'set' &&
      arm.actions[0].value === true &&
      arm.actions[0].target.scope === 'local' &&
      arm.actions[0].target.name === cap.bindings.armed &&
      visible?.actions.length === 1 &&
      visible.actions[0]?.op === 'flip' &&
      visible.actions[0].target.scope === 'local' &&
      visible.actions[0].target.name === cap.bindings.revealed &&
      timer.variables.some(
        (v) => v.type === 'int' && v.name === cap.bindings.timerValue && v.value === 2,
      ) &&
      logic.handlers[cap.events.defeated] !== undefined &&
      timer.handlers[cap.events.escape] !== undefined,
    'Timer o callback senza i receiver fonte.',
  );
  const actions = person.states.flatMap((s) => s.actions);
  const choices = actions.filter((a) => a.op === 'choice'),
    tests = actions.filter((a) => a.op === 'challenge');
  invariant(
    choices.length === 1 &&
      choices[0]?.op === 'choice' &&
      choices[0].options.length === 3 &&
      choices[0].options.every((o) => o.cost === 'interact' && !o.requirement) &&
      choices[0].cancel &&
      tests.length === 2 &&
      tests.every(
        (a) =>
          a.op === 'challenge' &&
          'kind' in a.sum &&
          a.sum.value === 0 &&
          a.bounds.every((b) => typeof b.maximum === 'number'),
      ) &&
      !Object.keys(person.deferredHandlers).length &&
      person.states.every((s) => !Object.keys(s.deferredTransitions ?? {}).length),
    'Opzioni o challenge del segnalino incomplete o cumulative.',
  );
  invariant(
    tests.some(
      (a) =>
        a.op === 'challenge' &&
        a.stat === 'might' &&
        a.bounds.map((b) => b.maximum).join(',') === '0,2,3',
    ) &&
      tests.some(
        (a) =>
          a.op === 'challenge' &&
          a.stat === 'agility' &&
          a.bounds.map((b) => b.maximum).join(',') === '0,1',
      ),
    'Limiti superiori ordinati della persona alterati.',
  );
  const rewards = actions.filter((a) => a.op === 'message' && a.inspiration),
    consequences = actions.filter((a) => a.op === 'message' && a.consequence),
    boons = actions.flatMap((a) => (a.op === 'message' && a.boon ? [a.boon] : []));
  invariant(
    rewards.length === 1 &&
      consequences.length === 1 &&
      consequences[0]?.op === 'message' &&
      consequences[0].consequence?.family === 'fear' &&
      consequences[0].consequence.amount === 2 &&
      consequences[0].consequence.face === 'faceup' &&
      boons.length === 2 &&
      boons.includes('emboldened') &&
      boons.includes('hidden'),
    'Risorse, benefici o conseguenze della persona alterati.',
  );
  invariant(
    additions.filter((r) => r.a.op === 'spawnFixed').length === 2 &&
      additions.filter((r) => r.a.op === 'removeEnemies').length === 1 &&
      additions.every(({ d, s, a }) =>
        a.op === 'spawnFixed'
          ? d === principal && [normal, variant].includes(s)
          : a.op === 'removeEnemies'
            ? d === timer &&
              s.actions.some(
                (next) =>
                  next.index > a.index &&
                  next.op === 'send' &&
                  next.definition === logic.source &&
                  next.event === cap.events.defeated,
              )
            : d === person,
      ),
    'Istruzioni del primo scontro fuori dalla closure proprietaria.',
  );
  const visited = new Set<number>();
  let cursor: number | undefined = logic.handlers[cap.events.defeated];
  while (cursor !== undefined) {
    invariant(!visited.has(cursor), 'Callback del primo scontro ciclica.');
    visited.add(cursor);
    const s = at(logic, cursor)!;
    invariant(
      s &&
        s.actions.every(
          (a) =>
            (a.op === 'message' &&
              a.mode === 'ordinary' &&
              !a.inspiration &&
              !a.consequence &&
              !a.boon &&
              !a.sprint) ||
            ['lore', 'section', 'objective', 'hideNode', 'stop'].includes(a.op) ||
            (a.op === 'broadcast' && a.event === cap.events.escape) ||
            (a.op === 'send' && a.definition === timer.source && a.event === cap.events.escape),
        ),
      'Callback fuori dalla continuazione chiusa.',
    );
    invariant(
      Object.keys(s.transitions).every((e) => e === 'FINISHED'),
      'Callback con una nuova decisione non attestata.',
    );
    cursor = s.actions.some((a) => a.op === 'stop') ? undefined : s.transitions.FINISHED;
  }
  invariant(
    logic.states.every(
      (s) => visited.has(s.index) || (s.index === logic.initial && !s.actions.length),
    ) &&
      logic.states.flatMap((s) => s.actions).filter((a) => a.op === 'section').length === 1 &&
      logic.states.flatMap((s) => s.actions).filter((a) => a.op === 'objective').length === 1,
    'Inventario della callback incompleto.',
  );
}

export function validateFirstCombatBinding(pack: ScenarioPack, p: Projection) {
  const cap = pack.manifest.firstCombat;
  if (!cap) return;
  const space = p.spaces.find((s) => s.id === cap.pose.spaceId),
    tile = p.sections.flatMap((s) => s.tiles).find((t) => t.source === cap.pose.tileSource);
  invariant(
    cap.projectionFingerprint === p.fingerprint &&
      digest(p.context.ownedProductIds) === digest(cap.configuration.ownedProductIds) &&
      space &&
      tile &&
      space.tileSource === tile.source &&
      tile.hashId === cap.pose.tileHash &&
      tile.modelSource === cap.pose.tileModel &&
      space.source === cap.pose.spaceSource &&
      space.index === cap.pose.index &&
      pack.manifest.rounds?.configuration.initialEnemyGroups.length === 0,
    'Primo scontro di un altro prodotto, configurazione o posa realizzata.',
  );
}

export function validateFirstCombatState(state: State) {
  const sc = state.scenario!;
  invariant(
    !!sc.pack.manifest.firstCombat === !!sc.firstCombat,
    'Primo scontro introdotto o rimosso dopo lo startup.',
  );
  if (sc.firstCombat && !state.physical?.cycle)
    invariant(
      !sc.firstCombat.spawns.length && !sc.firstCombat.callbacks.length,
      'Origine del primo scontro riscritta dopo lo startup.',
    );
}

function missionState(state: State) {
  const sc = state.scenario!;
  invariant(
    sc.pack.manifest.firstCombat && sc.firstCombat,
    'Primo scontro non inizializzato allo startup.',
  );
  return sc.firstCombat;
}

/** Resolve the reciprocal group/logic association from the saved source receipt. */
export function firstCombatGroup(state: State, g: DeployedGroup) {
  const sc = state.scenario,
    cap = sc?.pack?.manifest.firstCombat;
  if (!cap || !sc?.firstCombat || !g.logic) return false;
  const binding = sc.firstCombat.spawns.find((s) => s.groupId === g.id && s.outcome === 'spawned');
  const owner = sc.instances.find((i) => i.id === binding?.logicInstanceId);
  return !!(
    binding &&
    owner &&
    owner.kind === 'logic' &&
    owner.definition === g.logic &&
    cap.definitions.some((d) => d.role === 'logic' && d.source === g.logic) &&
    g.source === cap.model.source
  );
}

export function firstCombatRefreshReady(state: State, group: DeployedGroup) {
  if (!firstCombatGroup(state, group)) return false;
  const pack = state.scenario!.pack,
    event = pack.manifest.combat?.source.shadow?.beforeUnexhaust,
    d = pack.definitions.find((d) => d.source === group.logic)!;
  return (
    !!event &&
    d.handlers[event] === undefined &&
    !d.deferredHandlers[event] &&
    d.states.every((s) => s.transitions[event] === undefined && !s.deferredTransitions?.[event])
  );
}

export function requireFirstCombat(state: State, heroId: string) {
  const sc = state.scenario!,
    cap = sc.pack.manifest.firstCombat!;
  missionState(state);
  validateFirstCombat(sc.pack);
  invariant(state.mapGeneration?.status === 'frozen', 'Primo scontro senza freeze.');
  validateFirstCombatBinding(sc.pack, state.mapGeneration.projection);
  const kinds = sc.pack.definitions
    .find((d) => firstCombatDefinition(sc.pack, d.source))!
    .states.flatMap((s) =>
      s.actions.flatMap((a) => (a.op === 'message' && a.boon ? [a.boon] : [])),
    );
  const p = state.physical!;
  const missing = p.boons
    ? boonAcquisitionProblems(p.boons, p.snapshot.resolution?.resources?.boonCustody ?? [], kinds, [
        heroId,
      ])
    : ['boon-quantities-57'];
  if (missing.length)
    throw new ApiError(
      409,
      'SCENARIO_BOON_CAPABILITY',
      'Un esito della persona richiede benefici la cui riserva o continuazione non è verificata. Nessun costo, carta o scelta casuale è stato applicato.',
    );
  const a = sc.pack.definitions
    .find((d) => d.source === sc.pack.principal)!
    .states.flatMap((s) => s.actions)
    .find((a) => a.op === 'spawnFixed')!;
  invariant(a.op === 'spawnFixed' && a.model === cap.model.source, 'Spawn proprietario assente.');
  firstSpawnPlan(state, a);
  invariant(
    !firstCombatCallbackProblems(state).length,
    'Continuazione del primo scontro incompleta.',
  );
}

/** This callback has only source-owned messages, resources, placements and a targeted timer return. */
export function firstCombatCallbackProblems(state: State) {
  const sc = state.scenario!,
    cap = sc.pack.manifest.firstCombat;
  if (!cap || !sc.firstCombat || state.mapGeneration?.status !== 'frozen')
    return ['scenario-combat-continuation'];
  const logicSource = cap.definitions.find((d) => d.role === 'logic')!.source,
    timerSource = cap.definitions.find((d) => d.role === 'timer')!.source;
  const logic = sc.instances.find((i) => i.definition === logicSource),
    timer = sc.instances.find((i) => i.definition === timerSource);
  if (!logic || !timer || logic.stopped || timer.stopped || sc.firstCombat.callbacks.length)
    return ['scenario-combat-continuation'];
  const p = state.mapGeneration.projection;
  for (const a of sc.pack.definitions
    .find((d) => d.source === logicSource)!
    .states.flatMap((s) => s.actions)) {
    if (a.op === 'section') {
      const section = p.sections.find((s) => s.id === a.sectionId);
      if (
        !section ||
        section.tiles.some(
          (t) =>
            !sc.tiles.some((v) => v.source === t.source) ||
            !sc.pack.manifest.followup!.explorationNodes.some((n) => n.tileSource === t.source) ||
            !p.spaces.some((s) => s.tileSource === t.source),
        )
      )
        return ['scenario-combat-section'];
    }
    if (
      a.op === 'objective' &&
      a.bindings?.some(
        (b) =>
          typeof (b.ref.scope === 'global' ? sc.globals : logic.variables)[b.ref.name] !== 'number',
      )
    )
      return ['scenario-combat-objective'];
  }
  return [];
}

export function sourceAttackGrant(state: State) {
  const sc = state.scenario;
  const receipt = sc?.firstCombat?.spawns.find((s) => s.grant === 'offered');
  if (
    !receipt ||
    sc?.pending?.kind !== 'source-attack' ||
    sc.pending.actorPlayerId !== receipt.playerId ||
    sc.pending.heroId !== receipt.actorHeroId
  )
    return null;
  return receipt;
}

export function recordFirstCombatCallback(
  state: State,
  id: string,
  cause: 'defeated' | 'timer',
  groupId: string | null,
) {
  const sc = state.scenario!,
    cap = sc.pack.manifest.firstCombat!,
    data = missionState(state);
  const logic = sc.instances.find(
    (i) => i.definition === cap.definitions.find((d) => d.role === 'logic')!.source,
  )!;
  invariant(
    logic && !logic.stopped && !data.callbacks.length,
    'Callback del gruppo duplicata o senza owner.',
  );
  if (groupId) {
    const group = sc.enemies!.groups.find((g) => g.id === groupId);
    invariant(
      group &&
        firstCombatGroup(state, group) &&
        (cause === 'timer' || group.figures.every((f) => f.health === 0)),
      'Callback senza rimozione autorevole del gruppo.',
    );
    group.placed = false;
    group.tokenId = -1;
  }
  data.callbacks.push({ id, cause, groupId, logicInstanceId: logic.id, returned: false });
  return logic;
}

/** Source availability counts living and pending figures, independently of physical inventory. */
function firstSpawnPlan(state: State, a: Extract<ScenarioAction, { op: 'spawnFixed' }>) {
  const sc = state.scenario!,
    cap = sc.pack.manifest.firstCombat!,
    model = verifySourceDeployment(sc.pack.manifest.followup!.deployment).compiled.models.find(
      (m) => m.source === a.model,
    )!;
  const live = sc
    .enemies!.groups.filter((g) => !g.removed && g.source === model.source)
    .reduce((n, g) => n + g.figures.filter((f) => f.health > 0).length, 0);
  const available = model.capacity - live;
  invariant(available >= 0, 'Disponibilità del gruppo oltre il limite applicativo.');
  if (available > 0 && available < a.size)
    throw new ApiError(
      409,
      'SCENARIO_ENEMY_FIGURE_SUPPLY',
      'Non ci sono due posti disponibili per il gruppo richiesto. La fonte non certifica una riduzione a una figura: nessun costo o effetto è stato applicato.',
    );
  invariant(
    !cap.configuration.initialReserved.length && !cap.configuration.initialPending.length,
    'Riserve iniziali non attestate.',
  );
  const before = sc.globals[sc.pack.manifest.followup!.enemyPointsBinding];
  invariant(
    typeof before === 'number' && Number.isInteger(before) && before >= 0,
    'Budget nemico non valido.',
  );
  const local = before + a.additionalPoints,
    cost = model.costs.find((c) => c.size === a.size)!.points;
  const outcome = !available
    ? ('unavailable' as const)
    : local < model.costs.find((c) => c.size === 1)!.points
      ? ('unaffordable' as const)
      : ('spawned' as const);
  return {
    model,
    available,
    before,
    outcome,
    after:
      outcome === 'spawned'
        ? Math.min(5 * state.preparation!.heroes.length, Math.max(0, local - cost))
        : before,
  };
}

export function spawnFirstCombat(
  state: State,
  a: Extract<ScenarioAction, { op: 'spawnFixed' }>,
  effectId: string,
) {
  const sc = state.scenario!,
    data = missionState(state),
    cap = sc.pack.manifest.firstCombat!,
    actor = sc.play?.attempts.find((a) => a.id === sc.play?.active);
  invariant(actor && !data.spawns.length, 'Spawn senza attore o già materializzato.');
  const plan = firstSpawnPlan(state, a),
    logic = sc.instances.find((i) => i.definition === a.logic && i.kind === 'logic');
  invariant(logic && !logic.stopped, 'Logica dello spawn non disponibile.');
  const id = cycleUUID({ scenario: sc.id, effectId, kind: 'first-combat' }),
    groupId = plan.outcome === 'spawned' ? `${id}/group/0` : null;
  data.spawns.push({
    id,
    effectId,
    actorHeroId: actor.heroId,
    playerId: actor.playerId,
    logicInstanceId: logic.id,
    groupId,
    outcome: plan.outcome,
    budgetBefore: plan.before,
    budgetAfter: plan.after,
    availableBefore: plan.available,
    availableAfter: plan.available - (groupId ? a.size : 0),
    grant: groupId && a.grant ? 'offered' : 'none',
    attackId: null,
    returned: false,
  });
  if (groupId) {
    invariant(state.mapGeneration?.status === 'frozen', 'Spawn senza posa realizzata.');
    const space = state.mapGeneration.projection.spaces.find((s) => s.id === cap.pose.spaceId)!;
    const group: DeployedGroup = {
      id: groupId,
      source: a.model,
      logic: a.logic,
      bonuses: [],
      tokenId: -1,
      exhausted: false,
      placed: false,
      spaceId: space.id,
      tileSource: space.tileSource,
      position: [...space.nodePosition],
      figures: createFigures(groupId, a.size, plan.model.stats),
    };
    assignGroupTokens(
      verifySourceDeployment(sc.pack.manifest.followup!.deployment).compiled,
      sc.enemies!.groups.filter((g) => !g.removed && g.figures.some((f) => f.health > 0)),
      [group],
    );
    sc.enemies!.groups.push(group);
    sc.globals[sc.pack.manifest.followup!.enemyPointsBinding] = plan.after;
  }
  return data.spawns[0]!;
}
