# Review dell’incontro nel perimetro base — #104

Confronto fissato a `fb6a2bbab354d2f92ce5a59e17b898f988701fcc` contro
`64bbae2c9ace3772aeafab0653dc9e5a0e9e7a64`: sei commit, 56 file.
[Issue104](https://github.com/Ic3b3rg/lotr-table-game/issues/104),
[specifica](../planning/base-products-encounter-spec.md),
[piano](../planning/base-products-encounter-plan.md) e
[rapporto](../development/base-products-encounter.md). Due review indipendenti
con contesti freschi; correzione e verifiche del root distinte dalla consegna.

## Standards

**Un difetto P2, corretto dal root. Nessuno smell euristico sostanziale.**
Il walker delle nuove forme in `src/server/state.ts` visitava ogni oggetto
in modo ricorsivo: normali globali/locali con chiavi baseProducts o
sprintOrigin venivano scambiati per metadati. Un salvataggio valido accettato
dal parser della base fissata era rifiutato come schema 21. Violava il
contratto di ripresa ADR2 e la preservazione dei validatori storici ADR3.

La correzione controlla soltanto manifest, istruzioni, richieste, task,
origini di esplorazione/combattimento e intenti/seed del ledger. I nomi nei
dizionari di variabili ed eventi rimangono dati. Nuova regressione tramite
avvio HTTP reale inventato: nomi baseProducts/sprintOrigin/op/kind nelle
globali e locali, migrazione dell’intero stato10–21 e input invariato.
Restano tutti i negativi sulle forme nuove, anche nel seed.

RED:1 test fallisce per il rifiuto storico; GREEN finale:2/2. Due correzioni
intermedie della nuova fixture schema 10 sono registrate: physical è assente
nel formato10 e viene aggiunto come null dalla migrazione già esistente.
Nessuna asserzione del contratto finale è rimossa o indebolita.

Il reviewer ha riprodotto il difetto confrontando in memoria entrambi i
parser e ha eseguito6/6 test finiti compiler/runtime/discendenti. Nessun
host, suite di recupero/canonica, browser, DB, helper ricevuto o modifica.
Nessun recheck delegato della correzione: il root possiede RED/GREEN e
verifica finale.

## Spec

**Nessun requisito mancante/parziale, scope creep o comportamento errato
confermato.** Controllati input[0]/owner, guardia prima degli effetti esterni,
costo/prove/carte, Scatto, preflight, provocazioni/esplorazione, ritorni e
sconfitta, forme schema 22 e vista pubblica. Verifica finita indipendente:
6/6 test compiler/runtime/discendenti con bundle in memoria e dist esistente.

Il candidato sull’esaurimento fisico non è un difetto nuovo: contratto61/T25
e contratto originale prescrivono il confine diagnostico alla pesca con
costi accettati conservati. Non è stata inventata una regola del mazzo vuoto
né esteso il consumer. Primarie/oracle, compatibilità completa, QA nativa e
suite canonica restano verifiche del root.

**Conteggio per asse:** Standards 1 P2 risolto/0 smell sostanziali; Spec 0
rilievi. Nessun ordinamento trasversale dei due assi.

## Verifica del root

I sei commit sono integrati dalla base fissata, seguiti dalla sola correzione
storica e dalla regressione. Verificati 2764 file / 2035240405 byte e create
copie proprie immutabili/di lavoro; sigillo ricevuto invariato, nessun DB
ricevuto aperto. Manifest 549728 byte, SHA256
`9b595c295700904baa06f1738108cab24fee7eb9172b5460409ccda5d1783110`.

Riletti sette asset/68563 byte con due reader e 36 corpi IL / 3185 byte codice /
1132 istruzioni. Ledger, hash, binding e 11 chiavi italiane coincidono.
Programma completo 14 stati/14 azioni; oracle separato 24 casi, tutte le nove
istruzioni ammesse e cinque stati esterni. Sul set esplicito[0] contatore
e titolo esterno non sono raggiunti. Tre output compiler identici byte per
byte, così come il freeze102. Nessuna esecuzione Unity/JIT o parità RNG.

Validator finale ricostruito dal commit della correzione: 1562357 byte,
SHA256 `a8d8454601ad9d7ad78e2ff95a64c43ab67e84680e3cd53720884dfe11a0752d`.
Passano 503/503 input,398 payload distinti e 17 viste94 intere; nove batch
root disgiunti con tutti gli indici una volta. Passano 18 snapshot/viste96,
14/98,17/100,19/102 e13/104, inclusi export/finali; payload distinti
18/13/16/18/12. Byte/hash precedono il parse, confronto completo e nessuna
esenzione replay. I risultati root precedenti alla correzione sono
archiviati separatamente e non sostituiscono quelli finali.

Sole migrazioni: schema 22 e il default storico physical:null≤10. Nei restore
correnti cambiano generation/revision/updatedAt. Nessuna normalizzazione
gameplay; originale156 conserva gate57 e payload completo nel solo preflight
statico, senza proseguire la partita. Copie identiche non nuove prove.

Audit UI ricevuto: 12 matrici,144 combinazioni,120 casi completi e24 ispezioni
con annullamento gratuito, tre identità e320/768/1024/1440. Guida, lettore,
focus/tastiera, assenza crypto.subtle e overflow; precondizioni dichiarate
prima dello startup. Verificati 21 file / 15676 eventi: zero eccezioni e
loadingFailed, due422 intenzionali sui restore. 468 PNG, quattro ispezionati
dal root. Non si dichiara ispezione manuale dell’intero insieme o nuova QA
browser del root. Chiusura dei tre contesti e rilascio della propria porta
attestati dalla ricevuta, senza ispezionare processi o superfici altrui.

La QA ricevuta esercita il codice del child. La correzione root interessa
soltanto l’identificazione delle nuove forme nei salvataggi storici; il
validator finale viene ricostruito dal commit root e usato per tutti i
confronti completi. Non viene dichiarato byte-identico al validator del
child dopo questa modifica. Il comportamento di gioco schema 22 è invariato.

Invarianti sui 24 file test preesistenti del child: sole attese21→22;
asserzioni, casi, deadline e dipendenze invariati. Il root aggiunge una
regressione, conservando integralmente i test ricevuti. Tentativi di fixture,
teardown e driver del child sono conservati; il difetto della vista pubblica
è documentato con RED/GREEN e ripresa dello stesso stato.

Suite canonica root **773/773**, zero fail/skip/cancel/todo,
679735,193208 ms, concorrenza4 invariata, eseguita da sola dopo tutte le
verifiche pesanti e i reviewer. Comprende i nuovi confini di recupero,
provocazione sospesa e transazioni. Typecheck, formato e diff passano.
Validator ricostruito dal commit finale e confrontato con quello usato
per tutti i riscontri; la relativa verifica è nella ricevuta root.

Privacy 307 stringhe, zero leak su diff, nuovi file e nuova storia; corpus
ed evidenze solo scratch ignorata. Comandi, adattamenti, byte/hash e risultati
root separati dal sigillo ricevuto.

Quantità 57 null/unverified e blocco mantenuto; nessuna nuova partita originale,
ripresa156 o accettazione89/33. #57/#65/#89/#33 rimangono aperte;109/inventario,
altri incontri, campo completo/acquisti e A2 successivi. Schema 22 richiede
il nuovo lettore; rollback dei dati mediante un backup precedente.
