import type { State } from '../server/state';
import type { ScenarioPack } from '../shared/scenario';
import { definitionId } from '../shared/preparation';
import { digest } from '../map-freeze/hash';
import { ApiError } from '../server/errors';
import { invariant } from '../map-freeze/validate';
export function validatePreparedPolicies(pack: ScenarioPack, content: State['content']) {
  const policies = pack.preparedEffects ?? [];
  invariant(
    new Set(policies.map((p) => p.skillId)).size === policies.length,
    'Policy carta duplicate.',
  );
  for (const p of policies) {
    const card = content?.skills.find((c) => c.id === p.skillId);
    invariant(
      card && card.identityStatus === 'confirmed' && digest(card) === p.cardHash,
      'Definizione carta non corrispondente alla policy fonte.',
    );
  }
}
export function requirePreparedCapability(pack: ScenarioPack, copy: string | null) {
  if (!copy) return;
  const p = pack.preparedEffects?.find((p) => p.skillId === definitionId(copy));
  if (p?.effect === 'requires-capability')
    throw new ApiError(
      409,
      'SCENARIO_PHYSICAL_CAPABILITY',
      `Questa preparazione richiede una capacità fisica ancora non disponibile (${p.capability}). Nessuna carta è stata cambiata: scegli un’altra carta o conservala nel mazzo.`,
    );
}
export function preparedReward(state: State, heroId: string, copy: string, source: string) {
  const sc = state.scenario!,
    p = sc.pack.preparedEffects?.find((p) => p.skillId === definitionId(copy));
  requirePreparedCapability(sc.pack, copy);
  if (!p || p.effect !== 'inspiration') return;
  const id = `${source}:${heroId}:${copy}`;
  sc.cardEffects ??= [];
  invariant(!sc.cardEffects.some((e) => e.id === id), 'Trigger preparato duplicato.');
  const hero = state.preparation!.heroes.find((h) => h.heroId === heroId)!,
    limit = state.content!.heroes.find((h) => h.id === heroId)!.stats.inspiration;
  const reward = hero.inspiration < limit ? 1 : 0;
  hero.inspiration += reward;
  sc.cardEffects.push({ id, heroId, copy, policyHash: digest(p), source, reward });
}
export function validatePreparedRewards(state: State) {
  const sc = state.scenario!;
  validatePreparedPolicies(sc.pack, state.content);
  const effects = sc.cardEffects ?? [];
  const heroes = state.preparation!.heroes;
  invariant(
    sc.initialInspiration.length === heroes.length &&
      new Set(sc.initialInspiration.map((h) => h.heroId)).size === heroes.length &&
      sc.initialInspiration.every((h) => heroes.some((x) => x.heroId === h.heroId)),
    'Risorse iniziali incoerenti.',
  );
  const values = new Map(sc.initialInspiration.map((h) => [h.heroId, h.value]));
  invariant(
    sc.initialInspiration.every(
      (h) => h.value <= state.content!.heroes.find((d) => d.id === h.heroId)!.stats.inspiration,
    ),
    'Risorse iniziali oltre il limite.',
  );
  for (const e of effects) {
    const limit = state.content!.heroes.find((h) => h.id === e.heroId)!.stats.inspiration,
      previous = values.get(e.heroId)!;
    invariant(e.reward === (previous < limit ? 1 : 0), 'Ricompensa della preparazione incoerente.');
    values.set(e.heroId, previous + e.reward);
  }
  for (const c of sc.completedSetup.filter((c) => c.kind === 'test'))
    values.set(c.heroId, values.get(c.heroId)! - c.converted + c.reward);
  if (state.skillTest?.status === 'converting')
    values.set(
      state.skillTest.heroId,
      values.get(state.skillTest.heroId)! - state.skillTest.converted,
    );
  const physical = state.physical;
  if (physical && physical.version !== 1 && physical.runs.length) {
    const initial = physical.runs[0]!.context!.preparation;
    const resources = physical.snapshot.resolution!.resources!.preparation;
    for (const hero of heroes) {
      invariant(
        values.get(hero.heroId) ===
          initial.heroes.find((h) => h.heroId === hero.heroId)!.inspiration,
        'Ispirazione iniziale fisica non derivata dal setup fonte.',
      );
      values.set(hero.heroId, resources.heroes.find((h) => h.heroId === hero.heroId)!.inspiration);
    }
  }
  for (const hero of heroes)
    invariant(
      values.get(hero.heroId) === hero.inspiration,
      'Ispirazione non coerente con preparazione/prove/conversioni fonte.',
    );

  invariant(
    new Set(effects.map((e) => e.id)).size === effects.length,
    'Trigger preparati ripetuti.',
  );
  for (const e of effects) {
    const p = sc.pack.preparedEffects?.find((p) => p.skillId === definitionId(e.copy));
    invariant(
      p?.effect === 'inspiration' &&
        digest(p) === e.policyHash &&
        e.id === `${e.source}:${e.heroId}:${e.copy}`,
      'Trigger senza fonte.',
    );
    const hero = state.preparation!.heroes.find((h) => h.heroId === e.heroId);
    invariant(hero, 'Trigger senza eroe.');
    if (e.source === 'initial') {
      const initial =
        physical && physical.version !== 1 && physical.runs[0]?.context
          ? physical.runs[0].context.preparation.heroes.find((h) => h.heroId === hero.heroId)!
          : hero;
      const first = state.content!.roles.find((r) => r.id === hero.roleId)!.skills[0]!;
      invariant(
        definitionId(e.copy) === first && initial.prepared.includes(e.copy),
        'Abilità iniziale non preparata.',
      );
    } else
      invariant(
        sc.completedSetup.some(
          (c) =>
            c.kind === 'scout' &&
            c.heroId === e.heroId &&
            c.source === e.source &&
            c.revealed.includes(e.copy),
        ),
        'Trigger senza Scoperta fonte.',
      );
  }
  for (const hero of state.preparation!.heroes) {
    const first = state.content!.roles.find((r) => r.id === hero.roleId)!.skills[0]!;
    const p = sc.pack.preparedEffects?.find((p) => p.skillId === first);
    if (p?.effect === 'inspiration')
      invariant(
        effects.some(
          (e) =>
            e.heroId === hero.heroId && e.source === 'initial' && definitionId(e.copy) === first,
        ),
        'Trigger iniziale non risolto.',
      );
  }
}
