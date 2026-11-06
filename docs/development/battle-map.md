# Battle map: libreria e CLI offline

Il compiler di [#126](https://github.com/Ic3b3rg/lotr-table-game/issues/126)
produce geometria tecnica verificabile da evidenze e policy revisionate.
[Specifica](../planning/battle-map-spec.md), [piano](../planning/battle-map-plan.md)
e [verifica](../testing/battle-map-verification.md).
**L'avvio avventura resta disabilitato e `runtimeReady` resta false.**

## API

Dopo `npm run build`, importare da `dist/battle-map-library.mjs`:

```ts
const artifact = compileBattleMapSource(sourceUnknown);
const checked = verifyBattleMapArtifact(artifactUnknown, {
  sourceFingerprint: trustedSourceFingerprint,
  artifactFingerprint: trustedArtifactFingerprint,
});
const geometry = battleMapCapability(checked, { kind: 'geometry' });
const start = battleMapCapability(checked, { kind: 'adventure-start' });
// geometry.enabled === true; start.enabled === false; entrambi runtimeReady === false
```

Tipi esportati: `BattleMapSource`, `BattleMapArtifact`, `BattleMapPins`,
`BattleMapCapability`. Eccezioni per input/pin/derivazione non validi;
nessun risultato parziale. Le funzioni sono pure, restituiscono copie
indipendenti e non aprono locator o file. Request e pin sono strict;
nessun parametro H, seed, gameplay o consumer del packet.

`verify` ricompila e confronta l'intero artifact, inclusi fonte e gate.
Pin attesi devono arrivare da un'autorità del futuro pack/host: digest e
ricompilazione provano coerenza, non autenticità editoriale. Una fonte
interamente inventata coerente è accettabile senza pin; quella originale
esige il pin attestato. Modificare source e derivati insieme non elude i
pin originali. Nessuna promessa di impossibilità di forgiare una fonte nuova.

## Contratto della fonte

`battle-map-source-v1` / `rectilinear-patches-v1` contiene:

- `files` (ID, byte, SHA256) e `records` (ID, tipo, file, locator, SHA256 oggetto).
- `resourceManager`, `prefab`, `adventure`, `model`, `buildSettings`, `materials`,
  `textures`: riferimenti verificati per tipo, identità e copertura. Prefab
  e componente Adventure distinti; indice BuildSettings conservato.
- `mechanics`: quattro prove file/locator/hash di caricamento, inizializzazione,
  selezione del materiale e merge, attestate dall’adapter privato.
- `transforms`: parent, posizione/quaternion/scala con `value` e `float32le`.
- `meshes`: proiezione verificabile dei quattro estremi UV per submesh,
  indici originali, posizioni/UV e codec; bit nativi quando float32.
- `alternatives` e `selectedAlternative`: due possibili root del merge,
  board in ordine modello, patch in ordine fonte, riferimenti TRS/mesh.
- `anchors`: ID, ruolo, Transform, record componente, ordine fonte solo
  per spawn; il muro aggiunge mesh/submesh e catena di Transform figli.
- `policy` / `policyFingerprint`: identità, revisione, evidenze/assunzioni,
  regioni fisiche per texture come partizione completa delle patch.
- `tolerances`: geometria, UV, distanza e allineamento muro, entro i massimi
  documentati nella spec. Sono parte dell'identità, non snapping.

Gli ID di board, regione e ancora usano lettere ASCII, numeri, `_`, `.` e `-`.
Gli ID di file/record e i locator sono identità inerti. I locator non sono
risolti dalla libreria. I campi non elencati dallo schema sono respinti.
Il formato è una proiezione minima attestata da un adapter privato sui byte,
non un loader Unity generale o una segmentazione automatica di immagini.
Il compiler ricava bounds/contatti/grafo/muri/mapping da questa proiezione.
Non accetta celle, archi o mapping già conclusi come input separato.

La fixture pubblica [inventata](../../tests/fixtures/battle-map.mjs) mostra
la struttura completa e non contiene materiale originale. Source e artifact
produttivi devono rimanere privati, anche nella storia Git.

L'artifact `battle-map-artifact-v1` incorpora la fonte completa e tutti i
layout alternativi: board/facce, patch/UV/bounds, regioni/caselle, contatti,
archi geometrici, muri, archi residui e piazzamenti/ordine spawn.
`sourceFingerprint` include tutta la fonte; `artifactFingerprint` include
anche output, algoritmo e gate. Il file non dipende dai path originali.

I bit float32 sono autorevoli e permettono di ricostruire `-0` dopo JSON;
il numero JSON non ne conserva necessariamente il segno. I packed double
decodificati non sono presentati come float32 nativi. Nessun arrotondamento
ad angoli ideali o coordinate intere. Static batching evita la doppia TRS.
Punti su un confine fisico, pareti ambigue, buchi, overlap e proiezioni fuori
dal modello rettilineo sono respinti; un divisore interno alla stessa casella
non è un confine fisico. Un muro rimuove un arco, non occupa una casella.

## CLI

```sh
node dist/battle-map.mjs compile --input private-source.json --output new-artifact.json
node dist/battle-map.mjs verify --input new-artifact.json --output new-verification.json \
  --expect-source "$SOURCE_SHA256" --expect-artifact "$ARTIFACT_SHA256"
node dist/battle-map.mjs capability --input geometry-request.json \
  --artifact new-artifact.json --output new-capability.json
```

Request JSON: `{"kind":"geometry"}` oppure `{"kind":"adventure-start"}`;
può includere `expected` con gli stessi due pin della API.
Verify/capability accettano anche `--expect-source`/`--expect-artifact`:
entrambi i livelli di pin si applicano. Compile non accetta pin.

Input/output espliciti obbligatori; `--artifact` solo per capability.
Opzioni duplicate/ignote/incompatibili sono errori. Lettura UTF8 strict,
file massimo8 MiB e guardia JSON condivisa (100000 nodi, profondità24).
Pubblicazione atomica mediante file0600 e hard link esclusivo; non sovrascrive
un file esistente, nemmeno in concorrenza. Nessun run, replay o journal.

| Exit | Significato |
| --- | --- |
| 0 | Compile, verify o geometria verificata |
| 1 | Input, comando, pin, lettura o pubblicazione invalidi |
| 2 | Avvio avventura gated: output completo conservato |

Il gate mantiene tre quantità null/unverified e originale156 static-gated.
Materializzazione/mescolate/trigger, consumer packet/scenario, nemici,
freeze dei risultati casuali e integrazione transazionale hanno requisiti
espliciti. Questo artifact non abilita A2 né modifica una sessione.
