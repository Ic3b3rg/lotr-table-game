# Selezione delle quattro sezioni — issue #46

Stato: specifica eseguibile dell'incremento, 2 novembre 2026. Autorità:
[issue #46](https://github.com/Ic3b3rg/lotr-table-game/issues/46) e
[contratto delle fonti](../research/first-adventure-map-generator-contract.md).
Base obbligatoria: `e66317daec43ab5a61fc13899268aae9f12b66f3`.

## Confine

Una singola attempt di CreateMap, dalla preparazione dei pool fino a
CoroutineBuildMap `06003c93:062d`, prima di calcolare qualsiasi bordo locale.
Output `scope: selection-only`; nessuna geometria, assegnazione incontri,
startup o A1 giocabile. Host, sessione, UI, schema persistito e RNG dei mazzi
non consumano questa libreria. #41, #38 e #33 restano aperte.

## Contratto del pacchetto v1

JSON tecnico esplicito, massimo 8 MiB. `formatVersion: 1`,
`algorithm: source-selection-v1`, provenienza con versione e SHA-256 dei file
fonte. Ogni oggetto ha un riferimento `file:pathID`; tutti i file citati devono
essere dichiarati. Gli array hanno indici contigui verificati, mai riordinati
dal validatore. Esattamente 120 prefab standard e quattro sezioni, bucket custom
separato. Identità prefab e modello, codice, HashId int32, opposite HashId,
set e caselle/tratti mantengono i valori originali. Ownership deriva dai codici
dei prodotti esplicitamente posseduti; vale anche per il prefab custom.

Prodotti, incontri, gruppi, oggetti/upgrade e riferimenti fissi sono normalizzati
in metadati, senza contenuti narrativi. Nessun riferimento/indice mancante viene
scartato. Il contesto comprende adventure ID, seed int32, H=1..5, lingua,
prodotti posseduti ordinati, oggetti di gruppo e per ciascun eroe, ID usati e
catene sbloccate. Lo stato entrante contiene i due pool trattenuti ordinati
(anche duplicati) e percentNormal float32. Non imporre [0,1]: la fonte confronta
`draw < percentNormal`, dimezza per normal, raddoppia per chain
(`06001319:048b–04cb`). Infinity prodotta da float32 è rappresentata con stringa
esplicita; NaN non è un input ammesso dalla politica del port.

API piccola: `selectMapTiles(input: unknown): SelectionResult`; valida/clona
prima di lavorare, non muta l'input. Il risultato include fingerprint SHA-256
del JSON normalizzato completo, input normalizzato, identità/politiche, pool
filtrati e mescolati, ordine standard realizzato, extras, selezioni ordinate,
totali cached, flags per bucket, sequenza/trie/history, trace e snapshot RNG.
La CLI aggiunge l'impronta dei byte del file e richiede
`node dist/map-selection.mjs --input file --output nuovo-file`.
Pubblica un file completo con hard link esclusivo; mai sovrascrivere.

## Comportamento fonte

1. Filtri lingua prima di tutto; normal con traits/history/repeatability e
   rimozione dei riferimenti fissi solo dalla lista normal; chain con unlock e
   history; item con capacità (occorrenze esatte nel gruppo + un conteggio per
   eroe che contiene l'ID), esclusione separata gruppo e upgrade ricorsivi.
   Un null raggiunto nel loop item è un errore dell'operazione fonte.
2. Un solo SourceRandom: shuffle standard completo, copia dei quattro builder
   mescolata una volta se H>1 e distribuzione ciclica di `(H−1)*2` extras saltando
   ignore-scaling; shuffle normal, chain, item trattenuti; merge nel random
   trattenuto con percentNormal persistente. Shuffle singleton consuma un sample.
3. IDs e tutte le sezioni inizializzate, tutti gli start, poi tutti i required.
   ReservedTile ignora IsStandard; auto lookup custom oscura standard anche se
   usato. Remove/return tocca solo la faccia richiesta. Explicit seeding salta
   CanUseTile. Successo fonte su tessera non posseduta conserva flag/trace ma
   non aggiunge una tessera alla sezione.
4. Trait, minimum, optional in ordine fonte. Scansioni generiche da indice zero
   dello standard mescolato, senza draw; reservations, seeded/opposite, set
   e max+extra. Matching uno-a-uno delle caselle separato dall'euristica a conteggi
   in ordine requisiti. AvailableTiles e totali cached rispettano add/remove.
5. Trait/minimum usano sequence/history e trie ordinato di prefissi. AddSequence
   cancella i figli finali; Count conta i discendenti. Fallimento senza history:
   fonte InvalidParameters=2; altrimenti rollback al builder rimosso, RNG avanzato.
   Pulire trie/sequence/history dopo ciascuna fase. Optional: draw float32 >
   RelativeSizeFactor termina; altrimenti tentare una tessera, nessun rollback.

## Fallimenti e limiti

Risultati discriminati `selected`, `source-failure`, `administrative-stop` o
`port-policy-failure`; soltanto selected raggiunge il checkpoint. Errori input
non pubblicano output. I risultati falliti sono diagnostici espliciti, mai mappe
valide. Budget di operazioni esplicito nel pacchetto, policy
`selection-operations-v1`: conta scansioni, iterazioni e matching; esaurirlo
non equivale a Timeout=1 Unity. Nessun timeout wall-clock o retry automatico.
Le decisioni temporali geometriche sono oltre il confine. Politica numerica
`float32-per-operation-v1`; nessuna certificazione di parità Unity/JIT.

## Evidenza richiesta

Test process-CLI sintetici: filtri/capacità/upgrade/retry, ordine e checkpoint,
scaling H3 [2,1,1], matching, identità/shadow, phantom, opposite, rollback reale,
trie/pulizia, fallimenti/budget, replay, immutabilità e pubblicazione esclusiva.
Controlli privati A1 italiano/base per H1..5 e seed signed documentati, con
compagnia esplicita, K calcolato dai modelli, checkpoint
`120+(H>1?4:0)+135+K`, quattro sezioni/traits/capacità/ownership/flags.
Pubblicare solo report tecnici e impronte, nessun input originale o selezione.
Verifica finale: npm test, typecheck, format:check, git diff --check.
Le review indipendenti Standards/Spec e l'integrazione restano al root.
