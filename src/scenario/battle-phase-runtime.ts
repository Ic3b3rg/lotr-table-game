import type { State } from '../server/state';
import type { ScenarioAction, ScenarioInstance } from '../shared/scenario';
import { SourceTextSchema } from '../shared/scenario';
import type { DeployedGroup } from '../shared/deployment';
import { invariant } from '../map-freeze/validate';
import { digest } from '../map-freeze/hash';
import { cycleUUID } from '../physical-resolution/cycle-request';
import { compileSourceDeployment, linkedEnemySources } from '../combat/deployment-compiler';
import { assignGroupTokens } from '../combat/deployment';
import { generateBattleDeployment } from './battle-deployment';
import { livingEnemyGroups } from './deployment';
import { battleSpatial } from './battle-combat';

export function battlePhase(state: State) {
  const sc = state.scenario!,
    cap = sc.pack.manifest.battleStartup?.battleRounds;
  if (!cap) return undefined;
  invariant(
    sc.rounds?.version === 'source-battle-rounds-v1',
    'Fasi prive del proprio stato fonte.',
  );
  return { cap, data: sc.rounds.battle };
}
export function battleCallback(state: State) {
  return battlePhase(state)
    ?.data.callbacks.slice()
    .reverse()
    .find((c) => !c.returned);
}
export function sourceActor(state: State) {
  const sc = state.scenario!,
    cb = battleCallback(state);
  if (cb)
    return { id: cb.id, heroId: cb.heroId, playerId: cb.playerId, instanceId: cb.logicInstanceId };
  return sc.play?.attempts.find((a) => a.id === sc.play?.active);
}
/** The reciprocal group/logic binding is created only by the certified source spawn. */
export function battleLogicGroup(state: State, group: DeployedGroup) {
  const phase = battlePhase(state);
  if (!phase || !group.battleRecipe) return false;
  const binding = phase.data.groups.find((g) => g.groupId === group.id),
    recipe = phase.cap.combat.source.scriptedGroups?.find((r) => r.key === group.battleRecipe),
    instance = state.scenario!.instances.find((i) => i.id === binding?.logicInstanceId);
  return !!(
    recipe &&
    binding &&
    binding.recipe === recipe.key &&
    instance?.definition === recipe.logic &&
    group.logic === recipe.logic &&
    digest(group.bonuses) === digest(recipe.bonuses)
  );
}
export function battleCallbackProblems(state: State, group?: DeployedGroup) {
  const phase = battlePhase(state);
  if (!phase) return ['battle-callback-source'];
  if (
    state.physical?.version !== 3 ||
    !state.physical.fronts ||
    !state.physical.lastStand ||
    !state.scenario?.pack.manifest.failure
  )
    return ['battle-callback-physical'];
  const index = group
    ? phase.cap.combat.source.scriptedGroups?.findIndex((r) => r.key === group.battleRecipe)
    : 0;
  const required =
    index === 0
      ? 3
      : index === 1 && phase.cap.heroIds.length > 4
        ? 2 *
          state.preparation!.heroes.filter((h) => {
            const pos = state.journey!.heroes.find((p) => p.heroId === h.heroId)!;
            return (
              !pos.removed &&
              state.scenario!.spaceBindings.find((b) => b.id === pos.spaceId)?.sourceId ===
                group?.spaceId
            );
          }).length
        : 0;
  if (state.physical.snapshot.decks.damage.length < required)
    return ['battle-callback-damage-supply'];
  return [];
}
export function beginBattleCallback(state: State, attackId: string, groupId: string) {
  const phase = battlePhase(state),
    sc = state.scenario!;
  if (!phase) return undefined;
  const g = sc.enemies!.groups.find((g) => g.id === groupId)!;
  if (!battleLogicGroup(state, g)) return undefined;
  invariant(
    !battleCallback(state) && !phase.data.callbacks.some((c) => c.attackId === attackId),
    'Callback battaglia duplicato o sovrapposto.',
  );
  const a = state.combat!.attempts.find((a) => a.id === attackId)!,
    binding = phase.data.groups.find((r) => r.groupId === g.id)!,
    logic = sc.instances.find((i) => i.id === binding.logicInstanceId)!;
  invariant(
    a &&
      a.groupId === groupId &&
      a.applied?.defeated &&
      g.figures.every((f) => f.health === 0) &&
      !a.returned,
    'DEFEATED senza l’attacco e le figure effettivamente sconfitte.',
  );
  invariant(
    !logic.stopped && !battleCallbackProblems(state, g).length,
    'Callback privo del consumer completo.',
  );
  phase.data.callbacks.push({
    id: cycleUUID({ scenario: sc.id, attackId, groupId, event: 'DEFEATED' }),
    attackId,
    groupId,
    logicInstanceId: logic.id,
    heroId: a.heroId,
    playerId: a.playerId,
    exhausted: g.exhausted,
    nextGroupId: null,
    returned: false,
  });
  return logic;
}
export function finishBattleCallbacks(state: State) {
  for (const cb of battlePhase(state)?.data.callbacks ?? [])
    if (
      !cb.returned &&
      (state.scenario!.conclusion ||
        state.scenario!.instances.find((i) => i.id === cb.logicInstanceId)!.stopped)
    )
      cb.returned = true;
}
function consumeBanners(state: State, groups: DeployedGroup[]) {
  const pools = battlePhase(state)!.data.bannerPools;
  pools.normal = pools.normal.filter(
    (id) => !groups.some((g) => !g.bonuses.length && g.tokenId === id),
  );
  pools.elite = pools.elite.filter(
    (id) => !groups.some((g) => g.bonuses.length && g.tokenId === id),
  );
}
/** DefeatGroup returns the token before its coroutine enters DEFEATED. ReturnUniqueId inserts at zero. */
export function returnBattleBanner(state: State, group: DeployedGroup) {
  const phase = battlePhase(state);
  if (!phase) return;
  const pools = phase.data.bannerPools;
  invariant(!pools.returnedGroups.includes(group.id), 'Stendardo restituito due volte.');
  pools.returnedGroups.push(group.id);
  if (group.tokenId < 0) return;
  const pool = group.bonuses.length ? pools.elite : pools.normal;
  invariant(!pool.includes(group.tokenId), 'Stendardo già nella riserva.');
  pool.unshift(group.tokenId);
}
export function releaseBattleBanner(state: State, count: number) {
  const data = battlePhase(state)!.data;
  invariant(
    data.reservedEliteBanners >= count && data.bannerPools.reservedElite.length >= count,
    'Riserva stendardi insufficiente.',
  );
  for (let n = 0; n < count; n++)
    data.bannerPools.elite.unshift(data.bannerPools.reservedElite.shift()!);
  data.reservedEliteBanners -= count;
}
export function materializeBattleSpawn(
  state: State,
  owner: ScenarioInstance,
  a: Extract<ScenarioAction, { op: 'battleSpawn' }>,
  effectId: string,
) {
  const phase = battlePhase(state);
  invariant(phase, 'Spawn fuori dalle fasi certificate.');
  const { cap, data } = phase,
    sc = state.scenario!,
    enemies = sc.enemies!,
    plan = cap.spawns[a.plan]!;
  invariant(
    plan &&
      plan.origin.definition === owner.definition &&
      plan.origin.state === owner.state &&
      plan.origin.action === a.index &&
      plan.origin.parameterHash === a.origin.parameterHash &&
      enemies.entropy &&
      !enemies.attempts.some((p) => p.effectId === effectId),
    'Spawn privo della propria azione o già eseguito.',
  );
  if (plan.kind === 'points') {
    const enemyPoints = sc.globals[cap.enemyPointsBinding];
    invariant(
      typeof enemyPoints === 'number' &&
        Number.isSafeInteger(enemyPoints) &&
        enemyPoints >= 0 &&
        enemyPoints <= 10000,
      'EnemyPoints non intero.',
    );
    const points = plan.points.map((p) => {
      const point = cap.points.find((q) => q.source === p.source)!;
      invariant(point, 'Punto spawn assente.');
      return { ...point, perHero: p.perHero };
    });
    const wave = generateBattleDeployment(
      sc.pack.manifest.battleStartup!,
      cap.heroIds.length,
      enemies.entropy,
      {
        source: cap.deployment,
        points,
        enemyPoints,
        inPlay: livingEnemyGroups(state),
        reserved: data.reserved,
        reservedEliteBanners: data.reservedEliteBanners,
        cursor: enemies.cursor,
        banners: data.bannerPools,
        id: `battle-wave/${cycleUUID({ scenario: sc.id, effectId })}`,
      },
    );
    consumeBanners(state, wave.groups);
    enemies.groups.push(...wave.groups);
    enemies.cursor = wave.cursor;
    invariant(wave.battleWave, 'Onda priva del budget fonte.');
    enemies.attempts.push({
      effectId,
      battleWave: wave.battleWave,
      groups: wave.groups.map((g) => g.id),
      remaining: wave.attempts.reduce((n, p) => n + p.remaining, 0),
      reason: wave.groups.length ? null : 'no-eligible-model',
      draws: wave.attempts.flatMap((p) => p.draws),
    });
    return;
  }
  const recipe = cap.combat.source.scriptedGroups!.find((r) => r.key === plan.recipe)!;
  invariant(
    recipe && !data.groups.some((g) => g.recipe === recipe.key),
    'Ricetta assente o logica già collegata.',
  );
  const { layout } = battleSpatial(state),
    cb = battleCallback(state),
    point = cap.points.find((p) => p.source === plan.anchor),
    anchor = layout.placements.find((p) => p.id === plan.anchor),
    old = cb ? enemies.groups.find((g) => g.id === cb.groupId) : undefined,
    actor = cb ? state.journey!.heroes.find((h) => h.heroId === cb.heroId) : undefined,
    cell =
      plan.kind === 'tracker'
        ? plan.pose === 'previous-group'
          ? old?.spaceId
          : sc.spaceBindings.find((b) => b.id === actor?.spaceId)?.sourceId
        : (point?.cell ?? anchor?.cell),
    position = plan.kind === 'tracker' ? old?.position : (point?.position ?? anchor?.position);
  invariant(cell && position, 'Spawn senza posa fonte o attore.');
  const cellVertices = layout.patches.filter((p) => p.cell === cell).flatMap((p) => p.vertices);
  const pose: [number, number, number] =
    plan.kind === 'tracker' && plan.pose === 'actor'
      ? [
          Math.fround(cellVertices.reduce((n, p) => n + p[0], 0) / cellVertices.length),
          Math.fround(cellVertices.reduce((n, p) => n + p[1], 0) / cellVertices.length),
          0,
        ]
      : [...position];
  const raw = cap.combat.source.assets.find((r) => r.source === recipe.model)!.data;
  const live = livingEnemyGroups(state);
  const available =
    Number(raw.MaxUnitsInPlay) -
    live
      .filter((g) => linkedEnemySources(cap.deployment, g.source, recipe.model))
      .reduce((n, g) => n + g.figures.filter((f) => f.health > 0).length, 0) -
    data.reserved
      .filter((r) => linkedEnemySources(cap.deployment, r.source, recipe.model))
      .reduce((n, r) => n + r.count, 0);
  if (plan.kind === 'fixed' && available < recipe.baseStats.length) {
    enemies.attempts.push({
      effectId,
      groups: [],
      remaining: 0,
      reason: 'no-eligible-model',
      draws: [],
    });
    return;
  }
  const id = cycleUUID({ scenario: sc.id, effectId, kind: 'battle-scripted-group' }),
    group: DeployedGroup = {
      id,
      source: recipe.model,
      battleRecipe: recipe.key,
      bonuses: [...recipe.bonuses],
      logic: recipe.logic,
      tokenId: -1,
      exhausted: false,
      placed: false,
      spaceId: cell,
      tileSource: sc.pack.identity.adventureSource,
      position: pose,
      figures: recipe.baseStats.map((s, n) => {
        const stats = { ...s };
        for (const ref of recipe.bonuses) {
          const bonus = cap.combat.source.assets.find((a) => a.source === ref)!.data;
          stats.health += Number(bonus.Health);
          stats.armor += Number(bonus.Armor);
          stats.sorcery += Number(bonus.Sorcery);
        }
        return { id: `${id}/figure/${n}`, ...stats };
      }),
    };
  assignGroupTokens(
    {
      ...compileSourceDeployment(cap.deployment).compiled,
      normalBanners: data.bannerPools.normal,
      eliteBanners: data.bannerPools.elite,
    },
    live,
    [group],
  );
  consumeBanners(state, [group]);
  const instance = sc.instances.find((i) => i.definition === recipe.logic)!;
  invariant(
    instance && !data.groups.some((g) => g.logicInstanceId === instance.id),
    'Logica già associata.',
  );
  data.groups.push({
    groupId: id,
    recipe: recipe.key,
    logicInstanceId: instance.id,
    effectId,
    actorHeroId: cb?.heroId ?? null,
  });
  if (cb) cb.nextGroupId = id;
  enemies.groups.push(group);
  enemies.attempts.push({ effectId, groups: [id], remaining: 0, reason: null, draws: [] });
}
export function battleGroupText(state: State, groupId: string) {
  const cap = battlePhase(state)!.cap,
    g = state.scenario!.enemies!.groups.find((g) => g.id === groupId)!,
    asset = cap.combat.source.assets.find((a) => a.source === g.source)!,
    name =
      cap.deployment.texts[String(asset.data.KeySingular)] ??
      cap.combat.source.texts.find((t) => t.key === asset.data.KeySingular)?.value;
  invariant(name, 'Nome dello spawn non attestato.');
  return SourceTextSchema.parse(cap.deploymentText).map((t) =>
    t.kind === 'text'
      ? {
          ...t,
          text: t.text.replaceAll('{count}', String(g.figures.length)).replaceAll('{enemy}', name),
        }
      : t,
  );
}
