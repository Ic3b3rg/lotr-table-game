import type { State } from '../server/state';
import type { Receipt } from '../shared/protocol';
import { adjacent } from '../shared/journey-map';
import { invariant } from '../map-freeze/validate';
import { validateCycleReceipts } from '../server/physical-cycle';
import { defeatedHeroes } from '../server/physical-defeat';
import { replayPhysical } from '../physical-resolution/runtime';
export function validateSourcePlayReceipts(
  state: State,
  commands: { playerId: string; requestId: string; receipt: Receipt }[],
) {
  if (state.physical?.cycle) {
    validateCycleReceipts(state, commands);
    const seed = state.physical.cycle.seed;
    const previous = structuredClone(state);
    previous.round = seed.round;
    previous.journey = seed.journey;
    delete previous.physical!.cycle;
    previous.physical!.runs = previous.physical!.runs.filter(
      (r) => r.source.instanceId !== 'ordinary-cycle',
    );
    previous.physical!.snapshot = replayPhysical(previous.physical!);
    validateSourcePlayReceipts(
      previous,
      commands.filter((c) => c.receipt.appliedRevision <= seed.revision),
    );
    return;
  }
  const sc = state.scenario!,
    j = state.journey,
    round = state.round;
  const relevant = commands
    .filter((c) => {
      const r = c.receipt;
      return (
        ((r.type === 'START_TRAVEL' || r.type === 'MOVE_HERO') && r.mapId === sc.id) ||
        ('roundNumber' in r && r.roundId === round?.id)
      );
    })
    .sort((a, b) => a.receipt.appliedRevision - b.receipt.appliedRevision);
  if (!j) {
    invariant(!relevant.length, 'Ricevuta prima del piazzamento.');
    return;
  }
  const heroes = state.preparation!.heroes;
  const poses = new Map(heroes.map((h) => [h.heroId, j.definition.startSpaceId]));
  const progress = new Map(heroes.map((h) => [h.heroId, { actions: 0, ended: false }]));
  let active: string | null = null,
    turnId: string | null = null,
    remaining = 0,
    travel = false;
  for (const c of relevant) {
    const r = c.receipt;
    invariant(sc.phase === 'action' && round, 'Ricevuta di gioco durante setup.');
    invariant(
      r.type === 'START_TURN' ||
        r.type === 'END_TURN' ||
        r.type === 'START_TRAVEL' ||
        r.type === 'MOVE_HERO',
      'Ricevuta consumer non supportata.',
    );
    const heroId = r.heroId,
      h = heroes.find((h) => h.heroId === heroId);
    invariant(h && h.playerId === c.playerId, 'Actor/hero della ricevuta consumer incoerenti.');
    const hero = progress.get(h.heroId)!;
    if (r.type === 'START_TURN') {
      invariant(
        !active && !hero.ended && r.turnId && r.sourceTurnId === r.turnId,
        'Inizio turno non valido.',
      );
      active = h.heroId;
      turnId = r.turnId;
      remaining = 0;
      travel = false;
    } else {
      invariant(active === h.heroId, 'Ricevuta fuori dal turno dell’eroe.');
      if (r.type === 'END_TURN') {
        invariant(r.sourceTurnId === turnId && r.turnId === null, 'Fine turno non valida.');
        hero.ended = true;
        active = null;
        turnId = null;
        remaining = 0;
        travel = false;
      } else {
        invariant('mapId' in r, 'Ricevuta movimento senza mappa.');
        invariant(r.roundId === round.id && r.turnId === turnId, 'Viaggio fuori dal turno.');
        if (r.type === 'START_TRAVEL') {
          invariant(
            hero.actions < 2 && r.spaceId === poses.get(h.heroId),
            'Azione viaggio incoerente.',
          );
          hero.actions++;
          remaining += 2;
          travel = true;
        } else {
          invariant(
            travel &&
              remaining > 0 &&
              r.spaceId &&
              adjacent(j.definition, poses.get(h.heroId)!, r.spaceId),
            'Movimento senza concessione/adiacenza.',
          );
          const source = sc.spaceBindings.find((b) => b.id === r.spaceId)?.sourceId;
          invariant(state.mapGeneration?.status === 'frozen', 'Movimento senza realizzazione.');
          const space = state.mapGeneration.projection.spaces.find((s) => s.id === source);
          invariant(
            space && sc.tiles.some((t) => t.source === space.tileSource && t.visible && t.explored),
            'Movimento senza esplorazione fonte.',
          );
          poses.set(h.heroId, r.spaceId);
          remaining--;
        }
        invariant(r.movesRemaining === remaining, 'Ricevuta movimenti residui incoerente.');
      }
    }
  }
  invariant(
    j.heroes.every((h) => poses.get(h.heroId) === h.spaceId),
    'Posizioni non coerenti con le ricevute.',
  );
  if (sc.phase === 'action') {
    invariant(
      round && round.activeHeroId === active && round.turnId === turnId,
      'Turno non coerente con le ricevute.',
    );
    for (const h of round.heroes) {
      const p = progress.get(h.heroId)!;
      invariant(
        p.actions === h.actionsUsed &&
          (p.ended || defeatedHeroes(state).includes(h.heroId)) === h.turnEnded &&
          !h.rallyDone,
        'Budget/progressi non coerenti con le ricevute.',
      );
    }
    invariant(
      travel ? j.travel?.remaining === remaining && j.travel.heroId === active : !j.travel,
      'Viaggio non coerente con le ricevute.',
    );
  }
}
