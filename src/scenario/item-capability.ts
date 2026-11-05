import type { ScenarioPack } from '../shared/scenario';
import type { State } from '../server/state';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';
import { validateItemGrant } from '../physical-resolution/item-inventory';
import type { FrontArtifact } from '../physical-resolution/front-program';
import { ApiError } from '../server/errors';

export function itemDefinition(pack: ScenarioPack, source: string) {
  return pack.manifest.prefabs.some(
    (p) => p.source === pack.manifest.items?.prefab && p.fsmSource === source,
  );
}
/** The waiting action remains in the complete certificate; only the modal owner can return. */
export function validateItemCapability(pack: ScenarioPack) {
  invariant(
    !pack.definitions.some((d) =>
      d.states.some((s) =>
        s.actions.some(
          (a) => a.op === 'physical' && a.program.children.some((c) => c.kind === 'scenario-item'),
        ),
      ),
    ),
    'Acquisizione oggetto fuori dal proprio owner scenario.',
  );
  const cap = pack.manifest.items;
  const additions = pack.definitions.flatMap((d) =>
    d.states.flatMap((s) =>
      s.actions.filter((a) => a.op === 'addItem' || a.op === 'modalWait').map((a) => ({ d, s, a })),
    ),
  );
  if (!cap) {
    invariant(!additions.length, 'Inventario senza capacità congelata.');
    return;
  }
  const p = pack.manifest.prefabs.find((p) => p.source === cap.prefab),
    d = pack.definitions.find((d) => d.source === p?.fsmSource);
  invariant(
    pack.manifest.scope === 'original-encounter-v1' &&
      p &&
      d &&
      pack.manifest.failure &&
      cap.prefabHash === digest(p) &&
      cap.definitionHash === digest(d) &&
      cap.roundsFingerprint === digest(pack.manifest.rounds ?? null) &&
      cap.failureFingerprint === digest(pack.manifest.failure) &&
      Object.entries(cap.methods).every(
        ([name, m]) =>
          m.assemblyHash ===
          (name === 'sequence'
            ? (pack.sources.find((s) => s.file === 'PlayMaker.dll')?.sha256 ??
              pack.manifest.failure!.methods.signal.assemblyHash)
            : pack.manifest.failure!.methods.signal.assemblyHash),
      ) &&
      cap.initialInventory.length === 0 &&
      cap.ownedProductIds.length === 1 &&
      cap.ownedProductIds[0] === 0 &&
      [cap.product, cap.grant.model, ...cap.grant.upgrade.choices, cap.titleModel].every((model) =>
        pack.sources.some((source) => source.file === model.source.split(':')[0]),
      ) &&
      !cap.baseSkillModelIds.includes(cap.collectorSkillId) &&
      new Set(cap.baseSkillModelIds).size === cap.baseSkillModelIds.length &&
      pack.manifest.failure.partyBonus.skills.every(
        (s) => s.modelId === null || cap.baseSkillModelIds.includes(s.modelId),
      ) &&
      cap.grant.model.source !== cap.product.source &&
      cap.grant.upgrade.choices.every((m) => m.source !== cap.grant.model.source) &&
      !pack.manifest.playablePrefabs?.includes(p.source) &&
      !pack.manifest.clues?.encounters.includes(p.source) &&
      pack.manifest.clues?.fort.prefab !== p.source &&
      pack.manifest.lair?.prefab !== p.source &&
      !pack.manifest.linked?.encounters.some((e) => e.prefab === p.source) &&
      pack.manifest.baseProducts?.prefab !== p.source,
    'Inventario senza input base, modelli e owner corrispondenti al freeze.',
  );
  invariant(
    d.states.length === 9 &&
      d.states.reduce((n, s) => n + s.actions.length, 0) === 10 &&
      Object.keys(d.handlers).join(',') === 'REVEALED' &&
      !Object.keys(d.deferredHandlers).length &&
      d.states.every(
        (s) =>
          !Object.keys(s.deferredTransitions ?? {}).length &&
          s.actions.every((a) =>
            [
              'message',
              'release',
              'confirm',
              'sourceTest',
              'modalWait',
              'addItem',
              'hideNode',
              'stop',
            ].includes(a.op),
          ),
      ) &&
      additions.length === 2 &&
      additions.every((r) => r.d === d),
    'Closure inventario incompleta o con effetti estranei.',
  );
  const all = d.states.flatMap((s) => s.actions.map((a) => ({ s, a }))),
    one = (op: string) => all.filter((r) => r.a.op === op);
  const confirms = one('confirm'),
    tests = one('sourceTest'),
    awards = one('addItem'),
    waiters = one('modalWait'),
    confirm = confirms[0],
    test = tests[0],
    award = awards[0],
    waiter = waiters[0];
  invariant(
    confirms.length === 1 &&
      tests.length === 1 &&
      awards.length === 1 &&
      waiters.length === 1 &&
      confirm?.a.op === 'confirm' &&
      test?.a.op === 'sourceTest' &&
      award?.a.op === 'addItem' &&
      waiter?.a.op === 'modalWait' &&
      confirm.s.index === cap.modal.state &&
      confirm.a.index === cap.modal.owner &&
      waiter.s === confirm.s &&
      waiter.a.index === cap.modal.waiter &&
      confirm.s.actions.length === 2 &&
      confirm.s.actions[0] === confirm.a &&
      confirm.s.actions[1] === waiter.a &&
      waiter.a.confirmEvent === confirm.a.confirmEvent &&
      waiter.a.cancelEvent === confirm.a.cancelEvent &&
      confirm.s.transitions[confirm.a.confirmEvent] === test.s.index &&
      confirm.s.transitions[confirm.a.cancelEvent] === d.initial &&
      d.states.find((s) => s.index === d.initial)?.transitions['NODE CLICKED'] ===
        confirm.s.index &&
      award.a.itemModel === cap.grant.model.source,
    'Proprietà modale, prova o acquisizione fuori dal lifecycle attestato.',
  );
  const testAction = test.a;
  const pass = d.states.find((s) => s.index === test.s.transitions[testAction.passEvent]),
    fail = d.states.find((s) => s.index === test.s.transitions[testAction.failEvent]),
    finish = d.states.find((s) => s.index === award.s.transitions.FINISHED);
  invariant(
    pass?.actions.length === 1 &&
      pass.actions[0]?.op === 'message' &&
      pass.transitions.FINISHED === award.s.index &&
      fail?.actions.length === 1 &&
      fail.actions[0]?.op === 'message' &&
      fail.transitions.FINISHED === d.initial &&
      finish?.actions.length === 2 &&
      finish.actions[0]?.op === 'hideNode' &&
      finish.actions[1]?.op === 'stop' &&
      !Object.keys(finish.transitions).length &&
      all.every(
        ({ a }) =>
          a.op !== 'message' ||
          (!a.consequence && !a.inspiration && !a.sprint && a.mode === 'ordinary'),
      ),
    'Esiti, ripetizione o callback inventario alterati.',
  );
}
export function requireItemCapability(state: State) {
  const cap = state.scenario!.pack.manifest.items;
  invariant(
    cap && state.physical?.fronts && state.preparation!.heroes.length >= 2,
    'Inventario senza owner base.',
  );
  validateItemCapability(state.scenario!.pack);
  validateItemGrant(state.content!, state.physical.fronts.artifact, cap.grant);
  invariant(
    digest(
      state.mapGeneration?.status === 'frozen'
        ? state.mapGeneration.projection.context.ownedProductIds
        : null,
    ) === digest(cap.ownedProductIds),
    'Prodotti inventario diversi dal freeze.',
  );
  if (state.scenario!.play!.lore >= cap.grant.upgrade.threshold)
    throw new ApiError(
      409,
      'SCENARIO_ITEM_UPGRADE_CAPABILITY',
      'L’oggetto richiede un avanzamento non ancora certificato. Nessun costo, carta o scelta casuale è stato applicato.',
    );
  const owned = state.physical.snapshot.resolution?.resources?.itemCustody ?? [];
  invariant(
    owned.length <= 1 &&
      owned.every((c) => c.cardId === cap.grant.cardId && c.modelId === cap.grant.model.modelId),
    'Inventario iniziale o identità non attestati.',
  );
  // The only admitted addition is this unique non-mount; PlayerCount never shrinks.
  invariant(
    owned.length + (owned.length ? 0 : 1) <= state.preparation!.heroes.length,
    'Titolo inventario senza consumer attestato.',
  );
}

export function validateItemStartup(state: State, pack: ScenarioPack, fronts?: FrontArtifact) {
  const cap = pack.manifest.items;
  if (!cap) return;
  invariant(
    fronts && state.content && state.preparation && !state.physical && !state.scenario,
    'Inventario iniziale sconosciuto o già avviato.',
  );
  validateItemCapability(pack);
  validateItemGrant(state.content, fronts, cap.grant);
  invariant(
    state.preparation.heroes.length >= 2 &&
      state.preparation.heroes.every((h) =>
        h.itemCopies.every(
          (copy) =>
            state.content!.items.find((c) => c.id === copy.slice(0, copy.lastIndexOf(':')))
              ?.slot !== 'trinket',
        ),
      ),
    'Inventario iniziale non vuoto o equipaggiamento non attestato.',
  );
}
