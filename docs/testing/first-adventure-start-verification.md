# Avvio A1 fino al primo turno — verifica #38

3 novembre 2026. Base `bc83b16fae75609472241e916c0a05d066be3f79`
(PR59 inclusa); implementazione nel solo checkout `t3-a2a66e5b`, branch
`t3/first-adventure-runtime`. Review e integrazione sono del root.
Nessuna scrittura GitHub, PR, push, merge, installazione o modifica agli originali.
Host di accettazione isolato sulla porta4351; host4339 e relativi dati intoccati.

Autorità: [spec](../planning/first-adventure-start-spec.md),
[piano](../planning/first-adventure-start-plan.md),
[contratto principal](../research/first-adventure-runtime-contract.md),
[contratto realizzato](../research/first-adventure-realized-runtime-contract.md),
[generatore](../research/first-adventure-map-generator-contract.md),
[movimento](../research/map-movement-contract.md),
[freeze53](map-freeze-verification.md) e sua
[review del3novembre](../reviews/2026-11-03-map-freeze.md).
Issue38, corpo e tre commenti, riletta prima della consegna.

## Risultato verificato

Il gruppo parte dalla realizzazione congelata, segue introduzione e richieste
originali italiane, completa Scoperta2 e Spirito1 separatamente per ciascun
eroe e raggiunge obiettivo0, un solo handoff e round1 con il primo turno legale.
La nuova mappa di gameplay conserva ID, binding e poligoni della proiezione;
visibilità, esplorazione, posizioni ed effetti vivono separatamente dal build.
L'intero `mapGeneration`, compresi proiezione e RNG, resta identico al freeze.

Il pack compilato, salvato nella sessione, ha30 definizioni,66 stati,38 azioni
eseguibili e63 archi con capacità rinviata esplicita. Un tipo fonte sconosciuto,
un opcode sconosciuto, un handler errato, una closure mancante o un prefab
auditato solo per initialization con reveal non compilato impediscono l'avvio.
Non è un elenco di seed ammessi: un nuovo input compatibile deve superare il
binding e la chiusura bounded dei suoi prefab effettivi.

L'IR non usa eval. Distingue azioni avviate/concluse, coroutine sospese,
ProcessingState, stopped e ricevitori nascosti. Il runtime esegue initialization
in spawn order prima di SCENARIO_BEGIN, poi esplorazione in space order,
PRE_REVEAL/REVEALED e completamenti fonte. Il timer riceve il broadcast nascosto;
il flip, le ricompense e l'handoff hanno prove persistenti once-only.
IgnoreLog proviene dal caricamento posizionale AddToLog→IgnoreLog e determina
il registro dei messaggi effettivamente completati. Letterali e binding restano
distinti. Testi/insert diventano token DOM, con enfasi e nomi accessibili delle
icone; residui PUA, anche fuori dal BMP, sono rifiutati.

## Input distinti

| Input                    |        Seed | Caselle / archi / incontri | Prova                                                                           |
| ------------------------ | ----------: | -------------------------: | ------------------------------------------------------------------------------- |
| H3 originale             |           1 |               22 / 43 / 15 | Binding e closure statica                                                       |
| Compagnia UI53 originale | -1065703788 |               21 / 36 / 14 | Binding, initialization e startup CLI su copia del backup autentico             |
| Nuova compagnia UI38     |   898554765 |               22 / 36 / 15 | Tre identità UI dalla preparazione/freeze a obiettivo0 e primo turno            |
| Compagnia con Cacciatore |           1 |               22 / 43 / 15 | Import UI di backup autentico, tre identità, conversione positiva e primo turno |

La UI53 usa i nodi iniziali5 e81; il secondo non viene trattato come123/H3.
La nuova UI38 usa i nodi2 e107. Le rispettive azioni/packet e tutti gli altri
14/15 prefab scelti sono letti e inizializzati prima dell'abilitazione.
Per la variante Cacciatore sono confrontati integralmente sezioni, caselle,
assegnazioni, spawn order, movimento e RNG con H3: sono identici, mentre
contesto e fingerprint differiscono. Nessun nuovo prefab è dedotto dal ruolo.

La lettura bounded copre28 prefab,463 oggetti/2.154.210byte,94 record di
gerarchia,38 FSM normalizzate,484 hash dei parametri,178 relabel posizionali,
119 binding e57 metodi lifecycle/constructor.13 packet compilati consumano
10 insert;20 chiavi selezionate provengono da due TextAsset italiani.
Sono verificate letture complete C/Python, classi/riferimenti, metadata e hash
IL. I clip referenziati non aggiungono autoplay o eventi. Non viene eseguita
Unity né dichiarata parità Unity/JIT, né copertura dei373 prefab o di tutti i seed.

## Carte e autorità

I servizi esistenti Scoperta, prove e mazzi vengono chiamati nel contesto fonte.
Nessun bonus Aragorn, rally shuffle, costo azione o START_SCOUT libero si applica
allo startup. Le carte rivelate e i risultati restano consultabili; un ACK non
può completare una Scoperta o una prova. Esito, conversione, scarto e premio
capped sono registrati nella stessa transazione del cursore e della ricevuta.
Quando l'eroe è pieno, il premio zero conclude correttamente il passo.

Due policy di preparazione sono legate all'intera definizione verificata della
carta: guadagno obbligatorio di1 ispirazione del Cacciatore e gate preciso per
la preparazione che richiede il flip di una paura a faccia in su. Il primo è
applicato una sola volta all'ingresso nel contesto fonte; il secondo rifiuta la
scelta prima di cambiare le carte. Non sono executor generali dei testi delle
carte. Nessun altro effetto fisico obbligatorio prima di obiettivo0 emerge dai
reveal dei prefab usati nelle prove UI.

Ogni richiesta è legata a scenario, actor, hero, request, source cursor,
revisione, generation e fingerprint di pack/proiezione. Stale, cross-hero,
cross-request, doppio invio e restore non possono riapplicare carte o effetti.
Le ricevute dei turni e del viaggio ricostruiscono proprietario, budget e
posizioni. Interazioni, esplorazioni successive, abilità generiche e Ombra
rimangono gated; le conferme manuali legacy non diventano effetti originali.

Schema10 migra1–9 mantenendo richieste pendenti di generazione, Scoperte,
prove, turni, copie e ricevute. Aggiunge scenario null senza reinterpretare una
sessione legacy come avventura avviata. La preparazione iniziale richiesta
distingue anche le Scoperte libere già risolte sui tavoli precedenti.

## Browser e ripresa

Tre identità indipendenti T3, su origini distinte dello stesso host4351, hanno
preparato Aragorn/Gimli/Beravor, generato e congelato la mappa effettiva prima
della compilazione dei suoi nuovi prefab. Il percorso finale riparte da quel
freeze autentico tramite UI e arriva al primo turno con soli controlli UI.
Le letture HTTP successive esportano le prove; non avanzano il tavolo.

Cinque SIGKILL nello startup finale (intro, popup di piazzamento, prova aperta,
obiettivo, handoff), uno dopo conversione positiva e un ulteriore riavvio sul
codice finale conservano identico l'intero payload stato/ricevute. Il pack su
disco è assente durante i riavvii della prima prova finale. Due ripristini UI
midway, durante Scoperta e dopo conversione, conservano tutto il gameplay e
cambiano soltanto generation/revisione/data previste; i tre posti sono
recuperati dalla UI.

La prova positiva importa un backup preparato tramite HTTP ordinario su un
host backend separato: nessuna scrittura SQLite o preparazione via API sul 4351. Il ruolo Cacciatore dà a Bilbo1 ispirazione, spesa dalla UI per convertire
un Fato. Dopo riavvio e import durante la richiesta: conversioni1, ispirazione0,
stesse carte/ricevute; la conclusione produce un solo premio. Anche questa
compagnia arriva a obiettivo0 e al primo turno. Un viaggio UI successivo
consuma una sola azione, muove su un arco fonte e conserva il secondo residuo.

La guida si apre da ogni passo, Escape ripristina il focus e i risultati non
si richiudono al polling. Il dialogo di import parte da Annulla. Ispezione e
chiusura di un segnalino lasciano identico il payload e il commit non disponibile
è disabilitato. Le verifiche DOM a320/768/1024/1440 non mostrano overflow o PUA.
La regressione visiva rosso→verde corregge il centraggio misurato a pannello
nascosto; ResizeObserver e layout dopo il reveal mantengono gli eroi visibili.
Zoom e pan non cambiano geometria o adiacenza.

Snapshot AX T3 restituisce timeout15000ms; la registrazione restituisce timeout
e una disconnessione. Le schede dedicate sono riconnesse senza toccare quelle
altrui. Il fallback Chrome MCP è occupato da un altro profilo, lasciato intatto;
la verifica pixel usa Chrome installato con profilo headless isolato e input
nativi DevTools, senza dipendenze nuove. Quattro PNG privati sono ispezionati.
Nessuna eccezione JavaScript; unica voce console rete:404 del favicon preesistente.
Queste prove non certificano telefoni fisici, LAN, Windows, Safari o WCAG completa.

## Riproduzione e verifiche automatiche

`npm test`: **416/416**, zero skipped;27 test focalizzati scenario, oltre
alla baseline389 dopo PR59. `npm run typecheck`, `npm run format:check` e
`git diff --check` verdi. Gli incrementi rossi/verdi conservano i log privati.
Le fixture pubbliche inventano parametri, stati, asset e testi; i nomi tecnici
dei tipi identificano gli handler implementati.

La scratch ignorata `.scratch/runtime/` del checkout contiene `README.md`,
`manifest.json`, `artifact-verification.json`, compiler/estrattori, lock e
prove ripetibili. `verify-artifacts.mjs` ricompila il pack, verifica quattro
binding, legge integralmente backup/checksum/stati/ricevute e confronta
riavvii/import. Nessun originale, FSM, IL, testo narrativo, immagine o layout
è incluso nei file pubblici. [Metadati/hash pubblicabili](first-adventure-start-private-evidence.json).

Pack su disco: SHA256
`6f3529cbf20cf979a8ffb01413b726158986ae865eede9feb90ed32cd68a4055`,
78.761byte; fingerprint canonico
`819fabcc03bb9645731599f411b4aa7e58e5d57b88536894bfe50d64ed49bb10`.

## Incrementi indispensabili successivi a #38

| Incremento                  | Confine ancora da implementare e verificare                                                                                                                                  |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Interazioni ed esplorazioni | Closure degli handler rinviati, prove cumulative/condivise, effetti, scelta del destinatario, nuovi reveal e obiettivi                                                       |
| Finestre di abilità         | Capacità di eroi, oggetti e preparate; effetti di turno, conversioni alternative, costi e prevenzioni                                                                        |
| Stato fisico                | Mazzi/copie di danni e paure, faccia in su/giù, capovolgimenti, cure, debolezze, titoli, prevenzione e ultime resistenze; PR59 fornisce catalogo verificato, nessun executor |
| Combattimento e nemici      | Gruppi, statistiche, attivazione, bersagli, danni/paure, contrattacchi e capacità                                                                                            |
| Ombra e minaccia            | Oscurità, minaccia/soglie, timer e tutti i ricevitori dinamici; nessun ACK legacy come sostituto                                                                             |
| Esiti, campo e ID2          | Successo/fallimento, ricompense, progressi persistenti, campo, equipaggiamento e routing verso la seconda avventura                                                          |

Le quantità dei tre benefici restano la domanda già pending in #57; non sono
inventate né richieste di nuovo e non bloccano questo startup. #38 consegna
l'avvio verificato; non dichiara completa l'avventura #33 o la campagna.
