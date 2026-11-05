import type { State } from '../server/state';
import { ApiError } from '../server/errors';
import { boonAcquisitionProblems } from '../physical-resolution/boon-stock';
import { requirePreparedCapability } from './prepared-effects';
import type { ScenarioPack } from '../shared/scenario';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';

export function threatTokenDefinition(pack: ScenarioPack, source: string) {
  return pack.manifest.threatTokens?.encounters.some((e) =>
    pack.manifest.prefabs.some((p) => p.source === e.prefab && p.fsmSource === source),
  );
}

/** Permissions belong to two closed graphs. The null-only exclusion stays certified. */
export function validateThreatTokens(pack: ScenarioPack) {
  const cap = pack.manifest.threatTokens;
  if (!cap) {
    invariant(
      !pack.definitions.some((d) =>
        d.states.some((s) =>
          s.actions.some((a) => a.op === 'ownsProducts' && a.products[0] === null),
        ),
      ),
      'Guardia nulla senza capacità minaccia congelata.',
    );
    return;
  }
  invariant(
    pack.manifest.scope === 'original-encounter-v1' &&
      pack.manifest.failure &&
      cap.roundsFingerprint === digest(pack.manifest.rounds ?? null) &&
      cap.failureFingerprint === digest(pack.manifest.failure) &&
      cap.encounters[0].prefab !== cap.encounters[1].prefab &&
      Object.entries(cap.methods).every(
        ([name, m]) =>
          m.assemblyHash ===
          (name === 'sequence'
            ? (pack.sources.find((s) => s.file === 'PlayMaker.dll')?.sha256 ??
              pack.manifest.failure!.methods.signal.assemblyHash)
            : pack.manifest.failure!.methods.signal.assemblyHash),
      ),
    'Segnalini minaccia senza contesto o controller corrispondenti.',
  );
  for (const [n, owner] of cap.encounters.entries()) {
    const p = pack.manifest.prefabs.find((p) => p.source === owner.prefab),
      d = pack.definitions.find((d) => d.source === p?.fsmSource);
    invariant(
      p &&
        d &&
        digest(p) === owner.prefabHash &&
        digest(d) === owner.definitionHash &&
        pack.manifest.prefabs.filter((v) => v.fsmSource === d.source).length === 1 &&
        p.modelSource === owner.model.source &&
        p.nodeSource === owner.node.source &&
        p.nodeType === 'threat' &&
        p.sourceNodeType === 2 &&
        p.token3DType === 3 &&
        [owner.model.source, owner.node.source].every((source) =>
          pack.sources.some((s) => s.file === source.split(':')[0]),
        ) &&
        !pack.manifest.playablePrefabs?.includes(p.source) &&
        !pack.manifest.clues?.encounters.includes(p.source) &&
        pack.manifest.clues?.fort.prefab !== p.source &&
        pack.manifest.lair?.prefab !== p.source &&
        pack.manifest.baseProducts?.prefab !== p.source &&
        pack.manifest.items?.prefab !== p.source &&
        pack.manifest.firstCombat?.prefab !== p.source &&
        !pack.manifest.searches?.encounters.some((e) => e.prefab === p.source) &&
        !pack.manifest.linked?.encounters.some((e) => e.prefab === p.source) &&
        d.states.length === 8 + n &&
        d.states.reduce((sum, s) => sum + s.actions.length, 0) === 9 &&
        owner.admittedStates.length === d.states.length &&
        new Set(owner.admittedStates).size === d.states.length &&
        d.states.every(
          (s) => owner.admittedStates.includes(s.index) && !owner.excludedStates.includes(s.index),
        ) &&
        owner.excludedStates.length === n * 3 &&
        new Set(owner.excludedStates).size === n * 3 &&
        Object.keys(d.handlers).join(',') === 'REVEALED' &&
        !Object.keys(d.deferredHandlers).length &&
        d.states.every((s) =>
          s.actions.every((a) =>
            [
              'message',
              'release',
              'confirm',
              'sourceTest',
              'hideNode',
              'stop',
              ...(n ? ['ownsProducts'] : ['addInt']),
            ].includes(a.op),
          ),
        ),
      'Closure minaccia incompleta, sovrapposta o diversa dal freeze.',
    );
    const all = d.states.flatMap((s) => s.actions.map((a) => ({ s, a }))),
      confirms = all.filter(({ a }) => a.op === 'confirm'),
      tests = all.filter(({ a }) => a.op === 'sourceTest'),
      confirm = confirms[0],
      test = tests[0],
      wait = d.states.find((s) => s.index === d.initial),
      reveal = d.states.find((s) => s.index === d.handlers.REVEALED),
      release = d.states.find((s) => s.index === reveal?.transitions.FINISHED),
      finishes = d.states.filter((s) => s.actions[0]?.op === 'hideNode'),
      finish = finishes[0];
    invariant(
      confirms.length === 1 &&
        tests.length === 1 &&
        confirm?.a.op === 'confirm' &&
        test?.a.op === 'sourceTest' &&
        confirm.s.actions.length === 1 &&
        test.s.actions.length === 1 &&
        test.a.target === 2 &&
        test.a.stat === (n ? 'spirit' : 'wisdom') &&
        confirm.a.confirmEvent !== confirm.a.cancelEvent &&
        test.a.passEvent !== test.a.failEvent &&
        confirm.s.transitions[confirm.a.cancelEvent] === d.initial &&
        confirm.s.transitions[confirm.a.confirmEvent] === test.s.index &&
        wait?.actions.length === 0 &&
        wait.transitions['NODE CLICKED'] === confirm.s.index &&
        finishes.length === 1 &&
        finish?.actions.length === 2 &&
        finish.actions[1]?.op === 'stop' &&
        !Object.keys(finish.transitions).length &&
        reveal?.actions.length === 1 &&
        reveal.actions[0]?.op === 'message' &&
        release?.actions.length === 1 &&
        release.actions[0]?.op === 'release' &&
        release.transitions.FINISHED === d.initial,
      'Ingresso gratuito, prova, attesa o cleanup minaccia alterati.',
    );
    const testAction = test.a;
    const passed = d.states.find((s) => s.index === test.s.transitions[testAction.passEvent]),
      failed = d.states.find((s) => s.index === test.s.transitions[testAction.failEvent]),
      reward = passed?.actions[0];
    invariant(
      passed && failed && reward?.op === 'message' && passed.transitions.FINISHED === finish.index,
      'Esiti minaccia senza ritorno attestato.',
    );
    const outcome =
      n && failed.actions[0]?.op === 'ownsProducts'
        ? failed.transitions[failed.actions[0].missingEvent]
        : undefined;
    for (const { s, a } of all)
      if (a.op === 'message')
        invariant(
          a.mode === 'ordinary' &&
            !a.sprint &&
            !a.recovery &&
            (s === passed || s.index === outcome || (!a.inspiration && !a.boon && !a.consequence)),
          'Conseguenza minaccia fuori dal proprio packet.',
        );
    if (!n) {
      const t = cap.threat,
        add = passed.actions[1],
        failure = failed.actions[0];
      invariant(
        passed.actions.length === 2 &&
          reward.boon === 'determined' &&
          !reward.inspiration &&
          !reward.consequence &&
          failed.actions.length === 1 &&
          failure?.op === 'message' &&
          failed.transitions.FINISHED === d.initial &&
          all.filter(({ a }) => a.op === 'addInt').length === 1 &&
          t.definition === d.source &&
          t.state === passed.index &&
          t.action === add?.index &&
          t.binding.scope === 'global' &&
          pack.globals.some((v) => v.name === t.binding.name && v.type === 'int') &&
          (!pack.manifest.rounds || t.binding.name === pack.manifest.rounds.bindings.threat) &&
          add?.op === 'addInt' &&
          digest(add.target) === digest(t.binding) &&
          add.value.kind === 'literal' &&
          add.value.value === t.delta &&
          d.states.every((s) => !Object.keys(s.deferredTransitions ?? {}).length),
        'Premio, retry o variazione minaccia fuori dal binding attestato.',
      );
    } else {
      const guard = failed.actions[0],
        g = cap.gate;
      invariant(
        passed.actions.length === 1 &&
          reward.inspiration === 1 &&
          !reward.boon &&
          !reward.consequence &&
          failed.index === g.state &&
          failed.actions.length === 1 &&
          guard?.op === 'ownsProducts' &&
          guard.index === g.action &&
          guard.products.length === 1 &&
          guard.products[0] === null &&
          guard.ownEvent !== guard.missingEvent &&
          failed.transitions[guard.ownEvent] === undefined &&
          failed.deferredTransitions?.[guard.ownEvent] === g.capability &&
          Object.keys(failed.deferredTransitions).length === 1 &&
          owner.excludedStates.includes(g.excludedTarget) &&
          d.states.every((s) => s === failed || !Object.keys(s.deferredTransitions ?? {}).length) &&
          all.filter(({ a }) => a.op === 'ownsProducts').length === 1,
        'Riferimento NULL o confine del ramo non posseduto alterati.',
      );
      const missing = d.states.find((s) => s.index === failed.transitions[guard.missingEvent]),
        fear = missing?.actions[0];
      invariant(
        missing?.actions.length === 1 &&
          missing.transitions.FINISHED === finish.index &&
          fear?.op === 'message' &&
          !fear.inspiration &&
          !fear.boon &&
          fear.consequence?.family === 'fear' &&
          fear.consequence.amount === 1 &&
          fear.consequence.face === 'faceup',
        'Ramo NULL senza conseguenza fisica e rimozione fonte.',
      );
    }
  }
}

/** Check every possible reward and future owned preparation before the attempt costs anything. */
export function requireThreatTokenResources(state: State, definition: string, heroId: string) {
  const sc = state.scenario!,
    p = state.physical!,
    d = sc.pack.definitions.find((d) => d.source === definition)!;
  const kinds = d.states.flatMap((s) =>
    s.actions.flatMap((a) => (a.op === 'message' && a.boon ? [a.boon] : [])),
  );
  const missing = kinds.length
    ? boonAcquisitionProblems(p.boons, p.snapshot.resolution?.resources?.boonCustody ?? [], kinds, [
        heroId,
      ])
    : [];
  if (missing.length)
    throw new ApiError(
      409,
      'SCENARIO_BOON_CAPABILITY',
      'Un esito del segnalino richiede benefici la cui riserva o continuazione non è verificata. Nessun costo, carta o scelta casuale è stato applicato.',
    );
  for (const hero of state.preparation!.heroes)
    for (const copy of [...hero.deck, ...hero.discard, ...hero.prepared])
      requirePreparedCapability(sc.pack, copy);
}
