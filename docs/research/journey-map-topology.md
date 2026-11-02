# Topologia delle tessere viaggio e frammento iniziale verificato

Audit locale del 2 novembre 2026. Fonte primaria: copia privata Steam JiME
**1.6.6#1128**, build **24301165**, Unity **2022.3.62f2**, già inventariata in
[official-app-inventory](official-app-inventory.md). Nessun avvio o modifica
dell'app, accesso ai salvataggi personali o nuova dipendenza.

## Risultato utilizzabile

La faccia standard **302A** contiene **tre caselle** con grafo reciproco
**0–1–2**; manca il collegamento 0–2. La collocazione iniziale degli eroi
dell'avventura 1 usa l'**indice sorgente 1**. Nella nuova interfaccia le tre
caselle sono numerate 1/2/3, quindi questo indice è presentato come Casella 2.

La tessera è resa nel proprio **orientamento canonico**. L'app sceglie
casualmente la rotazione iniziale: questa ricerca non certifica una sua
rotazione concreta, la disposizione completa dell'avventura 1, i collegamenti
fra tessere o il generatore. Il frammento isolato è una base reale per viaggio
e posizioni, non un'avventura giocabile o una nuova mappa inventata.

## Provenienza e collegamenti

- `ProductModel sharedassets0.assets:2319`, prodotto base `_id=0`, elenca
  44 facce `TileModel`. La topologia non è nel modello: è nei prefab della
  scena `Data/level4`, filtrati mediante quei riferimenti.
- Per 302A: `TileModel sharedassets0.assets:2705`, `Tile level4:20266`, array
  ordinato `Spaces` → `level4:16668`, `18948`, `20495`.
- `TileSpace.ConnectedSpaces` restituisce `[1]`, `[0,2]`, `[1]`. Ogni casella
  contiene rispettivamente 5, 3 e 4 esagoni geometrici: non sono dodici
  caselle di movimento. Tutte hanno il tratto boscoso; la terza ha anche
  elevazione. Questi effetti non sono automatizzati dal frammento corrente.
- `HexCoordinates`, mesh e `HexUVMapping.UVs` forniscono appartenenza,
  sagome e corrispondenza immagine. La relazione usata è `TileSpace.Hexes`;
  il puntatore inverso nel prefab è nullo.
- `ResourceManager globalgamemanagers:13`, percorso risorsa della texture
  302A → `resources.assets:213 Texture2D`, 1024×1024. La sagoma renderizzata
  usa l'unione dei dodici poligoni UV, non un ritaglio stimato a occhio.
- `AdventureModel sharedassets0.assets:805`, avventura 1, non pregenerata;
  `resources.assets:22701 SectionBuilder` richiede come partenza la standard
  302A. La custom 100A richiesta dalla sezione è una forma diversa dalla
  faccia standard omonima.
- FSM principale `resources.assets:20275`: rivelazione di `StartTileId`, poi
  `HighlightTileSpace(SpecifyIndex=true, IndexSpace=1)`. IL verificato:
  `CoroutineAttachNextTile` forza la tessera specificata per la prima
  collocazione; `Map.StartTile` legge la prima tessera della prima sezione;
  l'evidenziazione indicizza direttamente `Spaces[1]`.

## Controlli e limiti

Estratte tutte le **44 facce base**: **106 caselle**, **426 esagoni geometrici**,
**1.076 bordi** tipizzati. Verificati **5.960 oggetti**, **18.877 occorrenze di
puntatori non nulli** e reciprocità dei collegamenti interni. Letture complete
con `check_read=True`, confronto C/Python e classi dei puntatori controllate,
riusando gli helper delle precedenti ricerche. Nessun errore registrato.

I tre centri 302A ricadono nei propri poligoni; la conversione Unity→UV ha
residuo massimo di 0,001847 pixel nel corpus. Il disegno usa comunque gli UV
originali. Bordi e vicinanza visiva non bastano per collegare tessere:
`MapBuilder.CalculateConnectedSpaces` verifica anche compatibilità dei
giunti e stato dei passaggi. Tale composizione non è stata ricostruita.

Artefatti privati esclusi da Git: `.scratch/travel-source-audit/`, rapporto
`findings.md`, estrazione `base-topology.json`, pacchetto minimo
`map-pack-minimal.json`, script e registri di verifica. Il pacchetto conserva
impronte e riferimenti delle fonti. Immagine PNG 302A:
`60c09984e8d834a5a2e25a43f34b56c2554f8e17ac5b0d7afb5778fbee4c2324`.
Assembly: `8869ef87b7d49f4993911904e35d78b72f8339e91158bbe8784c9691a9d743c6`.

Il risultato attesta l'estrazione di questo corpus; non certifica semantica
completa degli scenari, casualità o fedeltà del futuro motore della campagna.
