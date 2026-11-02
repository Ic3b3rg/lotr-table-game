import type { Catalog } from '../shared/catalog';
import type { Player, Session } from '../shared/protocol';
import { definitionId } from '../shared/preparation';
import { refreshActions } from './actions';
import { cardButton, type CardReader } from './cards';
import { element, text } from './dom';
import { createGameActions } from './game-actions';

type Choice = { copy: string; destination: 'top' | 'bottom' | 'prepare' };

export function createScouting(sync: () => Promise<void>, reader: CardReader) {
  const root = element('#scouting');
  const form = element<HTMLFormElement>('#scout-start-form');
  const heroSelect = element<HTMLSelectElement>('#scout-hero');
  const count = element<HTMLInputElement>('#scout-count');
  const start = element<HTMLButtonElement>('#start-scout');
  const rally = element<HTMLButtonElement>('#rally-scout');
  const choiceForm = element<HTMLFormElement>('#scout-choice-form');
  const list = element('#scout-cards');
  const limit = element<HTMLSelectElement>('#scout-limit-discard');
  const confirm = element<HTMLButtonElement>('#confirm-scout');
  const discardSelect = element<HTMLSelectElement>('#prepared-discard-copy');
  const discard = element<HTMLButtonElement>('#discard-prepared');
  const status = element('#scout-status');
  const error = element('#scout-error');
  let current: Session | null = null;
  let player: Player | null = null;
  let catalog: Catalog | null = null;
  let rosterKey = '';
  let scoutKey = '';
  let preparedKey = '';
  let limitKey = '';
  let choices: Choice[] = [];
  const commands = createGameActions(() => current, sync, root, status, error);
  const label = (copy: string) =>
    catalog!.skills.find((card) => card.id === definitionId(copy))!.name.text;
  function options(select: HTMLSelectElement, copies: string[], empty: string) {
    const previous = select.value;
    select.replaceChildren(
      ...['', ...copies].map((copy) => {
        const option = document.createElement('option');
        option.value = copy;
        option.textContent = copy ? label(copy) : empty;
        return option;
      }),
    );
    if (copies.includes(previous)) select.value = previous;
  }
  function controls() {
    if (!current) return;
    const pending = current.scout;
    const activeTest = current.skillTest?.status === 'converting';
    const mine = current.preparation?.heroes.find(
      (hero) => hero.heroId === heroSelect.value && hero.playerId === player?.id,
    );
    form.hidden = Boolean(pending) || !mine;
    start.dataset.blocked = rally.dataset.blocked = String(Boolean(pending) || activeTest || !mine);
    element('#scout-discard-controls').hidden = !mine || Boolean(pending);
    const nextPrepared = `${current.generation}:${mine?.heroId}:${mine?.prepared.join(',')}`;
    if (preparedKey !== nextPrepared) {
      options(discardSelect, mine?.prepared ?? [], 'Scegli una carta preparata');
      preparedKey = nextPrepared;
    }
    discard.dataset.blocked = String(
      !mine || activeTest || Boolean(pending) || !discardSelect.value,
    );
    const owner =
      pending && current.preparation?.heroes.find((hero) => hero.heroId === pending.heroId);
    const ownPending = Boolean(owner && owner.playerId === player?.id);
    choiceForm.hidden = !ownPending;
    const selected = choices.filter((choice) => choice.destination === 'prepare');
    const needsDiscard = Boolean(owner && owner.prepared.length === 4 && selected.length === 1);
    element('#scout-limit-field').hidden = !needsDiscard;
    limit.required = needsDiscard;
    const nextLimit = `${pending?.id}:${selected[0]?.copy ?? ''}`;
    if (nextLimit !== limitKey) {
      options(
        limit,
        owner ? [...owner.prepared, ...(selected[0] ? [selected[0].copy] : [])] : [],
        'Scegli quale scartare',
      );
      limitKey = nextLimit;
    }
    element('#scout-choice-help').textContent =
      selected.length > 1
        ? 'Puoi preparare al massimo una delle carte scoperte.'
        : needsDiscard
          ? 'La nuova carta sarebbe la quinta: scegli una delle cinque da scartare.'
          : 'Prima nell’elenco significa più vicina alla prossima pesca, sopra o sotto il mazzo.';
    confirm.dataset.blocked = String(
      !ownPending || selected.length > 1 || (needsDiscard && !limit.value),
    );
    refreshActions();
  }
  function drawChoices() {
    const scout = current?.scout;
    const own = current?.preparation?.heroes.some(
      (hero) => hero.heroId === scout?.heroId && hero.playerId === player?.id,
    );
    list.replaceChildren(
      ...choices.map((choice, index) => {
        const card = catalog!.skills.find((entry) => entry.id === definitionId(choice.copy))!;
        const row = text('li', '', 'scout-card');
        row.append(cardButton(card, (caller) => reader.card(card, caller)));
        if (!own) return row;
        const field = text('label', `Destinazione di ${card.name.text}`);
        const select = document.createElement('select');
        select.dataset.copy = choice.copy;
        for (const [value, name] of [
          ['top', 'Sopra il mazzo'],
          ['bottom', 'Sotto il mazzo'],
          ['prepare', 'Prepara questa carta'],
        ]) {
          const option = document.createElement('option');
          option.value = value!;
          option.textContent = name!;
          select.append(option);
        }
        select.value = choice.destination;
        select.onchange = () => {
          choice.destination = select.value as Choice['destination'];
          commands.clear();
          controls();
        };
        field.append(select);
        row.append(field);
        const moves = text('div', '', 'scout-moves');
        for (const [step, title] of [
          [-1, 'Sposta prima'],
          [1, 'Sposta dopo'],
        ] as const) {
          const button = text('button', title, 'company-link') as HTMLButtonElement;
          button.type = 'button';
          button.setAttribute('aria-label', `${title}: ${card.name.text}`);
          button.disabled = index + step < 0 || index + step >= choices.length;
          button.onclick = () => {
            [choices[index], choices[index + step]] = [choices[index + step]!, choices[index]!];
            commands.clear();
            drawChoices();
            controls();
            [...list.querySelectorAll<HTMLSelectElement>('select')]
              .find((field) => field.dataset.copy === choice.copy)
              ?.focus({ preventScroll: true });
          };
          moves.append(button);
        }
        row.append(moves);
        return row;
      }),
    );
  }
  form.onsubmit = (event) => {
    event.preventDefault();
    void commands.submit(
      { type: 'START_SCOUT', heroId: heroSelect.value, count: count.valueAsNumber },
      true,
    );
  };
  rally.onclick = () => {
    void commands.submit({ type: 'START_RALLY_SCOUT', heroId: heroSelect.value }, true);
  };
  choiceForm.onsubmit = (event) => {
    event.preventDefault();
    if (!current?.scout) return;
    void commands.submit(
      {
        type: 'RESOLVE_SCOUT',
        scoutId: current.scout.id,
        prepareCopy: choices.find((choice) => choice.destination === 'prepare')?.copy ?? null,
        top: choices.filter((choice) => choice.destination === 'top').map((choice) => choice.copy),
        bottom: choices
          .filter((choice) => choice.destination === 'bottom')
          .map((choice) => choice.copy),
        discardPreparedCopy: limit.required ? limit.value : null,
      },
      true,
    );
  };
  discard.onclick = () => {
    void commands.submit(
      { type: 'DISCARD_PREPARED_SKILL', heroId: heroSelect.value, copy: discardSelect.value },
      true,
    );
  };
  root.oninput = () => commands.clear();
  heroSelect.onchange = discardSelect.onchange = limit.onchange = controls;
  return {
    update(session: Session, identity: Player | null, content: Catalog | null) {
      current = session;
      player = identity;
      catalog = content;
      root.hidden = !catalog || session.preparation?.status !== 'prepared';
      if (root.hidden || !catalog) return;
      const mine = session.preparation!.heroes.filter((hero) => hero.playerId === player?.id);
      const nextRoster = `${session.generation}:${player?.id}:${mine.map((hero) => hero.heroId)}`;
      if (rosterKey !== nextRoster) {
        const previous = heroSelect.value;
        heroSelect.replaceChildren(
          ...mine.map((hero) => {
            const option = document.createElement('option');
            option.value = hero.heroId;
            option.textContent = catalog!.heroes.find(
              (entry) => entry.id === hero.heroId,
            )!.name.text;
            return option;
          }),
        );
        if (mine.some((hero) => hero.heroId === previous)) heroSelect.value = previous;
        rosterKey = nextRoster;
        commands.clear();
        error.hidden = true;
      }
      const nextScout = `${session.generation}:${player?.id}:${session.scout?.id ?? ''}`;
      if (scoutKey !== nextScout) {
        choices = (session.scout?.revealed ?? []).map((copy) => ({ copy, destination: 'top' }));
        drawChoices();
        scoutKey = nextScout;
        limitKey = '';
        commands.clear();
      }
      const hero = catalog.heroes.find((entry) => entry.id === session.scout?.heroId);
      const message = session.scout
        ? `${hero!.name.text} · Scoperta: ${session.scout.revealed.length} carte. Le carte rivelate sono salvate sul PC. Conferma preparazione e ordine.`
        : session.skillTest?.status === 'converting'
          ? 'Concludi la prova abilità prima di scoprire carte.'
          : 'Nessuna Scoperta in corso. Le carte preparate restano nell’area di ogni eroe.';
      if (status.textContent !== message) status.textContent = message;
      element('#scout-observer').hidden = mine.length > 0;
      controls();
    },
  };
}
