# Verifica del compiler dei tabelloni battaglia

Implementazione di [#126](https://github.com/Ic3b3rg/lotr-table-game/issues/126)
sulla base `e128adb36789ff7859431df6adbc9739a587c588`.
[Spec](../planning/battle-map-spec.md), [piano](../planning/battle-map-plan.md),
[API/CLI](../development/battle-map.md).

## Risultato tecnico

Libreria e CLI standalone compilano un artifact privato completo, con fonte,
policy revisionata e due alternative del merge. Verify ricompila l'intero
risultato e applica i pin del chiamante. Geometria verificata disponibile;
richiesta di partenza disabilitata, `runtimeReady:false`.

Sono aggiunti soltanto `src/battle-map/`, tre file test nuovi, una fixture
inventata, documentazione e due entry in build. Nessuna modifica a pack,
schema29, journal/replay, host, sessione, route, viaggio, UI, RNG o mazzi.

## Ingressi e indipendenza

Verificati prima del parse i pin del mandato e dei tre manifest autorizzati;
poi tutte le 17.879 righe / 843.355.608 byte, con path relativi unici,
containment, file regolari e assenza di symlink/traversal. Ogni riga usata
è verificata di nuovo prima di lettura/copia. Nessun locator storico è stato
seguito; i tre ingressi restano read-only. Supporto120 è verificato per hash,
senza eseguire helper in place o importare backup estranei.

L'adapter privato rilegge slice delle primarie selezionate usando schema e
reader struct sigillati; confronta i raw decodificati con le prove ricevute.
Il contratto conclusivo124 non genera source, coordinate, archi o mapping:
è letto dal checker come oracolo separato. Catalogo/prefab/Adventure/modello,
BuildSettings, manager/board, mesh/submesh/UV, materiali/texture/stream,
Transform e ancore sono collegati dai campi nativi.

La source minima conserva 133 record, 65 Transform, cinque mesh e 13 ancore.
Le 39 selezioni di submesh comprendono 36 patch e i tre usi del muro. I quattro
estremi UV sono verificati contro tutti gli indici nativi della submesh;
i bounds completi coincidono. Il packed resta double decodificato con
identità codec; i float32 nativi conservano i bit. Quattro corpi IL sono
confrontati byte per byte con la DLL primaria, con hash raw/code distinti.
La politica visiva già revisionata resta esplicita e pin-nata; BC1/pixel e
24 contatti campionati corroborano le regioni, senza segmentazione autonoma.

Il checker Python non importa compiler TypeScript o adapter produttore.
Ricostruisce geometria dalle mesh complete e confronta ogni campo dei layout
con primarie e oracolo124: **19.578 confronti ricorsivi**, quattro combinazioni
selezione/layout. Entrambe le selezioni ricompilano gli stessi derivati.
Ogni layout ha dieci caselle,19 archi geometrici, tre muri,16 archi residui
e 13 piazzamenti; il controllo copre anche tutti i 27 contatti fra patch,
facce, coordinate/bit, UV, giunti, orientamenti, distanze e ordine spawn.
Non si limita ai conteggi.

Condivisioni dichiarate: schema/reader struct e decoder packed dell'adapter,
BC1, semantica TRS/static batching, politica visiva e interpretazione RR.
Il checker è distinto dal prodotto; non è una seconda implementazione Unity
né una verifica indipendente dell'autore delle fonti.

## TDD e negativi

18 test nuovi interamente inventati coprono fonte/binding/prefab, gerarchie,
regioni accorpate, giunto, diagonali escluse, muri/bordi/ambiguità/orientamento,
static batching/TRS, bit `-0` e componenti piccole, due merge/reorder, copie,
JSON hostile e budget, pin/alterazioni risignate, capability e CLI.
Concorrenza di due publisher: un solo artifact completo, retry senza overwrite,
file0600; input invalido exit1; avvio gated exit2 con output conservato.

La matrice reale aggiunge 24 casi negativi e otto comandi CLI: output alterati
e risignati sono respinti; una nuova source inventata coerente è tecnicamente
valida senza pin e respinta dai pin originali. Il pin non è ricavato da un
output avversario: il chiamante deve riceverlo da un'autorità attestata futura.
Hash/recompile non autenticano autonomamente contenuto o autore.

I RED e gli errori reali sono conservati nella scratch, con stdout/stderr/exit:
entrypoint/export assenti durante TDD; gerarchie e tolleranze UV prima delle
guardie; null esplicito inizialmente trattato come pin omesso, poi respinto.
Il primo test roundtrip pretendeva il segno numerico di `-0` dopo JSON e un
negativo pretendeva di respingere una policy coerente senza pin: aspettative
corrette secondo la spec, mantenendo il log fallito e aggiungendo il pin.

L'adapter iniziale ometteva dalla propria allowlist un asset già autorizzato;
i tentativi sul Template funzionale del terreno non erano necessari al mesh
render e si fermavano prima di leggere righe assenti. La successiva visita
bounded dei figli ha trovato i MeshFilter già sigillati. Un accesso iniziale
alla classe di un componente non selezionato è stato fermato dal manifest;
nessun nuovo root seguito. Il primo export del ledger aveva una chiave `file`
duplicata nel costruttore Python: corretto soltanto nell'helper proprio.
Nessun negativo reale è stato cancellato o reinterpretato come successo.

## Comandi finali

I comandi effettivi e le ricevute sono in `.scratch/battle-map-compiler/logs/`.
Build base `npm run build` eseguita prima del prodotto, conservando tutti i 22
vecchi output e l'albero dei 224 file fonte/tool selezionati da Git. Dipendenze
locali copiate e verificate dopo pin del lockfile; nessun install/ci.

Le verifiche finali comprendono `npm run typecheck`, `npm run build`,
`npm run format:check`, `git diff --check`, checker privato e confronto byte.
Il confronto copre tutti i 22 vecchi dist e tutti i 223 file fonte/tool/validatori
preesistenti escluso build: byte-identici. Build cambia per due sole entry,
con flag originali invariati e due soli target nuovi. Nessun nuovo import
nelle vecchie entrypoint; nessun corpus di backup da 11 GB riprodotto.

La sola canonica finale `npm test`, ALONE/concurrency4, è terminata con **exit
npm 0: 941 test, 941 pass, 0 fail/cancelled/skipped/todo** (923 base + 18 nuovi).
Durata Node 1224215.942166 ms, stderr 0 byte; ricevuta `56-canonical-alone`,
UTC 10:56:07–11:16:32 del 6 novembre 2026. Nessun altro job pesante, browser,
build o edit tracked durante l'esecuzione. Codice verificato al commit
`a7fc518` (successive modifiche soltanto documentali). Nessun test esistente
modificato, saltato o eliminato. Nessuna prova browser richiesta per il modulo.

| Comando / ricevuta                    | Esito                                                  |
| ------------------------------------- | ------------------------------------------------------ |
| `npm run typecheck` /47               | exit 0                                                 |
| `npm run build` /45 e build interna56 | exit 0                                                 |
| `npm run format:check` /48            | exit 0                                                 |
| `git diff --check` /55                | exit 0                                                 |
| `check-baseline.py` /49               | 22 vecchi dist e 223 fonti/tool identici               |
| `check-output.py` /51                 | 19.578 confronti completi, exit 0                      |
| `revalidate.mjs` /50                  | Entrambe le selezioni identiche, pin e gate verificati |
| `audit-public.py` /52                 | 44.297 frammenti narrativi, 13 vettori, zero finding   |
| `inputs.py verify-all` /53            | 17.879 file / 843.355.608 byte immutati                |

## Consegna e limiti

La scratch propria contiene sorgenti/adapters operativi, artifact privati,
checker/matrice, baseline, output/log e ledger. Il manifest proprio ha righe
relative senza traversal/symlink, byte/SHA attuali; esclude se stesso, con pin
separato. I tre manifest read-only rimangono riferimenti distinti. README e
ricevute spiegano la riproduzione senza percorsi storici o installazioni esterne.
L'audit del nuovo diff e della storia mantiene contenuti originali fuori da Git.

Le tre quantità57 sono **null/unverified**, originale156 **statico/gated**.
#33/#89/#65/#57 restano aperte. Nessun B1_WEAKNESS/packet consumer, pesca,
generazione nemici, shuffle, avvio o ripresa di una partita originale.
Nessuna equivalenza Unity/JIT/RNG, partita completa, telefoni fisici, Windows
o Safari è certificata. Root esegue review Standards/Spec fresche e integrazione;
questa consegna non scrive GitHub, non apre PR e non esegue push/merge/watch.

## Integrazione Root

Le due review hanno individuato lo stesso P2: compile poteva restituire
un artifact oltre il limite condiviso di100000 nodi, poi rifiutato da verify.
Il Root ha riprodotto il RED e aggiunto il controllo sull'artifact completo
prima del return, con una regressione inventata al confine del budget.

I19 test mirati e la nuova canonica Root sono passati: **942/942**, exit
npm0, zero fail/cancelled/skipped/todo, stderr vuoto, ALONE/concurrency4.
Il codice è rimasto al commit `3a4893bbdf60a1092fe0f1f12c8501411769cd51`
per tutta l'esecuzione. I941 risultati della consegna precedente rimangono
evidenza storica distinta.

Rieseguiti adapter nativo, compilazione, matrice e confronto separato:
19.578 verifiche di campo,24 casi negativi e otto comandi CLI. I due artifact
validi conservano esattamente byte e fingerprint precedenti; tutti i22
vecchi dist e223 file fonte/tool/validatori sono invariati. Dettagli e limiti
nella [review Root](../reviews/2026-11-06-battle-map-compiler.md).
