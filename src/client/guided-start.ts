import type { Player, Session } from '../shared/protocol';
import { playableScenarioPrefab } from '../shared/clues';
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
        const q = session.scenario.pending;
        const synthetic = session.scenario.pack.manifest.scope === 'synthetic-physical-p0';
        const startup =
          session.scenario.phase === 'setup' &&
          !!(session.scenario.pack.manifest.startupPreparation || session.scenario.battle);
        topic = startup ? 'startup' : q?.kind === 'physical' ? 'physical' : 'startup';
        heading =
          session.scenario.phase === 'action'
            ? synthetic
              ? 'Prova sintetica completata'
              : 'L’avventura è iniziata'
            : session.scenario.pack.name;
        message =
          q?.kind === 'physical'
            ? session.physical?.fronts
              ? `${session.players.find((p) => p.id === q.actorPlayerId)?.name ?? 'Il proprietario'} risolve la decisione qui sotto. Controlla carta, destinatario e costi: fonte e figli sono salvati.`
              : `${session.players.find((p) => p.id === q.actorPlayerId)?.name ?? 'Il proprietario'} risolve la conseguenza coperta. Controlla destinatario, quantità e allocazione qui sotto. Carte e scelte sono già salvate.`
            : q?.heroId
              ? `${session.players.find((p) => p.id === q.actorPlayerId)?.name ?? 'Il proprietario'} completa ${q.kind === 'scout' ? 'Scoperta 2' : 'Spirito 1'} con il proprio eroe. Le carte e le scelte sono salvate a ogni conferma.`
              : q
                ? 'Leggete insieme le istruzioni dell’avventura e confermate il passo indicato.'
                : synthetic
                  ? 'La prova P0 è conclusa e la fonte ha ripreso. Gli incontri originali e l’avventura completa richiedono ancora i loro effetti.'
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
          q?.kind === 'physical'
            ? 'Risolvi la conseguenza'
            : q?.stage === 'revealed'
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
          if (session.physical?.cycle) {
            if (round.phase === 'rally') {
              heading = `Round ${round.number} · Riorganizzazione`;
              message =
                'Ogni eroe apre la propria Scoperta. Preparate e ordinate le carte nel pannello dell’avventura; il nuovo round attende tutti gli effetti.';
              target = '#scouting';
              label = 'Apri Scoperta';
              topic = 'scout';
            } else if (!active) {
              heading =
                round.phase === 'shadow'
                  ? 'Ombra manuale della prova sintetica'
                  : 'Scegliete il prossimo passo';
              message =
                round.phase === 'shadow'
                  ? 'Questa conferma non esegue l’Ombra originale. Le capacità senza una vera fonte restano bloccate.'
                  : 'Scegliete il turno oppure, quando tutti hanno concluso, il passaggio manuale della prova sintetica.';
              target = '#rounds';
              label = 'Apri il round';
            }
            if (session.physical.cycle.pending) {
              heading =
                session.physical.active?.kind === 'gate'
                  ? 'Conseguenza sospesa'
                  : 'Completa la capacità in corso';
              message = `${session.players.find((p) => p.id === session.physical!.active?.actorPlayerId)?.name ?? 'Il proprietario indicato'} risolve la decisione. Carte, turno e movimenti residui restano salvati fino al ritorno.`;
              target = '#scenario';
              label = 'Apri la decisione';
              topic = 'physical';
            }
          }
        }
        if (session.scenario.battle) {
          heading =
            session.scenario.phase === 'setup'
              ? 'Allestite la seconda avventura'
              : 'Seconda avventura · Fase di Azione';
          message = q?.actorPlayerId
            ? `${session.players.find((p) => p.id === q.actorPlayerId)?.name ?? 'Il proprietario'} completa la scelta personale. Segui le carte e la capacità indicate; gli altri attendono. La ripresa conserva lo stesso passo.`
            : q
              ? 'Leggete e confermate l’istruzione della nuova mappa. Muri, terreni e gruppi seguono i piazzamenti indicati.'
              : session.round?.heroes.every((h) => h.turnEnded)
                ? 'I turni sono salvati. La prossima Ombra richiede le proprie istruzioni prima di proseguire.'
                : session.round?.activeHeroId
                  ? session.combat
                    ? 'Il proprietario dell’eroe di turno può attaccare, viaggiare dalla mappa o concludere il turno. Ogni attacco costa un’azione; i movimenti residui restano salvati.'
                    : 'Il proprietario dell’eroe di turno viaggia dalla mappa o conclude il turno. Gli altri partecipanti attendono.'
                  : 'Il proprietario del primo eroe apre il turno. Viaggiare usa una normale azione; i muri bloccano i rispettivi confini.';
          target = q ? '#scenario' : session.round?.activeHeroId ? '#journey-map' : '#rounds';
          label = q
            ? 'Completa l’allestimento'
            : session.round?.activeHeroId
              ? 'Apri la mappa del turno'
              : 'Apri il turno';
          topic = 'startup';
          if (
            session.scenario.battleRound &&
            session.round &&
            session.scenario.phase === 'action'
          ) {
            const round = session.round;
            heading = `Round ${round.number} · ${round.phase === 'shadow' ? 'Ombra' : round.phase === 'rally' ? 'Riorganizzazione' : 'Fase di Azione'}`;
            topic =
              round.phase === 'rally' ? 'scout' : round.phase === 'shadow' ? 'shadow' : 'turn';
            if (q) {
              message = q.actorPlayerId
                ? `${session.players.find((p) => p.id === q.actorPlayerId)?.name ?? 'Il proprietario indicato'} completa l’istruzione. Gli altri partecipanti attendono; carte ed effetti già risolti restano salvati.`
                : 'Completate il messaggio e i piazzamenti indicati. La fase riprende dopo il ritorno di tutte le conseguenze.';
              target = '#scenario';
              label = 'Completa l’istruzione';
            } else if (round.phase === 'rally') {
              const done = round.heroes.every((h) => h.rallyDone);
              message = done
                ? 'Ogni Scoperta è conclusa. Il gruppo può iniziare il nuovo round.'
                : 'I mazzi sono ricomposti. Ogni proprietario completa la propria Scoperta e l’ordine delle carte.';
              target = done ? '#rounds' : '#scouting';
              label = done ? 'Inizia il nuovo round' : 'Apri Scoperta';
            } else if (round.phase === 'shadow') {
              message =
                'Completate nemici, oscurità ed eventi. Leggete poi l’aumento della minaccia e proseguite insieme.';
              target = '#rounds';
              label = 'Continua l’Ombra';
            } else if (round.heroes.every((h) => h.turnEnded)) {
              message =
                'Tutti i turni sono conclusi. Il gruppo può iniziare l’Ombra e seguirne le conseguenze.';
              target = '#rounds';
              label = 'Inizia l’Ombra';
            }
          }
        }
        if (session.scenario.pack.manifest.scope === 'original-encounter-v1') {
          if (q) {
            const explorer = session.scenario.explorations?.attempts.find(
              (a) => a.id === session.scenario!.explorations?.active,
            );
            heading = explorer
              ? 'Esplora la tessera'
              : q.kind === 'hero-choice'
                ? 'Scegli il destinatario del titolo'
                : q.kind === 'choice'
                  ? 'Scegli come proseguire'
                  : q.kind === 'physical'
                    ? session.round?.phase === 'shadow'
                      ? 'Risolvi la prova dell’Ombra'
                      : 'Completa la prova o la conseguenza dell’incontro'
                    : 'Segui l’istruzione dell’avventura';
            const actor = q.actorPlayerId
              ? (session.players.find((p) => p.id === q.actorPlayerId)?.name ??
                'Il proprietario indicato')
              : 'Il gruppo';
            message = explorer
              ? `${actor} completa l’istruzione di esplorazione. L’ingresso ha usato 1 movimento, senza altre azioni; ${session.journey?.travel?.remaining ?? 0} movimenti residui restano salvati fino al ritorno.`
              : session.round?.phase === 'shadow'
                ? `${actor} completa l’istruzione dell’Ombra. Seguite i piazzamenti nell’ordine indicato; la Riorganizzazione attende tutti gli effetti.`
                : `${actor} completa il passo corrente. L’interazione conserva costo e movimenti residui.`;
            target = '#scenario';
            label = 'Apri l’istruzione';
            topic = explorer ? 'exploration' : q.kind === 'physical' ? 'physical' : 'encounter';
          } else if (session.scenario.phase === 'action' && !session.physical?.cycle?.pending) {
            topic = 'encounter';
            const available = session.scenario.instances.some(
              (i) =>
                i.visible &&
                !i.stopped &&
                playableScenarioPrefab(session.scenario!.pack, i.prefab!),
            );
            if (session.round?.heroes.every((h) => h.turnEnded)) {
              heading = 'I turni sono conclusi';
              message = session.scenario.pack.manifest.rounds
                ? 'Il gruppo può iniziare l’Ombra nella sezione del round. Seguite tutte le istruzioni fino alla Riorganizzazione.'
                : 'La Fase di Ombra originale non è ancora disponibile. I progressi sono salvati; puoi consultarli o esportare un backup.';
              target = '#scenario';
              label = 'Controlla lo stato dell’avventura';
            } else if (session.round?.activeHeroId) {
              message = session.scenario.pack.manifest.exploration
                ? `Apri la mappa per viaggiare nelle caselle visibili adiacenti, esplorare le tessere abilitate o usare i ${session.journey?.travel?.remaining ?? 0} movimenti residui. L’esplorazione non richiede un’altra azione; le interazioni disponibili restano indicate sui segnalini.`
                : available
                  ? 'Apri la mappa per viaggiare e raggiungere il segnalino disponibile. L’ispezione è gratuita; confermare l’interazione spende una sola azione.'
                  : 'L’incontro disponibile è concluso. Puoi usare i movimenti residui o concludere il turno; i successivi incontri richiedono ancora i loro effetti.';
            } else {
              message = available
                ? 'Scegliete il prossimo turno. Il segnalino iniziale è disponibile; la Fase di Ombra originale richiede ancora i suoi effetti.'
                : 'L’incontro disponibile è concluso. Gli eroi che devono ancora agire possono completare il turno; la Fase di Ombra originale richiede ancora i suoi effetti.';
            }
          }
          if (
            session.scenario.pack.manifest.rounds &&
            !q &&
            !session.physical?.cycle?.pending &&
            session.round
          ) {
            const round = session.round;
            if (round.phase === 'rally') {
              const done = round.heroes.every((h) => h.rallyDone);
              heading = `Round ${round.number} · Riorganizzazione`;
              message = done
                ? 'Ogni eroe ha completato Scoperta. Il gruppo può iniziare il nuovo round.'
                : 'I mazzi sono ricomposti. Ogni proprietario apre Scoperta e prepara o ordina le proprie carte; gli altri giocatori attendono il suo completamento.';
              target = done ? '#rounds' : '#scouting';
              label = done ? 'Inizia il nuovo round' : 'Apri Scoperta';
              topic = 'scout';
            } else if (round.phase === 'shadow') {
              heading = `Round ${round.number} · Ombra`;
              message =
                'Gli effetti dell’Ombra e gli eventi sono risolti nell’ordine dell’avventura. Leggete l’aumento della minaccia e proseguite alla Riorganizzazione.';
              target = '#rounds';
              label = 'Continua l’Ombra';
              topic = 'shadow';
            } else if (round.heroes.every((h) => h.turnEnded)) {
              heading = 'I turni sono conclusi';
              message =
                'Il gruppo può iniziare l’Ombra: il tavolo controlla e risolve gli effetti dell’avventura prima della Riorganizzazione.';
              target = '#rounds';
              label = 'Inizia l’Ombra';
              topic = 'shadow';
            } else if (!round.activeHeroId) {
              heading = `Round ${round.number} · Scegliete il prossimo eroe`;
              message =
                'Concordate l’ordine. Il proprietario inizia il turno del proprio eroe; gli altri giocatori attendono.';
              target = '#rounds';
              label = 'Scegli il turno';
              topic = 'turn';
            }
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
      if (session.combat?.pending && !session.combat.current) {
        const battle = session.scenario?.pack.manifest.battleStartup?.combat;
        heading = battle
          ? 'Scegli l’ordine delle provocazioni'
          : 'Scegli l’ordine prima dell’interazione';
        const owner =
          session.players.find((p) => p.id === session.combat!.pending!.actorPlayerId)?.name ??
          'Il proprietario indicato';
        message = battle
          ? `${owner} sceglie il prossimo gruppo pronto. Risolvi ogni provocazione prima del movimento: posizione e movimenti residui restano salvati.`
          : `${owner} registra il piano e l’ordine dei gruppi pronti. L’interazione resta salvata fino al ritorno.`;
        target = '#combat';
        label = 'Scegli il prossimo passo';
        topic = 'encounter';
      }
      if (session.combat?.current) {
        const combat = session.combat.current,
          actor = session.combat.pending?.actorPlayerId ?? session.physical?.active?.actorPlayerId;
        heading = combat.kind === 'provocation' ? 'Risolvi la provocazione' : 'Completa l’attacco';
        message = `${session.players.find((p) => p.id === actor)?.name ?? 'Il proprietario indicato'} completa la scelta corrente. ${combat.returnLabel}`;
        target = session.physical?.active ? '#physical-resolution' : '#combat';
        label = 'Apri il prossimo passo';
        topic = 'physical';
      }
      if (session.physical?.sourceTest?.terrain && session.physical.active) {
        const terrain = session.physical.sourceTest.terrain;
        heading =
          terrain.kind === 'attack'
            ? 'Falò: scegli carte e modificatore'
            : 'Massi: converti gratis per negare';
        message = `${session.players.find((p) => p.id === session.physical!.active!.actorPlayerId)?.name ?? 'Il proprietario indicato'} risolve la prova; gli altri attendono. ${session.combat?.current?.returnLabel ?? 'Poi riprende la fonte.'}`;
        target = '#physical-resolution';
        label = 'Apri le scelte della prova';
        topic = 'combat';
      }
      if (
        session.physical?.active?.kind === 'decision' &&
        ['interaction-look', 'interaction-order'].includes(session.physical.active.purpose ?? '')
      ) {
        const look = session.physical.active.purpose === 'interaction-look';
        heading = look ? 'Guarda prima di interagire' : 'Concordate l’ordine degli effetti';
        message = look
          ? `Solo ${session.players.find((p) => p.id === session.physical!.active!.actorPlayerId)?.name ?? 'il proprietario indicato'} legge la carta sul proprio dispositivo. Chiudi la lettura e continua la stessa interazione; gli altri attendono.`
          : 'Il gruppo concorda l’ordine. Il proprietario indicato conferma un effetto alla volta; il seguito e i costi sono salvati.';
        target = '#physical-resolution';
        label = look ? 'Apri la lettura e continua' : 'Scegli il prossimo effetto';
        topic = 'encounter';
      }
      if (session.scenario?.conclusion) {
        const conclusion = session.scenario.conclusion;
        heading =
          conclusion.stage === 'camp-preparation'
            ? 'Confermate le scelte per il seguito'
            : conclusion.stage === 'camp'
              ? 'La compagnia riposa nel campo'
              : 'Concludete l’avventura';
        message =
          conclusion.stage === 'camp-preparation'
            ? session.scenario.pack.manifest.campDeparture
              ? 'Ogni proprietario controlla e conferma ruolo, accessorio ed equipaggiamento. Quando tutti sono pronti, concordate l’ordine di pesca e partite dalla preparazione.'
              : 'Ogni proprietario controlla ruolo, accessorio facoltativo, equipaggiamento e carte previste, poi conferma. Le scelte sono salvate; la partenza della prossima avventura non è ancora disponibile. Potete tornare al campo e rientrare.'
            : conclusion.stage === 'camp'
              ? 'I premi sono già salvati nei ruoli che li hanno ottenuti. Ogni proprietario può scegliere il ruolo per il seguito. La prossima destinazione è indicata nel campo e attende il proprio materiale prima della partenza.'
              : `${conclusion.outcome === 'victory' ? 'La compagnia ha vinto l’avventura.' : 'L’avventura è terminata con una sconfitta.'} Un partecipante conferma per il gruppo i messaggi della conclusione, poi la destinazione e il racconto prima di entrare nel campo. Gli altri leggono e attendono; i premi si applicano una sola volta.`;
        target = '#campaign';
        label =
          conclusion.stage === 'camp-preparation'
            ? 'Apri le scelte'
            : conclusion.stage === 'camp'
              ? 'Apri il campo'
              : 'Leggi la conclusione';
        topic = 'camp';
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
