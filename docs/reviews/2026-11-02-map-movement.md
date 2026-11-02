# Revisione delle adiacenze di movimento

Issue #50; base `d735d17`, head revisionato `972784c`.
Due revisori freschi hanno valutato Standards e Spec separatamente.

## Standards

Nessuna violazione documentata o smell di baseline azionabile.
Il modulo mantiene la derivazione del movimento separata dal grafo fonte,
con provenienza tipizzata e senza chiamate a RNG, clock o osservazioni.
L'integrazione resta in assembly.ts e la reciprocità viene validata insieme
agli altri riferimenti authoring. L'evidenza pubblica contiene soltanto
conteggi, stati e hash, senza coordinate o layout originali. Vocabolario,
istruzioni del repository e ADR rispettati. Esclusi dalla review i controlli
già applicati dagli strumenti e il disegno preesistente del generatore.

## Spec

Nessun difetto sostanziato. Movimento da authoring intratessera reciproco
e contatti consentiti/attraversabili delle sole tessere realizzate;
validazione prima della selezione, ordine/BFS, provenienza, deduplica,
freeze e movimento nullo sui fallimenti corrispondono alla specifica.
Nessuna modifica al grafo fonte, RNG, clock, geometria o stato di ricerca;
nessuna estensione a host/UI/schema.

Il revisore ha eseguito **29/29** test del movimento e confrontato gli hash
del checker privato, della matrice, del replay e del bundle con l'evidenza
pubblicata. Non ha ripetuto la matrice completa; la verifica root è distinta.
Integrazione runtime e parità Unity/JIT rimangono fuori dal confine.

## Verifica root

**222/222** test completi, zero skipped, tipi/formato/diff con exit0.
Ripetuti **47/47** casi con entrambi i checker privati e confronto completo
dei campi fonte contro il bundle baseline, di impronta verificata uguale
a quello catturato dal child prima del codice. Tutti i grafi di movimento
sono connessi e ogni campo preesistente rimane identico.
Impronta della matrice uguale a quella del child:
`1faa032eac49f30e337d3044b36829c17da750e3c134f2a5841c4dbebf6e5712`.
Evidenze root nella scratch ignorata `.scratch/movement-root-review/`.
Il replay H3 consuma **91.998** osservazioni e due esecuzioni producono
byte identici. Anche lo stop amministrativo all'ultima osservazione
mantiene il grafo fonte ma espone movimento nullo, come previsto.

Esito: Standards 0 rilievi; Spec 0 rilievi. #41/#38/#33 restano aperte.
