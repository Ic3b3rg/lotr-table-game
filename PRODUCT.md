# Viaggi nella Terra di Mezzo — prodotto

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Il proprietario e il suo gruppo personale, da una a cinque persone riunite allo stesso tavolo e sulla stessa rete locale. Una persona può partecipare anche dal PC; giocatori, eroi e dispositivi sono concetti distinti.

## Product Purpose

Digitalizzare integralmente il gioco base e la campagna iniziale di Viaggi nella Terra di Mezzo, sostituendo componenti fisici e app di supporto. Regole, carte, personaggi, storia e funzionalità devono essere fedeli. Le espansioni vengono dopo.

## Operating Context

Un processo host su PC macOS o Windows conserva il salvataggio e serve le interfacce nei browser. Il PC presenta il tavolo condiviso; i telefoni entrano tramite QR senza account o installazione. Dopo la preparazione iniziale, la partita deve funzionare senza Internet. Tutte le azioni, comprese quelle comuni, devono essere disponibili dai telefoni.

## Capabilities and Constraints

- Salvataggio automatico prima della conferma di ogni azione accettata; copia esportabile e importabile.
- Codice personale per recuperare il proprio posto su un altro dispositivo; il QR pubblico non contiene il codice.
- Gruppo atteso da una a cinque persone, confermato e salvato prima della preparazione. Il tavolo aspetta tutti i giocatori previsti; il numero distingue persone, eroi e dispositivi e resta disponibile dopo riavvio, recupero e ripristino. Le modifiche prima della preparazione non cancellano scelte esistenti.
- Decisioni comuni secondo le regole del gioco, senza introdurre votazioni o precedenze di gioco basate sulla velocità dei telefoni.
- Sono implementati sessione, QR, recupero, prova condivisa e backup, preparazione persistente con sei eroi, sei ruoli, equipaggiamento iniziale e mazzi reali, prove standard con pesca, fato e ispirazione recuperabili, Scoperta con ordinamento e limite delle preparate e ricomposizione dei mazzi, turni con due azioni e interazioni con prova, Ombra manuale in tre passaggi e Riorganizzazione collettiva persistente, mappa di viaggio congelata e viaggio interrompibile con posizioni recuperabili. Il primo tratto è la reale 302A in orientamento canonico; non è ancora l’avventura 1 completa. Il catalogo italiano privato distingue testi ufficiali, traduzioni e associazioni candidate. Generazione completa delle mappe, altre capacità delle carte, combattimento e campagna giocabile seguono negli incrementi successivi.
- La Scoperta di Riorganizzazione rivela due carte di base. Con Aragorn nella compagnia, lui e gli eroi nella sua stessa casella o in una casella adiacente ricevono una carta aggiuntiva gratuita. L’host determina il bonus dalle posizioni e dai collegamenti salvati nella mappa, senza affidarsi alla distanza visiva e senza consumare azioni, ispirazione o effettuare altre ricomposizioni. Nei vecchi round privi di posizioni, per gli altri eroi il gruppo deve dichiarare esplicitamente la vicinanza ad Aragorn; nessuna risposta è preselezionata. La dichiarazione non può sostituire posizioni note. Il bonus riguarda questa fase; le altre Scoperte mantengono il proprio conteggio.
- Stato e backup usano lo schema 8. La migrazione dagli schemi 1–7 conserva compagnia, mazzi, ricevute e rivelazioni in corso: una Scoperta 2 già aperta conserva le due carte salvate fino alla conclusione, senza ripescare. Il bonus vale per le nuove Scoperte di Riorganizzazione. Per tornare a un host precedente serve una copia conservata prima della migrazione.
- Percorso guidato in sei passi: ingresso, gruppo, eroi, mazzi, mappa e round. Il passo deriva dallo stato salvato; la vista condivisa orienta il gruppo e le viste personali permettono le decisioni. Si può passare a tutti gli strumenti e tornare alla guida. Le scelte locali non ancora confermate sopravvivono agli aggiornamenti degli altri giocatori e richiedono un salvataggio esplicito.
- Guida al tavolo sempre accessibile da PC e telefono, con ricerca per argomento e rimandi ai comandi. Le istruzioni funzionano senza Internet; manuale italiano, Compendio inglese, FAQ italiane e carte corrette sono consultabili offline quando i quattro PDF sono installati nel pacchetto privato. L’assenza dei documenti è dichiarata senza impedire la lettura della guida.
- Le prove presentano con un’animazione le carte già salvate dall’host, senza nuove estrazioni durante conversione, aggiornamento o ripresa. Il movimento ridotto disattiva l’effetto; carte, simboli, esito e comandi restano accessibili senza attenderlo.
- Stack esistente: Node 24, HTTP locale, SQLite, TypeScript, HTML e CSS. La futura tecnologia di rendering della mappa non è ancora decisa.
- Uso personale; distribuzione pubblica e gioco remoto via Internet non fanno parte del primo rilascio.

## Brand Commitments

Lingua italiana. Il proprietario vuole un'esperienza coinvolgente che ricordi un gioco da tavolo animato e un videogioco a turni, con Baldur's Gate come riferimento dichiarato. Movimenti e animazioni contano; il 3D non è un requisito. La disposizione delle schermate può essere adattata a PC e telefoni. La direzione confermata è il diorama 2.5D; regia e animazioni del motore reale restano da implementare.

Il riferimento a Baldur's Gate riguarda soprattutto il personaggio, le skill, i poteri, la crescita, il combattimento a turni e il movimento sul terreno. La precedente richiesta di fedeltà alle regole rimane confermata; non è stata richiesta esplicitamente l'aggiunta di classi, livelli o regole di un altro gioco.

Il 23 ottobre 2026 il proprietario ha selezionato la direzione **Diorama 2.5D**: personaggi animati nel terreno, abilità e combattimento in primo piano. La prima consegna visiva è una scena interattiva dimostrativa per valutare il turno, separata dalla sessione persistente.

## Evidence on Hand

Contratti di prodotto e sessione in `docs/adr/0001-gioco-digitale-completo-in-rete-locale.md` e `docs/adr/0002-salvataggio-e-conferma-delle-azioni.md`. Verifiche della sessione e della preparazione in `docs/testing/`. Workbook fornito dall'utente, app ufficiale 1.6.6 e inventari in `docs/research/`. Il pacchetto privato copre la preparazione con 74 definizioni abilità e 78 oggetti; quattro testi mantengono una verifica incompleta. Il grafo delle avventure è ricostruito nei documenti di ricerca, ma comportamento runtime, intera scatola e campagna giocabile non sono ancora verificati integralmente.

Il contratto dell’avvio guidato è in `docs/planning/guided-start-spec.md`. La verifica del 2 novembre 2026 ha eseguito dalla UI l’ingresso e la preparazione di tre identità distinte, mappa, viaggio, prova, tre turni, Ombra manuale, Riorganizzazione e avvio del round 2, con recupero di un posto da un quarto profilo. Ha verificato anche la conservazione di una scelta locale del gruppo durante una modifica concorrente, fino al successivo salvataggio esplicito. Rapporto e limiti dell’incremento guidato in `docs/testing/guided-start-verification.md`; catture private desktop, mobile emulato e guida in `.scratch/ux-three-player/`.

Il bonus di Aragorn [#35](https://github.com/Ic3b3rg/lotr-table-game/issues/35) è implementato. Contratto e fonti in `docs/planning/aragorn-scout-spec.md`: manuale italiano, pagine stampate 11 e 14, e Compendio inglese §61.1–61.2. Proseguendo dalla UI con gli stessi tre profili, nella Riorganizzazione del round 2 Aragorn, Beravor e Bilbo hanno rivelato tre carte ciascuno con gli eroi adiacenti. Nel round 3, con Aragorn in Casella 3 e Beravor e Bilbo in Casella 1, le pesche effettive sono state rispettivamente 3, 2 e 2. La progressione è avvenuta interamente dalla UI, senza chiamate API scriventi. Le catture private `bonus-desktop.png` e `bonus-mobile.png` sono in `.scratch/ux-three-player/`; `bonus-legacy-mobile.png` documenta soltanto la vista di compatibilità tramite una fixture di lettura GET, senza attestare una progressione legacy reale dalla UI. Suite automatizzata corrente: 83 test superati su 83, typecheck e controllo del formato superati; comprende ripresa, backup e migrazione della Scoperta 2 pendente. L’accettazione dell’avventura completa [#33](https://github.com/Ic3b3rg/lotr-table-game/issues/33) resta aperta: avventura, combattimento e altre capacità non sono ancora completi.

## Product Principles

1. Conservare la fedeltà alle regole e ai contenuti mentre si adatta l'interfaccia.
2. Rendere il tavolo condiviso e i telefoni parti della stessa esperienza locale.
3. Conservare integralmente lo stato senza affidarsi alla memoria del gruppo.
4. Dare alle azioni una risposta visiva coinvolgente e comprensibile.

Le informazioni derivano dalle risposte confermate dal proprietario nella conversazione e dagli ADR. Nessuna proposta visiva presentata in seguito diventa una scelta approvata automaticamente.
