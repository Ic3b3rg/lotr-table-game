# Ultimo Sforzo persistente — #69

3 novembre 2026. Base `fa110b69ee35a7fb86f27fe2a8362d35b3fc4a8f`,
schema13,482 test. Autorità: issue69, contratto61 (P2, T13–22),
spec/piani/verifiche P0/P1a/P1b, review del 3 novembre e fix `e40e1ac`,
GLOSSARY e ADR0001/0002. Autonomia, seam TDD e lavoro inline già autorizzati.
Review Standards/Spec/integrazione al root; nessuna scrittura GitHub.

## Risultato e moduli

Dopo una fonte fisica interamente risolta, il consumer propone l'ordine
legale fra obblighi e reazioni concorrenti. Ultimo Sforzo seleziona una sola
istruzione congelata, esegue una prova reale, calcola l'esito, applica
restituzioni/premi/titoli o sconfitta, e restituisce al padre una volta.
Una perdita immediata conserva invece una conseguenza terminale tipizzata.

Il modulo `physical-resolution` mantiene la piccola interface
freeze/open/answer/validate/view; un compilatore separato convalida
istruzioni e titoli rispetto alle fonti private. L'adattatore scenario e
il ledger ordinario possiedono fonte, attore e ritorno. Store.once possiede
la transazione. La UI consuma soltanto la proiezione pubblica.

L'uscita attraversa questi moduli, HTTP/SQLite, recupero e tre identità UI.
Le fonti scenario di accettazione restano dichiaratamente sintetiche:
P3 abiliterà gli incontri originali. Campo, seconda avventura e gestione
finale originale della perdita restano #33; una barriera terminale precisa
non costituisce una conclusione originale implementata.

## Contratto e compatibilità

Schema14 migra1–13 senza nuove pescate, spese, mescolate o selezioni durante
parse/GET. Ogni run nuovo abilitato dichiara regole P2 e fingerprint delle
istruzioni; quelle regole non sostituiscono `executionRules` P1b. Run
versione2 non marcati mantengono la semantica storica, quelli marcati
`retained-paid-effects-v1` mantengono il seguito pagato, e i run spaziali
mantengono le regole3. Il seed ordinario resta round1/Fase di Azione.

Un pending legacy `last-stand-unavailable` resta identico e importabile.
Una risposta esplicita di continuazione, vincolata alla richiesta attuale,
congela l'artifact P2 verificato e apre la prima selezione nello stesso
Store.once. Il journal conserva questa risposta: replay ricostruisce prima
il vecchio gate e consuma la continuazione solo in quel punto. Nessuna
riscrittura dei costi/scelte/RNG precedenti; retry non apre un'altra
selezione. I run conclusi continuano a usare le vecchie regole. Un gate P0
privo di risorse e capacità originali conserva il suo confine diagnostico.

Input stretti: il client sceglie opzioni, carte o conversioni disponibili
oppure continua il pending legacy; non invia difficoltà, risultato, premio,
fallimento forzato o nuova fonte. Actor, destinatario, scenario/pack/proiezione,
source/request/cursor, generation/revision e receipt restano ricostruibili.
Cache Store e prefisso canonico restano copie difensive di input identici;
output e ricevute sono sempre confrontati.

## Semantica

- La barriera segue tutte le carte e tutti i discendenti della fonte.
  Limiti effettivi da caratteristiche, policy/copie attive e consumi;
  capacità non certificate conservano gate. Ordine dei due tipi scelto
  dall'eroe; priorità simultanee da decisione corrente, ricalcolate dopo figli.
- Selezione uniforme con reinserimento fra istruzioni della famiglia,
  stream versionato separato da mappa e selezioni fisiche, journal privato.
  Identità/hash/modello/caratteristica e difficoltà affrontata persistono.
  Nessuna parità Unity/JIT dichiarata.
- Difficoltà iniziale1, unica per eroe fra tipi, incremento dopo successo.
  Reset solo al futuro confine certificato di nuova avventura; nessun reset
  implicito durante restore o cambio round.
- Prova dal vero mazzo abilità; modificatori prima del reveal, minimo1,
  successi/Fati/conversioni/costi/trigger e figli Scoperta reali. Carte del
  padre trattenute fuori dalle ricomposizioni figlie. Bonus negate-only
  esclusi. Sole scoperte al limite di uno qualsiasi dei tipi impediscono
  il successo; il controllo usa lo stato vivo alla conclusione.
- Successo: tutte e sole le coperte del tipo sotto il proprio mazzo,
  ispirazione con cap e incremento una volta. Premi capped completati anche
  a zero. Condizioni dei titoli indipendenti e in ordine fonte, unicità
  sull'intera Compagnia, proprietà/copie conservate, preparazione immediata,
  scarto per limite quattro e trigger prima della ripresa.
- Titoli dalla famiglia verificata, senza alterare il catalogo iniziale
  delle74 abilità. Copie titolo partecipano alle vere zone del mazzo;
  proprietà di campagna e rimozione dall'avventura sono distinte. Capacità
  solo se preparata, nella propria finestra e col proprio costo. Usi che
  acquisiscono benefici conservano il gate #57 prima di costo/effetto.
  Le viste e i consumer ordinari leggono i metadati delle sole abilità titolo
  possedute da una proiezione separata, derivata dalle carte congelate; non
  inseriscono titoli nel catalogo iniziale. Lettore, preparazione, Scoperta
  e prova ordinaria condividono questa risoluzione. Il numero disponibile
  segue le copie nelle vere zone, incluse le nuove carte, entro i budget
  esistenti delle zone; non resta fissato alla composizione iniziale di15.
- Fallimento: eroe sconfitto, figura rimossa, copie/risorse conservate;
  niente seconda prova dello sconfitto o suoi normali turni/azioni/bersagli.
  Con superstiti il padre può riprendere; al successivo inizio Ombra
  conseguenza autorevole di perdita. Senza superstiti perdita immediata;
  niente ACK che superi il consumer finale ancora assente.

## Verifica e consegna

Node24/TypeScript/Zod/SQLite/DOM e dipendenze esistenti, nessuna installazione.
Stile del progetto: tipi discriminati, schemi strict e moduli con interface
piccola; `answerPhysical(state, runId, input, evidence)` è il seam di comando.
Fixture pubbliche inventate in tests; originali, mapping, istruzioni,
asset, backup, IR e confronti solo `.scratch/physical-p2/` ignorata anche
nella storia Git. Riutilizzo corpus61 verificato; nuove fonti solo su lacune.

TDD alle interface, HTTP/SQLite e UI: soglia dopo fonte, ordine D/F e F/D,
difficoltà condivisa e per eroe, scoperte dell'altro tipo, conversioni/costi,
premio capped, due titoli, preparazione/scarto/uso/rimozione, sconfitta con
e senza superstiti e prossima Ombra. Stato prodotto dal vecchio eseguibile
per regressione legacy, inclusi gate e run conclusi.

Retry/concorrenza, SIGKILL prima/dopo costi e premi, restart/restore senza
pack, backup alterati risignati e doppia cronologia rimossa; confronto
integrale di selezione, difficoltà, carte/zone, risorse e receipt. Budget
preesistenti conservati, nessun validator/output esentato.

Browser preview_status/open prima; fallback soltanto con errori esatti.
Host/dati propri4359 se libera. Solo UI per avanzare; fixture/backup di
partenza dichiarati, GET readonly per osservare. Tre identità, scelta,
prova/esito/ritorno, ripresa nel pending, guida/focus/status e
320/768/1024/1440. Coperte senza identità/ordine/entropia in API/eventi/
receipt/DOM/reader/log. Backup completo è export amministrativo privato.

Comandi: `npm run build`, test mirati `node --test tests/last-stand*.test.mjs`,
`npm test`, `npm run typecheck`, `npm run format:check`, `git diff --check`.
Nessuno skip/suppression/soglia ridotta. Rapporto con hash/locatori/copertura
e manifesto privato distingue automatici, artefatti e browser effettivo.
Commit ordinati, checkout pulito e processi/schede propri chiusi.
4339/PID12892 e root skill-tests-browser intoccabili. Nessun altro checkout,
subagente, push o PR. Telefoni/LAN/Windows/Safari non certificati.
#65/#57/#33 restano aperte;5/5/5 non confermato. Mazzo fisico realmente vuoto:
diagnosi e continuazione, nessun reshuffle/carta falsa/ignore.
