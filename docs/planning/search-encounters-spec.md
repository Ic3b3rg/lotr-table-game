# Incontri di ricerca — #110

Contratto canonico: [issue110](https://github.com/Ic3b3rg/lotr-table-game/issues/110).
Base `cd125df0466878ba808d30b2107a72e1fb66995d`, schema24, baseline816,
dopo l'integrazione108. Glossario, ADR2–3, baseline di fedeltà, contratti
55/61/75 e spec/report89/98/100/102/104/106/108 vincolanti.
Unico implementer nel checkout assegnato. Scelte ordinarie autorizzate;
root possiede le due review fresche Standards/Spec e l'integrazione.

## Obiettivo e confini

Giocare dalla UI soltanto le due ricerche92/93: ispezione e chiusura gratuite,
conferma con una sola azione, scelta oppure prova con carte e conversioni,
conseguenze reali, rimozione e ritorno con il viaggio residuo conservato.
La selezione originale congelata e gli altri segnalini restano identici.
Nessuna nuova partita originale o ripresa156; positivi soltanto inventati,
con intere precondizioni e disponibilità dichiarate prima dello startup.

Capacità facoltativa `manifest.searches`, versione `source-search-encounters-v1`,
congelata ante-startup. Lega esattamente due prefab, modelli/nodi, certificati
interi, definizioni, metodi, contesto prodotti[0] e controller esistenti.
Perimetro92: prefab5475/FSM27448,8 stati/8 azioni;93:5479/27452,9/9.
Le parti reveal/wait già certificate sono riusate immutate. Nessun retrofit
di pack, origine o salvataggio. Nessun permesso per21/15 o altri prodotti.

Input ricevuto108 verificato prima del parse/copia: manifest998832 byte,
SHA256 `28c9a5ba0bbb79cc950295be5ec896473318c937bf2c4b5ff2e308f6448c14f3`,
4728 righe/2791095473 byte. Ricevute e identità immutate; percorsi operativi
adattati solo nelle copie proprie. PNG ricevuti audit-only. Due reader
concordi sui soli oggetti pertinenti,17/17 azioni/parametri completi,
localizzazione primaria e soli metodi/callee pertinenti. Oracle indipendente
dal compiler/runtime. Raw, prosa, carte, IR/FSM/IL/JSON e immagini rimangono
nella scratch ignorata, anche nella storia Git.

## Comportamento e architettura

Il primo cancel non paga. La seconda finestra binaria è una scelta fonte
già pagata: entrambe le opzioni producono il proprio effetto, senza nuovo
costo, rimborso o cancellazione inventata. Il compiler conserva i due eventi
e il tipo fonte; soltanto l'owner attestato può usare questa traduzione.

La prova conserva il binding locale iniziale, l'attore e il conteggio0…99.
Limiti superiori inclusivi ordinati e fallback ultimo sono quelli fonte;
nessun Sum letterale sostitutivo, esito libero o Pass/Fail manuale.
Le carte e le conversioni appartengono al controller fisico condiviso.

I packet producono consumer tipizzati, mai effetti risolti dal solo testo.
Riusare scarto fisico, Scoperta, ispirazione e dopo-preparazione esistenti;
aggiungere soltanto le operazioni mancanti di disposizione senza preparare
e scelta fra Scoperta e preparazione dagli scarti. Custodia, ordine, limite
preparate, sostituzioni e trigger restano nel medesimo consumer fisico.
Nessuna carta o quantità, cap, bersaglio o finestra dedotti dalle etichette.
La UI mantiene visibili tutte le opzioni, anche con effetto impossibile;
il consumer applica le regole attestate senza filtrare popolazioni.

Preflight dell'intera continuazione prima di azioni, carte o RNG: tutte
opzioni/esiti, nuove preparazioni e loro discendenti, provocazioni, P1/P2,
sconfitta e ritorni. Consumer mancante o quantità57 non verificate conserva
la diagnostica specifica prima dei costi. Nessun proxy, filtro o reroll.
Hide, stop, processing, richiesta e ritorno seguono il proprio FSM una volta.
Un attore sconfitto non riceve nuove scelte personali.

Moduli esistenti: contratti in `src/shared`, compiler/preflight/frame in
`src/scenario`, consumer in `src/physical-resolution`, Store.once e validatori
in `src/server`, controlli DOM in `src/client`. Nessun motore parallelo,
comando pubblico libero o hook di test in produzione.

## Persistenza e verifica

Stesso registro ordinario e origine immutabile round1/Azione. Ownership
player/hero/source/space/card/cursor, concorrenza/stale/retry e ricevuta
del vero vincitore. Migrazione25 soltanto strutturale: formati≤24 rifiutano
le nuove forme anche nel seed; normali parole omonime nei dizionari valide.
Replay intero senza normalizzazioni gameplay, riscritture o esenzioni.

TDD tramite compiler di veri programmi inventati, controller HTTP/SQLite,
carte, effetti, sconfitta e provocazioni. SIGKILL prima/dopo commit e restore
packless su nuovi host vuoti ai confini pertinenti: confronti interi di
payload, vista e origine. Negativi risignati422 senza alcuna mutazione.

QA nativa inventata:3 identità indipendenti,320/768/1024/1440,HTTP IPv4 senza
crypto.subtle. Dopo bootstrap soltanto DOM/Input gioca; GET/evaluate osservano.
Costo/attore/opzioni/attese/prossimo passo, guida/lettore/focus/tastiera e
assenza overflow; immagini effettivamente dipinte e ispezionate. Export,
restore corrente e recupero dei tre posti dalla UI. Solo superfici proprie.

Validator ricostruito con git-show/onLoad dal commit finale:503 file,
398 payload distinti,17 viste94; serie96/98/100/102/104/106/108 di
18/14/17/19/13/20/22 snapshot/viste ed export/finali interi. Byte/hash prima
del parse. Sole differenze storiche: schemaVersion e physical:null≤10;
restore esatto salvo generation/revision/updatedAt già attestate.156 solo
preflight gated immutabile. Duplicati non contano come nuova prova.

Stack TypeScript strict/Zod/DOM, Node24.11.1, test Node inventati in `tests`.
Stile Prettier esistente, guardie esplicite: `if (!cap) return;`.
Comandi: `npm run build`; `node --test --test-concurrency=4 tests/search-*.test.mjs`;
`npm run typecheck`; `npm run format:check`; `git diff --check`.
Infine `npm test` DA SOLA, concorrenza4, dopo QA/validator pesanti.
Zero skip/cancel/fail, nessuna riduzione di casi/assert/deadline/soglie,
suppression o dipendenza. Privacy di diff e tutta la nuova storia.

Commit locali ordinati e checkout pulito; rapporto pubblico tecnico,
README/sigillo privati con input, byte/hash, adapter, comandi, tentativi e
limiti.57null/unverified rimane bloccata per preferenza esplicita. Nessuna
chiusura89/33/65/57 o dichiarazione di gioco/avventura completi. Nessun altro
agente/checkout/installazione, GHwrite/push/PR/merge o accesso a superfici protette.
