# Verifica placement degli incontri — issue #51

Base `d735d170073a800757816561bd2c17263c11264e`, verifica 3 novembre 2026.
[Specifica](../planning/map-encounters-spec.md),
[piano](../planning/map-encounters-plan.md),
[contratto fonte](../research/first-adventure-map-generator-contract.md) e
[conteggi/hash](map-encounters-private-evidence.json).
Specifica/piano committati prima del codice (`e44fa8c`). Implementazione nel
solo checkout assegnato, senza subagenti, installazioni o scritture GitHub.

## API e processo

```sh
npm run build
node dist/map-encounters.mjs --input input.json --output nuovo-output.json
```

```js
import { placeMapEncounters } from './dist/map-encounters-library.mjs';
const result = placeMapEncounters(rawInput);
if (result.status === 'encounters-complete') {
  // Assegnazioni, spawn pianificati e storia; prefab ancora da eseguire.
}
```

Input v1 `source-map-encounters-v1`: `assembly` grezzo e `placement` v1 con
provenienza, modelli/refs prefab, parametri di sezione e avventura, gruppo
specificato opzionale, più politica di esecuzione esplicita.
`tests/fixtures/map-encounters.mjs` mostra il formato interamente inventato.
Il parser controlla corrispondenza con selection, ordine/identità completi,
provenienza comune, TileModel identity e normalizzazione Prefab.Path/resource key.
Il pack privato aggiunge anche l'hash del resource manager alla provenienza.
Gli hash sono identità dell'input, non certificati di attendibilità del chiamante.

Ricalcola `assembleMap`, poi continua il suo SourceRandom. Nessuno snapshot
geometrico o RNG del chiamante è accettato. La preferenza Threat usa soltanto
`spaces[].connected` fonte. Nessun cambiamento a map-assembly o al grafo di
movimento sviluppato separatamente.

Output `encounter-placement-only`, immutabile in profondità; checkpoint solo
`after-encounter-history-before-prefab-execution` su `encounters-complete`.
Conserva allSpaces prima/dopo shuffle, assegnazioni con origine e NodePosition,
metadati dei modelli selezionati, ordine placement/spawn distinti, gruppo,
pool trattenuti, storia entrante/risultante, trie/history/cursori, trace/draw e
RNG completo. I nuovi ID restano int32 completi, inclusa la history di rollback.

CLI: massimo 64 MiB, input preservato, pubblicazione completa esclusiva tramite
`map-io`. Exit 0 successo; exit 2 diagnostico source-failure,
source-operation-exception o administrative-stop con checkpoint nullo; exit 1
input/I/O senza nuovo risultato. Non rigenera automaticamente attempt fallite.
Il successo contiene un sommario assembly; il debug geometrico completo compare
soltanto come diagnostico upstream su fallimento. Questo risultato di verifica,
inclusa la trace degli incontri, **non è un payload di salvataggio**: la futura
proiezione minima realizzata appartiene al successivo incremento di sessione.

## Contratto e test

51 nuovi test, baseline 193 invariata: **244/244** con `npm test`.
`npm run typecheck`, `npm run format:check` e `git diff --check` passano.

- CLI reale: sei fixed sintetici, validazione, output esclusivo, tutti gli stage
  concatenati con rollback/fallback del gruppo e fill best effort, budget e I/O.
- Libreria: clone/freeze; shuffle completo con draw singleton; traits all/any
  esclusi, identità TileModel anche a hash condiviso; Threat tie-prefix minimo;
  section/adventure rollback riuscito/esaurito senza rewind, primo modello
  fallito e scope null/array vuoto.
- Gruppi: filtri su tutti i membri, capacity, history/language senza filtri
  aggiuntivi, Comparison sort sopra 16, specified non posseduto, required/optional
  distinti, trie persistente, cleanup e lista optional vuota con count positivo.
- Item: primo fit, massimo uno e nessun duplicate guard inventato; normal fill
  float32 frazionario/inclusivo di fixed, gruppo e item, pool unico ed esaurimento,
  nessun append alla history. Spawn order e addUnique della storia separati.
- Errori/budget: modello non posseduto, compresa l'indicizzazione unchecked del
  log fonte (`A3c93:191b–1923`); operation/trace/clock amministrativi, upstream,
  replay esatto e osservazioni mancanti/residue. La depth del replay incontri
  supera quattro; overflow della soglia float32 è serializzato come `Infinity`.

Cicli RED→GREEN registrati privatamente in `red-01.log`/`green-01.log` (CLI e
fixed), `red-02.log`/`green-02.log` (required), `red-03.log`→`green-04.log`
(gruppi/item/fill) e `red-04.log`/`green-04.log` (depth replay e overflow).
`green-03.log` conserva la failure intermedia della fixture descritta qui sotto.
La prima prova di required-group rollback selezionava il modello impossibile
prima di collocare alcunché dopo shuffle: la fixture è stata resa deterministica
con un ID richiesto due volte, conservando il comportamento fonte.
Le ulteriori prove di confine e l'integrazione CLI ampliano questi contratti.

## Prova privata riproducibile

Directory di lavoro: `.scratch/encounters/`, ignorata. `normalize.py` legge solo
i metadati già auditati, i 47 file geometrici selettivi e l'H3/seed1 corretto del
root; non importa audit globali e non copia la directory assembly da 4 GiB.
`verified/` conserva47 nuovi input e i rispettivi output della CLI reale.
Politica incontri: `encounter-operations-v1`, maxOperations 1.000.000,
maxTraceEvents 200.000, logical-clock-v1 step 0, timeout 30.000 ms.
Sono budget del port; non certificano clock, float o JIT Unity.

`check.py` ricalcola placement e decisioni in Python senza importare src/dist
o eseguire JavaScript. Usa la geometria precedentemente auditata come confine,
controllando fingerprint, RNG e tutte le caselle/grafo contro il ricalcolo CLI.
Estrae soltanto le dichiarazioni pure RNG/Comparison sort dal checker corretto
del root tramite AST; non importa né esegue quel modulo. Verifica separatamente
filtri dei pool, shuffle/merge dai checkpoint di scaling, ordine dei candidati,
ogni decisione/draw, compatibilità, fixed6, unicità, trie/rollback, gruppo,
spawn e storia. Confronta tutti i 56 slot, indici e ordinale finale del RNG.

**47/47** attempt complete, senza eliminare risultati: **666 assegnazioni,
7.748 decisioni, 2.683 draw, 94 rollback, 40 scelte Threat**. Gli arresti/errori
sono verificati nelle fixture inventate, non presentati come successi privati.

H3/seed1 concreto: **22 caselle, 15 assegnazioni**, RNG **292→348**,
157 eventi, 462 operazioni del port. Due nodi selezionati sulla 302A; ID,
prefab e NodePosition rimangono privati. Output 229.606 byte, due esecuzioni con
byte identici. L'H3 corretto del root sostituisce il solo input omonimo;
compagnia, seed e retry-state degli altri 46 rimangono quelli forniti.

Comandi dal checkout (Python esistente, nessuna installazione):

```sh
task_python=/Users/silvioceccarini/.t3/projects/lotr-interactive-table-game/.scratch/unity-audit-venv/bin/python
PYTHONDONTWRITEBYTECODE=1 "$task_python" .scratch/encounters/check.py
PYTHONDONTWRITEBYTECODE=1 "$task_python" .scratch/encounters/verify-prefabs.py
PYTHONDONTWRITEBYTECODE=1 "$task_python" .scratch/encounters/verify-il.py
node dist/map-encounters.mjs --input .scratch/encounters/verified/H3-seed1.input.json --output .scratch/encounters/H3-seed1.nuova-prova.output.json
cmp .scratch/encounters/verified/H3-seed1.output.json .scratch/encounters/H3-seed1.nuova-prova.output.json
```

Il file destinazione deve essere nuovo. `normalize.py` e `matrix.py` documentano
la ricostruzione dell'intera matrice; `matrix.py` rifiuta output già esistenti.
Manifest e digest dei programmi/evidenze sono nel report JSON pubblico.

## Prefab e limiti del passaggio a startup

`verify-il.py` ridecodifica **18 corpi owning / 8.708byte**, controlla dimensioni
delle istruzioni e target dei branch e confronta i file già consultati.
`verify-prefabs.py` verifica solo **72 EncounterModel selezionati e 72 GameObject
root distinti**: 144 oggetti / 19.880 byte, 441 occorrenze di puntatori, consumo
esatto e agreement dei due reader. Resource manager: 1.750.076 byte, senza
pointer walk globale; mapping dei soli selezionati. Hash dei file originali
riconfrontati con quelli auditati. Zero traversate FSM e zero istanziazioni.

`selected-prefabs.json` conserva la lista realizzata per ciascun caso e le
componenti root; `H3-seed1.selected302A.json` contiene i due nodi startup,
riferimenti e closure pendente: FSM attached/child, FsmTemplate, RunFSM annidate,
variabili/eventi, pacchetti/chiavi Italian, modelli/item/nemici/token, parametri
e tipi di azione/effetti, PRE_REVEAL/REVEALED/interazione/hide/remove e stato
condiviso del gruppo. Nessun effetto dedotto da ID, NodeType, traits o titolo.

I risultati dichiarano `sourceParity: not-certified`: è verificato il modello
portabile, senza esecuzione Unity/JIT. #38 deve chiudere la closure selezionata
prima dell'auto-esplorazione e dell'obiettivo 0. Freeze minimo/sessione,
backup/ricevute e frontend non fanno parte di questo incremento; #41/#38/#33
restano aperte. Review fresche Standards/Spec, integrazione e merge al root.

## Integrazione root sopra il movimento

Integrato sopra `1e2fa93`, che comprende anche #50. Review fresche:
[Standards/Spec](../reviews/2026-11-03-map-encounters.md), zero violazioni
Standards e un suggerimento facoltativo rinviato; un P2 Spec corretto.
La collezione owned dei gruppi ora applica AddUniqueItem della fonte prima
di filtri e shuffle, preservando la prima occorrenza. Due regressioni
rosse→verdi coprono ripetizioni nello stesso prodotto e fra due prodotti.

Root **275/275** test, zero skipped, tipi/formato/diff con exit0.
Matrice rigenerata prima e dopo la correzione: **47/47**, entrambi i
controlli riproducono gli output del child byte per byte. Conteggi invariati:
666 assegnazioni, 7.748 decisioni, 2.683 draw, 94 rollback, 40 scelte Threat.
Il checker Python root include la deduplica verificata sulla fonte.
Impronta riepilogo root:
`3ae7bc1e7b724722e0bc392a187e2f72beb06e7dfa8dfb012c0b9beed60f958a`.
Il replay privato H3 consuma tutte le 462 osservazioni dello stage incontri,
riproduce assegnazioni/storia/search/trace/RNG e ha byte identici tra due
esecuzioni. File e log root: `.scratch/encounters-root-review/`.

La geometria e il movementGraph rimangono consumatori separati; #53 dovrà
costruire la proiezione minima salvata. La closure dei prefab selezionati
resta un prerequisito di #38, senza esecuzioni o dati narrativi pubblicati.
