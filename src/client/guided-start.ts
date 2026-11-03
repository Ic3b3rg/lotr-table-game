import type { Player, Session } from '../shared/protocol';
import { rosterProblem } from '../shared/preparation';
import type { GenerationOffer } from '../shared/generated-map';
import { SHADOW_LABELS } from '../shared/rounds';
import { refreshActions } from './actions';
import { element } from './dom';
import { createGameActions } from './game-actions';
import { createGuide } from './guide';

export function createGuidedStart(sync: () => Promise<void>) {
  const personal = location.pathname === '/join';
  const title = element('#start-title');
  const instruction = element('#start-instruction');
  const action = element<HTMLAnchorElement>('#start-action');
  const settings = element<HTMLDetailsElement>('#group-settings');
  const size = element<HTMLSelectElement>('#group-size');
  const agreed = element<HTMLInputElement>('#group-agreed');
  const toggle = element<HTMLButtonElement>('#toggle-tools');
  let current: Session | null = null;
  let groupKey = '';
  let groupDirty = false;
  let generation = '';
  let tools = false;
  let topic = 'start';
  const guide = createGuide((target) => {
    const destination = document.querySelector<HTMLElement>(target);
    if (destination && !destination.hidden && destination.childNodes.length) {
      if (!destination.getClientRects().length) {
        tools = true;
        preference(true);
      }
      destination.tabIndex = -1;
      destination.focus();
      destination.scrollIntoView({ block: 'start' });
    } else {
      const notice = element('#notice');
      notice.textContent =
        'Questi comandi non sono ancora disponibili per questa vista. Segui il passo attuale per continuare.';
      notice.hidden = false;
      notice.tabIndex = -1;
      notice.focus();
    }
  });
  const commands = createGameActions(
    () => current,
    sync,
    settings,
    element('#group-status'),
    element('#group-error'),
  );
  function preference(save = false) {
    document.body.classList.toggle('guided', !tools);
    toggle.textContent = tools ? 'Torna al percorso guidato' : 'Mostra tutti gli strumenti';
    toggle.setAttribute('aria-pressed', String(tools));
    if (save) {
      try {
        localStorage.setItem(`viaggi-tools:${generation}`, String(tools));
      } catch {
        /* The guide works without browser storage. */
      }
    }
  }
  document.body.classList.add('guided');
  toggle.onclick = () => {
    tools = !tools;
    preference(true);
  };
  element('#step-help').onclick = () => guide.open(topic);
  for (const link of document.querySelectorAll<HTMLAnchorElement>('[data-tools-link]')) {
    link.onclick = () => {
      tools = true;
      preference(true);
    };
  }
  const cancelGroup = element<HTMLButtonElement>('#cancel-group');
  element<HTMLFormElement>('#group-form').oninput = () => {
    commands.clear();
    groupDirty = true;
    cancelGroup.hidden = false;
  };
  cancelGroup.onclick = () => {
    groupDirty = false;
    groupKey = '';
    commands.clear();
    element('#group-error').hidden = true;
    void sync();
  };
  element<HTMLFormElement>('#group-form').onsubmit = (event) => {
    event.preventDefault();
    if (agreed.checked)
      void commands
        .submit({ type: 'SET_GROUP_SIZE', playerCount: Number(size.value), agreed: true }, true)
        .then((completed) => {
          if (completed) {
            groupDirty = false;
            agreed.checked = false;
            settings.open = false;
            title.focus();
          }
        });
  };

  return {
    update(session: Session, player: Player | null, generationOffer: GenerationOffer) {
      current = session;
      const identity = personal ? player : null;
      if (generation !== session.generation) {
        generation = session.generation;
        groupDirty = false;
        try {
          tools = localStorage.getItem(`viaggi-tools:${generation}`) === 'true';
        } catch {
          tools = false;
        }
        commands.clear();
        preference();
      }
      const expected = session.group?.expectedPlayers;
      const prepared = session.preparation?.status === 'prepared';
      const heroes = session.preparation?.heroes ?? [];
      const missing = session.players.filter(
        (person) => !heroes.some((hero) => hero.playerId === person.id),
      );
      const ready = Boolean(
        session.preparation &&
          !rosterProblem(
            session.players.map((person) => person.id),
            session.preparation,
          ),
      );
      const myHeroes = heroes.filter((hero) => hero.playerId === identity?.id);
      const waiting = expected !== undefined && session.players.length < expected;
      let step: number;
      let heading: string;
      let message: string;
      let target: string;
      let label: string;
      if (!prepared && !session.players.length) {
        step = 1;
        heading = 'Prendete posto al tavolo';
        topic = 'start';
        message = personal
          ? 'Inserisci il tuo nome qui sotto. Conserva il codice personale: ti servirà se cambi dispositivo.'
          : 'Ogni giocatore apre il QR sul proprio telefono e inserisce il suo nome. Il PC resta lo schermo condiviso. Per giocare da questo PC, apri una vista personale.';
        target = personal ? '#player-name' : '#invitation';
        label = personal ? 'Inserisci il tuo nome' : 'Mostra il QR e l’ingresso';
      } else if (!prepared && (!expected || waiting)) {
        step = 2;
        heading = expected
          ? `Aspettate il gruppo · ${session.players.length} su ${expected}`
          : 'Quanti giocatori aspettate?';
        topic = 'group';
        message = !expected
          ? identity
            ? 'Concordate il numero di persone, poi confermalo qui sotto. In tre, ciascuno sceglierà un eroe.'
            : 'Un partecipante conferma il numero di giocatori dalla sua vista personale. Gli altri entrano con il QR.'
          : `${expected - session.players.length === 1 ? 'Manca 1 giocatore' : `Mancano ${expected - session.players.length} giocatori`}. Ognuno entra con un nome dal proprio browser. I mazzi si preparano quando siete tutti presenti.`;
        target =
          identity && !expected
            ? '#group-size'
            : personal
              ? identity
                ? '#players'
                : '#player-name'
              : '#invitation';
        label =
          identity && !expected
            ? 'Conferma quanti siete'
            : personal && !identity
              ? 'Prendi il tuo posto'
              : 'Controlla gli ingressi';
      } else if (!prepared) {
        step = ready ? 4 : 3;
        heading = ready ? 'Confermate insieme la compagnia' : 'Scegliete eroi, ruoli e oggetti';
        topic = 'heroes';
        message = ready
          ? 'Tutti hanno scelto. Controllate ruoli e oggetti qui sotto. Un partecipante conferma l’accordo e prepara tutti i mazzi; poi gli eroi saranno fissati.'
          : identity
            ? myHeroes.length
              ? 'Hai scelto il tuo eroe. Controlla ruolo e oggetti con Configura. Aspettate che tutti abbiano un eroe e un ruolo distinto.'
              : expected === 1
                ? 'Scegli da due a quattro eroi. Poi controlla ruolo e oggetti di ognuno; ogni eroe avrà il suo mazzo.'
                : 'Scegli un eroe libero e salva. Troverai già proposti il ruolo e gli oggetti iniziali: puoi cambiarli con Configura.'
            : `Ogni partecipante sceglie dalla vista personale. ${missing.length ? `Devono ancora scegliere: ${missing.map((person) => person.name).join(', ')}.` : 'Controllate che ogni eroe abbia un ruolo distinto.'}`;
        target = personal && !identity ? '#recover-code' : '#company-preparation';
        label =
          personal && !identity
            ? 'Recupera il tuo posto'
            : ready
              ? 'Controlla e prepara i mazzi'
              : 'Vai alla scelta degli eroi';
      } else if (session.scenario) {
        step = 6;
        topic = 'startup';
        const q = session.scenario.pending;
        heading =
          session.scenario.phase === 'action'
            ? 'L’avventura è iniziata'
            : session.scenario.pack.name;
        message = q?.heroId
          ? `${session.players.find((p) => p.id === q.actorPlayerId)?.name ?? 'Il proprietario'} completa ${q.kind === 'scout' ? 'Scoperta 2' : 'Spirito 1'} con il proprio eroe. Le carte e le scelte sono salvate a ogni conferma.`
          : q
            ? 'Leggete insieme le istruzioni dell’avventura e confermate il passo indicato.'
            : 'Obiettivo iniziale salvato. Scegliete insieme il primo eroe di turno; il proprietario apre il turno dalla vista personale.';
        target =
          q?.stage === 'revealed'
            ? q.kind === 'scout'
              ? '#scouting'
              : '#skill-tests'
            : session.scenario.phase === 'action'
              ? '#rounds'
              : '#scenario';
        label =
          q?.stage === 'revealed'
            ? 'Completa le carte rivelate'
            : session.scenario.phase === 'action'
              ? 'Scegli il turno'
              : 'Continua l’avventura';
        if (session.scenario.phase === 'action' && session.round) {
          const round = session.round,
            active = heroes.find((h) => h.heroId === round.activeHeroId),
            progress = round.heroes.find((h) => h.heroId === round.activeHeroId);
          if (active && progress) {
            heading = `Round ${round.number} · È il turno di ${session.players.find((p) => p.id === active.playerId)?.name}`;
            message = `${2 - progress.actionsUsed} azioni disponibili. Il proprietario può viaggiare nelle tessere esplorate e concludere il turno. Le altre capacità dell’avventura restano bloccate finché i loro effetti non sono completi.`;
            target = '#journey-map';
            label = 'Apri la mappa del turno';
          } else if (round.heroes.every((h) => h.turnEnded)) {
            heading = 'I turni sono conclusi';
            message =
              'La Fase di Ombra richiede ancora gli effetti dell’avventura. Le conferme dei tavoli precedenti non li sostituiscono.';
            target = '#scenario';
            label = 'Controlla lo stato dell’avventura';
          }
        }
      } else if (session.mapGeneration || generationOffer.kind !== 'legacy') {
        step = 5;
        topic = 'map';
        target = session.mapGeneration?.status === 'frozen' ? '#scenario' : '#adventure-generation';
        label = session.mapGeneration?.status === 'frozen' ? 'Avvia l’avventura' : 'Vai alla mappa';
        const frozen = session.mapGeneration?.status === 'frozen';
        heading = frozen
          ? 'La mappa è salvata'
          : session.mapGeneration
            ? 'Create la mappa · richiesta salvata'
            : 'Create la mappa della compagnia';
        message = frozen
          ? 'Il PC conserva questa mappa e i suoi incontri. Un partecipante avvia l’avventura: seguiranno le istruzioni e le richieste per ogni eroe.'
          : generationOffer.message;
      } else if (
        !session.journey &&
        !session.round &&
        !session.scout &&
        session.skillTest?.status !== 'converting'
      ) {
        step = 5;
        heading = 'Collocate gli eroi sulla mappa';
        topic = 'map';
        message =
          'I mazzi sono pronti. Un partecipante conferma la collocazione iniziale dalla vista personale. Il tratto disponibile sarà mostrato a tutti, con le posizioni salvate.';
        target = '#journey-map';
        label = 'Apri il tratto iniziale';
      } else {
        step = 6;
        topic = 'turn';
        target = '#rounds';
        label = 'Vai ai comandi del round';
        const round = session.round;
        if (session.scout || session.skillTest?.status === 'converting') {
          const pending = session.scout ?? session.skillTest!;
          const owner = heroes.find((hero) => hero.heroId === pending.heroId)?.playerId;
          heading = 'Concludete le carte rivelate';
          message = `${session.players.find((person) => person.id === owner)?.name ?? 'Il proprietario dell’eroe'} sceglie dalla vista personale. Le carte sono già salvate: tutti gli schermi mostrano la stessa pesca.`;
          target = session.scout ? '#scouting' : '#skill-tests';
          topic = session.scout ? 'scout' : 'tests';
          label = 'Vai alle carte rivelate';
        } else if (!round) {
          heading = 'Cominciate il primo round';
          message =
            'Un partecipante conferma che siete pronti. Poi scegliete insieme chi inizia: il proprietario apre il turno dalla propria vista personale.';
        } else if (round.phase === 'shadow') {
          heading = `Round ${round.number} · Fase di Ombra`;
          message = `${SHADOW_LABELS[round.shadowStep!]}: questo passaggio è manuale. Il gruppo risolve gli effetti applicabili con le regole originali, poi un partecipante conferma. Il tavolo non calcola ancora nemici, oscurità o minaccia.`;
          topic = 'shadow';
        } else if (round.phase === 'rally') {
          heading = `Round ${round.number} · Riorganizzazione`;
          const left = round.heroes.filter((hero) => !hero.rallyDone).length;
          message = left
            ? `I mazzi sono stati ricomposti. Restano ${left} ${left === 1 ? 'eroe' : 'eroi'}: ogni proprietario completa Scoperta dalla vista personale. Poi iniziate il round successivo.`
            : 'Tutti hanno completato Scoperta. Un partecipante può confermare l’inizio del round successivo.';
          if (left) {
            target = '#scouting';
            label = 'Completa Scoperta';
          }
          topic = 'scout';
        } else if (round.activeHeroId) {
          const hero = heroes.find((entry) => entry.heroId === round.activeHeroId)!;
          const progress = round.heroes.find((entry) => entry.heroId === hero.heroId)!;
          heading = `Round ${round.number} · È il turno di ${session.players.find((person) => person.id === hero.playerId)?.name}`;
          message = `${2 - progress.actionsUsed} azioni disponibili. Il proprietario può viaggiare sulla mappa o effettuare una prova di interazione, poi conclude il turno. Un viaggio consente fino a due movimenti. Gli attacchi sono ancora in sviluppo.`;
        } else {
          heading = `Round ${round.number} · Scegliete chi agisce`;
          message = round.heroes.every((hero) => hero.turnEnded)
            ? 'Tutti gli eroi hanno concluso. Un partecipante conferma il passaggio alla Fase di Ombra.'
            : 'Concordate un eroe che non ha ancora agito. Il proprietario seleziona il suo eroe, conferma l’accordo e inizia il turno: fino a due azioni.';
        }
      }
      if (personal && !identity && session.players.length) {
        step = 1;
        heading =
          prepared || (expected && !waiting) ? 'Recupera il tuo posto' : 'Prendi il tuo posto';
        topic = 'recovery';
        message =
          prepared || (expected && !waiting)
            ? 'Il gruppo è già al tavolo. Se hai già partecipato, inserisci il tuo codice personale. Non serve un nuovo giocatore.'
            : 'Inserisci il tuo nome qui sotto, oppure recupera il tuo posto con il codice personale.';
        target = prepared || (expected && !waiting) ? '#recover-code' : '#player-name';
        label = 'Vai al tuo posto';
      }
      element('#start-progress').lastElementChild!.textContent =
        session.mapGeneration || generationOffer.kind !== 'legacy' ? 'Avventura' : 'Gioca';
      document.body.dataset.step = String(step);
      document.body.dataset.scenario = session.scenario?.phase ?? '';
      document.body.dataset.phase = session.round?.phase ?? '';
      document.body.dataset.active = String(Boolean(session.round?.activeHeroId));
      document.body.dataset.scout = String(Boolean(session.scout));
      document.body.dataset.test = String(session.skillTest?.status === 'converting');
      title.textContent = heading;
      if (instruction.textContent !== message) instruction.textContent = message;
      action.href = target;
      action.textContent = label;
      action.onclick = () => {
        const destination = document.querySelector<HTMLElement>(target);
        if (destination) {
          const details = destination.closest('details');
          if (details) details.open = true;
          if (!destination.matches('input,select,button,a')) destination.tabIndex = -1;
          destination.focus({ preventScroll: true });
        }
      };
      [...element('#start-progress').children].forEach((node, index) => {
        if (index === step - 1) node.setAttribute('aria-current', 'step');
        else node.removeAttribute('aria-current');
        node.classList.toggle('step-done', index < step - 1);
      });
      settings.hidden = !identity || prepared;
      const nextGroup = `${session.generation}:${identity?.id}:${expected}`;
      if (groupKey !== nextGroup) {
        if (!groupDirty || !identity) {
          groupDirty = false;
          if (expected) size.value = String(expected);
          else size.value = '3';
          agreed.checked = false;
          settings.open = !expected;
        }
        groupKey = nextGroup;
      }
      cancelGroup.hidden = !groupDirty;
      element('#group-summary').textContent = expected
        ? `Giocherete in ${expected} · modifica prima di preparare`
        : 'Quanti giocatori siete?';
      const groupStatus =
        groupDirty && expected && Number(size.value) !== expected
          ? `Il gruppo salvato prevede ${expected} giocatori. La tua scelta di ${size.value} non è ancora confermata: controllala prima di salvare, oppure annulla.`
          : expected
            ? `Presenti ${session.players.length} su ${expected}. Gli ingressi e le scelte già salvate saranno conservati.`
            : 'Un solo partecipante conferma per tutto il gruppo.';
      if (element('#group-status').textContent !== groupStatus)
        element('#group-status').textContent = groupStatus;
      element('#screen-help').textContent = personal
        ? 'La tua vista personale: scegli il tuo eroe e gestisci il suo turno. Il PC mostra il tavolo a tutti.'
        : 'Il PC mostra il tavolo. Ogni giocatore partecipa dalla propria vista personale.';
      const focused = document.activeElement;
      if (
        focused instanceof HTMLElement &&
        focused !== document.body &&
        !focused.getClientRects().length
      )
        title.focus();
      refreshActions();
    },
  };
}
