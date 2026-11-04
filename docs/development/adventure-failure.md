# Sconfitta dell’avventura e primo campo — #91

Base `738bc8a`, schema16. Contratto:
[issue91](https://github.com/Ic3b3rg/lotr-table-game/issues/91),
[spec e piano antecedenti al codice](../planning/adventure-failure-spec.md),
[contratto38](../research/first-adventure-runtime-contract.md),
[runtime realizzato](../research/first-adventure-realized-runtime-contract.md),
[contratto fisico](../research/physical-resolution-runtime-contract.md) e ADR2–3.
Review Standards/Spec e integrazione spettano al root.

## Trigger e ritorni

La capacità facoltativa `source-adventure-failure-v1` conclude la perdita
da eroe sconfitto. Con superstiti il controllo avviene all’inizio della
prossima Ombra, prima di attivazioni, oscurità, timer e minaccia. Non viene
ripetuto durante un’Ombra già iniziata. I risultati del padre, i figli e
il movimento nemico ancora dovuto continuano con i rispettivi proprietari.
Lo sconfitto non riceve un nuovo turno, attacco o scelta.

Senza superstiti il confine segue il terminale dell’Ultimo Sforzo. Il padre
fisico non ritorna: la conclusione conserva richiesta e principale sospesi,
causa dell’ultimo eroe, ricevute e cronologie. Questa perdita è distinta
dal cap di minaccia. Il percorso di minaccia non interamente realizzato
mantiene il gate prima dell’intera fase; nessuna soglia viene simulata.

Il principale riceve il vero evento di fallimento e mantiene il proprio
stato di elaborazione fino al termine. Il ramo certificato possiede due
messaggi, flag, XP e Sapienza concorrenti, destinazione e seguito terminale.
I premi sono applicati all’ingresso dello stato fonte; il messaggio attende
la conferma di un partecipante per il gruppo. Gli XP appartengono ai ruoli
selezionati in quel momento, compreso l’eroe sconfitto. Il controllo del
bonus di compagnia usa le abilità equipaggiate; proprietà di un titolo e
abilità equipaggiata restano distinte.

`FinishProcessingEvent`, `FinishFSM` e completamento dell’avventura sono
confini diversi. `RecordAdventureCompleted` è un no-op nella build letta.
`SetNextAdventure` svuota le alternative e seleziona il modello referenziato;
`ProceedToNextGame` registra l’avventura conclusa, ripulisce lo stato della
scena e apre la mappa della campagna. La destinazione, la descrizione e il
tipo della prossima mappa provengono dal modello, senza incrementi di ID o
titoli dedotti. Mappa, racconto e campo hanno richieste persistenti distinte.

## Persistenza e compatibilità

Il nuovo manifest richiede attestazione, owner e parametri certificati
prima dello startup. Il compiler rifiuta rami incompleti, destinazioni
incoerenti e operazioni terminali inserite in altri stati. Il permesso
per la Sapienza del principale è limitato allo stato certificato dei premi.

La migrazione15→16 è strutturale. Non aggiunge capacità a pack storici,
non avvia azioni e non ricostruisce origini. Formati fino a15 non possono
contenere la nuova capacità o una conclusione. I vecchi pack e backup
restano utilizzabili con il loro comportamento; il checkpoint storico
di89 rimane una prova della diagnosi.

Trigger, messaggi, premi, transizione e cambio ruolo passano dallo stesso
Store.once e dal replay integrale del ciclo versione2. Origine round1/Azione,
carte, RNG, gruppi, risultati e ricevute restano immutati. La conclusione
congela la prova dell’episodio e possiede separatamente lo stato di campagna
ripulito: eroi attivi, difficoltà iniziale, oggetti e titoli conservati,
ruoli ed esperienza, Sapienza e destinazione. La fase archiviata non viene
riscritta come una nuova partita; la guardia autorevole della conclusione
rifiuta i comandi di gioco successivi.

## Campo e confini successivi

Le tre viste personali mostrano causa, premi già applicati, Sapienza,
esperienza per ruolo, equipaggiamento e destinazione salvata. Ogni
proprietario può scegliere il ruolo del proprio eroe. La semantica fonte
trasferisce un ruolo già occupato, lasciando l’altro eroe senza ruolo;
l’esperienza premiata resta nel ruolo precedente. Non sono spesi XP o
Sapienza e non vengono generate carte del seguito.

La prossima avventura è un handoff tipizzato `requires-content`: il
riferimento fonte è salvato, ma contenuto e mappa non sono disponibili e
non viene dichiarata avviata. Acquisti di abilità, upgrade, campo completo
e nuovo generatore restano incompleti, prima di ogni costo. Vittoria e
combattimento finale mantengono i propri gate. Soglie40/48/55 e benefici57
restano bloccati; per57 vale la decisione esplicita del proprietario, senza
quantità inventate, filtro del pool o disponibilità ignota trattata come vuota.

Guida contestuale, lettore e backup restano accessibili. Le sezioni di turno,
viaggio, esplorazione e combattimento vengono nascoste dal termine. Il
ritorno asincrono del focus dalla guida rispetta il controllo già raggiunto
dall’utente, evitando di sottrarre la tastiera al lettore appena aperto.

La [verifica](../testing/adventure-failure-verification.md) distingue percorso
originale nativo, fixture inventate, recupero e limiti. #89 resta aperta:
nessun indizio autentico è stato completato. Questo incremento non dichiara
completa la prima avventura in entrambi gli esiti e non chiude33/65/57.
