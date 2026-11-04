import type { ScenarioPack } from '../shared/scenario';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';

/** New source forms have their own certificate; the historical certificate stays closed. */
export function validateThreatCapability(pack: ScenarioPack) {
  const cap = pack.manifest.threatContinuations;
  if (!cap) return;
  const rounds = pack.manifest.rounds,
    followup = pack.manifest.followup,
    shadow = pack.manifest.combat?.source.shadow,
    failure = pack.manifest.failure;
  invariant(rounds && followup && shadow && failure, 'Soglie senza controller completi.');
  invariant(
    cap.projectionFingerprint === followup.projectionFingerprint &&
      cap.roundsFingerprint === digest(rounds) &&
      cap.deploymentFingerprint === followup.deployment.fingerprint &&
      cap.failureFingerprint === digest(failure) &&
      digest(cap.methods.controller) === digest(rounds.controller) &&
      Object.values(cap.methods).every((m) => m.assemblyHash === rounds.controller.assemblyHash),
    'Owner delle soglie estraneo al freeze.',
  );
  for (const field of ['source', 'owner', 'definition', 'threshold', 'form'] as const)
    invariant(
      new Set(cap.thresholds.map((t) => t[field])).size === 3,
      'Receiver o forme duplicati.',
    );
  for (const row of cap.thresholds) {
    const d = pack.definitions.find((d) => d.source === row.definition),
      instance = followup.instances.find((i) => i.definition === row.definition);
    invariant(
      d &&
        row.definitionHash === digest(d) &&
        instance?.kind === 'threat' &&
        instance.gameObject === row.owner &&
        !instance.hasNode &&
        followup.thresholds.some((t) => t.source === row.source && t.definition === row.definition),
      'Definizione, owner o binding della soglia non certificati.',
    );
    invariant(
      Object.keys(d.handlers).join(',') === followup.thresholdEvent &&
        !Object.keys(d.deferredHandlers ?? {}).length,
      'Handler della soglia incompleto.',
    );
    const path: typeof d.states = [];
    const seen = new Set<number>();
    let index: number | undefined = d.handlers[followup.thresholdEvent];
    while (index !== undefined) {
      invariant(!seen.has(index), 'Callback della soglia ciclico.');
      seen.add(index);
      const s = d.states.find((s) => s.index === index);
      invariant(
        s && !Object.keys(s.deferredTransitions ?? {}).length,
        'Soglia con seguito non compilato.',
      );
      path.push(s);
      index = s.transitions.FINISHED;
    }
    const dark = row.form === 'darkness-spawn-register',
      terminal = row.form === 'spawn-terminal',
      expected =
        (dark ? 'set;' : '') +
        'multiplyInt,spawnRandom;' +
        (terminal ? '' : 'threat;') +
        'hideNode,stop';
    const initial = d.states.find((s) => s.index === d.initial);
    invariant(
      path.map((s) => s.actions.map((a) => a.op).join(',')).join(';') === expected &&
        path.every(
          (s, n) =>
            Object.keys(s.transitions).join(',') === (n < path.length - 1 ? 'FINISHED' : ''),
        ) &&
        d.states.length === path.length + 1 &&
        !seen.has(d.initial) &&
        initial?.actions.length === 0 &&
        !Object.keys(initial.transitions).length &&
        !Object.keys(initial.deferredTransitions ?? {}).length,
      'Forma della soglia diversa dalla closure attestata.',
    );
    if (dark) {
      const a = path[0]!.actions[0]!;
      invariant(
        a.op === 'set' &&
          a.target.scope === 'global' &&
          a.target.name === rounds.bindings.darkness &&
          a.value === true,
        'Confine della oscurità globale non certificato.',
      );
    }
    const spawnState = path[dark ? 1 : 0]!,
      multiply = spawnState.actions[0]!,
      spawn = spawnState.actions[1]!;
    invariant(
      multiply.op === 'multiplyInt' &&
        multiply.target.scope === 'local' &&
        d.variables.some((v) => v.name === multiply.target.name && v.type === 'int') &&
        multiply.left.kind === 'variable' &&
        multiply.left.ref.scope === 'global' &&
        multiply.left.ref.name === followup.playerCountBinding &&
        multiply.right.kind === 'literal' &&
        multiply.right.value === row.multiplier &&
        spawn.op === 'spawnRandom' &&
        digest(spawn.points) === digest(multiply.target) &&
        !spawn.excludeGameEnemyPoints &&
        !spawn.trial &&
        spawn.sections === null &&
        Object.values(spawn.filter).every((n) => n === 0),
      'Aritmetica, budget o popolazione della soglia non certificati.',
    );
    invariant(
      spawn.op === 'spawnRandom' &&
        (row.form === 'spawn-register'
          ? row.suffering && spawn.suffering && digest(spawn.suffering) === digest(row.suffering)
          : !row.suffering && !spawn.suffering),
      'Conseguenza fisica della soglia assente o non attestata.',
    );
    if (terminal) invariant(row.next === null, 'Soglia terminale con registrazione inventata.');
    else {
      const a = path[dark ? 2 : 1]!.actions[0]!,
        next = row.next;
      invariant(
        next &&
          a.op === 'threat' &&
          a.source === next.source &&
          a.threshold === next.threshold &&
          cap.thresholds.some(
            (r) =>
              r.source === next.source &&
              r.owner === next.owner &&
              r.definition === next.definition &&
              r.threshold === next.threshold,
          ),
        'Registrazione successiva della soglia non certificata.',
      );
    }
    invariant(
      pack.definitions.some((d) =>
        d.states.some((s) =>
          s.actions.some(
            (a) => a.op === 'threat' && a.source === row.source && a.threshold === row.threshold,
          ),
        ),
      ),
      'Default della soglia privo di registrazione fonte.',
    );
  }
  const first = cap.thresholds.find((t) => t.form === 'spawn-register')!,
    middle = cap.thresholds.find((t) => t.form === 'darkness-spawn-register')!,
    last = cap.thresholds.find((t) => t.form === 'spawn-terminal')!;
  invariant(
    first.next?.source === middle.source &&
      middle.next?.source === last.source &&
      shadow.thresholds.some(
        (t) =>
          t.nextSource === first.source &&
          t.nextOwner === first.owner &&
          t.nextThreshold === first.threshold,
      ),
    'Catena delle nuove soglie non collegata al controller precedente.',
  );
}
