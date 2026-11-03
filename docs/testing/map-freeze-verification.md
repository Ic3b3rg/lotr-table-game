# Verifica congelamento A1 nella sessione — #53

Base `e27a4b727bd5550cf74239193538045272343213`, Node24.11.1/npm11.6.2.
[Specifica](../planning/map-freeze-spec.md) e
[piano](../planning/map-freeze-plan.md) committati prima del codice (`bb01217`).
[Conteggi/hash](map-freeze-private-evidence.json),
[issue e commenti](https://github.com/Ic3b3rg/lotr-table-game/issues/53),
[contratto generatore](../research/first-adventure-map-generator-contract.md),
[startup](../research/first-adventure-runtime-contract.md) e
[movimento](../research/map-movement-contract.md).
Implementazione nel solo checkout T3 assegnato, senza subagenti, dipendenze
nuove, scritture GitHub o modifiche a originali/app/salvataggi.

## Risultato e interfacce

La compagnia preparata conferma **Crea la mappa** nel percorso guidato.
`GET /api/map-generation-plan` fornisce l'offerta corrente; i comandi
`GENERATE_ADVENTURE_MAP` e `RESUME_ADVENTURE_MAP` usano il protocollo esistente
con identità, requestId, generation, expectedRevision e fingerprint di pack e
contesto. La ripresa aggiunge jobId. Il client non invia una realizzazione,
un checkpoint diagnostico o un booleano runtimeReady.

`LOTR_GENERATOR_PACK` seleziona il pacchetto privato; il default è
`map-generator.json` nella cartella dati. `parseGeneratorPack` valida il template
selection/geometry/placement senza contesto di compagnia incorporato.
`deriveContext` vincola il catalogo completo e le sue fonti, conserva ordine
eroi/proprietari/copie equipaggiate e risolve i modelli originali verificati.
H e inventario vengono dalla preparazione salvata; quantità/upgrade dal
catalogo e dai modelli del pack. Per una nuova A1 base, prodotti, lingua e
storia iniziale vuota sono metadati espliciti. K deriva dai filtri effettivi.

La generazione gira in `map-generation-worker.mjs`; HTTP rimane disponibile.
`runGenerationAttempt` richiama le librerie grezze #50/#51. Poiché
`placeMapEncounters` restituisce un sommario assembly, la geometria viene
ricalcolata deterministicamente e confrontata per fingerprint, stato, ordine,
conteggi, caselle e snapshot RNG prima della proiezione. Nessuna posa o stato
search ricevuti dal client sostituiscono questo calcolo.

La libreria di verifica è `dist/map-freeze-library.mjs`: esporta parser,
derivazione del contesto, costruzione dell'input, esecuzione di un'attempt,
`verifyPendingReplay` e `validateProjection`. È una seam di verifica locale;
la prima persistenza nella sessione passa dal worker e dalle protezioni host.

## Persistenza, retry e recupero

Schema9 aggiunge `mapGeneration`. La migrazione da1–8 aggiunge null senza
cambiare giocatori, preparazione, mazzi, prove/Scoperte, round, turni,
movimento o ricevute. Le fixture delle versioni precedenti omettono il nuovo
campo; le sole aspettative della versione corrente passano da8 a9. I test
#50/#51 restano invariati.

- `Store.once` registra atomicamente richiesta, pending, revisione e ricevuta.
- Ogni fallimento fonte ripetibile registra il prossimo confine pulito, con
  seed int32 successivo, pool random/item e storia trattenuti. Il risultato
  positivo aggiorna proiezione, storia, continuazione, revisione e ricevute
  nella stessa transazione SQLite; nessuna risposta positiva precede il commit.
- Reload e riavvio non attivano worker. La ripresa esplicita verifica dal seed
  richiesto tutti gli attempt già registrati, con relativi pool, storia, RNG e
  digest di evidenza. Un pool alterato insieme al suo hash non supera il replay.
  Gli attempt successivi della stessa attivazione provengono dal risultato
  verificato del worker precedente e dal confine appena committato.
- Duplicati restituiscono la ricevuta corrente dello stesso intento. Un altro
  seed con il medesimo requestId, una revisione superata o un'altra conferma
  non creano una seconda mappa. Restore cambia generation e invalida il worker
  precedente. Pending e frozen mantengono ricevute coerenti anche nel backup.

Politica **node-clean-attempt-v1**: clock logico step0, budget di1.000.000
operazioni per selection/assembly/encounters, massimo200.000 eventi per trace
assembly/encounters. Il timeout dichiarato dell'attempt segue6/12/18/24/30s;
il clock logico non misura il tempo Unity. Otto attempt per attivazione,
massimo64, con overflow int32 del seed verificato. Guard amministrativo worker
60s e limite heap V8 di512MiB; non sono Timeout Unity o garanzie sul consumo
RAM complessivo. Il worker resta separato dal thread HTTP secondo l'API
[Worker di Node24.11.1](https://nodejs.org/download/release/v24.11.1/docs/api/worker_threads.html).

Senza seed esplicito l'host usa `crypto.randomInt` sull'intervallo int32; non usa
il seed inspector o il RNG delle carte. Il seed richiesto e quello riuscito
sono salvati separatamente. Il raggiungimento del limite di batch lascia una
ripresa esplicita; gli errori unchecked fonte e il limite totale lasciano una
pausa terminale, senza promettere una ripetizione deterministica risolutiva.
Arresti amministrativi o errori non pubblicano mappe parziali.

## Proiezione e validazione offline

`frozen-A1-v1` / `A1-semantic-v1`, massimo1MiB: dati normalizzati completi e
fingerprint canonico, provenienza e versioni, contesto, seed/attempt/politiche,
RNG iniziale/geometrico/finale, quattro sezioni e map order, sole tessere e
forme selezionate, pose/esagoni/caselle source-qualified, contatti, modelli e
prefab selezionati, origini/placement/spawn order, gruppo e storia.
`spaces[].connected` è il **grafo fonte** per gli incontri;
`movementGraph` conserva separatamente archi e origini di movimento.

Il validatore controlla identità e riferimenti, rotazioni e coordinate,
occupancy, geometria delle caselle e node anchor, contatti e join richiesti,
adiacenze autoriali, reciprocità e connettività del movimento, requisiti fissi,
origini, modelli/prefab, spawn, addUnique della storia e closure selezionata.
Il raggio cached della fonte è conservato: il confronto con la posa finale
ammette una tolleranza float32 relativa di1e-6, verificata anche con un caso
privato a un ULP di differenza. Non viene rimpiazzato con un raggio inventato.

La proiezione non contiene catalogo inutilizzato, candidati, cursori di search,
trace, FSM o testi originali. Conserva digest di evidenza e il clean input dei
pool necessario alla verifica dei retry. Il backup controlla semantica,
fingerprint e correlazione delle ricevute oltre al checksum; un import invalido
non cambia il tavolo. Hash e checksum non autenticano l'autore di un backup.

Il confine è **before-BeginAdventure(false)**, con `pending-startup` e
`pending-prefab-execution`. `continuation.pending` è un insieme completo di
obblighi, non un cursore o un ordine di esecuzione FSM. Non esistono posizioni
eroe, rivelazioni o effetti inventati per adattare il risultato alla vecchia
JourneyDefinition. Nessun comando legacy consente di iniziare round, prove o
Scoperta saltando lo startup della nuova realizzazione.

## Test sintetici e cicli TDD

**297/297** test, zero skipped, baseline275 conservata:22 test aggiunti sulle
seam pubbliche di libreria e host HTTP. Tipi, formato e diff controllati con i
comandi finali sotto. Tutte le fixture pubbliche sono inventate.

Copertura: contesto effettivo e mapping/upgrade/quantità; fingerprint e dati
malformati anche con rehash; geometria/due grafi/incontri/closure; identità,
revisioni, duplicati e concorrenza; rifiuto di checkpoint e runtimeReady del
client; pack ricontrollato al comando; retry con seed richiesto3 e riuscito4,
pool crescenti, overflow int32 e pausa/ripresa dei batch; errore fonte unchecked
con stage/reason originali; replay da genesis e pool/RNG manomessi; SIGKILL
pending, crash dopo commit prima del successivo riscontro client, ripresa da
un'altra identità, restore durante lavoro, backup senza pack e ricevute;
migrazione schema8 con prove, Scoperta e viaggio aperti, oltre alle regressioni
1–7 già presenti.

Log privati `red-01`…`red-10` e `green-*` registrano gli incrementi. Non tutte
le prime esecuzioni verdi passarono: sono preservati il mismatch di -0 della
normalizzazione JSON, il controllo troppo stretto del raggio cached e una
fixture il cui draw cambiava aggiungendo un modello. L'attesa del helper è
stata resa una deadline esplicita di30s con ultimo stato nel messaggio di errore:
il precedente conteggio di polling da circa5s era insufficiente sotto il
carico concorrente della suite e dei browser. Nessun budget di produzione,
asserzione o test è stato rimosso per ottenere il verde.

## Prove private mirate e UI

`.scratch/freeze/normalize.mjs` verifica23 source locks e pin dei metadati
esistenti, riusando le relative prove di lettura completa e accordo C/Python.
Non importa audit globali e non ricopia directory assembly. Mapping verificati:
6 eroi e78 oggetti. Pack normalizzato888.807byte, fingerprint e hash degli
script/artefatti nel report JSON. Il template H3 fornisce soltanto dati grezzi:
il suo contesto viene scartato e non entra nel pack di produzione.

`check-real.mjs` ricava dai metadati verificati il contesto privato di tre
eroi e dei loro oggetti, quindi esegue la pipeline reale:10 tessere,22 caselle,43 archi movimento,15 incontri,
K=16, RNG geometrico292 e finale348. Proiezione226.688byte. Il grafo fonte ha
componenti[3,18,1]; il movimento una componente da22.
`compare-reference.mjs` confronta esattamente geometria/sezioni/caselle,
assegnazioni, spawn, storia, RNG e movimento con gli output root già verificati.
Il contesto completo ha deliberatamente un hash diverso: conserva l'ordine
dell'equipaggiamento della preparazione effettiva. L'equivalenza dei set item
è verificata separatamente; il contesto non viene riordinato per pareggiare
la fixture. Entrambi i fatti restano nel ledger privato.

L'accettazione UI usa soltanto avanzamenti tramite controlli del browser,
su host/dati isolati4349. Tre origini in profilo incognito mantengono tre
identità indipendenti. Nessuna scrittura API o seed SQLite viene usata per
superare il percorso; le letture di controllo sono distinte dai test HTTP.

1. Ingresso dei tre posti, gruppo3, scelta di una compagnia diversa dal caso
   privato H3, accordo e preparazione dei mazzi dalla UI.
2. Richiesta dalla prima identità, SIGKILL mentre lo stato autorevole è pending,
   riavvio senza pack e messaggio di materiale necessario; reinserimento del
   medesimo pack e **Riprendi la creazione** dalla seconda identità.
3. Risultato UI salvato:21 caselle,36 archi,14 incontri, RNG finale343,
   proiezione209.383byte; controlli di gioco non disponibili e startup pendente.
4. Reload/riavvio senza pack, esportazione UI, importazione con file picker e
   conferma, recupero di tutti e tre i posti dalla UI. Proiezione, ordine privato
   dei mazzi, RNG, storia e ricevute identici; generation nuova, tre giocatori.
5. Tastiera: focus visibile e Tab/Enter dal passo al collegamento backup.
   Viewport320/768/1024/1440 senza overflow orizzontale del nuovo passo.

Il collegamento del risultato al backup è stato corretto durante la prova:
ora apre anche gli strumenti nel percorso guidato. Gli snapshot AX del browser
T3 andavano in timeout; Chrome MCP aveva il profilo occupato e CUA non aveva
browser access host. La prova è proseguita con i controlli DOM del browser
condiviso e letture DOM, funzionanti. Non è dichiarato un audit AX/pixel completo,
né una verifica su telefoni fisici/Safari/Windows. Le schede del task sono state
chiuse e l'host isolato fermato;4339/PID12892 è rimasto attivo.

## Riproduzione e handoff

Dal checkout assegnato, con Node24.11.1 e dipendenze esistenti:

```sh
npm test
npm run typecheck
npm run format:check
git diff --check
node .scratch/freeze/normalize.mjs
node .scratch/freeze/check-real.mjs
node .scratch/freeze/compare-reference.mjs
node .scratch/freeze/verify-artifacts.mjs
```

Gli script scrivono soltanto nella scratch del task. L'ultimo verifica anche
il pending registrato dal crash, i due backup UI e le tre identità registrate;
non ripete la prova browser. I raw input/output, backup/sessioni, prove e log
sono in `.scratch/freeze/`, ignorata. Per una lettura condivisa del risultato
UI già salvato, senza pack e senza accedere ai dati del root:

```sh
LOTR_BIND=127.0.0.1 LOTR_PORT=4349 \
LOTR_DATA_DIR=.scratch/freeze/ui-data node dist/host.mjs
```

Le capacità ancora mancanti sono concrete: consumer della realizzazione,
istanze/closure eseguibili dei prefab selezionati, orchestrazione principal e
nested, per-hero Scoperta2 e Spirito1 con ricompensa idempotente, visibilità e
handoff al primo turno. La [ricerca #55 integrata dal root](https://github.com/Ic3b3rg/lotr-table-game/blob/b9c0f465e79f6002d3ea8773ba5207000d4df921/docs/research/first-adventure-realized-runtime-contract.md)
fornisce contratti statici per H3/seed1: non costituisce un executor, né chiude
automaticamente i prefab di altre realizzazioni, compresa la compagnia UI.
Nessun materiale o decisione ulteriore è necessario per consegnare questo freeze;
#38 deve implementare i passaggi successivi mantenendo tali gate.

Clock/float/JIT Unity rimangono **not-certified**. Nessuna FSM o effetto startup
è stato eseguito. Review fresche Standards/Spec, PR/merge e integrazione restano
al root. Questo task non chiude #41, #38 o #33 e non dichiara finita l'avventura.
