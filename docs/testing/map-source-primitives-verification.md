# Primitive del generatore: verifica

Issue #44, parte di #41; [specifica](../planning/map-source-primitives-spec.md)
e [contratto delle fonti](../research/first-adventure-map-generator-contract.md).
Il nuovo modulo non cambia host, UI, stato della sessione o mescolamento dei mazzi.

## Confine pubblico

`dist/map-primitives.mjs` espone `SourceRandom`, stato copiabile e validato,
`sourceShuffle`, `comparisonSort` e `FLOAT32_POLICY`. Undici prove importano
questa build reale. Il primo rosso è il modulo assente; il secondo sono le
funzioni shuffle/sort assenti; dopo l'implementazione passano valori, stato,
identità e tracce. Una regressione ulteriore rossa→verde ammette lo slot
Int32.MaxValue e verifica il decremento originale del campione massimo.

Coperti semi signed, overflow unchecked, intervalli vuoti/unitari e grandi,
numero dei campioni, ripresa JSON, assenza di alias, stato/argomenti invalidi,
limite sicuro del contatore prima di operazioni composte, singleton/null
shuffle, arrotondamento float32 a 1, estremi inversi, comparatori invalidi
ed eccezioni. Il sort verifica ordine delle identità e impronta di **ogni
confronto**: un risultato soltanto ordinato non basta.

La suite completa passa **102/102**, con tipi, formato e `git diff --check`.

## Oracolo e matrice privata

L'oracolo locale `.scratch/map-primitives/il_oracle.py` interpreta i corpi IL
selezionati delle assembly fissate dal contratto. Non carica Unity, Steam,
la sessione o salvataggi personali. Il suo set limitato di istruzioni
rifiuta opcode sconosciuti, verifica stack e accessi agli array e applica
int32 unchecked / int64 / double. Math.Abs e le chiamate di collezione sono
intrinseci espliciti; FloorLog2PlusOne viene eseguito dal suo corpo IL.

Fixture pubbliche inventate: sei semi con 149 campioni ciascuno, quattro
shuffle di taglia 0/1/4/120 e diciassette ordinamenti, per 1.334 confronti.
Taglie 0/1/2/3/4/16/17/32, chiavi uguali e alternate; una lista sintetica
di 64 elementi raggiunge naturalmente heapsort. Il comparatore asimmetrico
delle sezioni è verificato nei suoi due passaggi. Nessuna fixture contiene
carte, storia o geometria originale.

Oracolo SHA-256
`e5843524a4b7bac502cf57e435b865efd00c489a18e5259bf6424c4994ae4a0a`;
fixture pubblica SHA-256
`53ad58eea86fe2fdf9fc4695ad3dbda5f207f6a71936c8e991711abe7e5bacfc`.
Le tracce complete e gli input della matrice restano privati.

| Matrice aggiuntiva | Quantità | Esito |
| --- | ---: | --- |
| Sequenze Random | 64 / 8.192 chiamate / 9.536 campioni | Valori, bit e stato identici |
| Comparison sort | 210 liste / 31.408 confronti | Identità e sequenze identiche |
| Shuffle | 34 liste / 905 campioni | Ordine e stato identici |

Input normalizzati SHA-256
`e7705c45ed23f5bdd1be96b7897e30c617c398512d76291dc6b43eb222c54a76`;
risultati normalizzati SHA-256
`6ce68b930e368f9fa003c9c964fc738a93d9a75d20ea8f8d63fbc930e782baff`.

## Limiti

La corrispondenza riguarda le primitive IL selezionate e gli input provati.
`float32-per-operation-v1` esplicita conversione del campione e arrotondamento
di differenza, prodotto e somma; l'oracolo usa la stessa politica dichiarata.
Non certifica floating stack, JIT, Transform, clock o generatore Unity completo.
Il contatore dei campioni e il formato snapshot sono adattamenti di persistenza.

La nuova ricerca completa è stata verificata meccanicamente: 119 metodi
citati esistono, offset e link risolvono, impronte dei pacchetti privati e
conteggi coincidono, nessun corpo IL/FSM o testo narrativo completo pubblicato.
Le issue #41/#38/#33 restano aperte: mancano generazione delle quattro sezioni,
selezione/congelamento degli incontri e avventura eseguibile dalla UI.
