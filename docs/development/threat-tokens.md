# Segnalini minaccia15/21 — #112

Base: main `4d50c29cb19c154c3cfc2558b50368fde6514bda`, schema25,
baseline840, dopo #110. Spec e piano sono stati committati prima del codice.
La capacità opzionale `manifest.threatTokens` è congelata prima dello startup,
vincolata ai due owner e al contesto base `[0]`; lo schema corrente diventa26.

## Comportamento e confini fonte

| Segnalino | Prefab / FSM   | Inventario certificato | Programma ammesso |
| --------- | -------------- | ---------------------- | ----------------- |
| 15        | R5696 / R27669 | 8 stati,9 azioni       | 8/9               |
| 21        | R5515 / R27488 | 12 stati,12 azioni     | 9/9               |

Il15 offre ispezione/cancel gratuiti. La conferma paga una nuova azione e avvia
`sourceTest` Saggezza2 con carte e conversioni reali. Il fallimento ritorna
all'attesa visibile; il retry è un nuovo tentativo pagato. Il successo acquisisce
il beneficio tramite il controller condiviso e applica IntAdd−4 a Threat,
poi rimuove e conclude il segnalino una volta.

Il21 usa Spirito2. Il successo concede ispirazione1 entro il cap e rimuove il
segnalino. Il fallimento conserva esattamente `OwnsProducts.products=[null]`:
OnEnter06001120 chiama IsOwned060010fa, il confronto Unity con null rende la
proprietà falsa e l'evento0 attraversa paura1 fisica e rimozione. I tre stati
esclusi2/8/9 e le relative azioni restano nel certificato intero con motivazione
`IsOwned(NULL)=false`. Il programma non ammette PlayerChoice/ModifyCorruption.

Il pavimento0 riusa il comportamento già attestato e limitato della capacità
linked102. Update06000c8b,270 code byte, legge AdventureThreat, applica
`Mathf.Max(value,0)` e riscrive AdventureThreat. Ctor06000cdf e get/set06000cec/
06000ced attestano il binding. Il runtime aggiunge soltanto il nuovo indirizzo
owner/stato/azione15: gli altri IntAdd, contatori, PlayerCount, budget e finestre
perdita mantengono i confini precedenti. I casi0/1/3/4/9 e modifiche al binding,
programma e attestazione sono coperti.

## Grounding e riproducibilità

Il manifest ricevuto è1830594 byte SHA256
`ba6eb1dd311d388c7fbaabb029635b8e5233f5391326d9595411994b5c44443e`.
Tutte8542 righe/3654464113 byte sono verificate prima di parse/copia, con seconda
verifica durante la copia. Originali/helper/DB ricevuti restano read-only.

La rilettura bounded confronta due reader sugli otto oggetti espliciti
(105166 byte), tutti20 stati/21 azioni e15 chiavi di localizzazione. L'oracle
indipendente dal compiler/runtime controlla2222 record parametri,3 binding,
5 relabel posizionali, puntatori/packet e35 corpi IL pertinenti:5442 code byte,
1906 istruzioni,213 branch,16 regioni EH. I tre esclusi sono distinti dal
sottoinsieme ammesso; le precedenti istruzioni certificate sono identiche.

Il pack110 è ricostruito integralmente37/290/308/28 con fingerprint
`1bca5b17c89617fbdcfc6bd3c491187947f00a83161e61d07db1a1c8ef3ecaf9`.
Il nuovo pack37/301/322/27 ha fingerprint
`065471143eabbfc15b4dffa16fa787c280b69757f442a6f79bc09b03c98a7704`.
Tre compilazioni producono gli stessi byte; pack522479 byte SHA256
`0f8cd67b76a0891cc14795c8dd1bcea332932eed06965844be13e9953c9c7ac9`.
Selezione, mappa, assegnazioni, pool e altri prefab/cap/certificati sono conservati.

## Stato, transazioni e UI

Il preflight controlla l'intera continuazione, le popolazioni, entrambi gli
esiti, provocazioni, preparazioni presenti/future e discendenti prima di costo,
carte o RNG. Stock57 null/unverified conserva il gate, compreso il ramo fallito
che tornerebbe all'attesa. Benefici, ispirazione e paura/P1/P2 hanno consumer
fisici reali. Si riusano Store.once/ledger, origine round1/Azione immutabile,
attore, casella, turno, carte, cursore e movimento residuo. La sconfitta
conclude il padre senza nuove scelte personali o nuove finestre perdita.

La migrazione26 è bounded ai percorsi di stato/seed del contratto: formati≤25
respingono le nuove forme e normali parole nei dizionari rimangono valide.
I contesti storici autonomi senza owner/pack rimangono validi. Si conserva
§76.1 per il reset del mazzo abilità e il gate dei futuri effetti non attestati.
I28 test storici modificati cambiano soltanto l'aspettativa corrente25→26.

La UI indica attore, azione già pagata, carte/conversioni, fallimento, nuovo
costo del retry, attesa e passo successivo; i proprietari diversi osservano lo
stesso avanzamento. Il controllo nativo usa due partite interamente inventate,
con tre identità, precondizioni/stock/limiti dichiarati prima dello startup e
solo DOM/Input dopo bootstrap. HTTP IPv4 senza `crypto.subtle`, larghezze
320/768/1024/1440:27 matrici,324 casi,32 snapshot interi, export/current restore,
recupero posti e quattro negativi risignati422. Un episodio copre fallimento/
retry e Spirito riuscito; l'altro paura/P2 e sconfitta del terzo attore.

Tutti1200 PNG passano il controllo di pittura (638 byte-distinti); sette immagini
rappresentative sono ispezionate direttamente, includendo attesa mobile,
conversioni, beneficio, P2, ritorno, lettore e guida. Focus, tastiera e assenza
di overflow sono verificati per ogni matrice. I tre contesti e i soli processi
propri di ogni episodio risultano chiusi; rebind della porta4413 riuscito.

## Verifica e ricevute

Le nuove suite contengono23 casi: compiler, runtime, migrazione, effetti, HTTP,
provocazione, recovery, transazione e UI. Le suite mirate passano23/23; il guard
aggiuntivo sull'inventario ammesso passa anche la ripetizione compiler4/4.
Le prove HTTP confrontano il vero vincitore concorrente e payload/vista interi.
Recovery copre16 SIGKILL postcommit,16 precommit e17 negativi risignati422 su
host nuovi vuoti packless, con origine intera e nessun hook in produzione.

Il corpus vincolante comprende503 file/398 payload/17 viste94, serie96–108
18/14/17/19/13/20/22,40 snapshot110 (37 payload distinti) e9 recheck (6 distinti)
degli stessi tre giochi, oltre ai nuovi32 snapshot112 e export/finali interi.
Il validator viene costruito dal commit con git-show/onLoad. Sono consentiti
solo schemaVersion26 e physical:null storico≤10; al restore solo generation,
revision e updatedAt.156 viene controllato soltanto staticamente, gated e
immutato. I duplicati non costituiscono nuovi casi di gameplay.

Le ricevute finali in `.scratch/encounter112-impl/` legano SHA, byte/hash,
comandi, veri exitcode, output e limiti. Il criterio canonico è `npm test`
ALONE a concorrenza4 dopo tutti i controlli pesanti,863/863 e zero
fail/cancel/skip/todo; il runner acquisisce footer Node spec oppure TAP.
Tipi, formato, diff e privacy includono l'intera storia dei nuovi commit.
README e sigillo privati conservano input, handle operativi separati dalle
identità ricevute e tutti i tentativi, inclusi quelli falliti.

Un errore iniziale nell'adapter dei parametri deferred è rilevato dall'oracle,
poi corretto mantenendo le istruzioni precedenti identiche. Il primo run mirato
fallisce su una precondizione di raggiungibilità della fixture provocazione:
si lega il segnalino alla casella iniziale effettiva prima dello startup,
conservando pool e limite3, senza filtri/reroll. Un errore di nome del campo
fingerprint nel verifier privato è corretto sugli stessi snapshot, senza
ripetere o alterare le partite. Le ricevute fallite restano conservate.

## Limiti della consegna

Nessuna nuova partita originale o ripresa156;57 resta null/unverified. Il pack
compilato non è una prova di gameplay originale. Nessuna apertura a prodotti
aggiuntivi, campo completo, upgrade oltre base o A2.89/33/65/57 rimangono aperti;
non si dichiara il gioco o l'avventura completi. Il live del proprietario non è
aggiornato. Root esegue Standards/Spec fresche e integrazione. Nessun agente,
checkout aggiuntivo, installazione o scrittura remota è usato dall'implementer.
