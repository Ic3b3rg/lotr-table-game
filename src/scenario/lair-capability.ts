import type { ScenarioPack } from '../shared/scenario';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';

export function validateLairCapability(pack: ScenarioPack) {
  const cap = pack.manifest.lair,
    endings = pack.definitions.flatMap((d) =>
      d.states.flatMap((s) =>
        s.actions.filter((a) => a.op === 'endGame').map((a) => ({ d, s, a })),
      ),
    );
  if (!cap) {
    invariant(!endings.length, 'Vittoria senza capacità del covo.');
    return;
  }
  const clues = pack.manifest.clues,
    failure = pack.manifest.failure,
    prefab = pack.manifest.prefabs.find((p) => p.source === cap.prefab),
    definition = pack.definitions.find((d) => d.source === prefab?.fsmSource),
    principal = pack.definitions.find((d) => d.source === pack.principal);
  invariant(
    pack.manifest.scope === 'original-encounter-v1' &&
      clues &&
      failure &&
      definition &&
      principal &&
      cap.prefab === clues.fort.prefab &&
      Object.values(cap.methods).every(
        (m) => m.assemblyHash === failure.methods.signal.assemblyHash,
      ) &&
      cap.cluesFingerprint === digest(clues) &&
      cap.failureFingerprint === digest(failure) &&
      cap.definitionHash === digest(definition) &&
      cap.principalHash === digest(principal),
    'Covo senza owner e legami al freeze corrispondenti.',
  );
  invariant(
    endings.length === 1 &&
      endings[0]!.d === definition &&
      endings[0]!.s.actions.length === 1 &&
      principal.handlers[cap.event] !== undefined &&
      !principal.deferredHandlers[cap.event] &&
      cap.event !== failure.event,
    'Segnale della vittoria fuori dalla closure del covo.',
  );
  const entries = [
    definition.handlers['NODE CLICKED'],
    ...definition.states.map((s) => s.transitions['NODE CLICKED']),
  ].filter((n) => n !== undefined);
  invariant(
    entries.length > 0 &&
      entries.every((n) => {
        const s = definition.states.find((s) => s.index === n);
        return s?.actions.length === 1 && s.actions[0]?.op === 'confirm';
      }),
    'Covo senza conferma fonte esclusiva.',
  );
}

/** The new terminal permission must not widen the principal's clue rewards. */
export function isLairClueReward(pack: ScenarioPack, index: number) {
  if (!pack.manifest.lair) return true;
  const d = pack.definitions.find((d) => d.source === pack.principal)!,
    visited = new Set<number>();
  const visit = (n: number) => {
    if (visited.has(n)) return;
    visited.add(n);
    const s = d.states.find((s) => s.index === n);
    for (const next of Object.values(s?.transitions ?? {})) visit(next);
  };
  visit(d.handlers[pack.manifest.clues!.event]!);
  return (
    visited.has(index) &&
    d.states
      .find((s) => s.index === index)
      ?.actions.map((a) => a.op)
      .join(',') === 'message,lore,objective'
  );
}
