import type { ScenarioPack } from '../shared/scenario';
import { invariant } from '../map-freeze/validate';
import { digest } from '../map-freeze/hash';

export function isConclusionReward(pack: ScenarioPack, source: string, state: number) {
  const cap = pack.manifest.failure;
  if (!cap || source !== pack.principal) return false;
  const d = pack.definitions.find((d) => d.source === source)!;
  if (pack.manifest.scope === 'battle-combat-v1')
    return d.states.some((s) => s.index === state && s.actions.some((a) => a.op === 'awardXP'));
  return (
    d.states.find((s) => s.index === d.handlers[cap.event])?.transitions.FINISHED === state ||
    (pack.manifest.lair && d.handlers[pack.manifest.lair.event] === state)
  );
}

/** Only the certified failure/victory paths may use campaign mutation instructions. */
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
    pack.manifest.scope === 'original-encounter-v1' || pack.manifest.scope === 'battle-combat-v1',
    'Conclusione fuori dal consumer originale.',
  );
  const d = pack.definitions.find((d) => d.source === pack.principal)!;
  const follow = (event: string) => {
    const path: ScenarioPack['definitions'][number]['states'] = [];
    let index = d.handlers[event];
    const seen = new Set<number>();
    while (index !== undefined) {
      invariant(!seen.has(index), 'Seguito della conclusione ciclico.');
      seen.add(index);
      const s = d.states.find((s) => s.index === index);
      invariant(s, 'Stato terminale assente.');
      path.push(s);
      const product = s.actions.find((a) => a.op === 'ownsProducts'),
        battle = pack.manifest.battleStartup?.battleRounds;
      if (product?.op === 'ownsProducts' && battle) {
        const own = product.products.every((source) => {
          const p = battle.productModels.find((p) => p.source === source);
          invariant(p, 'Prodotto della conclusione non attestato.');
          return pack.manifest.battleStartup!.ownedProductIds.some((id) => id === p.id);
        });
        invariant(
          !s.deferredTransitions?.[own ? product.ownEvent : product.missingEvent],
          'Seguito terminale incompleto.',
        );
        index = s.transitions[own ? product.ownEvent : product.missingEvent];
      } else {
        invariant(
          !Object.keys(s.deferredTransitions ?? {}).length,
          'Seguito terminale incompleto.',
        );
        index = s.transitions.FINISHED;
      }
    }
    return path;
  };
  const path = follow(cap.event);
  if (pack.manifest.scope === 'battle-combat-v1') {
    const battle = pack.manifest.battleStartup?.battleRounds,
      victory = battle ? follow(battle.victoryEvent) : [];
    invariant(
      new Set(cap.partyBonus.skills.map((s) => s.cardId)).size === cap.partyBonus.skills.length,
      'Binding delle abilità equipaggiate duplicato.',
    );
    invariant(
      path.length === 5 &&
        path.map((s) => s.actions.map((a) => a.op).join(',')).join(';') ===
          'message;message;message,set,lore,awardXP;nextAdventure,proceed;stop' &&
        path.every((s, n) => Object.keys(s.transitions).join(',') === (n < 4 ? 'FINISHED' : '')),
      'Closure terminale A2 incompleta.',
    );
    const flag = path[2]!.actions[1]!,
      next = path[3]!.actions[0]!;
    invariant(
      flag.op === 'set' &&
        flag.value === false &&
        next.op === 'nextAdventure' &&
        next.source === cap.next.source &&
        next.id === cap.next.id &&
        operations.length === (battle ? 4 : 3) &&
        operations.every((a) => [...path, ...victory].some((s) => s.actions.includes(a))),
      'Seguito terminale A2 fuori dalla fonte.',
    );
    if (battle) {
      const won = victory[0]?.actions[0];
      const guarded = victory[2]?.actions[0]?.op === 'ownsProducts';
      invariant(
        victory.length === (guarded ? 5 : 4) &&
          won?.op === 'set' &&
          won.value === true &&
          victory[1]?.actions.map((a) => a.op).join(',') === 'message,lore,awardXP' &&
          victory[guarded ? 3 : 2] === path[3] &&
          victory[guarded ? 4 : 3] === path[4],
        'Vittoria battaglia senza seguito completo.',
      );
    }
    return;
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
  const victory = pack.manifest.lair ? follow(pack.manifest.lair.event) : [];
  if (pack.manifest.lair) {
    const won = victory[0]?.actions[0];
    invariant(
      victory.length === 3 &&
        victory.map((s) => s.actions.map((a) => a.op).join(',')).join(';') ===
          'set,awardXP,lore;nextAdventure,proceed;stop' &&
        victory[1] === path[2] &&
        victory[2] === path[3] &&
        won?.op === 'set' &&
        won.value === true &&
        flag.op === 'set' &&
        digest(won.target) === digest(flag.target) &&
        Object.keys(victory[0]!.transitions).join(',') === 'FINISHED',
      'Closure della conclusione vittoriosa incoerente.',
    );
  }
  invariant(
    operations.length === (victory.length ? 4 : 3) &&
      operations.every((a) => [...path, ...victory].some((s) => s.actions.includes(a))),
    'Operazioni di conclusione fuori dal ramo certificato.',
  );
  invariant(!d.deferredHandlers[cap.event], 'Conclusione ancora gated.');
  invariant(
    new Set(cap.partyBonus.skills.map((s) => s.cardId)).size === cap.partyBonus.skills.length,
    'Binding delle abilità equipaggiate duplicato.',
  );
}
