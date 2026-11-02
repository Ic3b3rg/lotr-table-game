# Verifica assemblaggio geometrico — issue #48

Base `2006ca26bfab9e251e8c4fd1b5ead27603660038`, 2 novembre 2026.
[Specifica](../planning/map-assembly-spec.md),
[piano](../planning/map-assembly-plan.md) e
[contratto fonte](../research/first-adventure-map-generator-contract.md).
Specifica/piano committati prima del codice. Implementazione sul checkout
assegnato; nessun subagente, installazione o scrittura GitHub.

## API e processo pubblico

```sh
npm run build
node dist/map-assembly.mjs --input input.json --output nuovo-output.json
```

```js
import { assembleMap } from './dist/map-assembly-library.mjs';
const result = assembleMap(rawInput);
if (result.status === 'geometry-complete') {
  // Quattro sezioni e grafo; checkpoint prima di shuffle e incontri.
}
```

Formato v1 con `selection` grezza, `geometry` e `execution` espliciti;
`tests/fixtures/map-assembly.mjs` mostra il formato sintetico completo.
La CLI accetta al massimo 64 MiB; il modello verifica riferimenti, indici,
forme/caselle contigue, metadati compatibili, frame e overflow numerici.
Ricalcola la selezione; non accetta snapshot RNG/flags alterati.
Exit0 solo per `geometry-complete`; exit2 per diagnostici fonte, eccezioni
fonte o stop amministrativi; exit1 per input/I/O senza nuovo risultato.
`map-io/files.ts` conserva i byte di input e pubblica esclusivamente un file
completo senza sovrascrittura. La libreria congela il risultato in profondità.

Tutti i risultati dichiarano `geometry-only`, politiche versionate e
`sourceParity: not-certified`. Solo il successo ha il checkpoint
`after-graph-before-all-spaces-shuffle`. Input/fingerprint, selezione e stato
corrente sono distinti. Nessun campo ConnectedSpaces serializzato viene usato
come collegamento effettivo: il grafo deriva dai bordi dopo il reset.

## Evidenza sorgente privata

`.scratch/assembly/normalize.py` usa gli extractor esistenti in sola lettura,
con `PYTHONDONTWRITEBYTECODE=1`. Mai importato lo script audit completo;
nessun avvio Unity, accesso a salvataggi personali o modifica della sessione
root congelata. Output originale, IL, mesh, UV e manifest completi restano
nella scratch ignorata di questo checkout.

- 45 prefab distinti: 44 facce base e custom100A; 430 esagoni, 107 caselle,
  1.090 bordi. Identità prefab e HashId condiviso restano separati.
- 3.715 oggetti / 508.984 byte consumati esattamente con reader agreement;
  13.959 occorrenze di puntatori non nulli verificate per classe.
- `.scratch/assembly/check-source.py` controlla frame, mesh bounds, tratti,
  forme, appartenenze e gerarchie contro le letture originali. Confronta
  45 frame bucket e 426 centri con il precedente audit: errore massimo0; 1.076 midpoint
  derivati da corner/bounds/Transform con i midpoint authoring:
  errore massimo `4.172325134277344e-7`.
- `.scratch/assembly/il-evidence.json`: 38 metodi / 15.717 byte IL verificati,
  con istruzioni e target di branch controllati e hash privati.
- Hash delle due assembly e dei file asset/pack confrontati con la provenienza
  già auditata. Il catalogo geometrico normalizzato ha SHA-256
  `f90e4730fe11a850c66aab9497e814ac886ec4b3ccfe6419b857f0f48a96134e`.

La missione viene istanziata a zero/identity (`A3932:01b1–01c1`); i frame
builder sono ricomposti da lì. Il primo PlaceStartTile conserva la traslazione world del bucket fino al
SetParent: `A1356:002e/0057` scrive localPosition prima di cambiare parent.
Una regressione con offset XY/Z non nulli verifica la media prima del recenter.
La fonte `GetCornerPosition/GetEdgePosition`
usa Bounds.extents.y, corner source float32, TransformPoint e Lerp. Il radius
usa tutti i centri Transform. Queste verifiche riproducono i dati e il modello
numerico dichiarato; non certificano Transform/Quaternion/JIT nativi Unity.

## Accettazione concreta H3

Input e compagnia espliciti provengono dal file auditato
`selection/matrix-root-fixed/H3-seed1.input.json` del source root, conservato
nel nuovo input privato insieme al catalogo geometrico. Nessun prelude K,
seed, eroe, item o stato campagna inventato. Attempt singola, base/Italian,
seed 1, `logical-clock-v1` step0, maxOperations5.000.000,
maxTraceEvents200.000, timeout amministrativo30.000ms.

Output finale concreto:
`.scratch/assembly/verified-v2/H3-seed1.output.json`.
Quattro sezioni in builder order `[0,1,2,3]`; primo sort `[1,2,3,0]`, secondo
sort e Map order `[1,3,2,0]`. Tessere per sezione2/2/3/3, caselle 4/4/7/7:
**10 tessere, 89 esagoni, 22 caselle**. Tutte le forme selezionate conservate,
cubi di somma zero senza overlap, 57 contatti tra tessere compatibili,
quattro coppie richieste attraversabili, 28 archi unici del grafo delle caselle.
2.752 candidati verificati, incluse molteplicità e ordine Comparison sort.

SourceRandom continua da 279 a **292** campioni, con tutti i56 slot e indici
verificati dal checker separato. Nessun draw di incontri o shuffle allSpaces.
Il check fonte per sezione passa, ma il grafo ha **tre componenti [3,18,1]**:
non si aggiungono passaggi per renderlo interamente raggiungibile.
Questo output è geometria completa per questo confine, non un'A1 giocabile.

Replay processuale H3:
`.scratch/assembly/source-frame-replay.input.json` e
`.scratch/assembly/source-frame-replay.output.json`.
**91.998 osservazioni** validate e consumate esattamente. Sezioni, pose,
candidati residui, caselle, contatti, grafo, search/trace e RNG coincidono;
due esecuzioni finali del replay hanno anche byte identici.
`.scratch/assembly/replay-evidence.json` conserva i digest e i campi confrontati.

## Matrice e checker separato

`.scratch/assembly/check.py` non importa src/dist. Implementa separatamente
RNG continuato, enumerazione di tutti i candidati, introsort fonte, frame e
sphere del modello portabile, ranking, pose trial/rollback, grafo e componenti.
Confronta anche l'intero snapshot di selezione con le 47 selezioni auditate
prima di questo incremento, inclusi pool trattenuti e flags.

`.scratch/assembly/matrix.py` esegue la CLI reale su **47 input**: 35 nuovi
per H1..5 e i sette seed `-2147483648,-80977,-1,0,1,411398192,2147483647`,
sette con compagnia H3 alternativa e cinque retry con pool trattenuti a seed2.
**47/47 geometry-complete** sotto la politica logica dichiarata, ciascuno
controllato indipendentemente. Questi tentativi non hanno percorso rollback
geometrico; quei rami sono coperti dalle fixture sintetiche processuali.

Tentativi originali H3 con budget clock e operazioni deliberatamente esauriti
sono conservati in `.scratch/assembly/failed-attempts.json` e relativi input/output:
entrambi `administrative-stop`, RNG 279, checkpoint nullo. Non sono errori
Timeout=1 Unity né mappe parziali valide. Ulteriori fallimenti fonte, eccezioni,
rollback e salti temporali sintetici restano riproducibili nei test.

Comandi privati riproducibili dal checkout:

```sh
PYTHONDONTWRITEBYTECODE=1 /Users/silvioceccarini/.t3/projects/lotr-interactive-table-game/.scratch/unity-audit-venv/bin/python .scratch/assembly/normalize.py
python3 .scratch/assembly/check-source.py
python3 .scratch/assembly/matrix.py
python3 .scratch/assembly/check.py .scratch/assembly/verified-v2/H3-seed1.output.json
```

Usare sempre un percorso di output nuovo per nuove CLI. Gli script di
normalizzazione/checker scrivono soltanto qui; il source root e Steam sono
letti. Il JSON pubblico associato contiene solo conteggi/hash e parametri
tecnici, mai asset, IL o layout originali.

## Verifiche pubbliche e limiti

Test processuali sintetici con più tessere e quattro sezioni: draw ordinati,
valid-next/sort/clump, contatti incidentali incompatibili e non attraversabili,
overlap, forbidden/required, boundary contact-side, recenter pesato e frame,
sphere tangente, rollback globale/sezioni e candidati residui, soglia temporale
stretta, replay alterato, budget, reset/grafo interno, validazione numerica,
immutabilità, input limitato e output esclusivo. #42 mantiene il proprio
comportamento con link serializzati; ne sono riusati solo predicati interi/bordi.

Verifica focalizzata eseguita:

```sh
node --test tests/map-assembly.test.mjs tests/map-geometry.test.mjs tests/map-selection.test.mjs tests/map-primitives.test.mjs
```

**108/108** passati, di cui 40 test dell'assemblatore. Typecheck intermedio passato.
Verifica completa finale: **191/191** passati, baseline 151 più 40 nuovi, zero skipped.

```sh
npm test
npm run typecheck
npm run format:check
git diff --check
```

Tutti i comandi completati con exit0 sul codice finale. Il log completo è
`.scratch/assembly/full-test-final.log`; il log focalizzato è
`.scratch/assembly/focused-test-final.log`. Il warning SQLite sperimentale
proviene dal runtime Node dei test host preesistenti.

Nessuna parità completa Unity/JIT: `portable-transform-f32-v1` usa rotazioni
planari portabili; i clock Node sono adattati, con siti di osservazione espliciti.
Il timeout amministrativo non emula Update/yield Unity o il retry loader.
Nessuna assegnazione incontri, esecuzione nodi/FSM, freeze di sessione o UI.
Host/session/schema e RNG delle carte non sono consumatori della libreria.
#41/#38/#33 restano aperte. Le review Standards/Spec fresche e ogni
PR/push/merge/chiusura issue restano al root: non sono state svolte qui.

## Integrazione e verifica root

Le [review Standards e Spec](../reviews/2026-11-02-map-assembly.md) sono
concluse: zero violazioni Standards, un suggerimento facoltativo rinviato;
tre difetti P2 Spec corretti con regressioni rosso→verde. Riguardavano
il getter con effetto sulla cache target, il replay vuoto e il mantenimento
di LastAttachedTileId nei diagnostici.

Dopo le correzioni: **193/193** test completi, zero skipped, typecheck,
format e diff check con exit0. Il root ha rigenerato e verificato **47/47**
mappe con il checker Python separato, includendo il controllo della cache.
L'evidenza privata riassuntiva ha SHA-256
`6cf897da997ad09a7079a5bcc1af2b11eb026838762cf75863eda5ed7d5160ce`.
Il caso H3/seed1 e il suo replay mantengono tutti i campi realizzati/search,
trace, grafo e RNG; consumate esattamente 91.998 osservazioni.
File root: `.scratch/assembly-root-review/`; log completo
`.scratch/selection/assembly-root-fixed-tests.log`.

Il [contratto del movimento](../research/map-movement-contract.md) distingue
il grafo fonte da quello richiesto dalle adiacenze fisiche. Il calcolo in
sola lettura H3 collega 22 caselle con 43 archi; l'adattatore effettivo è
il prossimo incremento. Nessuna sessione browser o salvataggio attivo è
stato usato o modificato da queste verifiche.
