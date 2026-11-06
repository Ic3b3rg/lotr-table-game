# Avventura 2: tabelloni battaglia e contratto dei piazzamenti

Ricerca statica per [#124](https://github.com/Ic3b3rg/lotr-table-game/issues/124),
6 novembre 2026, sulla base `5571108db98600a552acde97cc60af7bddcd0f6c`.
**Il vero ResourceManager conferma il prefab A2; le due facce hanno cinque
caselle ciascuna. Le tredici ancore dello startup sono associate a caselle
o bordi comprovati.** Il testo inglese della stessa build chiarisce
l’istruzione dopo sconfitta nel setup di riferimento; l’italiano rimane
incongruente. Sono risultati di ricerca, senza avvio di un’avventura o
certificazione del primo turno.

| Domanda                   | Esito della ricerca                                                                                                                                                                                                         |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Binding e scene           | Confermati file, pathID, caricamento e configurazione dei due board. L’identità del root conservato dal merge resta condizionata all’ordine dei risultati Unity.                                                            |
| Facce e topologia fisica  | Dieci caselle complessive, diciannove adiacenze geometriche; i tre muri ne eliminano tre. Le sedici rimanenti sono derivazioni delle facce e delle regole.                                                                  |
| Piazzamenti iniziali      | Verificate dieci ancore interne e tre ancore di bordo, con orientamenti e valori sorgente preservati nel contratto privato.                                                                                                 |
| `B1_WEAKNESS`             | EN specifica acquisizione, quantità e fondo del mazzo personale. Bersaglio chiuso per il riferimento a tre proprietari con un eroe ciascuno; il packet non codifica la distribuzione quando una persona controlla più eroi. |
| Inizializzazione e freeze | Distinti configurazione dei board, particelle native e casualità dello startup. Nessuno stato iniziale Unity, transcript completo o equivalenza JIT è dimostrato.                                                           |

[#120](first-camp-transition-runtime-contract.md) resta l’autorità della
transizione e dello startup già studiato. [#122](../development/camp-preparation.md),
integrata con PR123, salva scelte di ruolo/accessorio, ricetta deterministica
e conferme personali: non materializza mazzi, shuffle, trigger o partenza A2.
Queste assenze appartengono al seguito previsto. Il GET della issue124
conferma `blocked_by=0`, `total_blocked_by=2`; la ricerca non chiude le
accettazioni di #33/#89/#65/#57.

## Fonti e provenienza

Baseline: app Steam **1.6.6#1128**, build **24301165**, Unity **2022.3.62f2**,
prodotti posseduti `[0]`. L’[inventario ufficiale](official-app-inventory.md)
identifica la provenienza dell’app. Il nuovo `Info.plist` conferma versione
1.6.6 e `CFBundleVersion=100`: quest’ultimo non è il numero interno1128.
Il record Steam ricevuto attesta appid/buildid; il suo percorso storico
non è stato seguito sull’installazione.

| Sigla   | Primaria e locatori                                                                                                                                                                                                         |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G       | `Data/globalgamemanagers`, SHA256 `81d1011e0db0a395f078b3f8a55a96e1e1722171837643cf52427b28f92875d0`; pathID13 ResourceManager e11 BuildSettings.                                                                           |
| F / K   | `Data/level5`, SHA256 `ff5659a37426fba122975607763efc445f3e9c08343e493b1aafcc039af9d53f`; `Data/level6`, SHA256 `a247c7408863177aa49af3fbcb7fe3e7475376d71757c62e2686b5f64414fbfb`. Numero seguente: pathID.                |
| S / R   | `sharedassets0.assets` / `resources.assets`, stessi byte della baseline120: SHA256 `dd2a2285cc1b94ab567c6a6b895872bd97bb2bf8fe9e08d152c5f1103d1687be` / `0250e91823b98c0f9fceb6b1ee517d880c6f9934359f849749779b7a5b0c835e`. |
| V       | `sharedassets5.assets`, SHA256 `bc1b1b5c7a1ef48ed5ff5bbf1b30f7c7a6c88998e791c08407d2ad5d98ed1abe`; materiali2/3, Texture2D14/15, buffer `sharedassets5.assets.resS`.                                                        |
| A       | `Managed/Assembly-CSharp.dll`, SHA256 `8869ef87b7d49f4993911904e35d78b72f8339e91158bbe8784c9691a9d743c6`. Token metodo e offset `IL_…`, relativi al codice, identificano i passi letti.                                     |
| L       | `StreamingAssets/bundles/manifest.dat`, SHA256 `a19d4dd35082b593c5b1c3e91b42420ea0ab66f21b92b01000adfe0c33abfc1f`; quattro bundle selezionati dalle sue voci EN/IT, non dal nome presunto del file.                         |
| RR / IT | [Rules Reference ufficiale][rr], 32 pagine; [manuale italiano][it], 16; [FAQ2.0][faq] e [carte corrette][errata], due pagine ciascuno. Copie sigillate ricevute con120, nuova estrazione PDFKit.                            |
| P       | [Pagina prodotto FFG][product], sua [immagine ufficiale dei tabelloni][boards] e figura RR p3: riscontro del componente fisico.                                                                                             |

Prima del parse sono stati verificati i due manifest esterni:

- Nuovo ingresso: **8.919 byte**, SHA256
  `95f1aac3f6c82eec9c9893ee7697e762f085b511019eb42449192515bb4fc0f6`;
  **43 righe / 441.069.239 byte**.
- Riferimento120: **228.674 byte**, SHA256
  `14945ec5e80b6426454f52226bedae12bac46a4dfb55979893d18296d0e9fd27`;
  **1.405 righe / 237.452.416 byte**.

Tutte le righe sono state verificate per unicità, containment, assenza di
traversal/symlink, file regolare, dimensione e SHA; una seconda verifica
conferma gli ingressi immutati. Il manifest statico interno è di8.738 byte,
SHA256 `a9ccb85ea76640873552dfe5fb5f5c2926915d814bfa539a87cd32a15e505ab4`.
I byte sono nuovi ingressi statici autorizzati, non una certificazione
retroattiva dei file mancanti in120. I metadati decodificati della raccolta
Root non fungono da checker. Nessun helper ricevuto è stato eseguito in place.

## ResourceManager, caricamento e configurazione

**Evidenza sorgente.** G13.`m_Container[8]` collega il path del prefab in
S806 a R4285; `[115]` collega il modello a S806. R4285 contiene Adventure
R20188, il cui `Model` punta a S806, e principal FSM R27344. Questi locatori
richiedono l’identità del file: il pathID13 di `globalgamemanagers.assets`
è invece uno Shader. Gli offset relativi all’oggetto G13 dei due pathID
sono **464** e **6.352**; S806.`Prefab.Path` inizia a56.

`RuntimeAsset.GetTrimmedPath`, A `0x060009c1`, elimina i prefissi di progetto
e l’estensione; `0x06003803 IL_0042–004e` inoltra il path a Resources.LoadAsync.
G11.`scenes[5/6]` identifica Forest/Rock, quindi `level5/level6`.
La scelta ambiente usa `GetBattleboardEnvironmentScene/GetSceneName`, A
`0x06000d69/0d50`, e il loader `0x06003932 IL_00b6–013b`.
L’enum del loader e l’indice BuildSettings sono locatori distinti.

La visita circoscritta legge **2.192 oggetti in F e1.643 in K**, tutti3.835
con consumo esatto. Sono presenti manager, board, nove `GroundFlat` e nove
`GroundChasm` per board, griglie dei bordi e decorazioni. Questi array
servono al rendering e alle varianti: non definiscono nove caselle fisiche.

| Scena  | Manager | Board logici0 /1 | Transform dei board |
| ------ | ------- | ---------------- | ------------------- |
| Forest | F2155   | F2170 / F2169    | F1194 / F1195       |
| Rock   | K1605   | K1620 / K1621    | K911 / K910         |

S806 conserva `Type=1`, due BoardSettings con Skin0/1 e tutti i sedici
river flag falsi per board. Gli Skin sono agli offset348/372. La scena
serializza inizialmente Skin0 anche per il secondo board: il valore
effettivo arriva dal modello durante BeginAdventure. A
`0x06000b8a IL_041c–0469`, `BBManager.Initialize 0x0600137c`,
`SetBoardSkin/GetMaterial 0x0600137d/1382` e `BBBoard.SetMaterial 0x0600136d`.
Skin0 seleziona V3/Texture15; Skin1 V2/Texture14. Il nome del materiale
roccioso contiene “Cave”, mentre il nome della scena è Rock.

**Gerarchia e attivazioni.** I Transform passano per il rispettivo parent
del board, `BattleBoardGeometry` e `ArtAssets`. Il contratto privato conserva
parent, ordine dei figli, posizione/quaternion/scala e bit float32 originali,
incluse scale non esattamente unitarie e componenti piccole della rotazione.
Non sono normalizzati a coordinate intere o angoli ideali.

`InitializeBattleboardEnvironment`, A `0x06000d46 IL_0000–0132`, combina
due root trovati per tag: disattiva le prime visuali del secondo, trasferisce
FX e contenuti del suo secondo bordo/parent al secondo parent del primo,
aggiorna i riferimenti e distrugge il root eccedente. Il mantenimento della
posizione world durante SetParent è un’assunzione Unity dichiarata.
L’ordine restituito dalla ricerca per tag non è provato staticamente:
sono conservate entrambe le alternative. Geometria piatta, orientamento UV
e selezione Skin dei board logici concordano nelle due alternative.

`BBManager.Initialize` abilita il parent del secondo board quando i settings
sono due, aggiorna i settings, costruisce i bordi e registra i due Transform
in MapTileManager. `BBEdgeGrid.Awake` e `BBEdgeCorner.Awake` risolvono i
backreference inizialmente nulli tramite il parent; non sono puntatori
mancanti al modello. Con i flag A2 falsi non si attiva un fiume.
A `0x0600137c`, `1371/136f`, `1372 IL_0000–0032`, `137f`.
Non è stata seguita la tabella ResourceManager verso altre scene.

## Facce, caselle e bordi fisici

**Sorgenti visive.** V15 eV14 sono texture1024×1024, formato10. I rispettivi
stream occupano524.288 byte a offset524.288 e0 del buffer `sharedassets5.assets.resS`.
Sono state esportate, conservate per hash dei byte compressi, PNG e pixel,
e ispezionate integralmente. Il checker confronta di nuovo il buffer con
la decodifica BC1 e i pixel esportati. La figura RR p3 e l’immagine P
corroborano il disegno fisico; nell’immagine promozionale una parte della
faccia erbosa è coperta dal tablet. Non sono scansioni dimensionali della
copia del proprietario.

**Derivazione.** Ciascuna faccia ha quattro caselle periferiche allungate
e una centrale. I confini grigi uniscono alcuni elementi grafici del
reticolo di rendering nella medesima casella. Le due tessere battaglia
forniscono quindi dieci caselle occupabili, senza esagoni di movimento
aggiuntivi. Le regole definiscono adiacenza mediante il confine condiviso;
i terreni possono modificare un confine o stare dentro una casella.
[RR p3, §§6/14, pp7/9][rr].

La derivazione combina l’ispezione con24 controlli di contatti nel disegno:
otto divisori presenti e quattro assenti per faccia. Un flood fill separato
ritrova le cinque regioni. Da queste e dall’accostamento provato delle due
tessere risultano diciannove adiacenze geometriche. I tre muri iniziali
coprono tre confini distinti, lasciandone sedici attraversabili. Nessuna
adiacenza diagonale o passaggio attorno all’estremità grafica di un muro
è aggiunto al grafo. [RR §§6.6/111.1, pp7/27][rr].

**Distinzione necessaria.** `BBEdgeGrid` descrive angoli e segmenti per i
fiumi; non è il grafo fisico delle caselle. `GroundFlat[9]` descrive elementi
di mesh; il numero dei suoi elementi non misura i movimenti. Il grafo
privato deriva da immagini e regole, con collegamento alla scena tramite
UV e geometria, non dai soli Transform.

La verifica comprende36 elementi di terreno piatto nelle due scene,
submesh selezionate dai MeshRenderer e UV effettive. Per gli elementi
staticamente combinati legge i vertici già trasformati; per quello non
combinato compone la gerarchia. Applicare entrambe le trasformazioni
sposterebbe il bordo. Il checker usa un decoder struct separato per
vertici/indici, anche compressi. L’interpolazione UV conserva un errore
numerico circoscritto e verificato; non viene promossa a un contorno fisico
subpixel o a una prova dell’aritmetica Unity/JIT.

## Collegamento dello startup al tavolo

Sono ricontrollati sul nuovo R primario principal, gerarchia e componenti
raggiunti. Il contratto privato distingue per ogni piazzamento:

- Transform e ancora dell’app, con valori e bit originali;
- elemento di rendering e faccia effettiva raggiunti da mesh/materiale/UV;
- casella fisica derivata, oppure coppia di caselle separata dal muro;
- orientamento sorgente e distanza dal bordo, senza spostare l’ancora.

La selezione comprende HeroSpawn R11449; i tre punti dello startup
R25524/R27187/R26617; sette nodi terreno e i nodi R21806/R23697.
I due ulteriori spawn point presenti nel prefab non entrano nell’array
iniziale. I dieci piazzamenti interni risultano dentro una sola regione
pertinente; i tre muri corrispondono univocamente a tre confini. Il mapping
completo, le coordinate e il grafo normalizzato rimangono privati.

I tre muri usano S2631; il mesh R504 ha asse lungo localeY. Due quaternion
mantengono l’orientamento verticale e il terzo lo ruota sul bordo
orizzontale; anche Transform dei figli e texture originale del muro sono
controllati. Un’ancora grafica può essere lievemente scostata dalla linea:
il checker prova unicità del bordo e orientamento, senza trasformarne il
centro in una casella bloccata. `GameNode.Space=null` rimane un dato reale:
l’associazione fisica è una derivazione esterna, non un campo app ritrovato.

R27344.s[3/19/20] conferma i tre gruppi di rivelazione: due cespugli,
tre muri, fuoco e roccia. `IsRandomTerrain/IsUnique=false` nei sette nodi.
R27344.s[6].a[3] conferma ordine dei tre spawn point e budget4H/6H/5H,
con H2–5; non sono quantità fisse di figure. Restano filtri, riserva e
disponibilità descritti da120, incluso il caso ranged senza candidato
acquistabile a H2. Questa ricerca non sostituisce quel pool con uno ridotto.

R27344.s[4/7] mantiene tipo minaccia/ricerca e i binding dei rispettivi
GameObject. La seconda azione di s[7] aggiunge2 Sapienza già all’ingresso.
Soglia iniziale3H, limite13H, Scoperta3 di ciascun eroe e ordine degli stati
concordano con120. Le nuove primarie chiudono il loro collegamento spaziale,
non gli effetti futuri di carte, incontri e combattimenti.

## Packet dopo sconfitta: confronto EN/IT

Le voci L `localization/bonesofarnor/en`, `/it`, `localization/main/en`,
`/it` identificano quattro bundle originali, tutti della build fissata.
La selezione dei TextAsset è ricontrollata dai bundle grezzi; record CSV
numerati da1 includendo l’intestazione, colonna2 del valore:

| Tabella           | CAB, pathID                                                    | Record pertinente                   |
| ----------------- | -------------------------------------------------------------- | ----------------------------------- |
| `BonesOfArnor_en` | `CAB-d1f1c1ec4a9b772ef2fe7406294598d1`, `-8198793234402206174` | 112, `B1_WEAKNESS`                  |
| `BonesOfArnor_it` | `CAB-de6e1db3db3feb5f9cac9ab9f2ee46c7`, `-2938581942859744165` | 112, stessa chiave                  |
| `Main_en`         | `CAB-3de684e14f86b9342a2576d3e3256744`, `-3145740700711790922` | Nessuna ridefinizione della chiave. |
| `Main_it`         | `CAB-f8344648403e00c8c44347d4709b3e23`, `-7439224213581943799` | Nessuna ridefinizione della chiave. |

**Contesto.** Dopo piazzamento eroi/Scoperta3, s[15] legge il risultato A1:
solo FALSE entra in s[16], poi FINISHED raggiunge s[3]. S[16] contiene
esclusivamente DisplayMessage, MessageSource nullo, chiave sopra e valori
localizzato/compresso vuoti. Il nome “Add Weakness” non assegna carte.

**Istruzione provata dalla primaria EN.** Il messaggio richiede una
debolezza aggiuntiva per ogni giocatore, collocata in fondo al proprio
mazzo abilità. La normale debolezza della preparazione precedente e questo
effetto successivo sono distinti. La carta proviene dalla cima del mazzo
debolezze secondo RR112.2; non viene scelta o rimescolata per intuizione.
Il destinatario EN è collettivo e personale, senza selezione di un eroe
o di un segnalino sorgente. Nel riferimento di tre proprietari con un eroe
ciascuno il bersaglio è quindi determinato. [RR p5, §112, p27][rr].

**Limite sul destinatario.** La formulazione usa giocatore; il packet non
possiede un array di eroi bersaglio. RR44/84 mantiene mazzi distinti quando
una persona controlla più eroi, ma non contiene una correzione specifica
di questa riga. La ricerca non autorizza a scegliere silenziosamente uno
dei mazzi o a certificare quella generalizzazione. Per abilitarla serve una
primaria ufficiale che espliciti l’applicazione a quel contesto; il consumer
deve conservare il gate pertinente. [RR §§44/84, pp16/23][rr].

**Risoluzione effettiva.** `DisplayMessage.PerformAction`, A
`0x0600115b IL_0000–003b`, chiama `ResolveArguments 0x06000b80`: il ramo
senza inserti recupera la chiave e riempie i due valori. Il loader
`0x060037d3 IL_031c–03a8` carica il TextAsset e lo passa a LoadCSV;
`Localization.Get 0x06000325 IL_019a–01cc` restituisce il valore non vuoto
della lingua selezionata. Non esiste in questo percorso un controllo
semantico che ripieghi sull’inglese perché l’italiano è incongruente.
La stessa coroutine contempla loader remoto e StreamingAssets: le quattro
tabelle locali fissate sono la prova di questo contratto. Eventuali override
remoti o in memoria non osservati non sono certificati; non sono state
consultate cache o preferenze personali dell’app.

IT112 contiene invece un’istruzione su Nascosto/scarto di persona, priva
del bersaglio nel contesto appena ricostruito. Il confronto conferma una
divergenza dei contenuti sorgente, non un’assegnazione automatica app.
Non vengono pubblicati i testi integrali, corretta la tabella italiana o
aggiunto un effetto al prodotto. Il futuro consumer può basare la meccanica
del riferimento sulla primaria EN attestata, conservando separatamente
provenienza e conflitto IT; testo localizzato ed effetti richiedono la loro
adozione esplicita. Le FAQ/carte corrette ricevute non risolvono questa riga.

## Inizializzazione e confine della casualità

I callback selezionati dei board risolvono backreference, settings,
materiali, visibilità, bordi e registrazione della mappa. I tre pool fiume
per scena inizializzano oggetti anche quando i flag sono falsi:
`PrefabPool.Awake/Initialize/CreateObjects`, A `0x0600099f/09a0/09ac`.
La closure dei tre prefab raggiunti comprende dodici GameObject e nessuno
script aggiuntivo; non è un export di tutti i prefab. I due billboard di K
e i callback meteo/visibilità sono considerati come presentazione.

Le scene serializzano48 e46 ParticleSystem: tutti con `autoRandomSeed` e
`playOnAwake` veri, oltre a valori di prewarm/attivazione conservati nel
privato. Questo prova che non sono una fotografia deterministica del frame
iniziale. Non prova che i seed delle particelle native consumino lo stesso
stato di UnityEngine.Random. La scelta del root e il reparent dei suoi FX
restano distinti dalla topologia occupabile.

Lo startup conserva le chiamate casuali già individuate da120 per gruppi,
modelli, bonus e figure, con pool ordinati e disponibilità vivi. Anche la
presentazione può incidere sulla sequenza condivisa: `Node.Reveal`, A
`0x06001588 IL_0000–0011`, estrae un ritardo. Il ramo casuale per le nuvole
in `0x06000b8a IL_02db–02ed` appartiene invece al percorso viaggio saltato
da Type1: non si aggiunge come consumo certo di A2. Le varianti numerate
di Localization.Get possono estrarre un indice; le chiavi selezionate
dispongono del valore diretto, quindi quel fallback non è applicato loro.
I suoni delle rivelazioni passano da `GameNode.Spawn3DToken 0x06000d08`
a `PlayTokenFalling/PlayTokenHitGround 0x06000be0/0be1` e
`AudioController.ImplPlayFX 0x060013eb IL_003a`, fino a
`MasterAudio.PlaySoundAndForget`. Questo è un ulteriore confine di
presentazione: le scelte interne del middleware audio non sono certificate.

La selezione non dimostra l’interleaving complessivo di callback, audio,
animazioni e RNG del motore. Il freeze futuro deve fissare i risultati
di gioco necessari al replay e definire il trattamento della presentazione;
non può ricavare uno stato Unity completo da questi file, riciclare il seed
A1 o dichiarare parità Unity/JIT. Nessun transcript originale viene inventato.

## Consumabilità, seam e prossima slice

Il contratto privato rende ora disponibili binding, facce, topologia
combinatoria, trasformazioni e tredici piazzamenti dello startup. È
consumabile come prova statica con questa checklist:

- Verificare i pin e le identità file/pathID, mantenendo originale,
  derivazione geometrica e regola fisica distinti.
- Conservare bit/coordinate sorgente, orientamenti e mapping privato;
  nessuna conversione di patch, angoli o muri in caselle aggiuntive.
- Congelare prospetticamente geometria e identità del contenuto;
  riprodurre entrambe le alternative del merge senza assumere l’ordine
  della ricerca Unity per tag.
- Materializzare mazzi, debolezze, Scoperte3 e trigger soltanto con i
  rispettivi consumer e disponibilità provati. Gestire EN/IT e il caso
  di più eroi per proprietario con il limite appena dichiarato.
- Completare la closure di generazione nemici/bonus necessaria al primo
  turno e conservare risultati, ordine e casualità richiesti dal replay.

La più piccola slice successiva è un compiler verificabile della mappa
battaglia e dei piazzamenti, con capability propria e contenuto congelato
prima della futura partenza. Può verificare dieci caselle, tredici ancore,
bordi dei muri e invarianti del merge senza avviare A2. Il comando di
partenza deve attendere materializzazione fisica e closure obbligatorie,
non la sola presenza del rapporto o delle conferme122.

I seam attuali sono [pack/runtime](../../src/scenario/pack.ts),
[conclusione](../../src/scenario/conclusion.ts),
[preparazione al campo](../../src/scenario/camp-preparation.ts) e
[ciclo fisico transazionale](../../src/server/physical-cycle.ts).
Il seguito usa lo stesso registro e Store.once, preservando episodio e
origine A1 come richiede [ADR0003](../adr/0003-registro-ordinario-e-fonte-dell-incontro.md).
Nessun secondo journal, retrofit dei freeze o migrazione che esegua gameplay.
Rimangono necessari startup completo, recupero su ogni richiesta e vera
certificazione del primo turno; non sono verifiche svolte da questa ricerca.

Le tre quantità57 restano **null/unverified**, con il blocco esplicitamente
richiesto dal proprietario. Nessuna5/5/5, riserva proxy, `unknown=empty`,
filtro o reroll viene introdotto. Originale156 resta **statico/gated**;
non è stato ripreso, modificato o sostituito da una nuova partita.

## Verifiche effettive e riproduzione

Prove in `.scratch/issue124-battle/`, ignorata da Git: originali in lettura
sola, copie degli helper adattate, raw/schema, IL selezionato, texture,
contratto, checker, comandi con exit/stdout/stderr e tentativi conservati.
README e manifest finale distinguono artefatti propri e riferimenti operativi
sigillati; i percorsi di provenienza storici non sono ingressi impliciti.

| Controllo            | Risultato effettivo                                                                                                                                                                                                                      |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Asset trattenuti     | 3.996 oggetti distinti,7.401.416 byte; reader C/P concordi, consumo intero,10.006 puntatori non nulli risolti e6.734 nulli. Due materiali candidati nel file sbagliato restano registrati come ipotesi scartata, fuori da questi totali. |
| Lettore struct       | 3.998 oggetti,7.402.320 byte e1.234.896 locatori di campo, inclusi i due candidati scartati. Rilegge i byte senza i reader UnityPy; lo schema rimane un’assunzione condivisa.                                                            |
| IL                   | 75 corpi,11.770 code byte,4.330 istruzioni,383 salti diretti e sei regioni eccezione; comprende anche un overload audio candidato scartato. Confronto PE/header/code separato, nessuna esecuzione.                                       |
| Geometria e immagini | 36 elementi piatti, due facce complete,24 contatti campionati; confronto separato di vertici/UV/indici, buffer compressi e pixel. Nessuna misura in millimetri certificata.                                                              |
| Contratto            | Dieci caselle,19 adiacenze geometriche, tre bordi con muro,16 adiacenze residue,13 piazzamenti;20 record localizzati selezionati e due percorsi dell’esito precedente.                                                                   |
| Alterazioni          | 49 mutazioni del contratto e cinque dei raw, queste ultime con hash coerentemente ricalcolato, respinte. Coprono identità, Skin, precisione, caselle, orientamenti, bordi, packet, budget e gate. Non sono54 partite.                    |

Il checker non importa produttore, decoder FSM o helper geometrico. Rilegge
campi binari e parametri PlayMaker, ricostruisce il reticolo dalle linee
campionate e verifica le associazioni. Condivide schema/layout, metadati
del contenitore, semantica TRS/static batching e librerie di decompressione;
la decodifica UnityFS e BC1 non è una seconda implementazione di quei formati.
I quattro oggetti TextAsset sono ricontrollati direttamente nei bundle.
L’ispezione umana delle immagini e la regola fisica restano basi esplicite,
non conclusioni certificate da un confronto fra due JSON.

Le letture IL sono limitate ai callee di board, caricamento, packet e
inizializzazione/presentazione selezionati. Header, offset PE, dimensioni,
raw/code hash sono ricontrollati sui byte della DLL; consumo delle istruzioni
e salti sono controllati dall’estrattore. Non si esegue codice originale.
Comandi riproducibili, con il solo interprete/vendor autorizzati del README:

```text
PYTHONDONTWRITEBYTECODE=1 <python-autorizzato> .scratch/issue124-battle/helpers/verify_inputs.py
PYTHONDONTWRITEBYTECODE=1 <python-autorizzato> .scratch/issue124-battle/helpers/check_raw.py
PYTHONDONTWRITEBYTECODE=1 <python-autorizzato> .scratch/issue124-battle/helpers/check_bundle_bytes.py
PYTHONDONTWRITEBYTECODE=1 <python-autorizzato> .scratch/issue124-battle/helpers/check_contract.py
PYTHONDONTWRITEBYTECODE=1 <python-autorizzato> .scratch/issue124-battle/helpers/verify_il_and_inventory.py
```

Sono conservati errori e correzioni degli helper: serializzazione byte/token,
DLL di supporto e caricamento duplicato, path prefab non ancora ripulito,
buffer texture non registrato, mesh combinata/non combinata, commenti CSV
ripetuti e wrapper dei parametri. Il primo accesso web all’immagine tramite
il convertitore FFG è fallito per timeout; il CDN originale ha risposto200.
Una vecchia pagina news ha rediretto all’indice: non è usata come prova.

Questa consegna modifica soltanto il rapporto. Nessun gameplay/UI/schema,
pack, dipendenza o test modificato; nessuna build, suite canonica923,
Unity/JIT, host, browser di gioco, salvataggio personale o tavolo live
avviato o ispezionato. Nessun push, PR, merge o write GitHub. Review fresche
Standards/Spec, riproduzione e integrazione spettano al Root.

[rr]: https://images-cdn.fantasyflightgames.com/filer_public/01/a0/01a0c9f7-4427-4113-9406-f53d6bde2ff5/journeys_in_middle-earth_rules_reference.pdf
[it]: https://cdn.svc.asmodee.net/production-asmodeeit/uploads/2022/09/Viaggi_nella_Terra_di_Mezzo.pdf
[faq]: https://cdn.svc.asmodee.net/production-asmodeeit/uploads/2022/09/jme_faq_ita.pdf
[errata]: https://cdn.svc.asmodee.net/production-asmodeeit/uploads/2022/09/JME_Carte_Aggiornate.pdf
[product]: https://www.fantasyflightgames.com/en/products/the-lord-of-the-rings-journeys-in-middle-earth/
[boards]: https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/jme01_fan_battle-map.png
