import type { Catalog } from '../shared/catalog';
import type { Player, Session } from '../shared/protocol';
import { definitionId } from '../shared/preparation';
import { rallyScoutCount } from '../shared/rally-scout';
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
  const proximity = element<HTMLSelectElement>('#rally-proximity');
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
  let proximityKey = '';
  let choices: Choice[] = [];
  const commands = createGameActions(() => current, sync, root, status, error, controls);
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
    const round = current.round;
    const inRally = round?.phase === 'rally';
    for (const option of heroSelect.options) {
      option.disabled = Boolean(
        inRally && round.heroes.find((hero) => hero.heroId === option.value)?.rallyDone,
      );
    }
    if (!heroSelect.selectedOptions.length || heroSelect.selectedOptions[0]?.disabled)
      heroSelect.value = [...heroSelect.options].find((option) => !option.disabled)?.value ?? '';
    const mine = current.preparation?.heroes.find(
      (hero) => hero.heroId === heroSelect.value && hero.playerId === player?.id,
    );
    const knownCount = inRally
      ? rallyScoutCount(current.preparation!.heroes, current.journey, heroSelect.value)
      : 2;
    const nextProximity = `${current.generation}:${round?.id}:${heroSelect.value}:${knownCount}`;
    if (proximityKey !== nextProximity) {
      proximity.value = '';
      proximityKey = nextProximity;
    }
    const unknown = inRally && knownCount === null;
    element('#rally-proximity-field').hidden = !unknown;
    proximity.required = Boolean(unknown);
    proximity.disabled = !unknown;
    const effective = knownCount ?? (proximity.value ? (proximity.value === 'near' ? 3 : 2) : null);
    element('#rally-count-help').textContent = unknown
      ? `Questo round precedente non ha posizioni registrate. Il gruppo deve indicare la vicinanza sul proprio tavolo.${effective ? ` Scoperta prevista: ${effective} carte.` : ''}`
      : inRally
        ? knownCount === 3
          ? 'Scoperta 2 di base + 1 per la capacità di Aragorn: riveli 3 carte. La vicinanza segue le caselle della mappa.'
          : 'Scoperta 2 di base. Nessun bonus di Aragorn applicabile a questo eroe.'
        : '';
    form.hidden = Boolean(pending) || !mine;
    start.dataset.blocked = String(Boolean(pending) || activeTest || !mine);
    rally.dataset.blocked = String(
      Boolean(pending) || activeTest || !mine || (unknown && !proximity.value),
    );
    start.hidden = Boolean(inRally);
    rally.hidden = Boolean(round && !inRally);
    rally.textContent = inRally
      ? effective
        ? `Scopri ${effective} per la Riorganizzazione`
        : 'Indica la vicinanza per scoprire'
      : 'Ricomponi e scopri 2';
    element('#scout-count-field').hidden = Boolean(inRally);
    count.disabled = Boolean(inRally);
    element('#scout-discard-controls').hidden = !mine || Boolean(pending) || Boolean(inRally);
    const nextPrepared = `${current.generation}:${mine?.heroId}:${mine?.prepared.join(',')}`;
    if (preparedKey !== nextPrepared) {
      options(discardSelect, mine?.prepared ?? [], 'Scegli una carta preparata');
      preparedKey = nextPrepared;
    }
    discard.dataset.blocked = String(
      !mine || activeTest || Boolean(pending) || !discardSelect.value || Boolean(inRally),
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
    if (current?.round?.phase === 'rally') {
      startRally();
      return;
    }
    void commands.submit(
      { type: 'START_SCOUT', heroId: heroSelect.value, count: count.valueAsNumber },
      true,
    );
  };
  function startRally() {
    void commands.submit(
      {
        type: 'START_RALLY_SCOUT',
        heroId: heroSelect.value,
        ...(current?.round ? { roundId: current.round.id } : {}),
        ...(current?.round?.phase === 'rally' &&
        rallyScoutCount(current.preparation!.heroes, current.journey, heroSelect.value) === null &&
        proximity.value
          ? { proximity: proximity.value as 'near' | 'far' }
          : {}),
      },
      true,
    );
  }
  rally.onclick = startRally;
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
  heroSelect.onchange = discardSelect.onchange = limit.onchange = proximity.onchange = controls;
  return {
    update(session: Session, identity: Player | null, content: Catalog | null) {
      current = session;
      player = identity;
      catalog = content;
      root.hidden = !catalog || session.preparation?.status !== 'prepared';
      if (root.hidden || !catalog) return;
      element('#scout-phase-help').textContent = !session.round
        ? 'Scopri carte quando una regola o una capacità lo richiede. Puoi prepararne una e scegliere l’ordine delle altre sopra o sotto il mazzo. Per riorganizzare l’eroe, ricomponi prima il mazzo e scopri due carte.'
        : session.round.phase === 'rally'
          ? 'Tutti i mazzi sono già ricomposti. Ogni eroe effettua Scoperta 2, più l’eventuale carta aggiuntiva di Aragorn, una volta. Può prepararne una e ordinare le altre sopra o sotto il mazzo.'
          : 'Scoperta da un effetto già determinato dal gruppo non consuma azioni. La ricomposizione dei mazzi avviene nella Riorganizzazione comune.';
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
          : session.round?.phase === 'rally' &&
              mine.length > 0 &&
              mine.every(
                (hero) =>
                  session.round!.heroes.find((progress) => progress.heroId === hero.heroId)!
                    .rallyDone,
              )
            ? 'I tuoi eroi hanno concluso Scoperta per questo round. Attendete la compagnia e aprite il prossimo round.'
            : 'Nessuna Scoperta in corso. Le carte preparate restano nell’area di ogni eroe.';
      if (status.textContent !== message) status.textContent = message;
      element('#scout-observer').hidden = mine.length > 0;
      controls();
    },
  };
}
