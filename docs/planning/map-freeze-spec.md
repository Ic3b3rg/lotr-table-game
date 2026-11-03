# Congelamento A1 nella sessione — #53

Base `e27a4b727bd5550cf74239193538045272343213`, 3 novembre 2026.
Autorità: [issue e commenti](https://github.com/Ic3b3rg/lotr-table-game/issues/53),
[generatore](../research/first-adventure-map-generator-contract.md),
[startup](../research/first-adventure-runtime-contract.md),
[movimento](../research/map-movement-contract.md), ADR0001/0002 e API #51/#50.
Specifica scritta prima del codice; esecuzione autonoma autorizzata nel solo
checkout T3. Root esegue review Standards/Spec e integrazione.

## Risultato e confine

Dopo la preparazione, un partecipante conferma «Crea la mappa». L'host
accetta l'intento e salva il lavoro pendente; un worker esegue la pipeline
grezza validata. Il risultato minimo validato viene salvato una sola volta.
Il percorso mostra avanzamento, interruzione/ripresa ed esito salvato, condivisi
fra tutti i dispositivi. Nessun comando o percorso di lettura avvia gli effetti
degli incontri. Il checkpoint è prima di `BeginAdventure(false)`; closure dei
prefab, nodi iniziali, obiettivo0, Scoperta2 e Spirito1 restano a #38.
Non si inventano posizioni/rivelazioni per usare `JourneyDefinition`.

## Pacchetto e contesto

Pacchetto privato v1, bounded, con digest canonico dell'intero contenuto
normalizzato. Contiene template grezzi selection/geometry/placement, metadati
avventura/builder, mapping catalogo→HeroModel/ItemModel e provenienza verificata.
Non contiene un contesto H3 di produzione. Il mapping è vincolato all'hash
completo del catalogo e alle sue fonti; riferimenti, quantità e upgrade sono
verificati contro gli input selection. Nessuna dipendenza nuova.

Per una nuova A1 base, lingua/prodotti e storia iniziale vuota sono metadati
espliciti del pacchetto. H, ordine eroi, proprietari, copie equipaggiate e ID
originali derivano dalla preparazione salvata, non dai suggerimenti iniziali.
Gli oggetti di compagnia sono distinti dall'equipaggiamento degli eroi.
Il contesto normalizzato e il suo fingerprint includono tutte queste scelte,
catalogo, storia entrante e identità fonte. K resta un risultato dei filtri.

## Stati e transazioni

Schema9 aggiunge `mapGeneration: null | pending | paused | frozen`.
Migrazione 1–8 aggiunge soltanto null e conserva gli stati intermedi legacy,
ricevute, giocatori, mazzi, prove, Scoperte, turni e movimento. Una vecchia
mappa resta legacy; non diventa una realizzazione A1.

`GENERATE_ADVENTURE_MAP` porta requestId, generation, expectedRevision,
packFingerprint, contextFingerprint e seed richiesto opzionale. Se assente,
il seed è scelto dall'host con casualità di sistema int32, distinto da inspector
e RNG del generatore. Identità, compagnia pronta, assenza di richieste/round/
mappa legacy e offer corrente sono verificate prima di registrare l'intento.
`RESUME_ADVENTURE_MAP` aggiunge l'identità del lavoro pendente e conserva seed,
contesto e input entrante. Non accetta dati di risultato o checkpoint arbitrari.

1. `Store.once`: atomico intento, stato pending, revisione e ricevuta pending.
2. Worker per attempt: nessuna transazione SQLite lunga; HTTP resta disponibile.
3. Fallimento fonte con ErrorCode: transazione del nuovo confine pulito,
   seed+1 unchecked int32, timeout6→12→18→24→30s, pool e storia trattenuti.
4. Successo: transazione di proiezione validata, storia, continuazione,
   revisione e ricevuta finale dell'intento. Il risultato viene scartato se
   generation/job/contesto non coincidono più, anche dopo restore.

Doppio invio restituisce la ricevuta; un altro partecipante non avvia un
secondo lavoro. Dopo crash pending si riprende soltanto con comando esplicito,
dal confine pulito salvato. Dopo commit prima della risposta si ritrova la
ricevuta finale. I comandi che potrebbero saltare startup sono bloccati.

## Politiche del port

`node-clean-attempt-v1`: clock logico step0; timeout fonte nominato per attempt,
budget selection/assembly/encounters e trace espliciti. È un adattamento Node,
non parità Unity/JIT/clock/float. Replay di un'attempt pulita è deterministico;
nessun checkpoint RNG isolato è sufficiente o accettato. L'assembly viene
ricalcolato per la geometria e confrontato con il sommario upstream di #51,
compresi fingerprint, ordine, caselle e RNG al confine.

Una attivazione ha un limite amministrativo di attempt; raggiungerlo lascia
il prossimo confine pending/paused, senza mappa. Errori unchecked e budget
amministrativi non diventano Timeout Unity né successi parziali. I retry
trattengono pool random/item e percentNormal, non ricreano il builder vuoto.
La cronologia degli attempt è bounded; un suo limite è un arresto esplicito.

## Proiezione v1 e validazione

Solo la pipeline corrente può produrre la prima realizzazione. Proiezione
stretta, bounded e fingerprint canonico sui dati normalizzati completi:

- identità algoritmo/validatore/fonti/pacchetto/contesto, seed richiesto e
  riuscito, attempt e politiche; RNG iniziale, al confine geometrico e finale;
- quattro sezioni in builder order e map order, tessere selezionate in ordine,
  prefab/bucket/model/hash/opposite/code e indici; rotazioni e pose, esagoni
  local/section/global, input e riferimenti selezionati necessari al rendering;
- caselle con ID stabile source-qualified, fonte/indice/traits/oscurità,
  appartenenza esagoni e node anchor realizzato;
- grafo fonte separato da movementGraph, autorialità interna e contatti
  traversabili con origine. Occupancy unica, rotazioni coerenti, reciprocità,
  referenze esatte, join richiesti e connettività completa del movimento;
- modelli/prefab selezionati, assegnazioni/origini, placement e spawn order,
  gruppo scelto, storia entrante e risultante verificata con addUnique;
- closure pending per i soli prefab selezionati e continuazione pre-startup,
  senza effetti/spawn eseguiti o gameplay RNG inventato.

Nessun catalogo inutilizzato, candidati, trace o diagnostico da decine di MiB
entra in SQLite/API/backup. I backup verificano sia checksum sia semantica e
fingerprint; un import invalido non modifica il tavolo. Reload/restore del
frozen non richiedono pacchetto, file originali o nuove draw. Un checksum non
è un certificato di autenticità dell'autore di una copia.

## Verifica autorizzata

Seam pubblici concordati dalla richiesta: libreria di proiezione/pipeline,
host HTTP e UI reale. Fixture inventate per test automatici. Cicli red→green
verticali per contesto/pacchetto, realizzazione/validatore, autorità e retry,
recupero/migrazioni/backup, UI. Test backend HTTP/CLI separati dalla prova UI.
Tre identità indipendenti avanzano solo via UI da preparazione a risultato,
reload, recupero e backup/restore su host/dati isolati, porta diversa da4339.
Prova privata A1 H3 con geometria/movimento/incontri reali, roundtrip e pending/
crash. Solo conteggi/hash e rapporti tecnici pubblici; originali in scratch.
Comandi finali: npm test, typecheck, format:check, git diff --check.

Niente Unity, app/salvataggi originali modificati, installazioni, altri
checkout/subagenti o scritture GitHub. #41/#38/#33 restano aperte; #55 non è
prerequisito per congelare metadati con startup pendente.
