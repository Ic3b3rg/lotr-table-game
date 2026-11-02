import type { Catalog } from '../shared/catalog';
import type { Player, Session } from '../shared/protocol';
import { PHASE_LABELS, SHADOW_LABELS } from '../shared/rounds';
import { rallyScoutCount } from '../shared/rally-scout';
import { refreshActions } from './actions';
import { element, text } from './dom';
import { createGameActions } from './game-actions';

export function createRounds(sync: () => Promise<void>) {
  const root = element('#rounds');
  const status = element('#round-status');
  const form = element<HTMLFormElement>('#round-form');
  const select = element<HTMLSelectElement>('#round-hero');
  const agreed = element<HTMLInputElement>('#round-agreed');
  const confirm = element<HTMLButtonElement>('#round-confirm');
  const end = element<HTMLButtonElement>('#round-end-turn');
  let current: Session | null = null;
  let player: Player | null = null;
  let catalog: Catalog | null = null;
  let rosterKey = '';
  let contextKey = '';
  let progressKey = '';
  const commands = createGameActions(
    () => current,
    sync,
    root,
    status,
    element('#round-error'),
    render,
  );
  const name = (id: string) => catalog!.heroes.find((hero) => hero.id === id)!.name.text;

  function render() {
    if (!current || !catalog) return;
    const round = current.round;
    const ownActive = Boolean(
      round?.activeHeroId &&
        current.preparation!.heroes.some(
          (hero) => hero.heroId === round.activeHeroId && hero.playerId === player?.id,
        ),
    );
    const pending = Boolean(current.scout || current.skillTest?.status === 'converting');
    const allEnded = round?.heroes.every((hero) => hero.turnEnded);
    const allScouted = round?.heroes.every((hero) => hero.rallyDone);
    const active = round?.heroes.find((hero) => hero.heroId === round.activeHeroId);
    element('#round-title').textContent = round
      ? `Round ${round.number} · ${PHASE_LABELS[round.phase]}`
      : 'Il round della compagnia';
    const message = !round
      ? 'La compagnia è pronta per iniziare i turni.'
      : round.phase === 'action'
        ? active
          ? `${name(active.heroId)} è di turno · ${2 - active.actionsUsed} ${active.actionsUsed === 1 ? 'azione disponibile' : 'azioni disponibili'}.`
          : allEnded
            ? 'Tutti gli eroi hanno concluso. Il gruppo può passare all’Ombra.'
            : 'Scegliete insieme quale eroe agisce adesso.'
        : round.phase === 'shadow'
          ? `${SHADOW_LABELS[round.shadowStep!]} · da confermare insieme.`
          : allScouted
            ? 'Tutti gli eroi hanno concluso Scoperta. Il prossimo round è pronto.'
            : 'Tutti i mazzi sono ricomposti. Ogni eroe effettua Scoperta 2 con l’eventuale bonus di Aragorn, una volta.';
    const nextStatus = message + (pending ? ' Concludi prima le carte rivelate.' : '');
    if (status.textContent !== nextStatus) status.textContent = nextStatus;
    element('#round-phase-help').textContent = !round
      ? current.group && !current.journey
        ? 'Aprite prima la mappa e collocate gli eroi. Poi potete iniziare i round.'
        : 'Avviate i round quando siete pronti. Le prove e Scoperta già risolte restano salvate.'
      : round.phase === 'action'
        ? 'Ogni eroe svolge un turno completo: da zero a due azioni, anche ripetute. Puoi interagire con una prova o aprire la mappa per viaggiare. Gli attacchi seguiranno con il combattimento.'
        : round.phase === 'shadow'
          ? 'Risoluzione manuale: il gruppo risolve o verifica che non si applichi questo passaggio. Nemici, oscurità e minaccia non sono ancora calcolati dal tavolo. Dopo minaccia, rendete pronti i nemici esauriti e confermate: tutti i mazzi saranno ricomposti.'
          : 'I mazzi sono stati mescolati tutti insieme, senza le carte preparate. Completate Scoperta nella sezione qui sotto, poi aprite il nuovo round.';
    form.hidden = !player || Boolean(round?.activeHeroId);
    const choosing = Boolean(round?.phase === 'action' && !allEnded);
    element('#round-hero-field').hidden = !choosing;
    select.disabled = !choosing;
    for (const option of select.options) {
      option.disabled = Boolean(
        round?.heroes.find((hero) => hero.heroId === option.value)?.turnEnded,
      );
    }
    if (!select.selectedOptions.length || select.selectedOptions[0]?.disabled)
      select.value = [...select.options].find((option) => !option.disabled)?.value ?? '';
    element('#round-agreement').textContent = !round
      ? 'Il gruppo è pronto a iniziare i round.'
      : round.phase === 'shadow'
        ? `Il gruppo ha risolto ${SHADOW_LABELS[round.shadowStep!].toLocaleLowerCase('it')} o verificato che non si applichi.`
        : choosing
          ? 'Il gruppo ha concordato che questo eroe agisce adesso.'
          : 'Il gruppo è pronto a passare alla fase successiva.';
    confirm.textContent = !round
      ? 'Inizia i round'
      : choosing
        ? 'Inizia il turno dell’eroe'
        : round.phase === 'action'
          ? 'Passa alla Fase di Ombra'
          : round.phase === 'shadow'
            ? `Conferma: ${SHADOW_LABELS[round.shadowStep!]}`
            : `Inizia il round ${round.number + 1}`;
    confirm.dataset.blocked = String(
      pending ||
        (!round && Boolean(current.group) && !current.journey) ||
        !agreed.checked ||
        (choosing && !select.value) ||
        (round?.phase === 'rally' && !allScouted),
    );
    element('#round-turn-controls').hidden = !ownActive;
    element('#round-unused').textContent =
      `Puoi concludere anche senza usare tutte le azioni. Azioni usate: ${active?.actionsUsed ?? 0} / 2.`;
    element('#round-interact').hidden = !ownActive || pending || active?.actionsUsed === 2;
    end.dataset.blocked = String(!ownActive || pending);
    element('#round-observer').hidden = Boolean(player);
    refreshActions();
  }

  form.oninput = () => {
    commands.clear();
    render();
  };
  form.onsubmit = (event) => {
    event.preventDefault();
    if (!current || !agreed.checked) return;
    const round = current.round;
    if (!round) void commands.submit({ type: 'START_ROUNDS', agreed: true }, true);
    else if (round.phase === 'shadow')
      void commands.submit(
        { type: 'CONFIRM_SHADOW_STEP', roundId: round.id, step: round.shadowStep!, agreed: true },
        true,
      );
    else if (round.phase === 'rally')
      void commands.submit({ type: 'END_RALLY', roundId: round.id, agreed: true }, true);
    else if (round.heroes.every((hero) => hero.turnEnded))
      void commands.submit({ type: 'BEGIN_SHADOW', roundId: round.id, agreed: true }, true);
    else
      void commands.submit(
        { type: 'START_TURN', roundId: round.id, heroId: select.value, agreed: true },
        true,
      );
  };
  end.onclick = () => {
    const round = current?.round;
    if (round?.activeHeroId && round.turnId)
      void commands.submit(
        { type: 'END_TURN', roundId: round.id, heroId: round.activeHeroId, turnId: round.turnId },
        true,
      );
  };
  return {
    update(session: Session, identity: Player | null, content: Catalog | null) {
      current = session;
      player = identity;
      catalog = content;
      root.hidden = !content || session.preparation?.status !== 'prepared';
      if (root.hidden || !catalog) return;
      const mine = session.preparation!.heroes.filter((hero) => hero.playerId === player?.id);
      const nextRoster = `${session.generation}:${player?.id}:${mine.map((hero) => hero.heroId)}`;
      if (nextRoster !== rosterKey) {
        select.replaceChildren(
          ...mine.map((hero) => {
            const option = document.createElement('option');
            option.value = hero.heroId;
            option.textContent = name(hero.heroId);
            return option;
          }),
        );
        rosterKey = nextRoster;
      }
      const round = session.round;
      const nextContext = `${nextRoster}:${round?.id}:${round?.phase}:${round?.shadowStep}:${round?.turnId}:${round?.heroes.every((hero) => hero.turnEnded)}:${round?.heroes.every((hero) => hero.rallyDone)}`;
      if (nextContext !== contextKey) {
        agreed.checked = false;
        commands.clear();
        element('#round-error').hidden = true;
        contextKey = nextContext;
      }
      const nextProgress = `${session.generation}:${JSON.stringify(round)}:${session.scout?.id}:${session.scout?.count}`;
      if (nextProgress !== progressKey) {
        element('#round-heroes').replaceChildren(
          ...(round?.heroes ?? []).map((hero) => {
            const scoutCount = rallyScoutCount(
              session.preparation!.heroes,
              session.journey,
              hero.heroId,
            );
            const row = text('li', '', hero.heroId === round?.activeHeroId ? 'round-active' : '');
            const owner = session.preparation!.heroes.find(
              (entry) => entry.heroId === hero.heroId,
            )!.playerId;
            row.append(
              text('strong', name(hero.heroId)),
              text('span', session.players.find((entry) => entry.id === owner)!.name),
              text(
                'span',
                round?.phase === 'rally'
                  ? hero.rallyDone
                    ? 'Scoperta conclusa'
                    : current?.scout?.heroId === hero.heroId
                      ? `Scoperta ${current.scout.count} in corso · pesca salvata`
                      : scoutCount === 3
                        ? 'Scoperta 2 + 1 di Aragorn da fare'
                        : scoutCount === null
                          ? 'Scoperta da fare · vicinanza da indicare'
                          : 'Scoperta 2 da fare'
                  : hero.turnEnded
                    ? `Turno concluso · ${hero.actionsUsed} / 2 azioni usate`
                    : hero.heroId === round?.activeHeroId
                      ? `Di turno · ${hero.actionsUsed} / 2 azioni usate`
                      : 'Turno da iniziare',
              ),
            );
            return row;
          }),
        );
        progressKey = nextProgress;
      }
      render();
    },
  };
}
