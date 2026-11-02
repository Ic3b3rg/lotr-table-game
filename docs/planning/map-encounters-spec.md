# Placement degli incontri — issue #51

Base `d735d170073a800757816561bd2c17263c11264e`; autorità:
[issue #51](https://github.com/Ic3b3rg/lotr-table-game/issues/51),
[contratto fonte](../research/first-adventure-map-generator-contract.md),
A3c93:0e3b–1998 e helper owning citati lì. Specifica prima del codice.
L'utente autorizza esecuzione autonoma, senza gate di conferma intermedi.

## Obiettivo e API

`placeMapEncounters(input: unknown)` in `src/map-encounters/encounters.ts` e
`node dist/map-encounters.mjs --input file --output nuovo-file` riproducono una
singola attempt fino ad assegnazioni, ordine di spawn e storia, prima di
istanziare/eseguire prefab. Formato v1, `source-map-encounters-v1`: input
`assembly` grezzo validato/ricalcolato e `placement` versionato con provenienza,
modelli ordinati, NodeType, Required/ExcludedTraits, SpecificTile come identità
TileModel, indice, riferimenti Prefab.Path/resource key/GameObject, parametri
TileEncounters/SectionEncounters/RandomFillPercent, AdventureEncounters e
SpecifiedEncounterGroup. Nessun risultato geometrico fornito è accettato.

Metadati placement e selection devono concordare su identità, indici, fonti,
elenchi fixed/adventure e hash comuni. I dizionari all/owned derivano dai
prodotti nell'ordine originale. Non dedurre effetti da ID, titoli o traits.
ID nuovi completi int32; nessun restringimento int16 della history.

Output immutabile `encounter-placement-only`; solo `encounters-complete` ha
checkpoint `after-encounter-history-before-prefab-execution`. Include input e
placement fingerprints, politiche numeriche/clock esplicite, sommario assembly,
caselle fonte, allSpaces prima/dopo shuffle, assegnazioni con origine/model/
prefab/NodePosition, sequenza placement distinta da spawn, gruppo e storia
entrante/risultante, stato search/trace/RNG, closure pendente per i selezionati.
L'assembly debug completo non è un payload di salvataggio: questo incremento
non crea freeze, sessione, backup o receipt. Un fallimento upstream conserva
separatamente il suo diagnostico completo; non raggiunge il checkpoint.

## Comportamento fonte

1. allSpaces: builder 0..3, tiles insertion, spaces source. Shuffle ascending
   full-range una volta, con il SourceRandom proseguito dalla geometria.
2. Fixed: ordine sezione/array; duplicato globale, lookup all-model, tile HashId
   numerico nella sezione, indice specificato oppure draw anche singleton,
   spazio vuoto. Nessun filtro traits/language/history improprio.
3. Required section: clear history/sequence/trie per array non nullo, completamento
   locale; candidati in ordine, skip globalmente presenti/invalidi/missing lookup;
   scansione locale tile/space. SpecificTile prevale sui traits. Threat2 usa
   Comparison sort per vicini Threat2 sul grafo **fonte** e draw nel prefisso minimo.
   Fallimento: trie, pop/clear tramite tile ID/space, RNG avanzato; history vuota
   dà InvalidParameters=2. Nessuna scelta di una nuova casella per ID vietato.
4. Adventure: clear anche array vuoto (null salta); prima scansione nonpresente/
   noninvalida, first-fit su allSpaces. Successo o rollback conclude l'iterazione;
   non tentare un secondo modello nello stesso passo dopo il primo fallimento.
5. Gruppi: free count e traits filter su TUTTI required/optional, owned order,
   shuffle e Comparison sort `(campaignUsed, isRepeatable)`. Specified salta
   filtro/shuffle/sort, conserva il solo capacity guard. Provare in ordine.
   Required/optional mescolati separatamente; helper azzera history/sequence ma
   conserva il trie. Optional fallita pulisce ogni occorrenza di required IDs.
   Nessun rewind; nessun candidato valido dà InvalidParameters=2.
6. Item: primo fit del pool trattenuto, massimo uno, niente draw aggiuntivo o
   duplicate guard assente nella fonte. Normal: stesso array trattenuto per
   sezioni 0..3, soglia float32 percent×spaceCount, conteggio inclusivo, best
   effort. Clear una volta, nessun append a history/sequence, refill o FSM.
7. Spawn pianificato in allSpaces order: lookup owned, addUnique used encounter
   IDs anche repeatable, poi addUnique gruppo. Conservare progressi diagnostici
   su failure/unchecked exception; nessuna esecuzione dei prefab.

## Errori, limiti e stile

Input bounded 64 MiB, schema rigoroso/array limitati, provenienza esplicita,
output esclusivo `map-io`. Exit 0 successo, 2 source-failure/
source-operation-exception/administrative-stop con checkpoint nullo, 1 input/I/O
senza nuovo risultato. Budget `encounter-operations-v1`, trace e clock del port
bounded, nominati; nessun Timeout Unity inventato. Clock logico, monotono o
replay con contesto/cursore/RNG validati. Float/Transform/JIT: not-certified.

TypeScript strict, funzioni/classi piccole per responsabilità; riuso di
SourceRandom, comparisonSort e file I/O esistenti senza cambiare map-assembly.
Esempio consumer: `const result = placeMapEncounters(rawInput);` seguito dal
controllo `result.status === 'encounters-complete'`. Nessuna dipendenza nuova.

## Verifica e confini

TDD Node (`tests/map-encounters*.test.mjs`, fixture inventate): CLI e libreria,
shuffle/RNG, sei fixed equivalenti, duplicate/occupancy/lookup/indice, traits e
SpecificTile identity, Threat tie/min prefix, section/adventure rollback,
first-model failure, gruppi con sort oltre insertion threshold, cleanup e trie
persistente, specified, item/max-one, fill frazionario/inclusivo/esaurimento,
spawn/history, input invalidi, immutabilità, budget/clock/replay ed errori.

Matrice privata CLI sui 47 input geometrici, H3/seed1 aggiornato del root;
checker separato delle decisioni/RNG/compatibilità/history. Verifica solo refs
e metadata dei prefab effettivamente selezionati; lista privata selected302A e
closure FSM/templates/localization/effects ancora pendente per #38. Pubblico
solo codice, fixture inventate, documentazione tecnica, conteggi e hash.

Comandi finali: `npm test`, `npm run typecheck`, `npm run format:check`,
`git diff --check`. Report riproducibile in `docs/testing/` e scratch ignorata.
Mai Unity, dati originali modificati, browser/sessione root, installazioni,
altri checkout/subagenti o scritture GitHub. Review Standards/Spec al root;
#41/#38/#33 restano aperte. Nessun dato indispensabile attualmente mancante.
