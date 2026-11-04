import type { ScenarioPack } from '../shared/scenario';
import { invariant } from '../map-freeze/validate';

/** Only this certified principal path may use campaign mutation instructions. */
export function validateFailureCapability(pack: ScenarioPack) {
  const cap = pack.manifest.failure;
  const operations = pack.definitions.flatMap((d) =>
    d.states.flatMap((s) =>
      s.actions.filter((a) => ['awardXP', 'nextAdventure', 'proceed'].includes(a.op)),
    ),
  );
  if (!cap) {
    invariant(!operations.length, 'Operazione di conclusione senza capacità.');
    return;
  }
  invariant(
    pack.manifest.scope === 'original-encounter-v1',
    'Conclusione fuori dal consumer originale.',
  );
  const d = pack.definitions.find((d) => d.source === pack.principal)!;
  const path: ScenarioPack['definitions'][number]['states'] = [];
  let index = d.handlers[cap.event];
  const seen = new Set<number>();
  while (index !== undefined) {
    invariant(!seen.has(index), 'Seguito della conclusione ciclico.');
    seen.add(index);
    const s = d.states.find((s) => s.index === index);
    invariant(
      s && !Object.keys(s.deferredTransitions ?? {}).length,
      'Seguito terminale incompleto.',
    );
    path.push(s);
    index = s.transitions.FINISHED;
  }
  invariant(
    path.length === 4 &&
      path.map((s) => s.actions.map((a) => a.op).join(',')).join(';') ===
        'message;message,set,awardXP,lore;nextAdventure,proceed;stop' &&
      path.every((s, n) => Object.keys(s.transitions).join(',') === (n < 3 ? 'FINISHED' : '')),
    'Closure della conclusione terminale incompleta.',
  );
  const flag = path[1]!.actions[1]!,
    next = path[2]!.actions[0]!;
  invariant(flag.op === 'set' && flag.value === false, 'Esito della conclusione incoerente.');
  invariant(
    next.op === 'nextAdventure' && next.source === cap.next.source && next.id === cap.next.id,
    'Destinazione diversa dal modello referenziato.',
  );
  invariant(
    operations.length === 3 && operations.every((a) => path.some((s) => s.actions.includes(a))),
    'Operazioni di conclusione fuori dal ramo certificato.',
  );
  invariant(!d.deferredHandlers[cap.event], 'Conclusione ancora gated.');
  invariant(
    new Set(cap.partyBonus.skills.map((s) => s.cardId)).size === cap.partyBonus.skills.length,
    'Binding delle abilità equipaggiate duplicato.',
  );
}
