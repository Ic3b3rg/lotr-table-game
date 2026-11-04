# Review #81 — seconda Ombra e round 3

Confronto `177e97aff7d5f00481f869deec5a0a07e4c58ffa...2b88e5b61a5f569cbf7e0088417f2578a98b56df`.
Cinque commit; review Standards e Spec in due contesti indipendenti, senza
modificare il checkout o le evidenze ricevute. Autorità: issue81 con la
correzione autonoma del brief da parte del root, spec/piano locali, ADR1–3
e contratti fonte precedenti.

## Standards

**Un P2, risolto.** `verifySourceDeployment` leggeva `a.source` e calcolava
il digest prima di controllare il confine JSON. Un artifact sintetico con
getter enumerabile veniva accettato ed eseguiva due letture, contro il
contratto documentato in `docs/development/first-combat-kernel.md`.

Il root ha riprodotto il fallimento e aggiunto `bounded(raw)` prima della
prima lettura. La regressione verifica accessor diretto, annidato e proprietà
ereditata, tutti rifiutati senza eseguire getter. Cinque test deployment
passano. Nessun ulteriore difetto o smell Fowler sostanziato.

## Spec

**Zero difetti funzionali provati.** Verificati lifecycle del callback,
premio all'entry, ordine e pose dei piazzamenti, obiettivo dinamico distinto
dall'annuncio, minaccia, prova collettiva, pool completo e disponibilità,
bonus, gate sui nemici vivi, assenza di attivazione retroattiva, continuazioni
e recupero. Sette test mirati; oracle indipendente, 51 backup UI finali e
129 backup storici riconvalidati dall'asse Spec.

Una nota editoriale attribuiva al proprietario il chiarimento dello spawn:
era una correzione autonoma del root nel perimetro già autorizzato. Corretta
la provenienza, senza modificare il requisito.

## Disposizione e verifica del root

Il P2 è corretto direttamente dal root; nessun nuovo ciclo di review per la
correzione circoscritta. Rimossa la riga vuota finale segnalata dal diff check.
Nelle catture ricevute l'etichetta dell'obiettivo si univa al testo: aggiunti
due punti e spazio. Questa sola modifica testuale non cambia il flusso UI.

Sigillo ricevuto: 1.160 file, 718.555.375 byte; manifest SHA256
`7aabfeb7af0896c1ef36e328232426eccd32966f2d4d035d2d9a122aadec17fc`.
Tutti i byte/hash verificati nella copia del root, otto primarie ricontrollate.
Ricompilati dagli input privati il pack e la compilazione: identici byte per
byte. Oracle separato: quattro modelli, tredici bonus, due gruppi, sei draw,
budget residuo quattro e round 3.

Il verifier del root usa il codice corrente per 51 backup UI, otto restore,
nove SIGKILL e nove manomissioni risignate respinte. Le 28 catture e i log
documentano tre identità, quattro viewport, HTTP IPv4 senza WebCrypto,
zero eccezioni runtime o risposte HTTP errate nella finestra finale. Gli 89
errori di collegamento durante gli arresti deliberati restano distinti.
Ispezionate direttamente tre catture; nessuna nuova corsa UI o host del root.

Il confronto dei bundle limita le differenze eseguibili al controllo JSON
host e alla punteggiatura dell'etichetta client; CSS identico. I commenti di
percorso prodotti da esbuild differiscono per il symlink delle dipendenze.
Privacy controllata anche nei cinque commit: 51 percorsi, 53 snapshot di
blob e 26 testi privati lunghi, nessuna corrispondenza o materiale originale
pubblicato. Evidenze e log del root in `.scratch/second-shadow-root-review/`.

L'accettazione del tratto parte da un freeze autentico ante-startup importato
dalla UI; non sostituisce il nuovo tavolo e l'intera partita richiesti da33.
Combattimento, provocazioni, successive attivazioni, benefici irrisolti,
termine avventura e campo/A2 conservano i propri gate. Nessun dato o processo
del tavolo protetto è stato consultato.

Verifica finale sul codice integrato: **598/598 test**, zero fail/skip/todo,
221.096 ms; typecheck, format:check e diff check verdi. Riconvalidati anche
dal root tutti i **129/129 backup storici**, conservando campi e ricevute.
La suite è stata ripetuta dopo la correzione del P2 e della punteggiatura;
i log precedenti restano separati. Due path relativi del checker ricevuto
sono stati risolti nella copia di lavoro del root, senza cambiare evidenze.

Standards: **1 P2 risolto, 0 aperti**. Spec: **0 difetti funzionali aperti**.
