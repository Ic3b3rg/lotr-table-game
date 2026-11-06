# Review: compiler dei tabelloni battaglia

Issue [#126](https://github.com/Ic3b3rg/lotr-table-game/issues/126), base
`e128adb36789ff7859431df6adbc9739a587c588`. Consegna
`3c88bf6c50e532e4364e7714adf0d336ee488ddd`, codice figlio
`a7fc518526a74bc79926e12db69b52e303b698e4`. Il Root ha riprodotto le prove e
corretto un difetto del limite prima della pubblicazione.

## Standards

**Violazioni documentate: 0. Smell facoltativi: 0. Un bug concreto P2.**

La review ha verificato il diff fissato e gli standard del repository.
Compile controllava il budget della fonte ma restituiva l'artifact completo
senza controllarne la dimensione. Una fonte inventata da98.271 nodi era
accettata, ma il risultato da100.012 nodi veniva rifiutato dalla propria
verify, anche con i pin corretti. Con l'ultimo mesh ridotto di un vertice
il risultato da99.996 nodi verificava correttamente. Il problema riguarda
`compiler.ts`, non un nuovo limite da imporre ai dati originali.

## Spec

**Mancanti/parziali: 0. Scope creep: 0. Implementazioni errate: 1.**

Lo stesso P2 contraddiceva il requisito di un artifact intero verificabile
e reimportabile. La review ha confrontato issue, mandato, spec esecutiva,
API/CLI e prove private selezionate. Nessun altro difetto confermato.

Le ancore restano esplicitamente nel frame locale layout dell'app, come
la primaria124. Applicare una seconda trasformazione gerarchica cambierebbe
quel contratto. Hash e ricompilazione rimangono distinti dall'autenticità
editoriale. I limiti multihero/audio/RNG e il seguito runtime sono dichiarati.

## Correzione e verifica del Root

Il Root ha aggiunto una regressione inventata: sotto il limite il risultato
verifica con i propri pin; aggiungendo vertici inutilizzati, compile deve
rifiutare la fonte quando l'artifact intero supererebbe il budget. I vertici
aggiunti non cambiano geometria o submesh usate. RED effettivo: un test
fallito per eccezione mancante. Il compiler ora applica la guardia condivisa
all'artifact prima di restituirlo, come il compiler combattimento.

Il fix riguarda solo compiler e regressione,25 righe aggiunte e una rimossa.
I19 test mirati passano. Il cambiamento non modifica gli artifact reali validi,
che mantengono byte e fingerprint identici alla consegna.

Prima dell'uso, il Root ha verificato il manifest privato da40.959 byte,
SHA256 `ddf835e328713419473be279bacb20719bfa6b49d7307b54d7468b1282e0bdc0`,
e tutte le243 righe/11.626.128 byte. Due copie proprie distinguono evidenza
immutabile e area operativa. Verificati anche i17.879 riferimenti/
843.355.608 byte dei tre ingressi espliciti, senza seguire percorsi storici.

Le13 fasi riprodotte dal Root sono terminate con exit0:

| Prova                    | Esito                                                                                                                        |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Pin dei tre ingressi     | File e manifest ancora immutati.                                                                                             |
| Adapter dalle primarie   | 133 record,65 Transform, cinque mesh,13 ancore e39 selezioni submesh; nessuna derivazione dal JSON conclusivo124.            |
| Compilazione e roundtrip | Due scelte di merge, source e artifact validi identici alla consegna; pin e gate verificati con il codice Root.              |
| Oracolo separato         | 19.578 confronti di campo, quattro combinazioni scelta/layout; mesh complete, UV, contatti, geometria e tutti i piazzamenti. |
| Matrice API/CLI          | 24 casi negativi e otto comandi CLI con exit0/1/2 attesi, output0600 e start gated.                                          |
| Regressione preesistente | Tutti i22 vecchi dist e223 file fonte/tool/validatori byte-identici alla base; due soli nuovi target.                        |
| Qualità                  | Typecheck, formato, diff e privacy senza errori. Audit di44.297 frammenti narrativi e13 vettori originali: zero finding.     |

Sette file sorgente/derivati dell'adapter e i due artifact appena compilati
sono byte-identici alle prove ricevute. Il confronto dell'oracolo sulle
copie ricevute è collegato ai nuovi output da questa uguaglianza completa;
la matrice API/CLI e la ricompilazione usano direttamente il nuovo dist Root.
Schema/reader struct, codec packed/BC1, TRS/static batching e policy visiva
rimangono assunzioni condivise dichiarate, non una seconda Unity/JIT.

La canonica Root sul commit `3a4893bbdf60a1092fe0f1f12c8501411769cd51`, ALONE/concurrency4, è terminata con **942/942 test passati**, exit npm0, zero fail/cancelled/skipped/todo e stderr vuoto. Durata effettiva del runner 1206.412 secondi. HEAD, albero prodotto/test/script/dipendenze e stato pulito sono identici prima e dopo. La consegna figlia aveva941 test: il nuovo controllo di regressione del Root porta il totale a942. Le successive modifiche sono soltanto documentali e mantengono identità di sorgenti e binari verificati.

Le prove Root sono in `.scratch/battle-map-126-root-review/`, ignorata da
Git. Tre import JS sono adattati al repository operativo; gli output
esclusivi ricevuti sono archiviati prima di crearne di nuovi. Raw,
provenienza e riferimenti in lettura non sono modificati. Il primo controllo
del footer figlio cercava il formato TAP; il log usa il formato Node `ℹ`:
il tentativo è distinto dalle verifiche successive del risultato effettivo.

## Limiti e seguito

Libreria e CLI compilano un artifact tecnico privato. ScenarioPack,
schema29, sessione, viaggio, journal/replay, host e UI rimangono identici.
Nessun corpus di backup da11GB è stato riprodotto per un modulo isolato.
Il seguito deve consumare i fingerprint attestati e congelare il contenuto
prospetticamente nello stesso registro, preservando episodio e origine A1.

`runtimeReady:false` e partenza avventura disabilitata sono invarianti.
Quantità57 tutte **null/unverified** e originale156 **statico/gated**;
#33/#89/#65/#57 restano aperte. Nessuna nuova partita originale, ripresa,
certificazione Unity/JIT, prova fisica telefoni/Windows/Safari è dichiarata.
