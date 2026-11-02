# Verifica adiacenze di movimento — issue #50

Base `d735d170073a800757816561bd2c17263c11264e`, 2 novembre 2026.
[Specifica](../planning/map-movement-spec.md), [piano](../planning/map-movement-plan.md),
[autorità del movimento](../research/map-movement-contract.md).
Specifica/piano committati prima del codice (`2b02b2c`), validazione authoring
in `f2b3262`, derivazione/API/CLI in `639f662`.

## API e semantica

```sh
npm run build
node dist/map-assembly.mjs --input input.json --output nuovo-output.json
```

```js
import { assembleMap } from './dist/map-assembly-library.mjs';
const result = assembleMap(rawInput);
if (result.status === 'geometry-complete') {
  const movement = result.movementGraph;
  // Adiacenze fisiche e componenti; runtimeReady rimane false.
  console.log(movement.connectionCount, movement.wholeMapReachable);
}
```

Input e opzioni CLI restano quelli dell'assemblatore v1; esempio inventato in
`tests/fixtures/map-movement.mjs`. L'estensione aggiunge soltanto
`movementGraph`. I campi preesistenti conservano formato e significato:
`graph` e `spaces[].connected` sono il grafo fonte degli incontri.
Il tipo `AssemblyResult` discrimina movimento non nullo sul successo e nullo
su ogni failure/stop. Il modello rifiuta link authoring non reciproci prima
di selezione/RNG/ricerca, oltre ai controlli esistenti su riferimenti, range,
indici, duplicati e autoarchi. Nessuna riparazione dei cataloghi.

`movementGraph` dichiara formato 1, algoritmo
`authoring-and-traversable-contacts-v1` e provenienza
`{ sourceVersion, geometryFingerprint }`. Le caselle hanno identità
source-qualified e vicini propri. Gli archi derivano esclusivamente da:

- `intra-tile-authoring`: link reciproco `serializedConnectedSpaces` di una
  tessera effettivamente realizzata, con tileSource, spaceIndices e spaceSources;
- `inter-tile-contact`: un `contactIndex` nel risultato finale che identifica
  entrambi i bordi/endpoints, consentiti e attraversabili. Si conserva ogni
  contatto giustificante, anche quando più contatti deduplicano nello stesso arco.

Un Edge intratessera o la sola vicinanza cubica non sostituiscono l'authoring.
`CanMatch` non implica attraversabilità; trait700 può essere compatibile senza
consentire movimento, 100/200 bloccano, 300/400 richiedono la controparte,
600 verso0 richiede passaggio aperto, secondo i predicati fonte già verificati.
I contatti finali dell'assemblatore sono la sola fonte delle giunzioni del nuovo
adattatore; il checker indipendente ne ricostruisce separatamente l'idoneità.

Caselle in ordine fonte, endpoint di ogni arco `a < b`, archi ordinati per
`(a,b)` e vicini lessicografici, senza locale dipendente dal sistema.
Componenti BFS con radici in ordine caselle e vicini nell'ordine dichiarato.
`connectionCount` conta archi reciproci unici. Una casella isolata resta una
componente singola. La disconnessione lascia `geometry-complete` fonte intatto,
con `wholeMapReachable: false`; `runtimeReady: false` vale anche per i grafi
connessi, perché questo incremento rimane `geometry-only` e senza consumer.

La derivazione avviene dopo `clock.finish()`, senza RNG, polling, tick o trace.
Gli array del grafo fonte e del chiamante non vengono modificati; il nuovo grafo
è congelato in profondità insieme al risultato. Stop/failure espongono
`movementGraph: null`, anche quando il grafo fonte è stato già completato.
Exit CLI invariati:0 geometria completa,2 diagnostico fonte/amministrativo,
1 input/I/O rifiutato senza pubblicare un risultato. File di input intatto e
output esclusivo seguono l'implementazione esistente.

## TDD e verifiche pubbliche

29 nuovi test dedicati, più tutti i precedenti conservati:

- Asimmetria authoring: RED osservato (`Missing expected exception`), poi GREEN;
  sette altri casi negativi confermano range, interi, self-link, duplicati e
  riferimenti. CLI e libreria rifiutano senza riparare/modificare il chiamante.
- Undici test inizialmente RED per movimento assente: authoring senza Edge,
  vicinanza con Edge fonte senza authoring, CLI/libreria, dedup/provenienza,
  componenti/isolate, freeze e assenza di movimento su ogni stop/failure.
- Bordi compatibili ma bloccati: mutazione deliberata del filtro da
  `traversable` a `compatible` fa fallire il test delle prove. Ripristino GREEN.
  Il caso sintetico completo ha 31 contatti non attraversabili esclusi e 11
  contatti attraversabili conservati. Passaggi aperti e rive complementari sono
  verificati anche attraverso CLI; blocchi/passaggio chiuso/rive non appaiate
  impediscono l'assemblaggio e non pubblicano movimento valido.
- Esclusione di tessere del catalogo non selezionate, replay ripetibile,
  40.442 osservazioni e 132 campioni sintetici invariati. Un digest sintetico
  registrato prima del codice controlla tutti i campi preesistenti del risultato.
  Il confronto CLI/libreria applica la normale serializzazione JSON, che
  converte il valore numerico `-0` in `0` anche nella baseline.

Log privati: `.scratch/movement/validation-red.log`, `validation-green.log`,
`derivation-red.log`, `blocked-mutant-red.log`, `focused-green.log`,
`final-tests.log`. Focalizzati **71/71** (29 movimento + 42 assemblatore).
Baseline ripetuta **193/193**. Verifica finale:

```sh
npm test
npm run typecheck
npm run format:check
git diff --check
```

**222/222** test passati, zero fallimenti/skipped; build, tipi, formato e diff
con exit0. Nessuna dipendenza/installazione; riusato tramite symlink il
node_modules già presente nel project root. Nessuna modifica a build script,
map-encounters, host, schema o UI.

## Matrice privata e modello indipendente

Evidenza pubblica di soli conteggi/hash:
[map-movement-private-evidence.json](map-movement-private-evidence.json).
Originali, pacchetti geometrici, pose, immagini e risultati completi rimangono
nella `.scratch/` ignorata. Le fonti private sono state lette senza modifiche;
non sono stati importati audit che eseguono scansioni globali.

`.scratch/movement/verify-matrix.py` esegue sia il bundle CLI catturato dalla
base prima del codice, sia la nuova CLI, sugli stessi **47 input**. Per H3/seed1
usa l'input aggiornato del root in `.scratch/assembly-root-review/`; gli altri
sono letti dalla matrice `t3-ac307d2c/.scratch/assembly/verified-v2/`, senza
copiarne la directory. Conserva solo riepiloghi e l'output H3; i due output
intermedi di ogni altro caso vengono eliminati dopo la verifica.

Il checker Python non importa TS/dist. Ricostruisce i link authoring di tutti
**45 prefab / 83 archi authoring** del catalogo, reciprocità/range/self-link e
unicità. Per le forme realizzate ricostruisce occupancy, contatti, direzioni
intrinseche composite, bordi, IsConnection e coppie consentite, senza assumere
corretti i flag `contacts`. Verifica endpoint/fonti e prove di ogni arco,
vicini, dedup e ordine, componenti BFS e intero `movementGraph` atteso.
Il checker geometrico root aggiornato verifica separatamente layout, cache,
candidati, grafo fonte e RNG. Ogni campo preesistente dell'intero risultato
CLI deve inoltre essere esattamente uguale alla baseline, incluse selezione,
pose, candidati, `spaces[].connected`, grafo, trace, clock, input e fingerprint.

Esito: **47/47** geometrie complete, **47/47** movimento connesso,
**47/47** confronti integrali fonte identici. Nessun isolamento nella matrice;
quelli sintetici restano preservati. Tutti i casi passano entrambi i checker.
Compagnie H1..5, sette seed incluso int32 minimo/massimo, sette casi H3 con
compagnia alternativa e cinque retry a seed2 con pool trattenuti sono quelli
della matrice precedente, senza nuovi default o retry inventati.

Comandi privati dal checkout assegnato:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 .scratch/movement/verify-matrix.py --h3-only
PYTHONDONTWRITEBYTECODE=1 python3 .scratch/movement/verify-matrix.py
PYTHONDONTWRITEBYTECODE=1 python3 .scratch/movement/verify-replay.py
```

Il terzo comando usa l'output H3 del primo e verifica replay e stop finale.
Gli script sono conservati privatamente nel checkout; contengono i percorsi
espliciti delle fonti read-only e non richiedono estrazioni o installazioni.
La CLI continua a richiedere un output nuovo: prima di ripetere il terzo script,
spostare i precedenti `H3-replay.output.json` e `H3-boundary-stop.output.json`
in una sottodirectory della stessa scratch.

## H3/seed1 e replay

H3 conserva 10 tessere, 89 esagoni e 22 caselle. Il nuovo grafo ha **43 archi**:
15 authoring + 28 tra tessere, supportati da 57 contatti attraversabili, con
**una componente di 22 caselle**. Il grafo fonte mantiene 28 archi e componenti
**[3,18,1]**; source-check e status non vengono reinterpretati.
RNG continua da 279 a **292** campioni, clock **91.998** osservazioni.

`.scratch/movement/H3-seed1.output.json` è l'output concreto della matrice.
Il replay produce `.scratch/movement/H3-replay.output.json`: movimento e campi
realizzati/search/trace/RNG coincidono col caso logico; ogni campo preesistente
coincide col replay della baseline. Due replay hanno byte identici. Il probe
`.scratch/movement/H3-boundary-stop.output.json` porta a timeout amministrativo
soltanto l'ultima osservazione, dopo il grafo fonte: stop, checkpoint nullo e
movimento nullo, con grafo fonte e RNG conservati. Non è un Timeout=1 Unity.

SHA-256 principali (gli altri sono nel riepilogo JSON):

- Checker movimento: `fe7f33830d470163d6641a2f7b0fd9bf519e1cd80454486bf0bdb71a43d85f04`.
- Evidenza 47 casi: `1faa032eac49f30e337d3044b36829c17da750e3c134f2a5841c4dbebf6e5712`.
- Evidenza replay/stop: `00f32ec4d8a424ff13cbdd920779d45e633a091cd20ca449a90bc40ae5de8ea3`.
- Output H3: `a17c4f395c710c03d7ab525db35c629d8e8412396a017c321bf01943b46d1b0a`.
- CLI verificata: `aac9235c9d3eb8227a9164260e9801e978aa7aedc43ed6e613d4d8df4e67638f`.

## Limiti e handoff

Questo è un adattatore del contratto movimento documentato, non un'esecuzione
Unity né un audit di ogni possibile writer runtime originale. Connettività non
certifica l'avventura giocabile. Budget/clock adattati e float32 portabili non
certificano Unity/JIT. Muri/corsi d'acqua della mappa di battaglia, effetti,
eroi/nemici, proiezione runtime, incontri, FSM, host/sessione/UI restano fuori.
#41/#38/#33 restano aperte.

Il controllo dell'autore su contratto/diff è distinto dalle review fresche
Standards/Spec richieste al root. Nessun subagente, altro checkout, push, PR,
commento, aggiornamento o chiusura GitHub. Nessun avvio Unity o accesso a
salvataggi originali, browser/host attivo root o dati di sessione.

## Integrazione root

Le [review Standards e Spec](../reviews/2026-11-02-map-movement.md) sono
concluse senza rilievi su entrambi gli assi. Il root ha ripetuto la suite
completa (**222/222**, zero skipped), typecheck, format e diff check.
Ripetuti inoltre **47/47** casi, entrambi i checker e tutti i confronti
fonte/baseline: impronta della matrice identica a quella riportata sopra.
Il replay H3 e lo stop finale sono stati ripetuti nel checkout root,
con 91.998 osservazioni e byte identici tra le due esecuzioni del replay.
Log e output root: `.scratch/movement-root-review/`; il bundle baseline
catturato prima della build ha SHA-256
`01acdcf1820bbe10e6adae8b180ed921f64500cc5e95f645484799d68a3564a6`,
uguale alla baseline privata del child.
