# Fronti e continuazioni P1a — verifica #65

Consegnato un incremento verticale: compiler privato, corpi dei fronti, scelte,
costi reali e figli prova/Scoperta attraversano `physical-resolution`,
`scenario/physical`, Store.once, HTTP e UI. **P1 rimane incompleta**: servono gli
agganci al ciclo ordinario e i followup delle policy indicati sotto. Questo
rapporto non autorizza la chiusura di65 o33 e non attesta una partita completa.

Base `5378c0b702d7362f4badea1daf4b84fab30beac4`, schema11,444 test.
[Specifica](../planning/physical-resolution-p1-spec.md) e
[piano](../planning/physical-resolution-p1-plan.md) committati in `4ac8ec2`
prima del codice. Autorità: [issue65](https://github.com/Ic3b3rg/lotr-table-game/issues/65),
contratto/review61 e spec/verifica/review63. Esecuzione inline nel solo
checkout assegnato, senza delega, installazioni o scritture GitHub.

## Implementazione verificata

L'interface freeze/open/answer/validate/view conserva P0 e aggiunge versione
fisica2. Il compiler accetta annotazioni strutturali strette,36 definizioni
obbligatorie, hash canonici delle carte/campi originali e localizzatori;
lega le policy alle definizioni confermate del catalogo. Non interpreta nomi
né prosa. Raw, artifact e catalogo restano nel freeze: i file esterni non
servono per continuare o ripristinare. Le associazioni originali rimangono
nella scratch ignorata; le fixture committate sono inventate.

Il replay ricostruisce copie/facce, carta corrente, residui, bersagli casuali,
risorse, scelte e discendenti. Una carta termina prima della successiva;
una selezione materializzata modificata dai figli viene ricontrollata senza
rimpiazzi. Scarti sotto il mazzo proprio, sostituzioni e spegnimento delle
passive quando cambia faccia/zona. Debolezze dalla riserva comune, mescolate
nel mazzo corrente; le carte trattenute da prova/Scoperta padre restano fuori.

Negazione soltanto quando concessa dalla fonte, conversioni con ledger dei
fati, allocazione senza riuso e possibilità di subire volontariamente.
Protezione richiede preparata, possessore, stessa casella, beneficiario e
scarto reale; spese ripetibili consumano ispirazione ogni volta. Il divieto
di prevenire danni vincola destinatario e contributore. Nessun credito P0
paga una capacità originale. Scarti imposti non attivano Protezione.

Schema12 migra1–11, preservando i pending P0 e le ricevute. Il nuovo consumer
usa esclusivamente il manifest sintetico P1, parametri hash-bound e normali
SCENARIO_INPUT. Source-history, task/instance/request, cursori e ricevute
restano riconciliati; i replay delle risorse includono esplicitamente quelle
fisiche e le carte temporaneamente trattenute dai figli. Niente esenzioni
per cancellare due cronologie o per promuovere uno stato a completato.

La regressione PR64 passa su tutti32 padri da32 figli,1.026 decisioni
casuali e56 copie. Il budget preesistente2050 record/cursore7084800 non è
ridotto; il journal aggiuntivo e le popolazioni coprono il budget operativo
P1 dichiarato. Nessun skip, suppression, soglia abbassata o dipendenza nuova.

## Test automatici e casi privati

**463/463 test**, baseline444 più19, zero skipped; npm test, typecheck,
format:check e diffcheck verdi sul codice finale. HTTP, SQLite e processi
reali. I cicli RED→GREEN includono compiler, cascata, scelta/costo, consumer,
UI, proprietà solo, validazione della fonte, riconciliazione dei reveal
legacy dopo refill e destinatario/divieto del contributore di Protezione.

T03–12/15 pertinenti: ordine e conservazione, selezioni alterate dai figli,
sostituzioni, alternative interamente fattibili, perdite/risorse, soglia
alla barriera, negazione/prevenzione e figli annidati. I trigger di turno
sono provati tramite eventi fonte sintetici; il ciclo ordinario resta P1b.

Concorrenza con due ID, retry identico e intento diverso, stale/cross-actor/
source, SIGKILL e restore senza pack. La prova prima del commit osserva una
vera mutazione di preparate e carte nel processo Store.once e poi lo uccide:
rollback di claim/costo/effetto; il retry applica una volta. Nessun failpoint
produttivo. Backup risignati alterano risorse, contesto, cursor, history,
artifact, faccia e le due cronologie: rifiuto422 e tavolo originale invariato.
La migrazione11→12 conserva richiesta P0, entropia, programma e ricevute.

**Matrice privata:** compiler36/36, corpi eseguiti36/36 in run indipendenti,
checker Python separato senza import dell'executor. Confronta raw, IR e
annotazioni bloccate, destinazione finale e conservazione;18 terminali
coperti,10 scoperti,8 restituiti. Verifica anche i36 hash dei fronti originali.
Le20 policy selezionate contengono il sottoinsieme compilato delle capacità;
non equivalgono a tutte le capacità di quelle carte.

Precondizioni dei run di artefatti: proprietà abilità del backup autentico,
fonte/posizione comune sintetiche, entropia scelta per rendere ciascuna
copia la prima, nessun beneficio/accessorio e oscurità dichiarata dalla
fonte inventata dove serve. Sono esecuzioni dei corpi originali nelle
precondizioni dichiarate. Le finestre persistenti e i casi con acquisizioni
ricche richiedono altre prove. Zero gate nei36 casi di corpo non significa
che ogni capacità P1 abbia già il proprio consumer ordinario.

## Browser effettivo

Host e dati isolati sulla4355. Import UI del backup autentico UI38,
SHA256 `9c7ecb7110b6b6af3bbaf54ebddc3e8332e032f6e46c82fb6a9c4e05b0c7ba2a`;
nessuna rigenerazione del freeze o preparazione sostitutiva tramite backend.
Il programma e i testi fonte sono inventati e dichiarati; raw e front IR
sono quelli originali verificati. La copia candidata preesistente non è
promossa a una policy originale eseguibile.

Tre identità in tre contesti Chrome separati recuperano i posti dalla UI.
Una Scoperta iniziale prepara legittimamente una conversione confermata.
La negazione fonte scarta quella preparata, converte un fato in un successo
e apre Scoperta1: tre carte della prova padre restano trattenute, la figlia
rivela una carta distinta. L'allocazione zero lascia subire il fronte reale.
Seguono corpi sequenziali, scelta dell'ordine simultaneo, perdita effettiva
di una preparata e carenza di accessori risolta secondo l'inferenza61.
Un altro posto risolve Scoperta2. Sei input fisici, quattro figli fonte e
un solo ritorno; poi obiettivo e handoff sintetici.

Quattro finestre: conversione, Scoperta figlia, fronte corrente e ultima
Scoperta. A ciascuna: export UI, SIGKILL/restart, import UI e recupero dei
posti; gameplay e ricevute integralmente uguali. Scenario/raw/artifact
rimossi dalla cartella host dopo freeze. Finale: mazzi27/27, due copie nelle
aree,56 totali, nessun frame/carta trattenuta, nessuna scoperta residua.

320/768/1024/1440: niente overflow, controlli≥44px, label, actor esclusivo,
assenza di ACK/Annulla sostitutivi, guida/Escape e ritorno del focus. PNG
ispezionati. La prima QA trova “sospesa” su una decisione attiva: regressione
browser rossa→verde, dicitura corretta nelle tre QA finali. Nessuna eccezione
runtime; otto favicon404 preesistenti nelle quattro catture complessive.

preview_status/open e import UI provati per primi. Due verifiche della
separazione delle identità falliscono perché nuove schede Incognito ereditano
lo stesso posto; errori esatti nel manifest privato. Fallback a Chrome
proprio con profilo nuovo e contesti indipendenti. Tre schede preview chiuse.
Un tentativo iniziale di selezione stringa non invia il form; la successiva
selezione nativa è verificata prima del submit. Un export in concorrenza con
reload viene ripetuto sequenzialmente; nessun avanzamento di gameplay.

**Solo UI per avanzare:** controlli nativi, tastiera e file picker. Letture
Node GET separano osservazione e gameplay; nessuna scrittura HTTP/SQLite
ausiliaria prepara o supera l'accettazione. Il checker offline finale
rivalida27 backup, quattro restart e quattro restore; proiezione pubblica e
copie coperte restano riservate. Il full backup rimane export amministrativo
privato, con identità/ordine completi.

## Seguito indispensabile e gate

P1b deve collegare gli eventi reali di turno/Riposo/Riorganizzazione/oscurità/
interazione al consumer, derivando quantità e causalità dal loro ledger.
Deve consumare modificatori di viaggio/attacco, finestre del turno e followup
rimanenti delle policy, ed estendere coerentemente pending, cronologie e
ricevute del normale ciclo. La vicinanza qui è confinata alla casella iniziale
comune; posizioni/adiacenze successive richiedono quel collegamento.
Finché manca, i turni ordinari con fronti persistenti conservati sono
respinti esplicitamente. È lavoro P1 ancora necessario.

L'acquisizione fonte di accessori e relativi stati non è simulata da risorse
iniziali inventate: il contesto iniziale rifiuta accessori/benefici aggiunti.
Le perdite con risorsa assente seguono la carenza normale dichiarata in61.
Servono consumer di acquisizione per provare gli altri stati raggiungibili.
Benefici/acquisizione rimangono P4/#57, quantità non confermate;5/5/5 resta
un'ipotesi, nessuna copia o quantity-confirmation aggiunta.

P2/Ultimo Sforzo è un gate preciso dopo l'intera fonte. P3/incontri originali
rimane escluso dal manifest; nessun Pass/Fail lo certifica. Mazzo necessario
realmente vuoto: diagnosi e continuazione senza carta sostitutiva o reshuffle.
Nessuna nuova domanda duplicata. Telefoni fisici, LAN, Windows e Safari non
certificati; combattimento, Ombra, esiti, campo, ID2 e intera33 restano fuori.

## Riproduzione, storia e chiusura

[Evidenze aggregate](physical-resolution-p1-evidence.json). Scratch privata
`.scratch/physical-p1/`: README, lock, compiler runner,36 output, checker
indipendente, prove UI, backup, PNG, log, audit storia e manifest con hash.
Raw originale780.002byte, SHA256
`3d06fbbf8f767b3e5e78e859c7187986041ed77d7af173917c4c72f2126b0c52`.
Ricontrollati25 input del lock61,190.142.075byte, immutati.

```sh
npm test
npm run typecheck
npm run format:check
git diff --check
PYTHONDONTWRITEBYTECODE=1 python3 .scratch/physical-p1/check-matrix.py
node .scratch/physical-p1/verify-ui.mjs
```

Per riprodurre builder/checker, copiare le prove in una propria scratch e
seguire il README; non eseguire main contro le evidenze di altri checkout.
L'audit percorre ogni commit intermedio, controlla path e stringhe originali:
nessun materiale privato o associazione identità→effetti in Git. Review
Standards/Spec, integrazione e decisione sul seguito spettano al root.

Host4355, Chrome dedicato e schede preview propri chiusi e verificati.
Nessuna operazione sul tavolo4339/PID12892 o su skill-tests-browser.
Nessun GitHub write, push o PR dal child.

Riferimenti tecnici consultati: [Zod4](https://zod.dev/api#unions) per gli
schemi e [fieldset/legend](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/fieldset)
per i controlli nativi. Node24.11.1, TypeScript5.9.3 e dipendenze esistenti;
nessuna nuova libreria introdotta.
