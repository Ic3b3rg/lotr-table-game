import { RuleCatalogSchema } from '../shared/rules';
import { request } from './api';
import { element, text } from './dom';

const TOPICS = [
  {
    id: 'start',
    title: 'Cominciare: PC, telefoni e primi passi',
    target: '#start',
    action: 'Torna al passo attuale',
    paragraphs: [
      'Il PC ospita e salva il tavolo. Tenete aperta la vista condivisa perché tutti vedano mappa, carte ed esiti. Ogni persona usa una vista personale su un telefono, tablet o browser distinto; il PC condiviso non è un giocatore.',
      'Collegatevi alla stessa rete Wi-Fi del PC. Inquadrate il QR, inserite un nome a testa e conservate il codice personale. Per giocare dal PC, usate “Partecipa da questo PC”; ogni persona deve avere il proprio browser o profilo.',
      'Seguite i sei passi: ingresso, numero di giocatori, scelta degli eroi, preparazione dei mazzi, mappa, round. Il passo si aggiorna per tutto il gruppo. “Mostra tutti gli strumenti” lascia consultare anche le altre sezioni; potete tornare al percorso guidato quando volete.',
    ],
  },
  {
    id: 'group',
    title: 'Numero di giocatori e attesa del gruppo',
    target: '#start',
    action: 'Vai al gruppo',
    paragraphs: [
      'Un partecipante conferma quante persone giocano, da una a cinque. Aspettate che tutti siano entrati prima di preparare i mazzi. Il numero previsto resta salvato anche dopo un riavvio.',
      'Da due a cinque giocatori, ciascuno controlla un eroe. In solitario scegli da due a quattro eroi: resti un solo giocatore. Prima della preparazione potete modificare il numero concordato, purché non escluda giocatori già presenti o cancelli scelte esistenti.',
    ],
  },
  {
    id: 'heroes',
    title: 'Scegliere eroi, ruoli, oggetti e mazzi',
    target: '#company-preparation',
    action: 'Vai alla compagnia',
    paragraphs: [
      'Nella vista personale scegli un eroe libero e premi “Salva gli eroi”. Il ruolo suggerito e gli oggetti iniziali vengono proposti se ancora disponibili. Apri “Configura” per verificarli o cambiarli; “Caratteristiche e capacità” apre la scheda originale dell’eroe.',
      'Concordate un ruolo diverso per ogni eroe. Rispettate le mani disponibili per armi e oggetti; un’arma a due mani occupa entrambe. Gli oggetti già assegnati non sono disponibili per un altro eroe. Salvate ogni modifica prima di proseguire.',
      'Quando tutti sono pronti, un partecipante conferma l’accordo e prepara i mazzi. La prima abilità del ruolo resta preparata; il resto viene mescolato insieme ad abilità base, eroe e una debolezza. Ogni eroe ha il suo mazzo coperto. Dopo questo passo gli eroi sono fissati.',
      'Se il tavolo cambia mentre stai scegliendo, le tue modifiche restano nel modulo. Premi di nuovo Salva per verificarle sullo stato aggiornato, oppure “Ricarica le scelte” per annullare le modifiche locali.',
    ],
  },
  {
    id: 'map',
    title: 'Mappa, posizioni e viaggio',
    target: '#journey-map',
    action: 'Vai alla mappa',
    paragraphs: [
      'Dopo i mazzi, un partecipante conferma la collocazione iniziale sulla mappa. Questa versione contiene un tratto iniziale verificato, non la generazione dell’intera avventura. Le caselle e i collegamenti indicano dove si può andare.',
      'Durante il tuo turno, “Inizia viaggio” spende un’azione e assegna fino a due movimenti. Scegli una casella adiacente e conferma il movimento. Puoi interrompere il viaggio per interagire e usare poi il movimento rimasto nello stesso turno. Un nuovo viaggio sostituisce i movimenti rimasti; non li somma.',
      'Trascina la visuale o usa i comandi sotto la mappa. Con la tastiera: frecce, +, − e Home. La lista delle posizioni e il menu Destinazione permettono di giocare anche senza usare l’immagine. “Movimento ridotto” evita gli spostamenti animati.',
    ],
  },
  {
    id: 'turn',
    title: 'Round e turno: fino a due azioni',
    target: '#rounds',
    action: 'Vai al round',
    paragraphs: [
      'Un round comprende Azione, Ombra e Riorganizzazione. Nella Fase di Azione concordate l’ordine. Il proprietario seleziona il proprio eroe e inizia il turno; quell’eroe lo completa prima che ne inizi un altro.',
      'Ogni eroe può svolgere fino a due azioni, anche uguali. Il tavolo gestisce viaggio e interazione con prova. Un’interazione consuma l’azione quando riveli le carte, anche se fallisci. Gli attacchi richiedono il combattimento, ancora in sviluppo.',
      '“Concludi il turno” è disponibile anche con azioni non usate. Prima concludi ogni prova o Scoperta in corso. Quando tutti gli eroi hanno terminato, un partecipante conferma il passaggio all’Ombra.',
    ],
  },
  {
    id: 'tests',
    title: 'Prove: pesca, successi, fato e ispirazione',
    target: '#skill-tests',
    action: 'Vai alle prove',
    paragraphs: [
      'Si usano carte abilità, non dadi. Scegli la caratteristica e la soglia indicate dalla prova. Riveli dal mazzo un numero di carte pari alla caratteristica, con l’eventuale modificatore già determinato dal gruppo; almeno una carta. Nelle carte rivelate conta solo i simboli: ignora il testo.',
      'Ogni simbolo successo vale un successo. Puoi spendere un’ispirazione per trasformare un fato in un successo, una conversione alla volta. Senza ispirazione, il fato non vale un successo. Se raggiungi la soglia superi la prova; nelle prove senza soglia confermi soltanto il numero dei successi.',
      'La pesca è salvata prima che appaia sugli schermi. L’animazione mostra quelle stesse carte; ricaricare o convertire fato non pesca di nuovo. Concludi la prova per scartare le carte rivelate. Le capacità speciali non sono ancora automatizzate: consultate le carte e i limiti prima di procedere.',
      'Durante un round, scegli “Interazione” per consumare un’azione. “Effetto già determinato” è riservato a una prova richiesta da un effetto effettivo e non consuma azioni. Registra ispirazione ottenuta soltanto quando una regola o una capacità la assegna.',
    ],
  },
  {
    id: 'scout',
    title: 'Scoperta, carte preparate e Riorganizzazione',
    target: '#scouting',
    action: 'Vai a Scoperta',
    paragraphs: [
      'Quando una regola richiede Scoperta, rivela il numero di carte indicato. Puoi preparare al massimo una di quelle carte. Scegli se mettere le altre sopra o sotto il mazzo e in quale ordine; poi conferma. Le carte preparate restano separate dal mazzo e disponibili per i loro effetti.',
      'La capacità di preparare è limitata a quattro carte. Se vuoi prepararne una quinta, scegli prima quale preparata scartare. Una carta scartata per un effetto va registrata solo dopo averne risolto effettivamente il testo.',
      'Nella Fase di Riorganizzazione tutti i mazzi sono ricomposti, lasciando fuori le preparate. Ogni proprietario esegue la Scoperta del proprio eroe una volta; quando tutti hanno finito, potete avviare il round successivo. Controllate sulle schede eventuali capacità che modificano il numero di carte.',
      'La Scoperta di Riorganizzazione è di due carte. Se Aragorn è nella compagnia, lui e gli eroi nella sua stessa casella o in una adiacente rivelano una carta aggiuntiva: tre in totale. Il tavolo applica questa capacità dalle posizioni salvate, senza costi o nuove mescolate. Nei vecchi round senza posizioni, il gruppo deve indicare esplicitamente se un altro eroe è vicino ad Aragorn; nessuna risposta è preselezionata. Una pesca già aperta conserva il numero e le carte salvate fino alla conclusione.',
    ],
  },
  {
    id: 'shadow',
    title: 'Ombra: cosa è ancora manuale',
    target: '#rounds',
    action: 'Vai alla Fase di Ombra',
    paragraphs: [
      'L’ordine è attivazione dei nemici, oscurità, minaccia. Prima di ogni conferma il gruppo deve risolvere il passaggio o verificare con le regole che non si applichi. Dopo la minaccia rendete pronti i nemici esauriti; la conferma finale ricompone i mazzi e apre Riorganizzazione.',
      'Il tavolo attuale non genera o calcola nemici, oscurità, minaccia ed eventi. I pulsanti registrano l’accordo del gruppo, non risolvono questi effetti. Per una partita completa queste parti devono ancora essere implementate.',
    ],
  },
  {
    id: 'recovery',
    title: 'Riprendere il posto, salvataggi e backup',
    target: '#backups',
    action: 'Vai ai backup sul PC',
    paragraphs: [
      'Il PC salva ogni decisione confermata. Se il collegamento si interrompe, aspetta la riconnessione e riprova la stessa richiesta. Non iniziare un nuovo tavolo per un’interruzione.',
      'Per cambiare browser o dispositivo, apri l’ingresso e scegli “Hai già un posto? Recuperalo”. Inserisci il codice personale ricevuto al primo ingresso. Il nuovo dispositivo controlla lo stesso posto; il browser precedente continua a ricordarlo, quindi usate un solo dispositivo alla volta per quell’eroe. Non viene aggiunto un giocatore. A gruppo completo o mazzi pronti, recupera il posto già esistente.',
      'Dal PC puoi esportare una copia della sessione. Conserva il file in un luogo fidato: contiene i dati necessari alla ripresa. Per ripristinarla, seleziona il file e controlla il riepilogo. Il ripristino sostituisce il tavolo corrente; esportane prima una copia se vuoi mantenerlo. I giocatori rientrano con i codici personali.',
    ],
  },
  {
    id: 'limits',
    title: 'Cosa puoi provare in questa versione',
    target: '#start',
    action: 'Torna al percorso guidato',
    paragraphs: [
      'Sono disponibili ingresso e recupero, compagnia e mazzi, tratto di mappa e viaggio, turni e azioni, prove standard, Scoperta, salvataggio e backup. Carte e immagini originali sono consultabili se installate sul PC.',
      'La prima avventura completa non è ancora giocabile. Mancano generazione ed esplorazione della mappa completa, nemici e combattimento, danni e paure, automatismi delle capacità, minaccia, obiettivi, esito dell’avventura e passaggio al campo. Un round nel tratto iniziale non equivale a una partita completata.',
      'Questa guida riassume il flusso; per i dettagli fate riferimento al manuale, al Compendio e agli errata originali installati qui sotto. Non inventate tiri di dadi o regole per superare un comando mancante.',
    ],
  },
] as const;

export function createGuide(navigate: (target: string) => void) {
  const dialog = element<HTMLDialogElement>('#table-guide');
  const search = element<HTMLInputElement>('#guide-search');
  const topics = element('#guide-topics');
  const articles = element('#guide-articles');
  let caller: HTMLElement | null = null;
  let restoreFocus = true;
  let rulesLoaded = false;
  const entries = TOPICS.map((topic) => {
    const article = text('article', '', 'guide-article');
    const heading = text('h3', topic.title);
    heading.tabIndex = -1;
    article.append(heading, ...topic.paragraphs.map((paragraph) => text('p', paragraph)));
    const jump = text('button', topic.action, 'text-button') as HTMLButtonElement;
    jump.type = 'button';
    jump.onclick = () => {
      restoreFocus = false;
      dialog.close();
      navigate(topic.target);
    };
    article.append(jump);
    articles.append(article);
    const tab = text('button', topic.title, 'text-button') as HTMLButtonElement;
    tab.type = 'button';
    tab.onclick = () => {
      heading.focus();
      heading.scrollIntoView({ block: 'start' });
    };
    topics.append(tab);
    return { topic, article, tab, heading };
  });
  const normalized = (value: string) =>
    value
      .toLocaleLowerCase('it')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  function filter() {
    const needle = normalized(search.value.trim());
    let count = 0;
    for (const { topic, article, tab } of entries) {
      const found = normalized(`${topic.title} ${topic.paragraphs.join(' ')}`).includes(needle);
      article.hidden = tab.hidden = !found;
      if (found) count++;
    }
    element('#guide-empty').hidden = count > 0;
  }
  search.oninput = filter;
  async function rules() {
    if (rulesLoaded) return;
    const list = element('#rule-documents');
    try {
      const catalog = RuleCatalogSchema.parse(await request('/api/rules'));
      list.replaceChildren(
        ...catalog.map((rule) => {
          const row = document.createElement('li');
          if (rule.available) {
            const link = text('a', `${rule.title} · PDF locale ↗`) as HTMLAnchorElement;
            link.href = `/api/rules/${rule.id}`;
            link.target = '_blank';
            link.rel = 'noopener';
            row.append(link);
          } else row.append(text('span', `${rule.title} · non installato su questo PC`));
          return row;
        }),
      );
      rulesLoaded = true;
    } catch {
      list.replaceChildren(
        text(
          'li',
          'Non riesco a verificare i PDF. Riapri la guida dopo la riconnessione; le istruzioni qui sopra restano disponibili.',
        ),
      );
    }
  }
  function open(id?: string) {
    restoreFocus = true;
    caller = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    search.value = '';
    filter();
    dialog.showModal();
    const entry = entries.find(({ topic }) => topic.id === id);
    if (entry) {
      entry.heading.focus();
      entry.heading.scrollIntoView({ block: 'start' });
    } else {
      dialog.scrollTop = 0;
      search.focus({ preventScroll: true });
    }
    void rules();
  }
  element('#open-guide').onclick = () => open();
  element('#close-guide').onclick = () => dialog.close();
  dialog.addEventListener('close', () => {
    if (restoreFocus && caller?.isConnected) caller.focus({ preventScroll: true });
  });
  return { open };
}
