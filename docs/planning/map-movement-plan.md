# Piano di implementazione #50

Specifica: [map-movement-spec.md](map-movement-spec.md). Metodo: implementazione
inline nel checkout assegnato, senza subagenti né conferme di routine, come
richiesto. Nessuna scrittura GitHub; review indipendenti al root.

## Task 1: validazione authoring

Files: `src/map-assembly/model.ts`, nuovi test/fixture movimento.
Interfaccia consumata: `parseAssemblyInput(value: unknown)` esistente; nessuna
modifica del formato input. Dopo range/duplicati/self-link, richiedere ogni
riferimento inverso. Prima test CLI e libreria per asimmetria, riferimento fuori
range, indice negativo/non intero, autoarco e duplicato. Atteso RED per
asimmetria, GREEN dopo la validazione; errori senza output/file modificato.
Verifica: build e `node --test tests/map-movement.test.mjs tests/map-assembly.test.mjs`.
Commit locale della slice verificata.

## Task 2: derivazione e API/CLI

Files: nuovo `src/map-assembly/movement.ts`, minima integrazione
`src/map-assembly/assembly.ts`, test/fixture dedicati.
Interfaccia prodotta: `movementGraph` della specifica, soltanto per successo.
Helper interno `calculateMovementGraph(world, sourceGraph, geometryFingerprint)`
usa dati validati e già realizzati; nessuna callback RNG/clock. Dopo
`clock.finish()`, costruire vicini nuovi da authoring e contatti consentiti,
deduplicare archi con tutte le prove, ordinare e calcolare componenti.

Prima test RED su authoring senza Edge e assenza di movimento per sola
vicinanza, quindi GREEN. Estendere in TDD giunzioni, bordi/passaggi/rive,
provenienza, dedup, componenti/isolamenti, selezionate rispetto al catalogo,
freeze/nessuna mutazione, source-failure/exception e stop dopo grafo. Verificare
replay identico e confronto col bundle baseline salvato in scratch.
Verifica focalizzata come Task 1, poi typecheck. Commit locale verificato.

## Task 3: matrice indipendente e consegna

Files: documentazione tecnica e riepilogo conteggi/hash dedicati; checker e
output privati in `.scratch/movement/`.
Eseguire CLI reale sui 47 input, modello indipendente da TS/flag del risultato,
checker geometrico root e confronto integrale di ogni campo precedente col
bundle della base (escluso solo `movementGraph`). Conservare selettivamente H3,
replay e riepiloghi, senza copiare la directory privata da 4 GiB.
Atteso H3: 22 caselle, 43 archi, una componente. Riportare eventuali altre
mappe disconnesse. Report con comandi, input/bundle/checker/evidenza SHA-256,
TDD osservato e limiti. Eseguire `npm test`, `npm run typecheck`,
`npm run format:check`, `git diff --check`, ispezionare diff e lasciare commit
locali ordinati e checkout pulito. Root esegue review Standards/Spec e merge.

## Review Focus / preflight

- Task 1 produce input reciproco consumato dal Task 2: range e identità prima
  della ricerca, nessuna riparazione e nessuna nuova informazione fonte.
- Task 2 produce output consumato dal Task 3: usare soltanto nuove proprietà;
  nessuna modifica del significato di `graph` o di `spaces[].connected`.
- Test obbligatori: casella vicina senza authoring anche con Edge fonte;
  contatto compatibile ma non attraversabile; doppia giunzione; casella isolata;
  clock-stop dopo grafo che deve comunque avere movimento nullo.
- Conservare e verificare le prove di ogni arco; il checker privato ricostruisce
  i contatti dalle pose, invece di riusare `traversable` come autorità.

## Esito

Task 1–3 completati: specifica/piano `2b02b2c`, validazione `f2b3262`,
API/CLI `639f662`; 29 test dedicati e 222/222 completi. Matrice privata 47/47,
confronti fonte integrali identici, H3 22 caselle/43 archi/una componente,
replay esatto e stop finale con movimento nullo. Report e limiti in
[map-movement-verification.md](../testing/map-movement-verification.md).
Review Standards/Spec fresche e operazioni GitHub restano al root.
