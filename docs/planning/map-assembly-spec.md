# Assemblaggio geometrico delle quattro sezioni — issue #48

Base: `2006ca26bfab9e251e8c4fd1b5ead27603660038`. Autorità:
[issue #48](https://github.com/Ic3b3rg/lotr-table-game/issues/48) e
[contratto sorgente](../research/first-adventure-map-generator-contract.md),
CoroutineBuildMap `06003c93:062d–0e31`. Specifica scritta prima del codice.

## Confine e interfaccia

Libreria TypeScript `assembleMap(input: unknown)` e processo
`node dist/map-assembly.mjs --input file --output nuovo-file`. Un input JSON
versionato contiene **input grezzo di selezione**, catalogo geometrico con
provenienza, quattro parametri di layout e politica di esecuzione esplicita.
La selezione viene validata e ricalcolata con `selectMapTiles`: nessuno snapshot,
flag o pool fornito dal chiamante può essere promosso a checkpoint valido.
Non modifica host, sessione, schema, UI o RNG delle carte. Usa dipendenze esistenti.

Solo `geometry-complete` raggiunge `after-graph-before-all-spaces-shuffle`.
L'output è `geometry-only`, non è un'avventura giocabile e non è importabile
nell'host. Nessuno shuffle allSpaces, incontro, nodo o FSM viene eseguito.
#41/#38/#33 restano aperte. Nessun retry automatico o default di compagnia/seed.

Il catalogo conserva prefab source-qualified e HashId int32 distinti; custom100A
non è standard100A. Ogni forma conserva caselle, traits, darkness, esagoni ordinati
con cubi intrinseci immutabili, appartenenze e bordi tipizzati/apertura, inclusi
quelli interni effettivamente serializzati. Conserva dati di rendering e ancore,
Transform/mesh/bounds e provenienza per comporre centri e midpoint fisici.
Validazione rigorosa di riferimenti, duplicati, indici, origine, contiguità,
appartenenza e compatibilità con i metadati di selezione. Il catalogo deve coprire
le forme possedute, non gli oggetti phantom non assegnati. Limiti espliciti di
byte, array, numeri, lavoro e trace. Output esclusivo tramite `map-io/files.ts`.

## Algoritmo

- Riparte dal vero SourceRandom alla boundary di selezione. Calcola boundary
  locali delle tessere; azzera sequence/trie/history geometrici. Visita builder
  0..3 e tutte le loro tessere. Start specificato oppure scelta uniforme,
  rotazione uniforme; scelte successive uniformi sul prefisso valid-next dopo
  `comparisonSort`. Non decrementa SpacesFromAvailableTiles durante retrieval.
- Enumera tutte le coppie di ancore nell'ordine sorgente, duplicati compresi.
  Snap cubico e display separati. Rifiuta overlap e ogni contatto CanMatch falso;
  IsConnection è un predicato distinto. OpenEdgeCount signed-int16, sort solo
  per conteggio e quantile TileClumpFactor float32. Lista vuota: eccezione fonte,
  mai fallback. Failure LastAttachedTileId negativo: rollback globale con trie,
  ritorno in coda AvailableTiles, nessun rewind RNG.
- Recenter display pesato su TUTTI i centri Transform degli esagoni, senza
  modificare i cubi. Cache boundary di sezione in tile/hex/global-direction order.
  Due Comparison sort fonte con conteggio coppie e tie asimmetrico: A1 prima
  [1,2,3,0], poi [1,3,2,0], radice 1.
- Boundary Map concatenata in Map.Sections order, mantenendo lati a contatto
  con altre sezioni. Conteggio combinato PRIMA della restrizione ai required
  già presenti; <= sceglie l'ultimo vicino a pari boundary.
- Snap intersezione con rotazioni composite; sphere strict dei required già
  presenti, overlap contro tutta la mappa, CanMatch e coppie vietate su OGNI
  contatto, anche non attraversabile. Required soddisfatti tramite IsConnection.
  Molteplicità, signed-short e ordine candidati conservati. Quantile medio
  section-clump (media attached + incoming)*.5, rimuovendo prima di applicare.
- Rollback sezioni: conserva candidati del target, svuota liste attraversate,
  retarget se esaurito, rimozione root => InvalidParameters. Non rigenera sezioni,
  non ripristina pose trial dopo enumerazioni o rimozioni, non rewinda RNG.
- Reset elimina ConnectedSpaces serializzate. Grafo derivato da TUTTI i vicini
  esagonali, anche stessa tessera, e IsConnection. Check fonte: ogni sezione ha
  qualche casella collegata. Componenti/reachability indipendenti vengono
  riportate senza aggiungere traversal o imporre un check fonte più forte.

## Politiche e diagnostici

Politica numerica nominata e versionata: float32 per operazione vettoriale,
rotazioni display portabili esplicite; nessuna certificazione dei dettagli
Quaternion/Transform nativi Unity/JIT. Conservare input fisici auditati e formule
bounds/midpoint, non sostituirli con coordinate cubiche o raggi inventati.

Esecuzione deterministica con clock logico adattato, oppure clock monotono
registrato, oppure replay con cursori/contesto/ordinale RNG validati. Ogni punto
osservato registra timeout/tempo e ogni decisione >5s; localMin/start conservati.
Il replay non consulta il wall clock e deve consumare esattamente la traccia.
Budget di lavoro/clock amministrativi distinti da Timeout=1 e
InvalidParameters=2 fonte. Nessun arresto pubblica una mappa parziale valida.

Risultati discriminati: geometry-complete, source-failure,
source-operation-exception, administrative-stop; input-invalid rifiuta il file
prima della pubblicazione (exit 1). Diagnostici pubblicati exit 2, successo exit 0.
Metadati di selezione, pool, flags, disponibili e cache, cubi/pose trial, boundary,
placement residui, trie/history, loop cursors, localMin/rollback, trace e RNG
rimangono ispezionabili anche dopo failure. L'output completo conserva quattro
sezioni in builder order e Map order, tutte forme/caselle/esagoni e pose locali,
composite/globali, ancore/contatti/joins/grafo, fingerprint e politiche.

## Accettazione e verifiche

TDD sul processo CLI pubblico con fixture sintetiche multi-tile/multi-section:
draw iniziali/successivi, sort/tie/clump, contatti incidentali/overlap,
required/forbidden, boundary contact-side, recenter/frame, sphere tangente,
rollback e candidati residui, clock/replay/budget/errori, reset/grafo interno,
immutabilità/validation/output esclusivo. Nessun test esistente indebolito.

Normalizzazione privata read-only di 44 facce base + custom100A e frame/bounds,
con byte/pointer checks e hash. Almeno H3 completo concreto con compagnia,
seed, politica clock e RNG avanzato; ampliare H/seed conservando fallimenti.
Checker separato dall'implementazione verifica forme/spazi/cubi/no-overlap,
contatti e quattro required joins, grafo/componenti, conteggi/trace/RNG.
Pubblicare solo conteggi/hashes e limiti. Mai asset/IL/storia/output originali.

Prima della consegna: test focalizzati, typecheck, full suite una volta al termine,
format:check, diff --check, commit e checkout pulito. Le review indipendenti
Standards/Spec e ogni operazione GitHub restano al root.

## Decisioni finali del formato v1

Il file CLI è limitato a **64 MiB**, includendo un replay completo. Il catalogo
contiene una forma per ogni prefab posseduto, anche quando un prefab standard è
oscurato dal bucket custom; le voci phantom non assegnate non richiedono forme.
Gli array Transform sono in ordine dal figlio verso la tessera esclusa;
`render.polygon`/`render.uv` sono coordinate/UV del mesh nell'esagono locale.
`authoring` conserva separatamente le gerarchie originali. `resetPosition` e
posizioni delle sezioni sono quelle dopo l'istanziazione della missione a
zero/identity, non l'offset del prefab nel file. Tile root a scala unitaria;
scale figlie positive, quaternion unitari, coordinate/centri/corner composti
finiti e limitati. Questi sono vincoli d'input nominati del port v1, verificati
su tutte le forme A1 disponibili.

`portable-transform-f32-v1` applica Transform figlie con quaternion e float32,
rotazioni display planari di -60° tramite cos/sin portabili e fround, Lerp dei
corner e radius dai centri. Non simula internamente Quaternion.Euler nativa.
`logical-clock-v1` avanza per osservazione; step0 disabilita i salti temporali.
`monotonic-clock-v1` registra il tempo Node nei siti dichiarati;
`replay-clock-v1` valida e consuma soltanto i dati, senza consultare il clock.
`assembly-search-sites-v1` nomina quei siti e i loro cursori. Tutti i timeout
osservati sono **clock-budget amministrativi**: non si attribuisce loro il
codice Timeout=1 Unity. InvalidParameters=2 rimane un fallimento fonte;
indicizzazione unchecked rimane source-operation-exception. Il limite trace
permette una voce terminale diagnostica oltre al budget di eventi ordinari.

Dettaglio IL confermato durante TDD: il rollback locale modifica il cursore
senza riassegnare il riferimento alla sezione attiva nel ciclo interno
(`A3c93:06c2/06cf/083e/0855`). Il port conserva anche questa particolarità,
compresa l'eventuale eccezione GetTileAtIndex(-1); il
[contratto](../research/first-adventure-map-generator-contract.md) è aggiornato
con gli offset. Le pose cubiche locali vengono congelate dopo l'assemblaggio
locale; `cubeOrigin` e LocalRotations della sezione compongono quelle globali.
I flag boundsDirty/cachedRadius descrivono la cache precedente ai bounds
derivati pubblicati nel risultato. Lo stato serializzato è ispezionabile;
non è un'API per riprendere checkpoint arbitrari.

Il primo PlaceStartTile scrive localPosition mentre la tessera appartiene
ancora al bucket (`A1356:002e`); SetParent (`0057`) conserva il world pose.
Il port mantiene perciò resetPosition del bucket anche prima del recenter,
con regressione processuale su offset XY/Z non nulli.
