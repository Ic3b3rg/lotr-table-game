import type { ScenarioPack } from '../shared/scenario';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';
import { threatTokenDefinition } from './threat-tokens';

export function baseProductsDefinition(pack: ScenarioPack, source: string) {
  const cap = pack.manifest.baseProducts;
  return (
    !!cap && pack.manifest.prefabs.some((p) => p.source === cap.prefab && p.fsmSource === source)
  );
}

/** This permission is one closed base-only continuation, never an entitlement default. */
export function validateBaseProducts(pack: ScenarioPack) {
  const cap = pack.manifest.baseProducts;
  const additions = pack.definitions.flatMap((d) =>
    d.states.flatMap((s) =>
      s.actions
        .filter(
          (a) =>
            (a.op === 'ownsProducts' && !threatTokenDefinition(pack, d.source)) ||
            (a.op === 'message' && a.sprint),
        )
        .map((a) => ({ d, s, a })),
    ),
  );
  if (!cap) {
    invariant(!additions.length, 'Prodotti o Scatto senza capacità base congelata.');
    return;
  }
  invariant(
    cap.ownedProductIds?.length === 1 &&
      cap.ownedProductIds[0] === 0 &&
      cap.models[0].id === 0 &&
      cap.models[1].id === 5,
    'Input prodotti base sconosciuto o non ammesso.',
  );
  const p = pack.manifest.prefabs.find((p) => p.source === cap.prefab),
    d = pack.definitions.find((d) => d.source === p?.fsmSource),
    failure = pack.manifest.failure;
  invariant(
    pack.manifest.scope === 'original-encounter-v1' &&
      p &&
      d &&
      failure &&
      cap.prefabHash === digest(p) &&
      cap.definitionHash === digest(d) &&
      cap.roundsFingerprint === digest(pack.manifest.rounds ?? null) &&
      cap.failureFingerprint === digest(failure) &&
      Object.values(cap.methods).every(
        (m) => m.assemblyHash === failure.methods.signal.assemblyHash,
      ) &&
      cap.models[0].source !== cap.models[1].source &&
      cap.models.every((m) => pack.sources.some((s) => s.file === m.source.split(':')[0])) &&
      !pack.manifest.playablePrefabs?.includes(p.source) &&
      !pack.manifest.clues?.encounters.includes(p.source) &&
      pack.manifest.clues?.fort.prefab !== p.source &&
      pack.manifest.lair?.prefab !== p.source &&
      !pack.manifest.linked?.encounters.some((e) => e.prefab === p.source),
    'Capacità base senza prefab, prodotti e owner corrispondenti al freeze.',
  );
  invariant(
    d.states.length === 9 &&
      d.states.reduce((n, s) => n + s.actions.length, 0) === 9 &&
      Object.keys(d.handlers).join(',') === 'REVEALED' &&
      !Object.keys(d.deferredHandlers).length &&
      new Set(cap.excludedStates).size === 5 &&
      cap.excludedStates.includes(cap.gate.excludedTarget) &&
      d.states.every((s) => !cap.excludedStates.includes(s.index)) &&
      additions.length === 2 &&
      additions.every((r) => r.d === d) &&
      d.states.every((s) =>
        s.actions.every((a) =>
          [
            'confirm',
            'sourceTest',
            'message',
            'release',
            'hideNode',
            'stop',
            'ownsProducts',
          ].includes(a.op),
        ),
      ),
    'Closure base incompleta o con effetti esterni al proprio perimetro.',
  );
  const gate = d.states.find((s) => s.index === cap.gate.state),
    guard = gate?.actions.find((a) => a.index === cap.gate.action);
  invariant(
    gate?.actions.length === 1 &&
      guard?.op === 'ownsProducts' &&
      guard.products[0] === cap.models[1].source &&
      guard.ownEvent !== guard.missingEvent &&
      gate.transitions[guard.ownEvent] === undefined &&
      gate.deferredTransitions?.[guard.ownEvent] === cap.gate.capability &&
      Object.keys(gate.deferredTransitions).length === 1 &&
      d.states.every((s) => s === gate || !Object.keys(s.deferredTransitions ?? {}).length),
    'Guardia prodotti alterata o ramo esterno reso eseguibile.',
  );
  const finish = d.states.find((s) => s.index === gate.transitions[guard.missingEvent]);
  invariant(
    finish?.actions.length === 2 &&
      finish.actions[0]?.op === 'hideNode' &&
      finish.actions[1]?.op === 'stop' &&
      !Object.keys(finish.transitions).length,
    'Il ramo base non termina prima degli effetti esterni.',
  );
  const all = d.states.flatMap((s) => s.actions.map((a) => ({ s, a })));
  const confirms = all.filter((r) => r.a.op === 'confirm'),
    tests = all.filter((r) => r.a.op === 'sourceTest'),
    rewards = all.filter((r) => r.a.op === 'message' && r.a.inspiration),
    sprints = all.filter((r) => r.a.op === 'message' && r.a.sprint);
  const confirm = confirms[0],
    test = tests[0],
    reward = rewards[0],
    sprint = sprints[0];
  invariant(
    confirms.length === 1 &&
      tests.length === 1 &&
      rewards.length === 1 &&
      sprints.length === 1 &&
      confirm?.a.op === 'confirm' &&
      test?.a.op === 'sourceTest' &&
      reward &&
      sprint &&
      confirm.s.transitions[confirm.a.confirmEvent] === test.s.index &&
      confirm.s.transitions[confirm.a.cancelEvent] === d.initial &&
      d.states.find((s) => s.index === d.initial)?.transitions['NODE CLICKED'] ===
        confirm.s.index &&
      test.s.transitions[test.a.passEvent] === reward.s.index &&
      test.s.transitions[test.a.failEvent] === sprint.s.index &&
      reward.s.transitions.FINISHED === gate.index &&
      sprint.s.transitions.FINISHED === finish.index &&
      d.states.every((s) =>
        s.actions.every(
          (a) =>
            a.op !== 'message' ||
            (a.mode === 'ordinary' && !a.consequence && !(a.inspiration && a.sprint)),
        ),
      ),
    'Costo, prova e conseguenze non seguono i rami base attestati.',
  );
}
