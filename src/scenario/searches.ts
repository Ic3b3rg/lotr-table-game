import type { ScenarioPack } from '../shared/scenario';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';

export function searchDefinition(pack: ScenarioPack, source: string) {
  return pack.manifest.searches?.encounters.some((e) =>
    pack.manifest.prefabs.some((p) => p.source === e.prefab && p.fsmSource === source),
  );
}

/** Permissions belong to these two complete graphs, never to an action type globally. */
export function validateSearches(pack: ScenarioPack) {
  const cap = pack.manifest.searches;
  const additions = pack.definitions.flatMap((d) =>
    d.states.flatMap((s) =>
      s.actions
        .filter(
          (a) =>
            (a.op === 'message' && a.recovery) ||
            (a.op === 'choice' && a.origin.type === 'FFG.JIME.Actions.DisplayMessageCancelConfirm'),
        )
        .map((a) => ({ d, a })),
    ),
  );
  invariant(
    !pack.definitions.some((d) =>
      d.states.some((s) =>
        s.actions.some(
          (a) =>
            a.op === 'physical' && a.program.children.some((c) => c.kind === 'search-recovery'),
        ),
      ),
    ),
    'Conseguenza di ricerca fuori dal proprio owner.',
  );
  if (!cap) {
    invariant(!additions.length, 'Ricerche senza capacità congelata.');
    return;
  }
  invariant(
    pack.manifest.scope === 'original-encounter-v1' &&
      pack.manifest.failure &&
      cap.roundsFingerprint === digest(pack.manifest.rounds ?? null) &&
      cap.failureFingerprint === digest(pack.manifest.failure) &&
      cap.encounters[0].prefab !== cap.encounters[1].prefab &&
      Object.entries(cap.methods).every(
        ([name, method]) =>
          method.assemblyHash ===
          (name === 'sequence'
            ? (pack.sources.find((s) => s.file === 'PlayMaker.dll')?.sha256 ??
              pack.manifest.failure!.methods.signal.assemblyHash)
            : pack.manifest.failure!.methods.signal.assemblyHash),
      ),
    'Ricerche senza contesto o controller corrispondenti.',
  );
  for (const [n, owner] of cap.encounters.entries()) {
    const p = pack.manifest.prefabs.find((p) => p.source === owner.prefab),
      d = pack.definitions.find((d) => d.source === p?.fsmSource);
    invariant(
      p &&
        d &&
        digest(p) === owner.prefabHash &&
        digest(d) === owner.definitionHash &&
        pack.manifest.prefabs.filter((other) => other.fsmSource === d.source).length === 1 &&
        p.modelSource === owner.model.source &&
        p.nodeSource === owner.node.source &&
        p.nodeType === 'search' &&
        p.sourceNodeType === 0 &&
        p.token3DType === 2 &&
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
        !pack.manifest.linked?.encounters.some((e) => e.prefab === p.source) &&
        d.states.length === 8 + n &&
        d.states.reduce((sum, s) => sum + s.actions.length, 0) === 8 + n &&
        Object.keys(d.handlers).join(',') === 'REVEALED' &&
        !Object.keys(d.deferredHandlers).length &&
        d.states.every(
          (s) =>
            !Object.keys(s.deferredTransitions ?? {}).length &&
            s.actions.every((a) =>
              ['message', 'release', 'confirm', 'choice', 'challenge', 'hideNode', 'stop'].includes(
                a.op,
              ),
            ),
        ),
      'Closure della ricerca incompleta, estranea o diversa dal freeze.',
    );
    const all = d.states.flatMap((s) => s.actions.map((a) => ({ s, a }))),
      confirms = all.filter(({ a }) => a.op === 'confirm'),
      confirm = confirms[0],
      wait = d.states.find((s) => s.index === d.initial),
      terminal = d.states.find((s) => s.actions[0]?.op === 'hideNode'),
      reveal = d.states.find((s) => s.index === d.handlers.REVEALED),
      release = d.states.find((s) => s.index === reveal?.transitions.FINISHED);
    invariant(
      confirm?.a.op === 'confirm' &&
        confirms.length === 1 &&
        confirm.s.actions.length === 1 &&
        confirm.s.transitions[confirm.a.cancelEvent] === d.initial &&
        wait?.actions.length === 0 &&
        wait.transitions['NODE CLICKED'] === confirm.s.index &&
        terminal?.actions.length === 2 &&
        terminal.actions[1]?.op === 'stop' &&
        !Object.keys(terminal.transitions).length &&
        reveal?.actions.length === 1 &&
        reveal.actions[0]?.op === 'message' &&
        !reveal.actions[0].recovery &&
        !reveal.actions[0].inspiration &&
        release?.actions.length === 1 &&
        release.actions[0]?.op === 'release' &&
        release.transitions.FINISHED === d.initial &&
        all.every(
          ({ a }) =>
            a.op !== 'message' || (a.mode === 'ordinary' && !a.consequence && !a.boon && !a.sprint),
        ),
      'Ingresso gratuito, processing o rimozione della ricerca alterati.',
    );
    const confirmAction = confirm.a;
    const decision = d.states.find(
        (s) => s.index === confirm.s.transitions[confirmAction.confirmEvent],
      ),
      a = decision?.actions[0];
    invariant(decision?.actions.length === 1, 'Decisione di ricerca concorrente.');
    const outcomes = (events: string[]) =>
      events.map((event) => {
        const s = d.states.find((s) => s.index === decision.transitions[event]),
          message = s?.actions[0];
        invariant(
          s?.actions.length === 1 &&
            s.transitions.FINISHED === terminal.index &&
            message?.op === 'message',
          'Esito ricerca senza conseguenza e rimozione fonte.',
        );
        return message;
      });
    if (!n) {
      invariant(
        a?.op === 'choice' &&
          a.origin.type === 'FFG.JIME.Actions.DisplayMessageCancelConfirm' &&
          a.options.length === 2 &&
          !a.cancel &&
          a.options.every((o) => !o.cost && !o.requirement) &&
          a.options[0]!.event !== a.options[1]!.event &&
          !all.some(({ a }) => a.op === 'challenge'),
        'La scelta binaria della ricerca richiede due effetti già pagati.',
      );
      const result = outcomes(a.options.map((o) => o.event));
      invariant(
        result[0]?.recovery?.kind === 'discard-physical' && result[1]?.recovery?.kind === 'scout',
        'Effetti della scelta diversi dal packet attestato.',
      );
    } else {
      const sum = a?.op === 'challenge' ? a.sum : null;
      invariant(
        a?.op === 'challenge' &&
          a.stat === 'wisdom' &&
          'scope' in a.sum &&
          a.sum.scope === 'local' &&
          sum &&
          'scope' in sum &&
          d.variables.some((v) => v.name === sum.name && v.type === 'int' && v.value === 0) &&
          a.bounds.length === 3 &&
          a.bounds.every((b, i) => b.maximum === i) &&
          new Set(a.bounds.map((b) => b.event)).size === 3 &&
          !all.some(({ a }) => a.op === 'choice'),
        'Challenge della ricerca senza binding locale e limiti fonte.',
      );
      const result = outcomes(a.bounds.map((b) => b.event));
      invariant(
        result[0]?.inspiration === 1 &&
          !result[0].recovery &&
          result[1]?.recovery?.kind === 'look' &&
          result[2]?.recovery?.kind === 'scout-or-prepare',
        'Esiti della challenge diversi dai packet attestati.',
      );
    }
  }
  invariant(
    additions.length === 5 && additions.every(({ d }) => searchDefinition(pack, d.source)),
    'Effetti o scelta ricerca fuori dagli owner esclusivi.',
  );
}
