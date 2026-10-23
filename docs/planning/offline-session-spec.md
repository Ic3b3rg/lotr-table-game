# Primo traguardo: una sessione locale recuperabile

**Stato: approvata dal proprietario il 23 ottobre 2026.** La specifica e i ticket definitivi sono pubblicati su GitHub. Questa bozza non costituisce una riduzione del perimetro del gioco completo.

Riferimenti: [mappa del progetto](https://github.com/Ic3b3rg/lotr-table-game/issues/1), [decisione sulla sessione](https://github.com/Ic3b3rg/lotr-table-game/issues/6), [ricerca sull'host locale](../research/offline-host-options.md), [perimetro confermato](../adr/0001-gioco-digitale-completo-in-rete-locale.md).

## Problem Statement

Il gruppo vuole giocare a Viaggi nella Terra di Mezzo interamente in digitale, allo stesso tavolo e senza Internet. Prima di integrare regole, carte e campagna serve un percorso concreto per aprire una sessione sul PC, collegare i telefoni e conservare ciò che accade. Attualmente il repository contiene documentazione e ricerche, ma nessuna applicazione eseguibile.

## Solution

Un processo locale sul PC ospita la sessione e le interfacce nei browser. Il PC mostra il tavolo condiviso e un QR; ogni partecipante può aprire la propria vista dal telefono o dal PC. Le modifiche accettate dall'host appaiono sugli altri schermi. Una piccola prova di collegamento, chiaramente indicata come tale, permette di verificare le azioni condivise prima del motore di gioco.

Il primo traguardo consegna la struttura della sessione. Il gioco base completo resta il risultato finale: inventario italiano, regole e campagna proseguono nei rispettivi ticket.

## User Stories

1. Come proprietario del PC, voglio avviare l'host locale, così il gruppo può collegarsi alla stessa sessione.
2. Come proprietario, voglio aprire la vista condivisa nel browser, così il PC presenta lo stato del tavolo.
3. Come giocatore, voglio collegarmi tramite QR o indirizzo leggibile, così posso entrare senza installare un'app sul telefono.
4. Come giocatore, voglio usare la sessione senza account online, così posso partecipare anche senza Internet.
5. Come giocatore, voglio scegliere un nome riconoscibile, così il gruppo distingue le persone collegate.
6. Come gruppo, vogliamo accogliere da una a cinque persone, così il limite riguarda i giocatori e non il numero di schermi.
7. Come giocatore, voglio vedere chi partecipa, così posso controllare di essere entrato nel tavolo corretto.
8. Come persona che usa il PC, voglio partecipare anche dal browser del computer, così il telefono rimane facoltativo.
9. Come proprietario, voglio che la vista condivisa non consumi un posto giocatore, così cinque persone possono usare cinque telefoni e il PC.
10. Come giocatore, voglio sapere se il collegamento è interrotto, così non scambio una schermata vecchia per lo stato corrente.
11. Come giocatore, voglio ricaricare la pagina e ritrovare il mio posto, così un'interruzione non crea un partecipante aggiuntivo.
12. Come giocatore, voglio recuperare il mio posto da un altro dispositivo, così posso continuare dopo un problema al telefono.
13. Come gruppo, vogliamo riaprire la sessione dopo un arresto dell'host, così non dobbiamo ricostruirla.
14. Come giocatore, voglio ricevere una conferma affidabile per un'azione, così so se è stata registrata.
15. Come giocatore, voglio che il reinvio della stessa azione non la esegua due volte, così una riconnessione non altera la sessione.
16. Come gruppo, vogliamo un unico esito quando due persone confermano una scelta comune, così tutti vedono lo stesso risultato.
17. Come giocatore, voglio poter effettuare un'azione comune dal telefono, così il PC non diventa un passaggio obbligatorio.
18. Come proprietario, voglio esportare una copia della sessione, così posso conservarla separatamente dal PC.
19. Come proprietario, voglio ripristinare una copia valida e riconoscere una copia incompatibile, così posso recuperare il tavolo senza perdere lo stato corrente.
20. Come gruppo, vogliamo provare questi comportamenti con la connessione Internet assente, così verifichiamo il modo d'uso richiesto.
21. Come proprietario, voglio istruzioni di avvio per macOS e Windows, così possiamo provare entrambi gli host.
22. Come giocatore, voglio messaggi comprensibili per tavolo pieno, indirizzo irraggiungibile o collegamento perso, così posso rimediare senza conoscere l'architettura.

## Implementation Decisions

### Confermate dal perimetro e dalla ricerca

- Host sul PC; interfacce nei browser di PC e telefoni. La prima installazione può preparare runtime e dipendenze; avvio della sessione e partita non devono effettuare download.
- La copia autorevole dello stato vive sul PC, in una posizione scrivibile separata dai file dell'applicazione. La cache del telefono non è il salvataggio.
- Tutte le risorse necessarie al traguardo sono locali. Nessun servizio cloud, login remoto, font o script da CDN durante l'uso.
- Il QR contiene un indirizzo LAN raggiungibile dai telefoni, con alternativa testuale. L'utente deve poter scegliere l'interfaccia corretta quando esistono più indirizzi.
- Una sessione per processo host è sufficiente per il primo traguardo. L'avvio trova la sessione esistente oppure permette di crearne una; non la sovrascrive silenziosamente.
- Partecipanti ed eroi restano distinti. Il limite di cinque riguarda le persone; la creazione e l'assegnazione degli eroi saranno introdotte con le regole di preparazione.
- La vista condivisa non ottiene automaticamente un'identità giocatore. Una persona può partecipare dal PC aprendo la vista personale.
- Questo traguardo conserva elenco dei partecipanti, identità recuperabili e stato della prova di collegamento. Il successivo motore dovrà aggiungere tutto lo stato del gioco, senza affidarsi a ricostruzioni manuali.
- Il modello di sessione e il formato di esportazione devono poter dichiarare la propria versione. Le tecnologie e il trasporto concreto saranno scelti nell'implementazione, usando la ricerca come punto di partenza.

### Contratto della sessione confermato

- **Salvataggio:** ogni azione accettata viene registrata prima della conferma positiva; una copia esportabile/importabile permette il recupero manuale. Un errore di scrittura non viene presentato come successo.
- **Azioni comuni:** si seguono le dinamiche ufficiali. Il gruppo determina ordine ed esito nei casi di conflitto; ogni eroe completa il proprio turno prima del successivo (Rules Reference, p. 2 e §2.5–2.6, p. 6). Non si introduce una votazione obbligatoria né una precedenza di gioco fondata sulla velocità del telefono. Sul piano tecnico, una richiesta condivisa viene confermata una sola volta; le conferme concorrenti o superate non producono altri effetti. Nella prova dimostrativa un partecipante registra la scelta concordata dal gruppo. Il futuro motore applicherà anche i vincoli di turno e di competenza dell'eroe.
- **Identità:** ingresso con nome, senza account, e codice personale di recupero. Il dispositivo può ricordare l'accesso; un cambio dispositivo non crea una sesta persona. Il codice personale non compare nel QR pubblico.
- I comandi hanno un'identità stabile per distinguere un reinvio dalla conferma di un'altra richiesta. L'host valida e ordina le modifiche; i client non decidono autonomamente l'esito di una scelta condivisa.
- La perdita di collegamento sospende le azioni del client fino al riallineamento. Nessuna coda di azioni di gioco eseguita automaticamente su uno stato ormai cambiato.

## Testing Decisions

**Confine delle prove approvato dal proprietario:** testare il comportamento dal confine pubblico dell'host e dai browser collegati. Non esistono test o convenzioni precedenti nel repository.

- Le prove automatiche avviano un host reale e usano le stesse operazioni dei client. Verificano ingresso, limite dei partecipanti, recupero, azioni concorrenti e reinvii attraverso questo confine; non imitano funzioni interne.
- Le prove di persistenza arrestano e riavviano il processo usando la stessa cartella dati, anche dopo una conferma già ricevuta. Le prove di backup verificano esportazione, ripristino e rifiuto di un file non valido senza perdita del tavolo esistente.
- Le verifiche nel browser coprono vista condivisa e vista mobile: QR, ingresso, stato del collegamento, recupero e azione comune. Il funzionamento non dipende dalla clipboard o da una fotocamera accessibile dalla pagina.
- La verifica fisica usa PC e telefoni sulla stessa LAN con WAN scollegata, inclusi Safari su iPhone, Chrome su Android e cinque partecipanti. Annotare sistemi, browser e risultati effettivamente provati.
- Un test nel browser del computer di sviluppo non dimostra il funzionamento su Windows, su cinque telefoni o attraverso il firewall. Queste evidenze restano nel [ticket della prova LAN](https://github.com/Ic3b3rg/lotr-table-game/issues/5), aperto fino alla prova con il proprietario.

## Out of Scope

Fuori da **questo traguardo**, ma previsti dal progetto complessivo: catalogo completo italiano, immagini delle carte, assegnazione e mazzi degli eroi, mappa del gioco, combattimento, regole, eventi, campagna e suoi salvataggi completi.

Non richiesti per questo traguardo: gioco a distanza via Internet, account cloud, sincronizzazione fra più host, espansioni, app native per telefoni, contenitore desktop e aggiornamenti automatici. Il formato di distribuzione finale sarà deciso dopo la prova dell'host sui dispositivi reali.

## Further Notes

- Il workbook fornito dall'utente permette già di lavorare sull'inventario. Lingua italiana, immagini e anomalia di classificazione di una carta rimangono da verificare; non bloccano i quattro ticket della sessione.
- Per la campagna serve ancora una copia locale dell'app ufficiale con i dati della scatola base e della lingua italiana: una piattaforma è sufficiente per iniziare l'inventario. Non è ancora necessario richiedere tutte le scansioni o avviare reverse engineering indiscriminato.
- La [suddivisione approvata](offline-session-tickets.md) dettaglia consegne, dipendenze e criteri osservabili. Il proprietario ha approvato suddivisione, dipendenze e prove; per le azioni comuni ha richiesto fedeltà alle regole ufficiali.

Fonte delle dinamiche comuni: [Rules Reference ufficiale](https://images-cdn.fantasyflightgames.com/filer_public/01/a0/01a0c9f7-4427-4113-9406-f53d6bde2ff5/journeys_in_middle-earth_rules_reference.pdf#page=2).
