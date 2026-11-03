# Ultimo Sforzo persistente — verifica #69

Il perimetro P2 attraversa selezione delle istruzioni, vere prove fisiche,
consumer scenario e ciclo ordinario, Store.once/SQLite, titoli, sconfitta,
UI e recupero. Review Standards/Spec e integrazione spettano al root.
Questo incremento non abilita gli incontri originali P3 né completa #33,
#65 o #57. Nessuna scrittura GitHub, push, PR, installazione, altro checkout
o subagente creati dall'implementer.

Base `fa110b69ee35a7fb86f27fe2a8362d35b3fc4a8f`, schema13,482 test;
ultimo commit di codice `0573ec4fdbd83364ca268066d7c494ef4e2be18d`,
verifica HTTP rafforzata in `9d717da`.
[Specifica](../planning/physical-resolution-p2-spec.md) e
[piano](../planning/physical-resolution-p2-plan.md) committati in `b555c89`
prima del codice. Il raccordo delle abilità titolo ai consumer ordinari è
specificato in `1696145` prima del fix. I budget delle copie aggiunte e
dei formati storici sono chiariti in `ba4588b`/`066dfff` prima dei rispettivi
fix. Autorità: issue69, contratto61
(P2/T13–22), P0/P1a/P1b e
[review P1b](../reviews/2026-11-03-physical-resolution-p1b.md), inclusi i
fix root `e40e1ac`, GLOSSARY e ADR0001/0002.

## Comportamento e compatibilità

`last-stand-program` compila un artifact stretto, legato ai testi/modelli
e alle carte titolo verificate. Il runtime separato possiede istruzione,
stream casuale versionato, difficoltà condivisa per eroe ed esito. Il
runtime dei fronti possiede le vere zone e risorse, la prova, conversioni,
costi e figli. Gli adattatori scenario/ciclo possiedono fonte, attore,
richiesta e ritorno. La UI riceve soltanto la proiezione pubblica.

La barriera segue tutta la fonte e i suoi discendenti. Ordine dei due tipi
e reazioni simultanee passano da una decisione corrente e sono ricontrollati
dopo ogni figlio. Le sole scoperte al limite di uno qualsiasi dei tipi
impediscono il successo: il client non invia un booleano o un Pass/Fail.
La selezione app originale, che riceveva l'esito della prova, non viene
presentata come executor delle carte fisiche. Qui reveal, conversioni,
Scoperta figlia e costi sono reali; le carte del padre restano trattenute
durante le ricomposizioni figlie. Nessuna parità Unity/JIT dichiarata.

Un successo restituisce solo le coperte del tipo pertinente, assegna
l'ispirazione entro il cap e incrementa la difficoltà una volta anche
quando il premio è zero. Le due condizioni titolo sono indipendenti e
ordinate; proprietà di campagna, preparazione, scarto per limite quattro
e rimozione dall'avventura sono distinti. I simboli provengono dalle vere
carte. Nessuna capacità dopo-preparazione viene inventata per un titolo.
L'uso che acquisisce un beneficio conserva il gate #57 **prima** di
scarto, restituzione, rimozione o acquisizione.

La sconfitta rimuove la figura e conserva posizione storica, carte e
risorse. Lo sconfitto non effettua la seconda prova né normali azioni o
effetti. Con superstiti il padre può riprendere; il successivo inizio
Ombra deriva una perdita autorevole. Senza superstiti viene salvata subito
una conseguenza `adventure-loss` con timing `no-active-heroes`; il padre
non ritorna. Il consumer finale originale resta precisamente indicato come
assente e nessun ACK supera quel confine.

Schema14 migra1–13 senza azioni di gioco durante lettura/import. Le tre
semantiche precedenti restano distinte: run versione2 storici non marcati,
run versione2 `retained-paid-effects-v1`, run ordinari spaziali versione3.
Le regole P2 non sostituiscono `executionRules`. I nuovi run abilitati
conservano `source-last-stand-v1` e fingerprint dell'artifact, con confine
di attivazione verificato. Il seed ordinario resta round1/Fase di Azione.

Un vecchio `last-stand-unavailable` resta importabile e identico finché
non riceve la continuazione esplicita vincolata alla richiesta. Solo quel
comando congela le istruzioni e abilita il seguito: se occorre scegliere
l'ordine, la pescata dell'istruzione attende tale scelta. Replay ricostruisce
prima il vecchio gate, poi consuma la continuazione registrata. Costi,
scelte, risorse e casualità precedenti restano identici; retry ripete la
ricevuta. Un file istruzioni mancante causa409 e nessuna modifica. Non si
reinterpretano run conclusi o premi storici.

Il file locale `physical-last-stand.json`, accanto al pack fisico configurato,
contiene l'artifact di `compileLastStand`. Le fonti verificate e l'artifact
di accettazione sono soltanto nella scratch privata. Nuovi avvii lo
congelano quando disponibile; un pending legacy lo carica soltanto durante
la continuazione esplicita. Dopo il freeze restart/restore non dipendono
dal file. Il gate P0 privo di capacità originali resta diagnostico.

Le abilità titolo possedute hanno una proiezione separata per preparazione,
lettore, Scoperta e prove ordinarie; il catalogo iniziale resta di74 abilità.
Il conteggio disponibile della prova segue le vere zone, incluse abilità
titolo e debolezze aggiunte, entro il tetto30 già vigente per zone e
rivelazioni. Il caso con18 carte disponibili conserva anche la riserva
comune; quantità non riconciliate, copie non possedute e conversioni senza
Fati restano rifiutate. Tetto31 rifiutato. I formati storici conservano
il proprio limite15: un backup13 risignato con16 viene rifiutato422 senza
modificare il tavolo. I budget di pack, programmi, operazioni, journal, run,
comandi e ricevute preesistenti non sono ridotti né elusi. Le cache Store
e del prefisso canonico restano difensive; contesto e attivazione entrano
nel confronto, output e ricevute non hanno nuove esenzioni.

## Verifica automatica

**507/507 test, zero skip**, baseline482 più25. `npm test`,
`npm run typecheck`, `npm run format:check` e `git diff --check` verdi.
Nessuna suppression, test cancellato o saltato, dipendenza aggiunta o
soglia di qualità abbassata. I log e gli hash sono nei
[metadati](physical-resolution-p2-evidence.json).

| Criterio                         | Prove verificabili                                                                                                                                                                                                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T13 doppio limite e progressione | `last-stand.test`: entrambi gli ordini, difficoltà condivisa tra tipi e distinta per eroe, niente seconda prova dopo sconfitta; barriera dopo tutti i figli                                                                                                                     |
| T14 fallimento forzato           | Interface e HTTP: successi sufficienti non superano le sole scoperte al limite, anche dell'altro tipo; condizione ricalcolata dopo trigger e figli                                                                                                                              |
| T15 prova e conversioni          | Modificatori e minimo1; Fati, costi, conversioni reali, Scoperta figlia senza carte del padre, esclusione bonus negate-only                                                                                                                                                     |
| T16 restituzioni e premi         | Restituzione esatta, altro tipo/scoperte conservati; premio capped zero, incremento e ritorno singolo                                                                                                                                                                           |
| T17 titoli                       | Soglie affrontate2/3, entrambe le condizioni, unicità della Compagnia, preparazione immediata e scarto; HTTP/restart nel limite quattro pendente                                                                                                                                |
| T18 uso successivo               | Titolo acquisito escluso dalla prima prova; aiuto nella successiva, rimozione pagata, proprietà conservata; consenso del proprietario vicino con destinatario corretto; beneficio gated prima dei costi                                                                         |
| T19 sconfitta                    | Interface/HTTP/ciclo: figura rimossa, copie conservate, azioni rifiutate, ritorno con superstiti, perdita al prossimo inizio Ombra oppure immediata senza superstiti                                                                                                            |
| T20 recupero                     | HTTP e browser: selezione, difficoltà, reveal, costi, titolo pendente, zone e ricevute identici dopo restart/restore senza pack                                                                                                                                                 |
| T21 transazione                  | HTTP/SQLite reali; retry e concorrenza, ID/intento diverso, attore stale; SIGKILL prima del commit di costo e premio, rollback completo, retry una volta; dopo commit ricevuta identica                                                                                         |
| T22 alterazioni                  | Backup risignati: istruzione/stat/difficoltà/RNG, titoli, risorse, attore, ritorno, stato settled e cancellazione concorde di cronologie/ricevute; rifiuto e tavolo invariato                                                                                                   |
| Compatibilità                    | Quattro stati fisici realmente prodotti ricompilando in memoria le fonti main: pending/concluso × versione2/spaziale3; prefisso invariato dopo continuazione. Import HTTP schema13 con stato del vecchio executor; ordinario legacy, marker di attivazione e seed round1/action |
| Consumer titolo                  | `last-stand-title-consumers.test`: simboli, conteggio esatto con copie aggiunte, negativi di proprietà/Fati/tetto e Scoperta; nessuna estensione del catalogo                                                                                                                   |

File principali: `tests/last-stand.test.mjs`, `last-stand-http.test.mjs`,
`last-stand-legacy.test.mjs`, `last-stand-cycle.test.mjs`,
`last-stand-recovery.test.mjs`, `last-stand-transaction.test.mjs` e
`last-stand-title-consumers.test.mjs`; `skill-test-recovery.test.mjs`
conserva anche il limite del formato storico mediante un negativo HTTP.
La fixture pubblica è inventata.
Il test SIGKILL prima del commit intercetta l'UPDATE nello Store di prova
dopo la mutazione in memoria e prima della scrittura SQLite: nessun hook
di crash o bypass entra nel prodotto.

## Browser effettivo

Preview è stato aperto prima. Due verifiche della stessa operazione hanno
riprodotto condivisione dell'identità tra nuove schede dichiarate incognito:
`Identity isolation failed: a new Incognito tab inherited Nora instead of an empty seat.`
e `Identity isolation failed: a second new Incognito tab inherited Nora instead of an empty seat.`
Risultati, errori esatti e identificativi delle tre schede poi chiuse sono
in `browser/preview-isolation.private.json`. Il fallback usa un Chrome
headless proprio, tre BrowserContext indipendenti e127.0.0.1:4359.

Tutto l'avanzamento dell'accettazione usa focus/Input nativi, pulsanti,
checkbox e selettore file della UI. Node GET osserva soltanto; nessun
fetch browser o HTTP/SQLite ausiliario scrivente fa avanzare la partita.
I builder offline creano esclusivamente le precondizioni dichiarate e
separate dall'esecuzione browser.

Le precondizioni conservano il freeze autentico UI38 e il catalogo
originale. Fonte e spazi del programma di prova sono sintetici; l'entropia
fisica dichiarata è fissata prima del primo run. Preparazione, progressione
e sconfitte pregresse derivano da veri comandi, con trace nei rispettivi
backup. Il gate legacy della precondizione UI usa il ramo storico del
runtime corrente; la regressione dal vecchio eseguibile è quella automatica
distinta sopra. Nessuna di queste prove è una partita originale completa
#33, né esegue il campo o la seconda avventura.

| Esecuzione UI                                             | Esito osservato e locatore privato                                                                                                                                                                                                                                |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Legacy, tre identità, scelta del primo tipo e prova reale | Import46, continuazione47, ordine48, reveal49, costo50; `legacy-continued`, `inspected-50`                                                                                                                                                                        |
| Export, SIGKILL e restore nel pending pagato              | Download UI reale50, restart senza pack con payload identico, import51 e recupero dei tre posti; `restart-paid.private.json`, download e `import-*`                                                                                                               |
| Esiti e ritorno                                           | Quattro prove con difficoltà affrontate1/2/1/1, tutti e tre i proprietari agiscono, costi reali e ritorno singolo62; objective/handoff64, round1/action; `legacy-completed.log`, `legacy-handoff`                                                                 |
| Titoli e limite quattro                                   | Prova a difficoltà3, due ispirazioni e scarto reale, entrambi i premi; secondo titolo pendente76. Export UI, restart packless, import77; `title-pending-*`, `owned-title-fix-*`                                                                                   |
| Ripresa e uso successivo                                  | Scarto obbligatorio78, seconda prova79 a difficoltà4; aiuto pagato80, titolo rimosso e proprietà conservata. Due successi non bastano: fallimento terminale81; `title-use-*`                                                                                      |
| Sconfitta con superstiti                                  | Ordine49, reveal50 e fallimento naturale con zero successi51; secondo tipo saltato, figura rimossa e padre restituito una volta. Handoff53, turni dei due superstiti54–57, perdita `shadow-start`58; `survivors-to-shadow-green.log`, `survivors-shadow-terminal` |
| Ultimo eroe                                               | Precondizione con due vere sconfitte pregresse; import59, ordine60, reveal61, fallimento62. Nessuna seconda prova, nessun ritorno del padre; gate della perdita riferito all'ultimo eroe; `last-hero-terminal`                                                    |
| Lettore e reload finale                                   | Nuovo restore del download del titolo, pending77; testo/simboli autentici nel lettore ed Escape restituisce il focus. Reload dei tre posti, zero eccezioni runtime non catturate e zero log error in quella finestra; `title-reader.log`, `postfix-reload.log`    |

Guida, attese per gli altri proprietari, form esclusivo dell'attore,
legend coerente con la decisione, status e focus sono verificati.
Nessun ACK nei pending obbligatori o terminali. Nessun overflow a
320/768/1024/1440, controlli di almeno44px; screenshot realmente acquisiti
e ispezionati. I marker degli sconfitti sono nascosti e il loro turno non
è selezionabile. API pubblica, DOM, accessibility tree, lettore, ricevute
e log dell'host non espongono identità delle carte fisiche coperte,
istruzioni non selezionate, entropia o journal. Il backup amministrativo
completo è invece intenzionalmente privato.

La QA ha riprodotto un errore reale: il selettore delle preparate cercava
un titolo nel catalogo iniziale, interrompendo l'aggiornamento della vista
personale. Il fix separa i metadati delle abilità possedute e li usa in
tutti i consumer pertinenti; RED→GREEN, restart nel medesimo pending,
recupero delle tre identità e reload sono verificati. Non è stata aggiunta
una cache per mascherare il problema. Il log del debugger conserva anche
l'EvalError CSP catturato dal fallback JIT di Zod; non è presentato come
errore non catturato del gioco.

Restano negli artefatti gli errori dei primi driver di recupero/import
e un'asserzione eseguita prima del poll di un altro posto; i retry UI
attendono il caricamento e la proiezione corrente. Non sono contati come
prove riuscite. Una prima fonte con scoperte ha prodotto un successo
legale perché le sole scoperte non raggiungevano il limite effettivo:
non è contata come fallimento forzato. Un'altra fonte ha realmente esaurito
il mazzo; diagnosi, copie e continuazione restano valide, senza sostituzioni,
reshuffle o ignore. I fallimenti forzati T14 sono quelli automatici alle
interface e HTTP; i fallimenti del browser descritti sopra sono naturali.

## Artefatti, limiti e consegna

Riutilizzato il corpus61 corretto dal root:8 file bloccati copiati in
scratch propria, più confronto hash di5 fonti primarie già presenti.
Nessuna nuova ricognizione generale. Il raw ha SHA256
`3d06fbbf8f767b3e5e78e859c7187986041ed77d7af173917c4c72f2126b0c52`;
l'artifact delle istruzioni ha fingerprint
`817c9146026326240da9c58e3997208b0ba0c280e8402f61ef0a266e66ec5f5c`.
Originali, testi, mapping, IR, asset e backup restano nella scratch ignorata
anche nella storia Git. Nessun main di helper di altri checkout è stato
eseguito o modificato.

Il checker Python indipendente verifica fonti/hash,10 istruzioni e relativi
modelli/statistiche, famiglia di21 titoli, due premi, simboli di vere carte,
10 casi puri con catalogo autentico,64 backup, freeze/catalogo immutati e
56 copie fisiche conservate. Controlla215 artefatti pubblici/DOM/AX/log e
3.286 confronti di ricevute per la privacy. Questi sono controlli di artefatti; i10 casi
puri usano fonti/spazi sintetici e ispirazione iniziale al cap legale, e
non sono10 partite originali.

Separatamente, il prodotto riconvalida gli stessi64 backup con checksum,
StateSchema, replay completo e riconciliazione delle ricevute; comprende
58 snapshot del browser e6 precondizioni. Valida anche lo stato diagnostico
del mazzo realmente vuoto. Entrambi i download UI hanno un restore con
**tutti** i campi di gameplay e tutte le ricevute identici, esclusi soltanto
generation/revision/updatedAt previsti. La validazione locale massima degli artefatti
nel controllo finale è1,715s; non è una certificazione di piattaforma.

Manifesto privato `.scratch/physical-p2/manifest.private.json`:
624 file,155.193.170 byte; SHA256
`063f90b2103d5424ae6fb6183cee7efb728a6d9d700017e433f2ee1a5106e49b`.
Esclusi il profilo browser e i due file del sigillo stesso. Include sorgenti
QA, source lock, precondizioni, backup/download, screenshot, log RED/GREEN,
profili diagnostici, checker e database propri chiusi. Conteggi e hash sono
nei metadati pubblici; il manifesto contiene solo riferimenti privati.

L'host4359, il Chrome di prova, i tre contesti e tutti i15 processi propri
tracciati sono chiusi; porte4359/52493 libere. Le tre schede preview erano
già state chiuse. Port4339/PID12892 e la scratch browser del root non sono
stati usati. Il checkout consegnato è pulito e i commit restano locali.

Restano #57 e P4 per quantità/consumer dei benefici:5/5/5 non è confermato.
#65 conserva policy e consumer residui; P3 abiliterà gli incontri originali.
#33 richiede entrambi gli esiti originali, campo e avventura2. La perdita
tipizzata P2 non simula quei consumer. Nessuna regola di sostituzione del
mazzo fisico vuoto è stata inventata. Telefoni, LAN, Windows e Safari non
certificati. Il root può eseguire le review e l'integrazione dai commit
locali e dalle evidenze private, senza che69 venga confusa con la chiusura33.
