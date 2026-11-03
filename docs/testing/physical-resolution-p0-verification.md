# Risoluzione fisica coperta P0 — verifica #63

3 novembre 2026, base `cb60ea4f9917cdd878ac8728d3025e7267870819`, baseline419.
[Specifica](../planning/physical-resolution-p0-spec.md) e
[piano](../planning/physical-resolution-p0-plan.md) committati prima del codice
in `0f794b7`. Corpo issue63 letto con gh, nessun commento;61 chiusa con PR62.
Autorità: [contratto61](../research/physical-resolution-runtime-contract.md),
[review61](../reviews/2026-11-03-physical-resolution.md), ADR0001/0002,
baseline, catalogo57 e verifiche/review startup38 e freeze53.
[Metadati di consegna e hash del manifest privato](physical-resolution-p0-evidence.json).

## Risultato e interfaccia

Due mazzi comuni da28 copie, aree coperte degli eroi, prevenzione già concessa
dalla fonte, trasferimenti dalla cima e scarti casuali sotto i mazzi sono
eseguibili e recuperabili nel normale consumer scenario. La prova usa una
**fonte sintetica dichiarata**, con parametri, stati, testi e crediti inventati;
il raw delle carte è quello reale verificato. Non è un incontro originale e
non soddisfa l'avventura completa33.

`src/physical-resolution/` offre freezePhysical, openPhysical, answerPhysical,
validatePhysical e physicalView; `dist/physical-resolution-library.mjs` è la
seam di libreria. Non interpreta prose o annotazioni del catalogo.
Schema/programmi rigorosi sono in `src/shared/physical.ts`; adapter e
riconciliazione fonte in `src/scenario/physical.ts`. Nessuna dipendenza nuova.

L'IR ammette `physical` soltanto nel manifest `synthetic-physical-p0`, con tipo
`Synthetic.PhysicalProgram`, nome esplicitamente sintetico e parameterHash
corrispondente al programma. Una sola azione nel suo stato, solo nel principal.
L'ingresso richiede compagnia, freeze e servizi startup completati: non è una
route libera di danno. Gli incontri originali conservano i gate precedenti.

I figli fissano destinatario, ordine dei tipi, quantità e faccia. Una concessione
fissa actor, budget, condizione di stessa casella e costo in crediti sintetici
di quella fonte. Il destinatario rimane quello del figlio; il giocatore che
risponde può controllare un altro eroe. Crediti, concessioni e limiti sono
inventati per questa prova: nessuna Protezione o capacità originale viene
attribuita gratuitamente e nessuna ispirazione originale viene spesa.

Il client risponde soltanto con `physical-prevent` o `physical-discard` dentro
SCENARIO_INPUT; il resto del comando lega scenario, pack, proiezione, pending,
source fingerprint, hero, generation e expectedRevision. Non invia origine,
programma, importo della fonte, destinatario o identità delle copie.
ACK non conclude un figlio. I trasferimenti e le sotto-operazioni automatiche
consecutive non chiedono conferme aggiuntive.

## Stato, casualità, integrità e privacy

Schema11 migra1–10 con physical null, senza inizializzazione retroattiva.
Le regressioni mantengono pending generation, consumer legacy scout/test/
round/travel, scenario, copie e ricevute. I test storici cambiano soltanto
l'aspettativa della versione corrente e omettono il campo nuovo quando
costruiscono effettivi documenti di versioni precedenti.

Il raw è consumato tramite requirePhysicalFamily separatamente per damage e
fear, anche quando diagnostico per le quantità beneficio. Il salvataggio
conserva raw, provenienza/hash byte e fingerprint delle famiglie. Inizializza
una sola volta e diventa autosufficiente dopo il commit, senza file pack.
Il freeze mappa, la geometria e tutti i suoi snapshot RNG restano immutati.

Algoritmo fisico **sha256-counter-rejection-fisher-yates-v1**: entropia privata
256bit una sola volta, parole uint32 da SHA256 con contatore, rejection sampling
per evitare bias del modulo, Fisher–Yates. Scarti senza sostituzione, ordine
materializzato e restituzione sotto il mazzo proprio. Stream separato dalla
mappa; nessuna equivalenza con Unity/System.Random è asserita.

Il replay ricostruisce copie/zone, ordine, decisioni, crediti/costi, finestre,
figli, cursore e ritorno del padre. Cinquantasei copie globali, una zona per
copia. Nessun fronte viene eseguito durante sofferenza/scarto coperti.
Zero, tutto prevenuto e carenza normale nello scarto concludono con prova
persistente, applicando l'inferenza dichiarata nel contratto61.

Source-history, task-state, instance-state, request-state, allowScenarioPlay e
riconciliazione delle ricevute sono estesi espressamente. I completamenti
derivano dalle entry fonte e dai figli; eliminare le due cronologie delle
ricevute non certifica un effetto. Anche l'intento della ricevuta fisica viene
ricostruito dalla risposta fonte. La posizione iniziale è derivata dalla
Spaces[1] della tessera iniziale congelata, anche prima del piazzamento.

Store.once conserva nella stessa transazione effetto, costo, casualità, zone,
cursore e ricevuta. Retry identico restituisce la ricevuta; intento diverso,
stale, actor/cursor/hero/source estranei sono rifiutati. Il padre torna una
volta, dopo tutti i figli, prima di FINISHED.

La proiezione pubblica è distinta dallo stato privato: solo tipi, conteggi,
coperture, allocazioni, attori, esiti e passo corrente. Nessun fronte, ID copia
decodificabile, ordine, seed/entropia, popolazione o traccia casuale nelle
normali risposte/sessioni/eventi/ricevute, DOM, reader o log. Non esiste una
route di asset fisici; richieste dirette sono rifiutate. Il **full backup e il
database host sono recupero privato amministrativo**: contengono identità e
ordine, senza nuova promessa di account o cifratura.

## Test e cicli TDD

**444/444 test**, baseline419 più25, zero skipped. npm test, typecheck,
format:check e diffcheck passano sul codice finale. Fixture pubbliche inventate;
HTTP, SQLite, filesystem e processi reali. Nessuna suppression nuova, test
saltato o soglia abbassata.

| Ambito P0 del contratto61 | Prova                                                                                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T01/02                    | Raw diagnostico consumabile per famiglia; export/certificato rifiutato come raw; due mazzi28/28,56 copie, inizializzazione e replay                                                   |
| T04/06                    | Allocazioni fonte tra eroi e più contributi, budget/costo/residui, stessa casella, costo non disponibile, zero/tutto prevenuto; fronti non eseguiti                                   |
| T09                       | Selezioni coperte senza sostituzione e fondo dei mazzi, decisioni riproducibili dopo serializzazione/restart/restore, RNG mappa invariato                                             |
| T20/21                    | Richieste actor/cursor/hero, concorrenti con due ID, duplicate intent, generation vecchia, riavvio e restore senza pack                                                               |
| T22                       | Backup risignati: copie duplicate/mancanti, casualità, costi, parent/task/request/cursor, settled/stopped/processing, actor/source, doppia eliminazione cronologie e intento alterato |
| T23                       | Proiezione API/eventi/receipt, DOM e AX, reader/asset/log, guida/focus e attesa degli altri posti                                                                                     |
| T25                       | Scarto senza coperte distinto da mazzo necessario vuoto; sospensione precisa, carte parziali, residui e costo accettato conservati                                                    |

T04 copre qui le concessioni tipizzate inventate: l'intera Protezione originale
rimane P1. T09 copre gli scarti P0; flip e selezioni modificate da capacità
annidate originali rimangono P1. I due gate non vengono presentati come
executor completi dei corrispondenti casi61.

Una prova SIGKILL osserva il servizio reale dopo la mutazione fisica e prima
della scrittura Store.once, tramite un wrapper SQLite **solo nel processo di
test**: risposta già calcolata, costo pagato e carte trasferite in memoria.
Il crash annulla claim e transazione intera; restart restituisce il payload
precedente e il reinvio applica una sola volta. Nessun failpoint di produzione
o comando debug viene aggiunto. Un'altra prova interrompe dopo il commit e
verifica la stessa ricevuta al retry.

Tre affinamenti hanno regressioni RED→GREEN: il limite32 padri viene verificato
prima di modificare lo stato accettato; un backup non può spostare tutti i
partecipanti su un'altra casella valida prima del piazzamento; un limite effettivo non implementato resta gated alla barriera anche quando le carte erano già possedute e questa fonte non ne pesca altre. Anche la
dicitura UI errata “Spirito1” per una richiesta fisica ha una regressione
browser rossa→verde, ora con aiuto contestuale e conseguenza corretti.

## Accettazione browser reale

Host/dati propri sulla porta4353, libera prima dell'avvio; nessun accesso in
scrittura a4339/PID12892 o ai dati del root. Prerequisito dichiarato: import
**dalla UI** di un backup autentico della compagnia UI38 già congelata, SHA256
`9c7ecb7110b6b6af3bbaf54ebddc3e8332e032f6e46c82fb6a9c4e05b0c7ba2a`,
ricontrollato contro il manifest startup del root. Nessuna rigenerazione del
freeze, nessuna sostituzione con il caso Cacciatore preparato via backend.

Tre browser context indipendenti in Chrome dedicato, con profilo creato nella
scratch del task. Ripresa dei tre posti tramite i moduli UI. Il pacchetto di
prova conserva il binding al freeze autentico, usando esclusivamente stati,
testi e parametri inventati; nome e avvisi lo distinguono sempre dall'A1.

1. Import autentico, recovery tre posti e START_SCENARIO dalla UI inizializzano
   i mazzi. I due file scenario/raw vengono rimossi dalla cartella dell'host.
2. Startup sintetico tramite normali messaggi/Scoperta/prova raggiunge la fonte
   fisica. Secondo posto: allocazione1 danno/1 paura per il primo eroe, costo1;
   terzo posto: propria allocazione1 danno, costo1. Trasferimenti automatici.
3. Primo e terzo posto risolvono ciascuno uno scarto misto casuale. Il padre
   completa quattro figli, ritorna una sola volta, poi obiettivo e handoff
   della fonte sintetica. Finale: mazzi27/27 e due copie nelle aree,56 totali.
4. A tutte e quattro le richieste: SIGKILL/restart e download backup UI,
   import con file picker e dialog, recovery dei tre posti. Gameplay e
   ricevute identici; cambiano solo generation/revisione/data previste.
   Lo scarto precedente è già materializzato nella quarta richiesta e resta
   identico. In totale sono verificati otto confronti integrali di restart,
   includendo inizializzazione e conclusione sul validatore finale.
5. 320/768/1024/1440: nessun overflow, controlli≥44px, actor esclusivo, nessun
   Continua/Annulla generico, guida/Escape e ritorno del focus. AX con label
   Danni/Paure, status e ring di focus; PNG privati ispezionati. Zero eccezioni
   runtime; nelle due QA finali restano4/2 richieste favicon404 preesistenti.

Avanzamenti, selezioni, export/import e recupero sono esclusivamente controlli
UI nativi. HTTP Node nei helper browser è **GET-only**, per confronti readonly.
Nessuna API o SQLite scrivente fa avanzare l'accettazione. I test backend
precedenti sono prove separate e non sostituiscono questo percorso.

preview_status/open usati per primi; due snapshot hanno restituito
“Preview automation snapshot timed out after15000ms”. Fallback al Chrome
dedicato, senza toccare profili occupati. La scheda preview e il browser del
task vengono chiusi. I primi tentativi del helper dei select confermarono
zero prevenzioni tramite Enter, scelta legale ma non voluta: percorso
ricominciato tramite import UI; le prove finali verificano selezione effettiva,
costo e assenza di submit prima del pulsante. WIP e finale distinti nel README
privato. Nessun originale o materiale di altri checkout modificato.

## Riproduzione e limiti

Raw reale: **780.002byte**, SHA256
`3d06fbbf8f767b3e5e78e859c7187986041ed77d7af173917c4c72f2126b0c52`,
ricontrollato prima/dopo.36 definizioni/56 copie, famiglie18/28 ciascuna.
Le quantità beneficio57 rimangono irrisolte:5/5/5 è soltanto l'ipotesi non
confermata del proprietario, che ora non può contare la scatola. Nessuna nuova domanda.
Catalogo e contesto del freeze autentico sono hash-verificati prima dell'uso;
la matrice61 e gli audit già chiusi non sono rilanciati.

Artefatti in `.scratch/physical-p0/`: README con comandi, source-lock,
prepare-ui.mjs, ui.mjs, host-control.mjs, verify-artifacts.mjs, manifest, log,
backup e PNG. Il verificatore ripete replay, parsing backup, uguaglianze,
conservazione, proprietà, raw/hash, privacy e controlli DOM/AX. Il backup UI
finale privato è2.258.120byte, entro il limite d'importazione esistente.

```sh
npm test
npm run typecheck
npm run format:check
git diff --check
node .scratch/physical-p0/verify-artifacts.mjs
```

Con `--offline` il verificatore controlla anche le risposte pubbliche già catturate, senza avviare host. Senza questa opzione usa il4353 proprio per sole letture mentre è attivo; per
riaprirlo a partire dai dati finali salvati, senza i due pack:

```sh
LOTR_BIND=127.0.0.1 LOTR_PORT=4353 \
LOTR_DATA_DIR=.scratch/physical-p0/ui-data node dist/host.mjs
```

Fronti/P1, passive o limiti non certificati e Ultimo Sforzo/P2 hanno gate
precisi. Il mazzo realmente vuoto conserva la sospensione senza carta finta,
reshuffle o istruzione ignorata; manca ancora una norma primaria di
sostituzione, come61. I limiti stampati non diventano limiti sempre effettivi.
La prova non abilita incontri originali/P3, combattimento, Ombra, esiti/campo/
ID2 o l'intera33; non certifica telefoni fisici/LAN/Windows/Safari (#5/#8).
Review Standards/Spec fresche, PR/merge e chiusura spettano al root.
Host4353, browser dedicato e scheda preview del task sono chiusi; i dati
isolati e le prove rimangono recuperabili nella scratch indicata sopra.

## Integrazione root

Le [review indipendenti](../reviews/2026-11-03-physical-resolution-p0.md)
riscontrano Standards1 P2, corretto, e Spec0. Il registro casuale iniziale
di256 decisioni rifiutava l'ottavo programma valido da32 figli. Una regressione
RED→GREEN esegue tutti i32 padri ammessi, con32 figli ciascuno e1.026 decisioni,
conservando56 copie e un solo ritorno per padre anche dopo serializzazione.
Il limite è ora2+32×32×2=2.050 decisioni; il cursore ammette il budget
corrispondente di27 indici per mescolata e128 parole per indice. I programmi
ammessi e i limiti dei padri/figli non sono ridotti.

Il root verifica i151 file del manifest originale e i due input bloccati,
quindi ripete parsing, replay, uguaglianze e controlli di privacy su copie
separate in `.scratch/physical-p0-root-review/evidence/`. Otto coppie di
riavvio e quattro di ripristino concordano; finale56 copie, mazzi27/27,
quattro risposte, quattro figli e un ritorno. Il log host, letto dal checker
ma esterno al manifest originale, viene copiato e registrato separatamente.
Sono controlli degli artefatti UI precedenti, non una nuova sessione browser.
Il manifest originale e le evidenze del child rimangono immutati. La suite
root finale passa444/444, zero skipped, con typecheck, formato e diff verdi.
Il tavolo4339/PID12892 rimane invariato.
