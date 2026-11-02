# Geometria della prima sezione

Issue #42, primo incremento della mappa #41 che blocca l'avvio #38. Base
`main` `5a911ed`. La [ricerca dell'avvio](../research/first-adventure-runtime-contract.md)
dimostra la dipendenza dalla mappa completa e dagli incontri iniziali.
Questo incremento consegna un compilatore geometrico riusabile, senza
presentare la sola sezione 0 come avventura giocabile.

## Confine e dati

Node 24, TypeScript strict, Zod ed esbuild già presenti; nessuna dipendenza
aggiuntiva. Modulo di dominio e CLI in `src/map-geometry/`. I test del
compilatore attraversano il processo CLI reale; restano i test HTTP del tavolo.
Nessun cambio a salvataggio, API di gioco, UI o pacchetto mappa attivo.

Pacchetto privato JSON versione 1 con `source` (nome, SHA-256 e riferimento),
`start` e `attachment`. Ogni forma ha ID distinto e riferimento sorgente,
caselle ordinate con tratti/oscurità, esagoni ordinati con coordinate cubiche
intere e indice di casella, bordi con indice di esagono, direzione 0–5, tipo
e apertura, collegamenti interni reciproci rappresentati una sola volta.
Il prefisso dell'ID distingue standard302A dalla custom100A.

Il compilatore valida coordinate (somma zero), identità e indici, unicità di
esagoni/bordi/collegamenti, copertura delle caselle e bordi esterni dichiarati.
Input limitato a 1 MB, due forme da massimo 32 caselle/32 esagoni ciascuna;
coordinate locali entro ±512. Le forme devono contenere l'esagono zero.
Errori non producono un risultato parziale o cambiano un file esistente.

## Composizione

- Input di scelta esplicito: rotazione iniziale intera 0–5 e indice della
  giunzione da applicare. La CLI può prima elencare le giunzioni. Non sceglie
  da un seme e non spaccia la propria lista per l'ordinamento casuale originale.
- Direzioni cubiche originali: `(1,-1,0)`, `(0,-1,1)`, `(-1,0,1)`,
  `(-1,1,0)`, `(0,1,-1)`, `(1,0,-1)`. Rotazione positiva `(x,y,z)→(-z,-x,-y)`;
  direzione opposta = +3 modulo 6. Il primo esagono zero resta all'origine.
- Enumerare bordo esterno del tratto, poi bordo esterno della forma nuova,
  nell'ordine originale esagono/direzione. L'aggancio richiede `IsConnection`.
  Allineare bordi opposti e traslare l'ancora accanto al bordo scelto.
- Rifiutare ogni sovrapposizione e ogni altro contatto per cui `CanMatch`
  è falso. Contare tutti i bordi esterni residui, conservare anche i candidati
  geometricamente equivalenti prodotti da ancore diverse: niente deduplica
  che alteri una futura selezione. Sort/clump, RNG e pool restano in #41.
- `CanMatch` e `IsConnection` restano distinti. Tipi originali numerici:
  0 standard, 100 proibito, 200 acqua, 300/400 rive opposte, 500 ruscello,
  550 strada, 600 passaggio, 700 bloccato. Il 700 permette il contatto ma non
  il movimento; proibito/acqua non agganciano; rive opposte e passaggi aperti
  seguono le condizioni originali, non un confronto visivo.
- Il grafo mantiene le connessioni interne dichiarate e aggiunge soltanto
  quelle fra esagoni confinanti con `IsConnection` vero. Caselle con più
  esagoni restano singole caselle. Collegamenti reciproci e senza duplicati.

## Interfacce e risultato

`enumerateAttachments(pack, startRotation)` restituisce i candidati ordinati
con rotazione, traslazione, ancore e conteggio dei bordi residui.
`composeGeometry(pack, startRotation, placementIndex)` produce il risultato
congelato: pacchetto completo, impronta, scelta, pose, esagoni globali, caselle
e grafo. I dati validati sono immutati dalle funzioni.

CLI `node dist/map-geometry.mjs --input <file> --rotation <0..5> --list`
per l'elenco, oppure `--placement <indice> [--output <file>]` per comporre.
Senza output scrive JSON su stdout; con output crea un file nuovo senza
sovrascrivere. `formatVersion: 1` e `scope: geometry-only` impediscono di
confonderlo con il pacchetto dell'avventura completa.

## Fonti e accettazione

Assembly privata 1.6.6#1128, SHA-256
`8869ef87b7d49f4993911904e35d78b72f8339e91158bbe8784c9691a9d743c6`:
HexMath `.cctor/RotateDirection/FlipDirection` `0x06000a10/0a0a/0a0b`,
HexCube.RotateCoords `0x06000a1c`, Edge `0x06000c06–0c08`,
Tile.GetOutsideEdges/SnapTo/RotateAround `0x06000e92–0e94`,
Section.GetOutsideEdges `0x06000e59`, CoroutineAttachNextTile `0x06003ca4`
e MapBuilder.CalculateConnectedSpaces `0x06001332`.
Inventari e IL restano privati in `.scratch/map-composition-source/`.

Prove CLI pubbliche con dati inventati: sei rotazioni, agganci noti, contatti
incompatibili e sovrapposizioni, rive/passaggi/bloccato, input malformato,
determinismo e output senza sovrascrittura. Verifica privata delle vere
302A/custom100A: quattro caselle, sedici esagoni, tutte le rotazioni, nessun
contatto illegale e grafo derivato dai bordi effettivi. Documentare dati,
impronte e controlli; nessuna certificazione del generatore completo o della
parità runtime da queste sole invarianti. Poi suite, review, PR e merge.
