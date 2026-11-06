# Compiler dei tabelloni battaglia

Specifica di [#126](https://github.com/Ic3b3rg/lotr-table-game/issues/126),
base `e128adb36789ff7859431df6adbc9739a587c588`, 6 novembre 2026.
Design e autonomia già approvati nel mandato; nessuna nuova decisione di prodotto.
Autorità della ricerca: [contratto124](../research/second-adventure-battle-board-runtime-contract.md)
e [riproduzione Root](../reviews/2026-11-06-second-adventure-boards.md).

## Confine

`src/battle-map/` è una libreria Node TypeScript offline con CLI. Compila
un file tecnico privato, serializzabile e verificabile senza installazione
originale. Il freeze è questo snapshot, non una sessione modificata.
Nessun import dalle vecchie entrypoint, ScenarioPack, schema29, route, host,
UI, viaggio, journal/replay, RNG, mazzi, packet o generazione nemici.
I tre spawn sono posizioni ordinate dalla fonte, non quantità di figure.

Le tre quantità57 restano null/unverified; originale156 statico/gated.
Nessun avvio, ripresa o retrofit originale. #33/#89/#65/#57 restano aperte.
Nessun seed A1 assunto per A2; niente attestazione Unity/JIT, partita completa,
telefoni fisici, Windows o Safari. Multihero, packet, audio e RNG sono confini
successivi e non bloccano l'uso tecnico della geometria.

## API e identità

- `compileBattleMapSource(raw: unknown): BattleMapArtifact`.
- `verifyBattleMapArtifact(raw: unknown, expected?: BattleMapPins): BattleMapArtifact`.
- `battleMapCapability(artifact: unknown, request: unknown): BattleMapCapability`.

Errori di validazione sono eccezioni `Error`/Zod; nessun risultato parziale.
Tutti gli ingressi passano prima dalla guardia JSON strict/budget esistente
`boundPhysicalInput`: 8 MiB, 100000 nodi, profondità24, stringa16384.
Schema Zod strict anche per request e pin; niente getter, cicli, sparse,
prototipi arbitrari, proprietà nascoste o valori non JSON.
Le funzioni non aprono locator, URL o path incorporati. Parsing e ricompilazione
producono copie indipendenti, senza mutare ingressi né condividere risultati.

Tag distinti `battle-map-source-v1` e `battle-map-artifact-v1`; algoritmo
`rectilinear-patches-v1`. SHA256/canonical provengono da `map-freeze/hash`.
`sourceFingerprint` copre fonte completa, policy, selezione e algoritmo.
`artifactFingerprint` copre fonte, output, fingerprint fonte e gate.
`expected` accetta `sourceFingerprint` e/o `artifactFingerprint` fidati;
verifica prima di restituire un artifact consumabile. Verify ricompila tutto
e confronta canonical dell'intero artifact, non soltanto hash e conteggi.

Hash e ricompilazione provano coerenza, non autenticità dell'autore. Una fonte
inventata coerente è tecnicamente valida; per contenuti originali il futuro
consumer deve fissare il pin attestato. Alterazioni dei derivati risignate
sono respinte dalla ricompilazione; source e derivati alterati coerentemente
sono respinti dai pin originali, senza promettere impossibilità di una fonte
nuova non pin-nata.

## Fonte minima normalizzata: scelte del builder

Il formato è una proiezione verificabile di record nativi selezionati, non
un parser Unity generale e non il contratto conclusivo124. L'adapter privato
rilegge slice primarie sigillate con schema/reader, controlla i binding,
seleziona submesh e vertici/UV, e conserva provenienze e hash. L'oracolo124
serve al confronto finale, non a generare coordinate, archi o mapping.

Ogni record ha ID, file, locator e hash dei byte oggetto; ogni file ha ID,
byte e SHA256. I riferimenti tipizzati collegano catalogo ResourceManager,
prefab/Adventure, modello e BoardSettings, BuildSettings, manager/board,
materiale/texture e stream. Il modello determina Skin e ordine board;
il manager determina patch e Transform. Nessuna seconda verità per bounds,
caselle, archi o output di piazzamento viene accettata nell'ingresso.

I Transform conservano parent, posizione/quaternion/scala come coppie
`value`/`float32le`. Il valore decodificato dai bit è autorevole; il numero
JSON deve coincidere (i due zeri sono numericamente uguali). JSON non promette
di conservare il segno dello zero; i bit lo preservano e lo ricostruiscono.
Sono conservate anche componenti piccole, senza normalizzare quaternion o scala.

La proiezione mesh contiene gli indici dei quattro vertici estremi UV di
ciascuna submesh selezionata, posizione/UV decodificate, identità mesh e
selettore submesh. La selezione rettangolare e la copertura dell'intera
submesh sono controllate dall'adapter e dal checker privato sui byte.
Il compiler verifica rettangolarità, UV, area, orientamento e TRS di questa
proiezione; non certifica autonomamente il decoder binario. Per vertici
float32 si conservano anche i bit; per packed si conserva l'identità del
record/codec, senza attribuire bit float32 al risultato double del decoder.
Static batching usa vertici già trasformati; altrimenti compone i parent.
Le coordinate delle ancore sono quelle locali dello spazio layout dell'app;
la gerarchia fonte rimane conservata, senza applicarla una seconda volta.

La policy visiva ha identità/revisione/hash, evidenze file/locator/hash e
assunzioni esplicite. Per texture ripartisce gli indici delle patch in regioni
fisiche con ID stabili. Non è segmentazione autonoma delle immagini né un
campo GameNode.Space. Ogni patch deve appartenere a una sola regione connessa.
Casella, patch e ancora grafica restano concetti distinti.

## Derivazione e limiti numerici

Il modello minimo è una copertura di patch rettangolari nel piano XY, con
UV rettangolari e assi paralleli (anche con piccole deviazioni dimostrate).
Niente rotazioni arbitrarie, poligoni generici, snapping o ricerca della
casella più vicina. Tolleranze dichiarate dalla fonte e incluse nel pin,
con massimi fissi nel codice: geometria0.002, UV0.002, distanza muro0.25,
allineamento muro0.002. Le fixture inventate usano tolleranze più strette.
Questi valori sono tolleranze delle prove, non nuovi confini fisici.

Bounds derivati dai vertici trasformati. Due patch condividono un contatto
quando due lati opposti coincidono entro la tolleranza e l'intervallo comune
ha lunghezza positiva oltre la tolleranza; i soli angoli non creano archi.
Si rifiutano sovrapposizioni interne significative, patch degeneri, UV invertite
fra patch della stessa faccia, regioni disconnesse e contatti ambigui.
Si conservano entrambi i lati effettivi e il gap, senza spostare le ancore.
Contatti tra caselle diverse producono archi, aggregati per coppia ordinata;
i contatti fra board sono giunti. Contatti entro una regione non sono movimenti.

Un'ancora interna deve appartenere univocamente all'unione della regione,
lontano da un confine fisico; un divisore fra patch della stessa regione
non la rende ambigua. Fuori mappa o su confini fisici si rifiuta.
Per un muro l'asse lungo si deriva dalla proiezione del mesh e dai Transform
propri/figli; serve un solo bordo candidato entro distanza e orientamento
ammessi. Il muro elimina quell'arco, senza bloccare una casella. Ancore,
coordinate fonte, direzione, distanza e bordo restano nell'output.
Ordine/ID dei tre spawn sono conservati, non riassegnati.

La fonte contiene entrambe le alternative del merge e una selezione esplicita.
Si compilano entrambe; caselle, archi, muri e mapping devono coincidere,
coordinate delle patch entro tolleranza. Non si assume un ordine Unity.
Selezione/identità cambiano il sourceFingerprint; la proiezione logica concorda.

## Artifact, capability e CLI

Artifact: tag/algoritmo, fonte intera, fingerprint fonte, `compiled` con tutti
i layout alternativi (board/facce/patch/caselle/contatti/archi/muri/piazzamenti/
spawnOrder), gate e artifactFingerprint. Tutti i derivati sono ricompilati.
`runtimeReady:false` è incondizionato; quantità `[null,null,null]` con stato
unverified e originale156 static-gated. Requisiti espliciti: quantità57,
materializzazione/mescolate/trigger, consumer packet/scenario, nemici,
freeze casualità e integrazione transazionale futura.

Request strict `{kind:'geometry'|'adventure-start', expected?: BattleMapPins}`.
Geometria verificata: enabled true, runtimeReady false. Avvio: enabled false,
requisiti espliciti, nessuna mutazione o sessione creata.

Due soli nuovi target `dist/battle-map-library.mjs`, `dist/battle-map.mjs`.
CLI `compile|verify --input file --output nuovo-file`; `capability --input
request --artifact file --output nuovo-file`. Verify/capability accettano
`--expect-source`/`--expect-artifact`; compile li rifiuta. Opzioni duplicate,
ignote o incompatibili falliscono. JSON UTF8 bounded. Solo path in argomenti
sono aperti. Persistenza `map-io/files.writeNew`:0600, pubblicazione atomica
senza overwrite; exit0 compile/verify/geometria, exit2 avvio gated con output
conservato, exit1 input/comando/pin/file invalido. Nessun runGameplay/journal.

## Accettazione

TDD API/CLI con fixture interamente inventate, diverse dal riferimento:
regioni composte, patch distinte, giunto, muri, bordi/ambiguità/orientamento,
bitfloat/componenti piccole, reorder/merge, copie, pin e falsificazioni,
guardia JSON/budget, atomicità/no-overwrite/exit2. Nessun test esistente ridotto.
Matrice privata con checker distinto: confronto completo di tutti i derivati,
coordinate/bit e mapping con primarie/oracolo124, entrambe le alternative.
Dichiarare schema, decompressione, TRS/static batching e visiva condivisi.
Preservare errori/tentativi/stderr/exit, manifest proprio separato dai riferimenti.

Build base prima del codice conservata nella scratch propria. Confronto finale
completo dei22 vecchi file dist e di tutti i sorgenti/validatori preesistenti
(esclusa l'aggiunta delle due entry in build). Typecheck/build/format/diffcheck.
Una canonica finale ALONE `npm test`, concurrency4, exit npm reale e nuovo footer
oltre i923 test base. Nessuna prova browser necessaria per questa libreria.
Nessuna dipendenza nuova/installata. Audit privacy di diff e storia nuova:
nessun raw, immagine, narrativa, mapping originale, IL o JSON privato in Git.
Root farà review Standards/Spec fresche e integrazione; nessun write GitHub qui.
