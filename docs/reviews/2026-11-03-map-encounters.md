# Revisione della collocazione degli incontri

Issue #51; base root `1e2fa93`, head revisionato `c74551a`.
Il child partiva da `d735d17`; il root integra anche il movimento #50.
Due revisori freschi hanno valutato Standards e Spec separatamente.

## Standards

Zero violazioni documentate. Moduli con responsabilità distinte, riuso di
SourceRandom, comparisonSort e map-io, nessuna modifica a map-assembly o
nuova dipendenza. Nessun conflitto con vocabolario, ADR o confine privato.

Un suggerimento facoltativo: condividere il wrapper CLI e gli helper di
fingerprint/deep-freeze con l'assemblatore, per evitare divergenze future.
È una possibile duplicazione, non una violazione. Estrazione rinviata:
l'incremento mantiene il confine esplicito dell'assemblatore già integrato.

## Spec

Un difetto P2: l'elenco dei gruppi posseduti concatenava i riferimenti dei
prodotti senza deduplicarli. `UserCollectionManager A10f6:041f–0433` usa
AddUniqueItem, preservando la prima occorrenza. La ripetizione di un gruppo
produceva due candidati/draw invece di uno e alterava il RNG successivo.

Corretto prima dei filtri/shuffle con unicità per riferimento fonte e ordine
di prima occorrenza. Due regressioni osservate rosse prima della correzione,
poi verdi: ripetizione nello stesso prodotto e tra due prodotti posseduti.
Candidati, trace e RNG coincidono ora con il corrispondente elenco univoco.
Il checker Python privato verifica la stessa regola separatamente.

Nessun altro difetto confermato nell'audit di ordine, lookup, rollback,
trie, gruppi, fill, spawn, errori e replay. Il revisore ha confrontato la
coroutine e gli helper owning, senza modificare file o eseguire il checker.
La correzione appartiene all'unico passaggio dell'autore dopo la review;
nessuna seconda certificazione delegata.

## Verifica root e limiti

Baseline combinata: **273/273** test; dopo le due regressioni **275/275**,
zero skipped. Typecheck, format e diff check con exit0. La matrice privata
iniziale del root ha riprodotto **47/47** output byte per byte, con 666
assegnazioni, 7.748 decisioni, 2.683 draw, 94 rollback e 40 scelte Threat.
Ripetuta dopo la correzione con il checker aggiornato: stessi 47 output
byte-identici, impronta riepilogo root
`3ae7bc1e7b724722e0bc392a187e2f72beb06e7dfa8dfb012c0b9beed60f958a`.
Replay H3 incontri: **462** osservazioni consumate esattamente, RNG348,
15 assegnazioni, tutti i campi realizzati/diagnostici identici al caso
logico; due esecuzioni del replay producono gli stessi byte.
Evidenze e log del root in `.scratch/encounters-root-review/`.

La verifica riguarda la collocazione, non l'esecuzione dei prefab. I due
nodi realizzati sulla tessera iniziale e le loro dipendenze restano privati
e richiedono closure prima dello startup. Freeze, sessione, backup e UI
sono il prossimo incremento; #41/#38/#33 restano aperte. Clock/float/JIT
Unity non sono certificati.

Esito: Standards 0 violazioni / 1 suggerimento facoltativo rinviato;
Spec 1 difetto P2 corretto con due regressioni rosso→verde.
