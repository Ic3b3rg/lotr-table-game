# Adiacenze di movimento — issue #50

Base `d735d170073a800757816561bd2c17263c11264e`, 2 novembre 2026.
Autorità: [issue #50](https://github.com/Ic3b3rg/lotr-table-game/issues/50),
[contratto movimento](../research/map-movement-contract.md) e
[contratto fonte](../research/first-adventure-map-generator-contract.md).
Specifica scritta prima del codice. Esecuzione autonoma autorizzata nel solo
checkout T3; review Standards/Spec e tutte le operazioni GitHub al root.

## Obiettivo e confine

Estendere `assembleMap(input: unknown)` e la CLI esistente
`node dist/map-assembly.mjs --input file --output nuovo-file` con un
`movementGraph` distinto. `graph` e `spaces[].connected` conservano esattamente
Reset + CalculateConnectedSpaces per gli incontri. Nessuna modifica a pose,
candidati, trace, selezione, RNG, osservazioni/cursori clock o stato di ricerca.
Nessun host, schema, UI, incontri, shuffle o dipendenza nuova.

Il movimento usa soltanto le tessere realizzate nelle quattro sezioni:

- Link `serializedConnectedSpaces` intratessera reciproci, indipendentemente
  dalla presenza di Edge interno. Prossimità cubica senza link authoring non
  aggiunge adiacenza, anche quando il grafo fonte contiene quell'arco.
- Contatti tra tessere finali con `traversable && allowed`, secondo i predicati
  IsConnection e CanSectionsConnect già verificati. CanMatch da solo non basta;
  bordi bloccati, rive e passaggi mantengono la semantica fonte.

La validazione dell'input precede selezione, RNG e ricerca: tutti i prefab del
catalogo devono avere link interi nel proprio range, unici, senza autoarchi e
reciproci. Un link asimmetrico è input invalido, non viene completato o corretto.
I riferimenti source-qualified restano quelli controllati dal modello esistente.

## Interfaccia e ordine

Solo un risultato `geometry-complete` espone un `movementGraph` non nullo.
Ogni failure/stop conserva `movementGraph: null`, anche dopo il calcolo del
grafo fonte. Non si cambia lo status del generatore per la disconnessione.

Il nuovo oggetto dichiara `formatVersion: 1`,
`algorithm: authoring-and-traversable-contacts-v1`, provenienza con
`sourceVersion` e `geometryFingerprint`, `runtimeReady: false`,
`spaces`, `edges`, `components`, `wholeMapReachable` e `connectionCount`.
`runtimeReady` resta falso anche con una sola componente: l'output è
`geometry-only`, senza consumer runtime. Nessun arco ripara isolamenti.

Le caselle hanno `id`, `source`, `tileSource`, `sectionId`, `index` e una nuova
lista `connected`; ordine identico alle caselle fonte. Ogni arco unico ha
endpoint `a < b` in ordine lessicografico e `provenance`: oppure un riferimento
`kind: intra-tile-authoring` con tileSource, indici e fonti delle due caselle,
oppure uno o più `kind: inter-tile-contact` con `contactIndex` nella lista
`contacts` del risultato. La provenienza authoring ordina gli indici numerici;
i contatti seguono l'ordine fonte. Gli archi sono ordinati per `(a,b)`, i vicini
lessicograficamente; le componenti usano visita in ampiezza, radici in ordine
caselle e vicini nell'ordine dichiarato. Doppie giunzioni producono un arco con
più prove, senza duplicati nei vicini. Tutti gli oggetti sono congelati in
profondità con il risultato e non condividono array mutabili col chiamante.

La derivazione è pura e successiva a `clock.finish()`: non consulta RNG,
clock o callback di osservazione. `movement.ts` resta separato da `graph.ts`;
integrazione minima in `assembly.ts`, reciprocità in `model.ts`.

## Accettazione e verifica

Fixture inventate e test `node:test` dedicati in `tests/map-movement.test.mjs`
e `tests/fixtures/map-movement.mjs`. TDD CLI/libreria: authoring senza Edge,
prossimità senza authoring, giunzioni tra tessere, blocchi/rive/passaggi,
contatti multipli deduplicati con provenienza, riferimenti/indici/duplicati/
autoarchi/asimmetria, componenti e casella isolata, sole tessere realizzate,
immutabilità e input non modificato, stop/failure anche alla boundary finale.
Replay logico e confronto baseline verificano assenza di draw/osservazioni
aggiunte e identità dei campi fonte. Nessun test esistente indebolito.

Verifica privata con CLI reale su tutti i 47 input già auditati: checker Python
indipendente ricostruisce adiacenze da authoring, pose e bordi, senza fidarsi
dei flag `contacts`. Verifica reciprocità, riferimenti, prove, dedup, ordine,
componenti e uguaglianza completa dei campi preesistenti col bundle della base;
usa inoltre il checker geometrico root aggiornato, senza audit globali.
H3/seed1 deve avere 22 caselle, 43 archi e una componente; ogni altro isolamento
va riportato senza riparazione. Originali/JSON/layout restano in `.scratch/`
ignorata; documentazione pubblica solo tecnica, conteggi e hash.

Comandi finali: `npm test`, `npm run typecheck`, `npm run format:check`,
`git diff --check`. Stile TypeScript strict e Prettier esistenti, funzioni
piccole e contratti espliciti; nessuna modifica a `scripts/build.mjs` o
map-encounters. Report riproducibile in `docs/testing/map-movement-verification.md`.
I clock/budget/float del port non certificano Unity/JIT. #41/#38/#33 restano aperte.
