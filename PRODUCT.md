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
- Decisioni comuni secondo le regole del gioco, senza introdurre votazioni o precedenze di gioco basate sulla velocità dei telefoni.
- Sono implementati sessione, QR, recupero, prova condivisa e backup, più la preparazione persistente con sei eroi, sei ruoli, equipaggiamento iniziale e mazzi reali. Il catalogo italiano privato distingue testi ufficiali, traduzioni e associazioni candidate. Effetti, prove, movimento, combattimento e campagna giocabile seguono negli incrementi successivi.
- Stack esistente: Node 24, HTTP locale, SQLite, TypeScript, HTML e CSS. La futura tecnologia di rendering della mappa non è ancora decisa.
- Uso personale; distribuzione pubblica e gioco remoto via Internet non fanno parte del primo rilascio.

## Brand Commitments

Lingua italiana. Il proprietario vuole un'esperienza coinvolgente che ricordi un gioco da tavolo animato e un videogioco a turni, con Baldur's Gate come riferimento dichiarato. Movimenti e animazioni contano; il 3D non è un requisito. La disposizione delle schermate può essere adattata a PC e telefoni. La direzione confermata è il diorama 2.5D; regia e animazioni del motore reale restano da implementare.

Il riferimento a Baldur's Gate riguarda soprattutto il personaggio, le skill, i poteri, la crescita, il combattimento a turni e il movimento sul terreno. La precedente richiesta di fedeltà alle regole rimane confermata; non è stata richiesta esplicitamente l'aggiunta di classi, livelli o regole di un altro gioco.

Il 23 ottobre 2026 il proprietario ha selezionato la direzione **Diorama 2.5D**: personaggi animati nel terreno, abilità e combattimento in primo piano. La prima consegna visiva è una scena interattiva dimostrativa per valutare il turno, separata dalla sessione persistente.

## Evidence on Hand

Contratti di prodotto e sessione in `docs/adr/0001-gioco-digitale-completo-in-rete-locale.md` e `docs/adr/0002-salvataggio-e-conferma-delle-azioni.md`. Verifiche della sessione e della preparazione in `docs/testing/`. Workbook fornito dall'utente, app ufficiale 1.6.6 e inventari in `docs/research/`. Il pacchetto privato copre la preparazione con 74 definizioni abilità e 78 oggetti; quattro testi mantengono una verifica incompleta. Il grafo delle avventure è ricostruito nei documenti di ricerca, ma comportamento runtime, intera scatola e campagna giocabile non sono ancora verificati integralmente.

## Product Principles

1. Conservare la fedeltà alle regole e ai contenuti mentre si adatta l'interfaccia.
2. Rendere il tavolo condiviso e i telefoni parti della stessa esperienza locale.
3. Conservare integralmente lo stato senza affidarsi alla memoria del gruppo.
4. Dare alle azioni una risposta visiva coinvolgente e comprensibile.

Le informazioni derivano dalle risposte confermate dal proprietario nella conversazione e dagli ADR. Nessuna proposta visiva presentata in seguito diventa una scelta approvata automaticamente.
