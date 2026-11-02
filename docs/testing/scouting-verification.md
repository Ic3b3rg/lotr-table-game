# Verifica di Scoperta e carte preparate

2 novembre 2026, issue #27, base `main` a `666e1c6`.

## Automatiche

`npm test`: **51/51 passati**, nessun test saltato: i 40 precedenti e undici
nuovi casi sul confine HTTP dell'host reale. `npm run typecheck` e
`npm run format:check` passano. Nessuna dipendenza aggiunta.

Prima dell'implementazione, test distinti per `START_SCOUT`,
`START_RALLY_SCOUT` e `DISCARD_PREPARED_SKILL` fallivano con 422.
Dopo l'implementazione passano e verificano il risultato persistito.

- Ordine esatto sopra/sotto e scelta di zero/una preparata; debolezze,
  quinta carta con sostituzione della ruolo 1 o della nuova carta stessa.
- Conservazione delle quindici copie, ricomposizione prima di Scoperta 2
  e a metà pesca, esclusione delle preparate. Prove con undici o quindici
  carte disponibili; cronologia della prova valida dopo la preparazione.
- Proprietà, concorrenza, mutua esclusione con le prove, reinvii, partizioni
  incomplete/duplicate, copie altrui, quantità e scarti non validi.
- SIGKILL durante Scoperta e ripristino su un host privo del pacchetto:
  stesse rivelate, mazzo, preparate e ricevute; conferma finale una volta sola.
- Migrazione dello schema 3 con prova aperta su avvio e importazione.
  I test precedenti mantengono migrazioni 1/2 e formato del solo catalogo.
  Scoperte incoerenti e sovrapposte a una prova vengono respinte atomicamente,
  anche con checksum ricalcolato.

## Browser

Chromium sul Mac di sviluppo: vista personale a **390 × 844**, vista condivisa
a **1512 px**, catalogo e contenuti inventati. Preparazione della fixture
mediante API pubbliche; interazioni nuove eseguite con i controlli reali.

Verificati: recupero del posto, Scoperta 4, scelta della debolezza, due
preparate rifiutate nell'interfaccia, limite di quattro, scarto richiesto,
spostamento di una carta e divisione fra sopra/sotto. Dopo la conferma,
il backup HTTP ha verificato la prima carta, le due ultime nel nuovo ordine,
debolezza preparata e ruolo 1 negli scarti. Eseguita poi ricomposizione con
Scoperta 2 e sostituzione di un'altra preparata.

Le undici asserzioni in `tests/browser/scouting-regressions.js` passano in
entrambe le viste: scelte, nodi e focus stabili al polling, nessun overflow,
controlli visibili di almeno 44 px, copie conservate, ordine coperto nascosto,
prova bloccata durante Scoperta e vista condivisa senza controlli personali.
È passata anche la successiva prova abilità con undici carte disponibili,
ispirazione e conversione: dieci asserzioni del precedente controllo browser
passano in entrambe le viste; esito positivo e focus sullo stato finale.
Console online senza errori o avvisi.

Evidenze locali escluse da Git: `.scratch/scouting-browser-27/mobile.png`,
`desktop.png`, `design-audit.json`. Rilevatore eseguito una volta; avvisi
relativi alla lobby e alla superficie esistenti (etichette piccole, placeholder,
decorazioni e bordo della sezione). Nessuna conformità globale dichiarata.

## Limiti

Sono salvate le carte rivelate e la richiesta; le selezioni non confermate
restano nel modulo finché la pagina rimane aperta. Capacità e finestre degli
effetti, round, movimento e campagna non sono certificati. Scarto manuale
delle preparate disponibile fuori dalle prove e da Scoperta.

Lo schema 4 richiede una copia precedente per il downgrade. La prova fisica
su Mac/Windows e telefoni senza WAN resta nel ticket #5.

[Revisione indipendente Standards/Spec e UI](../reviews/2026-11-02-scouting.md):
nessun rilievo nel perimetro della consegna.
