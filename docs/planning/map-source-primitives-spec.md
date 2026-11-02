# Primitive di scelta del generatore

Primo incremento dopo #42 del generatore #41. La
[ricerca completa](../research/first-adventure-map-generator-contract.md)
definisce algoritmo e ordine delle fonti. Questo incremento consegna il
nucleo verificabile di casualità e ordinamento, senza avviare l'avventura.

## Confine

Node 24, TypeScript strict, Zod ed esbuild già presenti. Nessun pacchetto
aggiuntivo. Modulo `src/map-generation/`, esportato dalla build in
`dist/map-primitives.mjs` per consumatori e prove sull'interfaccia pubblica.
Nessuna modifica a host, salvataggio attivo, UI o casualità dei mazzi.
I dati e l'interprete delle fonti originali restano privati; le fixture
pubbliche contengono soltanto numeri e identità inventate.

## Casualità

`SourceRandom(seed)` accetta un intero signed int32. Espone `next()` (campione
intero originale), `nextDouble()`, `nextInt(min,max)` e
`nextFloat32(min,max)`, oltre a `snapshot()` e `SourceRandom.restore(unknown)`.

- Riprodurre il System.Random sottrattivo installato: 56 slot, indici 0/21,
  seme minimo convertito al massimo positivo, inizializzazione e quattro
  passaggi di mescolamento con aritmetica int32 unchecked.
- `nextDouble` moltiplica il campione per il double compilato
  `4.656612875245797e-10`. L'intervallo intero è `[min,max)`, con percorso
  a due campioni per ampiezza superiore a Int32.MaxValue. Anche intervalli
  vuoti o unitari consumano un campione; argomenti invalidi non lo consumano.
- Il contatore indica i campioni interni, non le chiamate pubbliche.
  Non perdere precisione superando Number.MAX_SAFE_INTEGER: una nuova
  operazione che richiederebbe più campioni deve fallire prima di mutare lo stato.
- Snapshot versione 1 con algoritmo identificato, seme signed originale,
  copia dei 56 slot, indici e contatore. Validare dimensioni, range, slot0
  inutilizzato e coerenza degli indici col contatore. Ripristino e snapshot
  non devono condividere array modificabili con il chiamante.
- `nextFloat32` rende esplicita la politica numerica
  `float32-per-operation-v1`: estremi, conversione del campione, differenza,
  prodotto e somma arrotondati a float32. Accetta estremi finiti anche in
  ordine inverso; rifiuta conversioni/differenze non finite prima della pesca.
  Il campione convertito può raggiungere 1. Questa politica portabile è
  distinta dalla futura certificazione del floating stack/JIT Unity nativo.

`sourceShuffle(items,random)` modifica la lista nell'ordine originale:
per ogni i crescente scambia i con `nextInt(0,items.length)`. Conta l'intera
lista ogni volta, anche per l'ultimo elemento e le liste di un elemento.
La lista vuota non consuma campioni. Nessuna conversione a Fisher–Yates.

## Ordinamento

`comparisonSort(items,compare)` modifica la lista secondo il percorso
Comparison dell'ArraySortHelper installato. Conserva l'ordine delle chiamate
al comparatore e l'ordine risultante delle identità a chiave uguale.

Introsort con profondità `2*FloorLog2PlusOne(n)`; taglia 16, casi specifici
2/3 elementi, insertion sort con confronti stretti, pivot mediana low/mid/high
spostato a high−1, scansioni e scambi dei pari, ricorsione destra prima
dell'iterazione sinistra, heapsort alla profondità zero. Non usare
Array.prototype.sort e non aggiungere uno spareggio sugli ID.

Il comparatore riceve elementi presenti e restituisce un signed int32,
come Comparison<T>. Un accesso oltre la lista o un risultato non valido
deve fallire esplicitamente; una callback che lancia propaga il fallimento.
Un fallimento può lasciare la lista parzialmente ordinata, come la fonte:
il chiamante usa copie di lavoro, senza pubblicarle come risultato completo.

## Fonti e prove

Assembly-CSharp.dll SHA
`8869ef87b7d49f4993911904e35d78b72f8339e91158bbe8784c9691a9d743c6`;
mscorlib.dll SHA
`9434e43dd58f9e3aba5b76c94f5da7fcec20c1bce2186c830039aa77c439b47a`.
Random `0x06000ee2–0eeb`, FFGTools.Randomize `0x06000ae2/0ae4`,
FFGRandom.Next `0x06000ab8`, Comparison sort `0x06006929–6930` e utility
FloorLog2PlusOne; le citazioni complete sono nel contratto della ricerca.

Prima dell'implementazione produrre un oracolo privato che esegua i corpi IL
selezionati, senza lanciare Unity o leggere salvataggi. Da esso ricavare
vettori pubblici inventati per semi 0, ±1, estremi int32; interi a due
campioni; shuffle e consumo; sort con identità pari su taglie 0/1/2/3/4/16/17/32
e partizioni grandi, compreso un caso che raggiunga heapsort. Confrontare
anche la sequenza delle chiamate al comparatore. Coprire ripresa intercalata,
isolamento degli array, input malformati e campione float32 che raggiunge 1.

L'oracolo confronta i corpi IL selezionati, non l'intero runtime Unity.
Il generatore completo resta aperto: bucket da 120 elementi, pool, ricerca,
clock, geometria delle quattro sezioni, incontri e congelamento in #41;
copione in #38; partita completa dalla UI in #33.
