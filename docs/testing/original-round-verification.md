# Primo round originale — verifica #79

Base `6efeb876a839d3f57c47045b6c16901de89ac2c0`, schema15, baseline567.
[Specifica](../planning/original-round-spec.md) e
[piano](../planning/original-round-plan.md) committati prima del codice in
`5145da7`. Implementazione `8c15e33`, ultimo codice
`c70d7a911043d0333de819706301559bf3d082f2`.
Solo checkout assegnato, nessuna delega/installazione/scrittura GitHub.
Review Standards/Spec, integrazione e merge al root.

## Risultato eseguito

Il percorso originale senza gruppi nemici arriva dalla fine dei tre turni
alla prima Ombra effettiva, alla Riorganizzazione dei tre proprietari e a
**round2/Azione con il primo turno legale iniziato**, attraverso input nativi
in tre contesti browser autenticati separati. È rimosso il primo blocco di
fine round; non è completata la partita o la issue33.

La capacità opzionale congelata `source-rounds-v1` lega controller, configurazione,
binding, proprietà native delle caselle e dipendenze. Riusa compiler/runtime
fonte, consumer fisico e ledger originale v2. Pack/run pubblicati non vengono
ampliati retroattivamente. Il nuovo avvio usa il nuovo pack; non occorre una
migrazione del tavolo del proprietario. Il seed del ledger resta lo startup
completo round1/Azione, con identica origine e ricevute.

Il preflight valuta su una copia l'intero seguito deterministico, inclusi
receiver globali/locali, broadcast nascosti e round-start con la nuova
minaccia. Scadenze, soglie, perdita e capacità mancanti bloccano prima di
tick/pesca/spesa/delta. Non esiste una scorciatoia `round===1`. Gli eventi e
le transizioni vuote avvengono secondo fonte, senza tre conferme fittizie.
La conferma del solo messaggio minaccia applica il risultato fonte e il reset.

L'oscurità deriva da posizione, proprietà e flag/token vivi. Il suo consumer
riusa prove di negazione, prevenzioni, fronti, reazioni, figli e P2. Reset,
Scoperta e bonus effettivi usano lo stesso consumer già esistente: fino a una
carta preparata, limite e hook, resto sopra/sotto nell'ordine scelto. Ogni
proprietario risolve il proprio eroe; il nuovo round attende tutti.
Frame/eventi, carte, richieste, RNG fisico, risorse e receipt entrano nella
stessa `Store.once` del comando. Replay non concede esenzioni ai nuovi output.

## Primarie e controllo indipendente

Le copie bounded e gli helper adattati sono nella sola scratch ignorata
`.scratch/first-round/`. Sono stati acquisiti 42 record nativi,1.261.136 byte,
con accordo di due lettori:17 FSM vivi,22 caselle e3 owner/global/model.
Sono presenti14 corpi IL selezionati,5.314 byte di codice; il ledger ricevuto
più ampio non è stato interamente ricatturato. Nessuna esecuzione Unity/JIT.

L'oracle privato Python non importa il prodotto. Confronta raw/binding,
origini delle istruzioni, ordine A`0x06003902` ed export UI. Tutti15 prefab
sono inizializzati; visibilità e registrazione receiver rimangono distinte.
Nei17 receiver vivi, solo R20635 riceve ROUND_END; nessuno riceve ROUND_START
o ha una transizione locale di fase. Il primo tick non emette ulteriori eventi.

Discrepanza con l'orientamento del brief: **REVEALED_DUDES è false nel default
serializzato, ma true nello startup completato**. L'evento effettivo dello
startup da R27649/stato17 e BoolFlip del timer/stato12 spiegano il valore.
Non è stato forzato false né cambiata una receipt. IsRunning=true,
TimerValue2 e DUDE_TIMER=false sono confermati; il primo tick2→1 non raggiunge
il ramo di scadenza, quindi la divergenza non cambia il percorso supportato.

Nella UI originale la minaccia è9: tre eroi×2, un segnalino attivo×1 e due
tessere visibili inesplorate×1. ROUND_END/tick precede l'aumento0→9; nessuna
soglia15 o fuga è raggiunta. Obiettivo, indizi, Lore, posizioni, geometria e
casualità del generatore estranei al passaggio sono invariati. L'oscurità è
assente per proprietà native e stato effettivo verificati, non per omissione
del generatore. Il caso positivo è una fixture inventata sul consumer reale.

Quattro controfattuali privati in memoria verificano segnalino attivo/nascosto
e tessere esplorate/inesplorate con i binding nativi. Non sono ulteriori
partite UI. Il test pubblico inventato raggiunge esplorazione e rimozione
del segnalino attraverso i consumer, senza un contatore globale inventato.

## Accettazione UI e recupero

Precondizione dichiarata: freeze autentico precedente allo startup, importato
tramite filepicker (migrazione esistente schema10→15, physical:null), nuovo
pack fonte configurato e tre posti autentici recuperati in contesti vuoti.
Startup interamente da UI fino alla revisione37; nessun viaggio/prova/pesca
o fase preparato con scritture HTTP/SQL. Automazione con focus, Input
tastiera/mouse e filepicker nativi; valutazioni DOM e richieste Node GET
soltanto per osservare. I backup amministrativi completi restano distinti
dalle viste ordinarie, prive di ordine dei mazzi e identità delle coperte.

| Passaggio nativo       | Revisioni / risultato                                                                                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tre turni originali    | 38–43, ciascun proprietario inizia e conclude il proprio turno; zero azioni usate, nessuna interazione/beneficio.                                                 |
| Prima Ombra            | 44, attivazioni vuote, oscurità derivata assente, timer2→1 e messaggio minaccia9.                                                                                 |
| Minaccia e reset       | 46, applicazione0→9 e reset reale dei tre mazzi.                                                                                                                  |
| Tre Scoperte           | 47–54 con restore intermedi; tre carte ciascuna per il bonus effettivo. Prima: una preparata e due sotto; seconda: tre sopra; terza: tre sotto, in ordine scelto. |
| Nuovo round            | 56, round2/Azione e ROUND_START effettivo, dopo tutti i completamenti.                                                                                            |
| Primo turno successivo | 58, proprietario autentico, due azioni disponibili e zero utilizzate.                                                                                             |

Cinque restore via UI ai punti44/47/49/54/56 preservano gameplay, carte,
richieste, RNG/eventi e receipt, salvo generation/revision/updatedAt. Sei
confronti dopo SIGKILL ai punti45/47/49/54/56/57 conservano l'intero payload.
Riprese/restore sono packless: i quattro pack runtime sono rimossi dalla
configurazione propria.18 backup del percorso convalidati via replay;
sette alterazioni originali coerentemente risignate respinte.

Il percorso nasce su8c15e33; prima del turno58 il codice finale c70d7a9 è
riavviato sul checkpoint57 e ricostruisce l'intero percorso identico. JS e
CSS sono identici byte per byte. L'ultima modifica host chiude il preflight
delle transizioni locali, assenti nei receiver originali verificati; il
turno58 è eseguito nativamente sul codice finale.

## Verifiche e limiti delle misure

| Verifica             | Evidenza                                                                                                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Suite finale         | **582/582**, zero fail/skip/todo,145.958s; una sola suite completa finale. Tutti567 test precedenti conservati.                                                                                                    |
| TDD e interfacce     | RED→GREEN per compiler, fase, oscurità, UI/lettore delle carte, preflight round-start e receiver locali; ownership, stale/duplicate, concorrenza e gate prima dei delta. Fixture pubbliche inventate.              |
| Atomicità            | Due SIGKILL immediatamente prima del commit Store.once dimostrano rollback di tick/eventi e minaccia/reset/receipt.                                                                                                |
| Compatibilità        | **111/111** backup elencati:109 precedenti più2 ricevuti. Tutti i campi gameplay originari e tutte le ricevute conservati; sole migrazioni storiche schemaVersion e physical:null mancante.                        |
| Controlli repository | Typecheck, Prettier e diff verdi; nessun test soppresso o qualità ridotta. Originali/associazioni/IR/FSM/IL/immagini restano ignorati anche nella storia Git.                                                      |
| UI responsive        | 16 catture accettate: Riorganizzazione, Scoperta pending, attesa di altro proprietario e round2, ciascuna a320/768/1024/1440; nessun overflow/alert visibile.                                                      |
| Accesso e focus      | Guida nativa con ricerca/Tab/Escape/ritorno; lettore di carta rivelata con focus/Escape/ritorno; form solo al proprietario e attesa degli altri.                                                                   |
| HTTP e asset         | IPv4 HTTP sullo stesso Mac, contesto non sicuro e crypto.subtle assente.6 URL content realmente caricati dal browser; separatamente26 PNG configurati,3 PDF e app/CSS/font rispondono200 con byte/hash verificati. |
| Processi             | Host/profilo/contesti/PID propri;10 PID registrati terminati, porta host propria libera e CDP proprio chiuso. Nessun dato utente pulito.                                                                           |

Limiti osservati conservati nelle prove: un comando startup riceve409 senza
avanzare; il corpo della risposta non è acquisito, quindi non se ne inventa
la causa. Dopo osservazione DOM, focus+Enter nativo prosegue. Un primo
tentativo di selezione dell'ordine si ferma prima del submit; il successivo
usa selezione nativa per etichetta e ne verifica il valore. Quattro catture
iniziali di Ombra prima del rendering completo sono escluse e conservate,
senza dichiararle verdi. La prima Ombra è provata da input/DOM/export/oracle,
non da quattro screenshot validi. Un controllo iniziale asset includeva QR
senza src e ritratti lazy nascosti: la misura finale distingue questi elementi
dalle immagini visibili caricate.

Observer: zero eccezioni JavaScript o console error/warning;38 messaggi di
rete nel log, composti dal409 e37 connessioni rifiutate durante gli stop
intenzionali. Nessun errore di risposta asset. Un GET iniziale troppo presto
e un checker della migrazione schema10 sono conservati come tentativi
superati, con correzioni del solo harness dichiarate nel README privato.
Non sono verificati telefoni fisici, altra macchina sulla LAN, Safari/altri
OS, focus di Chrome visibile o equivalenza della sequenza Unity.

## Sigillo e seguito

I [metadati pubblici](original-round-verification.json) contengono solo
conteggi, byte, hash e locatori. Il README privato spiega cronologia,
fixture/ipotesi, fallimenti conservati e comandi riproducibili. Il sigillo
proprio include318 file/133.815.008 byte; manifest54.853 byte, SHA256
`f7ba6b1b2e2b611fbc0bad6227c4491f4353f198ebd9ea086287967586a4ed2d`.
Esclude il profilo cache Chrome e soli file autoreferenziali; non visita
scratch altrui. Nessuna prova UI va rieseguita sul database finale sigillato.

```sh
python3 .scratch/first-round/check-source.py --verify
python3 .scratch/first-round/seal.py verify
npm run typecheck
npm run format:check
npm test
git diff --check
```

Il prossimo ROUND_END può raggiungere il ramo timer scadenza/callback e
ulteriori soglie: il preflight conserva il gate prima di nuovi effetti.
Il seguito concreto richiede chiudere quei receiver nei proprietari fonte
prima di abilitare un'altra Ombra. Combattimento/controller, benefici57,
altri rami, finale/campo/A2 e chiusura33/65 restano separati. Nessuna
approvazione provvisoria sulle quantità dei benefici è stata assunta.
