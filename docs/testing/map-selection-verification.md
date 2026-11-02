# Selezione delle quattro sezioni: verifica #46

2 novembre 2026, Node **24.11.1**, TypeScript strict. Base contenente
`e66317daec43ab5a61fc13899268aae9f12b66f3`.
[Specifica](../planning/map-selection-spec.md),
[piano e registro](../planning/map-selection-plan.md),
[contratto fonte](../research/first-adventure-map-generator-contract.md).

## Incremento consegnato

`src/map-selection/selection.ts` espone `selectMapTiles(unknown)` e il tipo
`SelectionResult`; `model.ts` valida/clona input e riferimenti, `pools.ts`
prepara i pool ordinati. La build produce `dist/map-selection-library.mjs`
e la CLI reale `dist/map-selection.mjs`. La libreria conserva lo stato mutabile
all'interno della singola attempt. Due consumatori reali, CLI geometria e CLI
selezione, condividono soltanto lettura limitata e pubblicazione esclusiva in
`src/map-io/files.ts`.

Il checkpoint è **dopo optional-size / prima dei bordi locali**,
`06003c93:0618–062d`. Il risultato contiene input normalizzato e fingerprint,
pool realizzati, ordine standard completo, scaling, AvailableTiles/totali,
flags distinti per bucket, trace/search e snapshot RNG. `scope: selection-only`
non è una mappa importabile nel tavolo. Host, UI, sessione, schema, RNG dei
mazzi e i precedenti comportamenti geometrici restano separati.

## Verifica pubblica

`tests/map-selection.test.mjs`: **49/49**, fixture inventate, processi CLI
effettivi e un controllo sulla libreria con input profondamente congelato.
Copertura comportamentale:

- Contratto/versioni/provenienza/indici/riferimenti, seed signed, input 8 MiB,
  opzioni duplicate, fingerprint dei byte e del JSON normalizzato, replay,
  immutabilità e rifiuto della sovrascrittura con pulizia del file temporaneo.
- Ordine lingua/traits/history/repeatability, normal fisso escluso, chain
  sbloccate, quantità sommate per prodotti, occorrenze esatte nel gruppo,
  una presenza per eroe, upgrade transitivi e null. I retry conservano duplicati
  e modelli ora esclusi dai filtri, mescolando l'intero item pool trattenuto.
- Standard completo prima dello scaling, shuffle unitari e vuoti, H3 con copia
  di tutti i quattro builder ed extras permutati [2,1,1]. Mixture senza clamp,
  compresa uguaglianza al float32 `0.6880244016647339`, che sceglie chain.
- Tutti gli ID prima di tutte le inizializzazioni; tutti gli start prima dei
  required; IsStandard ignorato; shadow custom senza fallback; flags per faccia,
  ownership e phantom, anche nel rollback senza tessera da restituire.
- Matching uno-a-uno con ritorno sui precedenti indici; euristica HasAny distinta
  dal matching full-mask, comprese maschere signed. Prenotazioni, opposite,
  rifiuto dei bit di set esterni e max+extra. Dead end reali in trait e minimum.
- Trie con Count dei discendenti e cancellazione dei figli finali, pulizia tra
  fasi, optional senza rollback e uguaglianza al fattore
  `0.9417566061019897`, che tenta ancora una tessera. Fallimenti fonte distinti
  dal budget amministrativo e da input non ammessi dalla politica del port.

Due mutazioni del trie sono state eseguite separatamente nella build CLI:
entrambe producono un test rosso. Ripristinato il codice corretto, tutti i test
sono verdi. I log restano nella scratch ignorata.

Il root ha aggiunto due regressioni dopo la review: saltare scaling e shuffle
quando tutte le sezioni lo ignorano, e rifiutare capacità minime superiori
alle massime prima di selezionare. Entrambe osservate rosse, poi verdi.
Il [rapporto di revisione](../reviews/2026-11-02-map-selection.md) separa i
rilievi dei revisori dall'evidenza eseguita dal root.

Gate finali eseguiti nel root dopo le correzioni:

| Comando                | Esito                                                                            |
| ---------------------- | -------------------------------------------------------------------------------- |
| `npm test`             | **151/151**, zero failure/skip; comprende la build e i test geometrici esistenti |
| `npm run typecheck`    | exit 0                                                                           |
| `npm run format:check` | exit 0                                                                           |
| `git diff --check`     | exit 0                                                                           |

Nessuna dipendenza installata. Un symlink locale usa i node_modules esistenti;
il pattern gitignore comprende anche il symlink. I test usano directory
temporanee e istanze proprie; l'host 4339 non è stato controllato o modificato.

## Originali privati

Normalizzazione read-only del pack e degli oggetti auditati, con verifica delle
impronte e risoluzione dei puntatori/indici senza fallback. Input normalizzato:
120 prefab standard, 1 custom, 4 sezioni, 373 encounter, 15 gruppi, 78 quantità
item di prodotto e **99 modelli item nell'unione** fra ordine prodotto e closure
auditata (89 riferimenti di closure, non tutti presenti nelle 78 voci prodotto).
Nessuna selezione originale è inclusa in Git.

Supplemento letto tramite gli helper auditati, con bytecode cache disabilitata:
sei HeroModel base e la TileSpace custom. La compagnia principale usa prefissi
degli eroi ID **[1,2,3,4,5]**, con oggetti iniziali espliciti:

| Eroe / source | Item IDs nell'ordine armor, weapon, second weapon non null |
| ------------- | ---------------------------------------------------------- |
| 1 / S2107     | [43,21,30]                                                 |
| 2 / S2108     | [43,17]                                                    |
| 3 / S2109     | [49,5]                                                     |
| 4 / S2110     | [49,5,27]                                                  |
| 5 / S2111     | [37,1]                                                     |
| 6 / S2112     | [49,13]                                                    |

`S` indica `sharedassets0.assets`. Compagnia alternativa H3: **[6,4,3]**.
Lingua Italian, adventure ID1, prodotto posseduto ID0, GroupItemIds vuoto,
used encounter/group e unlock vuoti. Non sono stati letti salvataggi personali.

Set di seed per ciascun H: **0, 1, −1, −2147483648, 2147483647,
411398192, −80977**. Totale **47/47** selezioni: 35 nuove attempt principali,
7 con compagnia alternativa e 5 retry al seed2 con pool provenienti dal seed1.
K è calcolato per ciascun contesto da tutti i modelli e risulta **16** per queste
compagnie: non è una costante introdotta nel generatore.

| H   | Casi | Prelude nuovo / retry | Intervallo campioni al confine | Rollback / phantom complessivi |
| --- | ---: | --------------------- | ------------------------------ | ------------------------------ |
| 1   |    8 | 271 / 287             | 275–291                        | 21 / 38                        |
| 2   |    8 | 275 / 291             | 280–298                        | 12 / 45                        |
| 3   |   15 | 275 / 291             | 279–297                        | 0 / 73                         |
| 4   |    8 | 275 / 291             | 279–295                        | 0 / 40                         |
| 5   |    8 | 275 / 291             | 279–298                        | 0 / 49                         |

Il checker separato confronta tutto lo stato RNG del preludio con un riferimento
Python, ordine dei tre shuffle pertinenti e stato trattenuto. Verifica
`120+(H>1?4:0)+135+K` per le attempt nuove e usa 32 item trattenuti nei retry.
Confronta ogni draw optional e lo snapshot finale, confermando che non sono
stati consumati sorteggi geometrici. Controlla quattro sezioni ordinate,
matching con un algoritmo indipendente a cammini aumentanti, capacità,
ownership, opposite, liste richieste e flags ricostruiti dalla trace. Massimo
budget consumato osservato: **6.831** operazioni, a fronte di 1.000.000 esplicite.

[Evidenza pubblica, solo metadati e impronte](map-selection-private-evidence.json).
Riproduzione locale e output completi, ignorati da Git, nel checkout assegnato:

- `.scratch/selection/normalize.py`, `normalized-a1.json`, `companies.json`;
- `.scratch/selection/matrix.py`, `matrix-v2/`, `matrix-evidence.json`;
- `.scratch/selection/source-file-verification.json`, `supplement.json`;
- `.scratch/selection/npm-test.log`, `selection-final.log`,
  `mutation-trie-count.log`, `mutation-trie-clear.log` e log rossi delle slice.

Impronte SHA-256:

| Artefatto privato             | SHA-256                                                            |
| ----------------------------- | ------------------------------------------------------------------ |
| normalized-a1.json            | `2af7be4255692e75c1e6f56b7df24c7a752f734aacb5aa6f6624e2433a4231b6` |
| matrix-evidence.json          | `e753d279a8f1cec775d1cbe95010dfc0face6667aabd86a296a773c9e6374a9a` |
| normalize.py                  | `831455e252edb90a5fd9c1984f28fc96d551e0a23d149bcbb30dedf517b7612c` |
| matrix.py                     | `8e98c3b54249eca8594791309a89419b1064e1f86e3ce0ad6d6264de00742ab9` |
| supplement.json               | `fb3eefac99b126b161fd98e1d4872cf4a40313212604f258c5b529b9339b25b4` |
| source-file-verification.json | `7d8a8e8885e42832a119c032efb9dd1bc57cec60fea072040526bcae849b3f1e` |

Il file di verifica registra il confronto riuscito delle cinque impronte dei
file installati (Assembly-CSharp, mscorlib, resources, sharedassets0, level4)
con il contratto. Il manifest normalizzato conserva anche le tre impronte del
pack originale già pubblicate nel contratto. L'implementatore non ha scritto
i dati root. All'integrazione il root ha copiato l'evidenza nella propria
scratch e rieseguito i 47 casi, prima e dopo le correzioni: stessa impronta
`e753d279a8f1cec775d1cbe95010dfc0face6667aabd86a296a773c9e6374a9a`.

## Fonte, adattamenti e limiti

Owning source: CreateMap `06001319:00fb–0527`, inizializzazione e selezione
`06003c93:0066–062d`; sezioni `06001345–1355`, `1358–1359`; matching
`135e–135f`; trie `1361–1369`; lookup/reservations `131c–1324`; bucket
`0e9c–0ea3`; capacità/upgrade `0cbd`, `0d95`, `0d97`, `10f6:024f–02c1` e `10ff`.
Due dettagli verificati direttamente nei corpi: `0e8b` conta HasAny, non
full-mask; `0cbd` restituisce false per null. Le maschere signed negative dei
modelli originali sono conservate, non convertite o scartate.

Il budget `selection-operations-v1` conta visite nei filtri/upgrade, merge,
scaling, start/required, scansioni, cicli e matching (anche l'osservazione finale).
È un arresto amministrativo deterministico, distinto dal Timeout Unity=1.
Versioni, limiti e float32 esatti sono politiche del formato di input del port.
La numerica segue `float32-per-operation-v1`, con Infinity esplicita come stringa
per lo stato mixture. Non viene misurato il clock Unity e non si simula il JIT.

Questa evidenza non è un oracolo completo del coroutine né una certificazione
di parità runtime Unity. Non implementa bordi, layout, incontri, startup,
freeze della mappa o A1 giocabile. **Review indipendenti complete**:
Standards 0 violazioni / 1 suggerimento facoltativo rinviato; Spec 2 difetti
importanti corretti dall'autore con regressioni. #41, #38 e #33 rimangono aperte.
