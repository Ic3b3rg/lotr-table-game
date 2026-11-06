# Review: tabelloni e piazzamenti dell’avventura 2

Issue [#124](https://github.com/Ic3b3rg/lotr-table-game/issues/124), base
`5571108db98600a552acde97cc60af7bddcd0f6c`, consegna
`6a78d1485ddc1346e0c9f3f5835d644570c2869b`. Il Root ha integrato il rapporto
con `50be6642b0d3b2e583fbb0279508f0de04aa1fab`, il cui albero è identico
alla consegna. Questo documento registra le due revisioni indipendenti e
la riproduzione successiva del Root.

La [ricerca](../research/second-adventure-battle-board-runtime-contract.md)
chiude binding, facce e collegamento spaziale dello startup nel perimetro
dichiarato. Non abilita A2: il compiler, la materializzazione fisica e la
chiusura delle capacità obbligatorie precedono il futuro primo turno.

## Standards

**Violazioni documentate: 0. Smell baseline: 0.**

La revisione ha esaminato tutte le 396 righe aggiunte al target indicato.
Fonti, versione, hash e locatori sono espliciti; sorgente, derivazione
geometrica e regola fisica rimangono distinti. Casella/tessera e
giocatore/eroe seguono il glossario. Registro e origine A1 rispettano
ADR0003; quantità57 e stato156 conservano i gate richiesti.

Il rapporto mantiene corpus, immagini, mapping completo e IL nella scratch
privata ed evita attestazioni di gameplay completo o parità Unity/JIT.
Non contiene codice cui applicare gli smell della baseline. La revisione
Standards è documentale: non ha riprodotto i checker o certificato i binari
privati. Le verifiche del Root sono registrate separatamente sotto.

## Spec

**Requisiti mancanti/parziali: 0. Scope creep: 0. Implementazioni errate: 0.**

La revisione ha confrontato issue e mandato con binding, scene, distinzione
mesh/caselle, tredici piazzamenti, tre muri di bordo, packet EN/IT,
inizializzazione e proposta della prossima slice.

Ha verificato i pin delle prove selezionate, ispezionato integralmente le
due facce, l’immagine FFG e la figura RR p3, quindi confrontato contratto,
checker separato, mapping, record112 e IL pertinenti. Le cinque regioni per
faccia concordano con la derivazione dichiarata.

Più eroi per proprietario, ordine del merge Unity, audio e interleaving RNG
sono limiti dichiarati, compatibili con il criterio della issue di
riportare una lacuna circoscritta e la fonte necessaria. Non sono stati
scambiati per funzionalità implementate. La review è rimasta statica e
in lettura; nessun helper, host o test è stato avviato dal revisore.

## Riproduzione del Root

Il manifest consegnato, **2.604.595 byte**, SHA256
`c686018ef17b09ba0816573f481d74b8ed15dcb45b376f7bbbb9368a9571f787`,
è stato verificato prima del parse. Tutte le **16.431 righe / 164.833.953
byte** sono state controllate prima delle due copie proprie: evidenza
immutabile e area operativa. Verificati anche tutti i **1.448 riferimenti /
678.521.655 byte** delle due capsule autorizzate, senza seguire identità
storiche annidate o importare backup runtime estranei alla ricerca.

Le nove fasi del controllo Root sono terminate con exit0:

| Controllo              | Risultato                                                                                                                                                                                                                   |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pin degli ingressi     | Capsule nuova43 file e riferimento120 da1.405 file ancora immutati.                                                                                                                                                         |
| Nuova lettura C/Python | 3.998 oggetti riletti dalle primarie; campi, raw e puntatori uguali alle prove. I3.996 trattenuti coprono7.401.416 byte,10.006 puntatori non nulli risolti e6.734 nulli. Due materiali candidati scartati restano distinti. |
| Lettore struct         | 3.998 oggetti /7.402.320 byte, consumo intero e1.234.896 locatori; raw confrontati con le slice sorgenti pertinenti.                                                                                                        |
| Bundle                 | Quattro TextAsset riletti dai quattro bundle grezzi, senza usare i valori JSON come oracolo.                                                                                                                                |
| Nuova estrazione IL    | 75 corpi /11.770 code byte /4.330 istruzioni; verifica PE separata,383 salti diretti e sei regioni eccezione.                                                                                                               |
| Produttore             | Contratto da149.143 byte, SHA256 `bafa76bcf7bfd8a90b0db8b54402d65a7fc917a2ce50d1d1c88da9ab94e811af`, identico alla consegna.                                                                                                |
| Checker separato       | 36 elementi piatti,24 contatti, dieci caselle,19 adiacenze geometriche, tre muri,16 adiacenze residue,13 piazzamenti e20 record localizzati;49 alterazioni del contratto e cinque dei raw respinte.                         |
| Inventario             | Conteggi trattenuti/scartati e IL ricostruiti, senza promuovere i candidati scartati.                                                                                                                                       |
| Audit pubblico         | 19.981 frammenti lunghi delle quattro tabelle confrontati con rapporto e storia: zero corrispondenze private; ammesso solo l’esatto URL pubblico FFG già usato come citazione.                                              |

Tutti i **306 file derivati** confrontati, compresi contratto, risultati dei
checker e quattro artefatti per ciascun corpo IL, sono byte-identici alla
consegna. Il Root ha visto le due facce originali, il muro, la figura RR p3
e l’immagine FFG; i controlli dei pixel e delle UV sono stati riprodotti dal
checker. Non si tratta di misure dimensionali dei componenti fisici.

L’unico adattamento di un helper ricevuto riguarda il percorso operativo
del repository nell’audit pubblico. I riferimenti alle primarie rimangono
espliciti e immutabili; raw e provenienza non sono riscritti. Le ricevute
proprie, gli output e il confronto sono conservati in
`.scratch/issue124-root-review/`, ignorata da Git.

Il checker condivide schema/layout, decompressione, semantica TRS/static
batching e interpretazione fisica delle immagini. La rilettura C/Python e
quella struct verificano i byte nei rispettivi limiti; nessuna esecuzione
Unity/JIT, prima partita o equivalenza completa della casualità è dedotta.

## Perimetro dell’integrazione

Sono aggiunti soltanto il rapporto e questa review. Nessun file di prodotto,
test, script, schema, pack o dipendenza cambia. Formato, collegamenti
relativi, privacy di diff/storia e `git diff --check` sono verificati. Non
è stata ripetuta la canonica runtime923 per questa modifica documentale.

La prossima slice può compilare geometria e piazzamenti in una capability
prospettica, mantenendo gated la partenza A2. Materializzazione fisica,
consumer obbligatori e freeze dei risultati casuali richiedono il proprio
incremento verificato nello stesso registro transazionale.

Le tre quantità57 restano **null/unverified**, secondo la decisione
esplicita del proprietario. Originale156 rimane **statico/gated**;
#33/#89/#65/#57 restano aperte. Nessuna partita originale è stata avviata,
ripresa o modificata; nessuna prova su telefoni fisici, Windows o Safari
è dichiarata da questa ricerca.
