import { RuleCatalogSchema } from '../shared/rules';
import { request } from './api';
import { element, text } from './dom';

const TOPICS = [
  {
    id: 'inventory',
    title: 'Oggetti ottenuti, inventario e consumo',
    target: '#company-inventory',
    action: 'Torna all’inventario',
    paragraphs: [
      'Una ricerca può assegnare un accessorio dopo una prova. Leggere e annullare l’ispezione è gratuito; la conferma paga un’azione. Le carte determinano l’esito. Se la fonte permette un nuovo tentativo, ripeterlo richiede una nuova interazione e il relativo costo.',
      'Quando la fonte consente di scegliere chi ottiene l’oggetto, indica un eroe ammesso dal messaggio: quell’eroe lo equipaggia subito. La copia appartiene alla Compagnia e rimane a quell’eroe durante l’avventura. Non si può trasferirla liberamente fra telefoni o eroi.',
      'Apri l’inventario per vedere eroe e giocatore, carta e segnalini consumo rimasti. Ogni consumo rimuove un segnalino dalla stessa copia. A zero, la capacità che richiede consumo non è disponibile. Le finestre di gioco mostrano l’uso facoltativo e il costo quando pertinenti; leggere la carta non la attiva.',
      'Alla conclusione la copia torna nell’inventario comune e i segnalini dell’avventura sono rimossi. Premi, custodia e consumo sono salvati: ricarica o ripristino non ricreano copie. La scelta dell’equipaggiamento del prossimo avvio e gli avanzamenti generici attendono il seguito del campo.',
    ],
  },
  {
    id: 'camp',
    title: 'Vittoria, sconfitta, premi e primo campo',
    target: '#campaign',
    action: 'Torna al campo',
    paragraphs: [
      'Negli avvii che comprendono l’interazione del covo, raggiungi la sua casella con l’eroe di turno e ispeziona il segnalino. Annullare è gratuito. Confermare paga un’azione; le provocazioni e i costi delle carte attive devono essere completati. La prova usa le carte e le conversioni disponibili. I successi si aggiungono al progresso salvato: un tentativo fallito permette di riprendere con una nuova interazione. Il messaggio di successo conduce alla vittoria, ai premi e al campo.',
      'Se un eroe è sconfitto, i superstiti completano i propri turni e la compagnia perde all’inizio della prossima Ombra. Senza superstiti la perdita è immediata. Una sconfitta durante l’Ombra già iniziata attende il confine previsto; le conseguenze ancora dovute si completano prima del seguito.',
      'Negli avvii con il seguito della minaccia, raggiungere il limite conclude l’avventura dopo tutti i messaggi, le conseguenze e le collocazioni delle soglie raggiunte. Se il limite è già raggiunto prima della fase, la perdita precede i suoi effetti. Il riepilogo mostra minaccia prima/dopo e causa del termine.',
      'Un partecipante conferma per il gruppo i messaggi della conclusione. Gli XP vengono applicati al ruolo che ciascun eroe aveva in quel momento. La Sapienza è condivisa. Il riepilogo indica quali premi sono già applicati: reload e ripristino non li assegnano una seconda volta.',
      'Seguite la destinazione e il racconto della mappa della campagna, poi entrate nel campo. Ogni proprietario può scegliere un ruolo per il proprio eroe; scegliendo un ruolo già assegnato lo si trasferisce, lasciando l’altro eroe in attesa della propria scelta. L’esperienza resta nel ruolo che l’ha ricevuta.',
      'Gli acquisti di abilità e i potenziamenti attendono i rispettivi effetti e non spendono risorse. La prossima avventura ha una destinazione salvata, ma attende la propria mappa e le proprie istruzioni prima della partenza. Guida, lettore delle carte e copie di sicurezza restano disponibili nel campo.',
    ],
  },
  {
    id: 'combat',
    title: 'Attaccare e provocare: costi, successi e ritorno',
    target: '#combat',
    action: 'Torna al combattimento',
    paragraphs: [
      'Nel tuo turno apri Attacca, scegli un nemico vivo a portata e gli oggetti equipaggiati compatibili. La caratteristica deve essere comune agli oggetti scelti. Anteprima e annullamento sono gratuiti; confermare paga un’azione, salvo un attacco concesso da una capacità.',
      'La prova rivela le vere carte abilità. Usa le conversioni e le preparate disponibili pagando i costi indicati. Ogni successo può pagare una sola spesa; ciascuno slot stampato della singola copia si usa al massimo una volta. Puoi applicare anche zero colpi. Le carte rivelate e le reazioni dopo la prova si chiudono prima di applicare l’attacco.',
      'Il tavolo applica colpi e modificatori alle difese delle figure nell’ordine previsto. Le immunità sono indicate nell’esito; un modificatore ignorato non annulla i colpi pagati. Un gruppo sconfitto viene rimosso una volta e la ricompensa va a un eroe vivo entro il suo limite.',
      'Se è dovuto, il contrattacco torna allo stesso attaccante prima delle reazioni dopo attacco. Segui la prova per negare, ripartisci i successi fra danni e paure e completa ogni conseguenza. Le scelte simultanee indicano chi deve decidere. Le capacità non ancora disponibili riportano il limite prima del proprio costo.',
      'Prima di uscire da una casella o interagire, ogni gruppo pronto presente provoca un attacco. La provocazione non esaurisce il gruppo e non usa la riduzione degli elite. Dopo tutti i figli, il comando originario riprende con costo e movimenti applicati una volta, se è ancora legale. Anche i movimenti aggiunti dalle istruzioni seguono adiacenze, provocazioni ed esplorazioni.',
      'La vista personale mostra chi agisce e chi attende fino al ritorno al turno o al viaggio. Salvataggio, riavvio e ripristino conservano la stessa prova e la stessa istruzione. Le acquisizioni di benefici richiedono una riserva verificata; consumare un beneficio realmente assente segue invece il ripiego stampato.',
    ],
  },
  {
    id: 'exploration',
    title: 'Esplorare durante il viaggio',
    target: '#journey-map',
    action: 'Torna alla mappa',
    paragraphs: [
      'Scegli una casella visibile adiacente su una tessera tratteggiata. Leggi la conferma prima di entrare: annullare è gratuito. Confermare usa un movimento del viaggio già pagato; esplorare non richiede un’azione interazione.',
      'Il proprietario dell’eroe esploratore segue introduzione, piazzamenti e istruzione finale nell’avventura. L’ispirazione spetta a quell’eroe e rispetta il suo limite. I movimenti residui rimangono salvati e tornano disponibili al termine.',
      'La rivelazione di un segnalino permette di leggerlo. La sua interazione rimane bloccata se gli effetti successivi sono ancora in sviluppo. Riavvio e ripristino conservano la stessa esplorazione, senza ripetere premi o costi.',
    ],
  },
  {
    id: 'encounter',
    title: 'Incontro: ispezione, azione e progressi condivisi',
    target: '#scenario',
    action: 'Torna all’incontro',
    paragraphs: [
      'Nel turno dell’eroe, raggiungi la casella del segnalino e apri l’ispezione dalla mappa. Leggere e annullare è gratuito. Conferma la ricerca per spendere una sola azione. Le prove e le scelte successive continuano quell’interazione.',
      'Nei luoghi collegati, una prima visita può rivelare un altro segnalino. La visita rimane compiuta anche lasciando il luogo o fallendo la prova. Quando torni, scegli l’opzione con costo soltanto se è disponibile; leggere e allontanarsi non consumano azioni. Una scelta fra alternative indica quale prova affrontare: il suo esito viene calcolato dalle carte.',
      'Quando l’avventura assegna un titolo, il gruppo concorda chi lo riceve e il proprietario indicato registra la scelta. Il destinatario può essere un altro eroe. La carta si prepara subito, completando l’eventuale scarto per il limite quattro; un titolo già ottenuto dalla Compagnia non crea un’altra copia.',
      'Il primo controllo superato appartiene alla Compagnia e rimane valido anche se un ramo fallisce o agisce un altro eroe. I successi del conteggio si accumulano nel segnalino. I progressi e la Sapienza ottenuta sono visibili nell’avventura.',
      'Rivela le carte della prova indicata e usa soltanto le conversioni disponibili, pagando il costo. Una Scoperta o un’altra conseguenza figlia si completa prima della prova padre. La scelta obbligatoria rimane aperta fino alla decisione del proprietario.',
      'Danni e paure risolvono le carte, le prevenzioni e l’eventuale Ultimo Sforzo prima di restituire il turno. I movimenti residui del viaggio rimangono disponibili nello stesso turno. Reload e ripristino ritrovano la stessa istruzione e gli stessi costi.',
    ],
  },
  {
    id: 'physical',
    title: 'Danni, paure e Ultimo Sforzo: scelte e ripresa',
    target: '#scenario',
    action: 'Torna alla conseguenza',
    paragraphs: [
      'La prova sintetica P0 usa parametri, stati e crediti inventati. Verifica mazzi e recupero; non è un incontro originale e non rende completa l’avventura. La prevenzione concessa dalla prova non attiva Protezione o altre abilità originali.',
      'La prova P1 usa una fonte inventata distinta dal contenuto delle carte. Risolve ogni fronte e i suoi figli prima della carta seguente. Le scoperte mostrano il testo; le coperte restano casuali. La negazione compare solo se la fonte concede una prova; Protezione richiede una preparata del proprietario nella stessa casella, scartata per un solo destinatario. I costi originali non usano i crediti di prova P0.',
      'La richiesta indica chi agisce e per quale eroe. Ripartisci il budget fra danni e paure prima della pesca: puoi lasciarne inutilizzato. Il costo in crediti di prova è pagato soltanto se usi la concessione. Dopo la conferma il PC trasferisce automaticamente le carte residue.',
      'Le carte coperte mostrano soltanto retro e conteggio, anche al proprietario. Per scartarle scegli il numero per tipo; il PC estrae casualmente le copie e le restituisce sotto il loro mazzo. Non esiste una pila scarti da rimescolare. Una conseguenza obbligatoria non può essere annullata.',
      'Ogni decisione salva carte, costo e passo successivo insieme. Reload, riavvio e ripristino conservano la stessa casualità e la stessa richiesta. Un mazzo realmente vuoto o una capacità ancora non eseguibile sospende la conseguenza con un motivo preciso.',
      'Fine turno risolve prima i fronti e il Riposo confermato disponibile: il turno resta aperto durante tutti i figli. Riposo scarta la preparata come costo e fino alla quantità indicata di propri danni o paure coperti, anche misti. Lo scarto imposto da un altro effetto non attiva Riposo. Le reazioni dopo Riposo seguono prima del completamento.',
      'Il viaggio mostra il budget effettivo di ciascuna azione e conserva separatamente i movimenti residui. Le passive cessano quando la carta cambia faccia o zona. Riorganizzazione ricompone i mazzi una volta e risolve Scoperta, vincoli di cima e trigger delle carte prima del nuovo round. Vicino segue il grafo della mappa; Protezione richiede la stessa casella.',
      'Ultimo Sforzo si verifica dopo tutte le carte della fonte. Se entrambi i limiti sono raggiunti scegli l’ordine; la difficoltà è una sola per eroe e aumenta dopo ogni successo, anche cambiando tipo. L’istruzione resta la stessa dopo reload. Rivela le vere carte abilità e scegli costi e conversioni disponibili: il PC calcola l’esito. Se le sole scoperte raggiungono un limite, nessun numero di successi permette di superarlo.',
      'Un successo restituisce tutte le coperte del tipo e concede ispirazione entro il limite. I titoli ottenuti si preparano subito, completando l’eventuale scarto per il limite quattro. La proprietà resta distinta dall’abilità preparata o rimossa. Un uso che richiede benefici ancora non disponibili si ferma prima di spendere carte o applicare effetti. Uno sconfitto conserva i suoi componenti, perde la figura e non compie altre azioni; gli eroi rimasti possono proseguire fino all’inizio Ombra. Senza superstiti la perdita è immediata.',
      'Il backup completo è una copia privata per il recupero: include identità e ordine delle carte nascoste. Chi apre quel file o il database del PC può leggerli. Conservalo come materiale amministrativo, separato dalla normale vista di gioco.',
    ],
  },
  {
    id: 'startup',
    title: 'Avventura: istruzioni, carte e ripresa',
    target: '#scenario',
    action: 'Torna all’avventura',
    paragraphs: [
      'L’avventura usa la mappa salvata della compagnia. Leggete l’introduzione e seguite i piazzamenti: tessere, segnalini e posizioni compaiono soltanto quando richiesti dal copione.',
      'Ogni eroe effettua la propria Scoperta 2 iniziale e poi una prova di Spirito 1. Il proprietario rivela e risolve le carte dalla vista personale. Questo setup non spende azioni e non applica il bonus di Aragorn della Riorganizzazione. La ricompensa di ispirazione rispetta il limite dell’eroe.',
      'Ogni conferma, pesca e conversione è salvata sul PC. Ricaricare o ripristinare una copia riprende la stessa richiesta. Nel riepilogo dell’avventura puoi rileggere carte, risultati e ricompense completati.',
      'Dopo l’obiettivo scegliete il primo turno. Potete ispezionare i segnalini e annullare gratuitamente. Le esplorazioni e il passaggio a Ombra e Riorganizzazione dipendono dalle capacità incluse nell’avvio. Ulteriori incontri, combattimento e rami dell’avventura conservano i limiti indicati sul tavolo.',
    ],
  },
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
      'Dopo i mazzi, create e salvate la mappa della compagnia. Avviate poi l’avventura e seguite i suoi piazzamenti: le tessere compaiono quando richiesto, con le posizioni degli eroi salvate. I tavoli precedenti possono ancora usare il tratto iniziale separato.',
      'Durante il tuo turno, “Inizia viaggio” spende un’azione e assegna fino a due movimenti. Scegli una casella adiacente e conferma il movimento. Puoi interrompere il viaggio per interagire e usare poi il movimento rimasto nello stesso turno. Un secondo viaggio aggiunge altri due movimenti: con due azioni viaggio puoi muoverti fino a quattro volte. Concludere il turno rinuncia ai movimenti rimasti.',
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
      'Ogni eroe può svolgere fino a due azioni, anche uguali. Il tavolo gestisce viaggio e interazione con prova. Negli incontri originali l’interazione consuma l’azione alla conferma della ricerca, anche se la prova successiva fallisce. Negli avvii che comprendono il combattimento, “Attacca” esegue la prova, gli slot delle armi e il contrattacco dovuto; il pannello indica gli eventuali limiti prima dei costi.',
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
      'La pesca è salvata prima che appaia sugli schermi. L’animazione mostra quelle stesse carte; ricaricare o convertire fato non pesca di nuovo. Concludi la prova per scartare le carte rivelate. Le prove originali mostrano le capacità eseguibili e i loro costi. Le prove libere mantengono i propri limiti: consultate le carte prima di procedere.',
      'L’esito di un incontro segue le carte: non è una seconda conferma della ricerca. Se il fallimento concede Scatto 1, il proprietario dell’eroe sceglie una casella adiacente oppure rimane qui. Provocazioni ed esplorazione si completano prima del ritorno; lo Scatto concesso conserva i movimenti del viaggio già iniziato.',
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
    title: 'Ombra e passaggio alla Riorganizzazione',
    target: '#rounds',
    action: 'Vai alla Fase di Ombra',
    paragraphs: [
      'Negli avvii che comprendono il passaggio completo senza nemici, iniziare l’Ombra esegue gli effetti disponibili. L’oscurità segue la posizione di ogni eroe e le proprietà della mappa: quando si applica, il proprietario risolve la vera prova per negare e le conseguenze nel pannello dell’avventura. Timer ed eventi precedono l’aumento della minaccia. Leggete l’aumento, poi proseguite: il tavolo lo applica e ricompone i mazzi per la Riorganizzazione.',
      'Negli avvii con il seguito del timer, risolvete i messaggi e i piazzamenti nell’ordine proposto. La soglia di minaccia può richiedere prove per tutti gli eroi e collocare gruppi nemici: completate la prova con il proprietario indicato, poi consultate i gruppi sulla mappa. I gruppi comparsi dopo le attivazioni non agiscono retroattivamente. L’obiettivo aggiornato resta nel pannello dell’avventura. Gli avvii con combattimento permettono attacchi e provocazioni contro i gruppi disponibili. Le vere attivazioni dell’Ombra e il seguito dell’avventura conservano il limite prima dell’intera fase.',
      'Ogni proprietario completa Scoperta del proprio eroe. Potete preparare al massimo una carta e ordinare le altre sopra o sotto il mazzo, rispettando gli effetti attivi. Il round successivo si apre quando tutti hanno concluso. Un evento o una capacità ancora mancante blocca il passaggio con i progressi salvati.',
      'Negli avvii con le soglie successive, il tavolo applica la minaccia dopo la conferma dell’aumento e completa tutti i seguiti raggiunti, anche quelli registrati durante un messaggio. La perdita al limite arriva dopo questi seguiti e prima di rendere pronti i gruppi o ricomporre i mazzi. Se il limite è già raggiunto all’inizio dell’Ombra, l’avventura termina prima degli effetti. Una sconfitta eroe ha priorità a quel confine. L’oscurità globale appena attivata vale per le prossime conseguenze e non ripete la fase già conclusa.',
      'Nei tavoli precedenti e nelle prove sintetiche l’Ombra usa conferme manuali nell’ordine nemici, oscurità, minaccia. Il gruppo deve prima risolvere ogni passaggio o verificarne l’assenza. Dopo la minaccia rende pronti i nemici esauriti; la conferma finale ricompone i mazzi e apre Riorganizzazione.',
      'Gli avvii precedenti senza questa capacità conservano il proprio limite. Le conferme manuali dei tavoli precedenti e delle prove sintetiche non eseguono gli effetti dell’avventura originale.',
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
      'La mappa A1 e il suo avvio fino all’obiettivo iniziale sono disponibili con materiale verificato. La prima avventura completa richiede ancora interazioni ed esplorazioni successive, nemici e combattimento, effetti fisici e capacità, minaccia, progressione degli obiettivi, esiti e campo. Le capacità ancora mancanti restano bloccate nella nuova avventura.',
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
    // The close event is queued: preserve focus if another control already received it.
    if (
      restoreFocus &&
      caller?.isConnected &&
      (document.activeElement === document.body || dialog.contains(document.activeElement))
    )
      caller.focus({ preventScroll: true });
  });
  return { open };
}
