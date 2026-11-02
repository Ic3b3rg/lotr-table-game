# Verifica delle prove abilità persistenti

2 novembre 2026, issue #25, base `main` a `e3f3255`.

## Automatiche

`npm test`: **40/40 passati**, nessun test saltato. Comprende i 29 test
precedenti e undici nuovi casi sull'HTTP dell'host reale. `npm run typecheck`
e `npm run format:check` passano.

Il primo test è stato eseguito prima del codice: `START_SKILL_TEST` era
rifiutato con 422; dopo l'implementazione restituisce 200, tre carte corrette
e un esito positivo. Anche acquisizione dell'ispirazione e conversione hanno
ciascuna un ciclo rosso/verde registrato durante l'implementazione.

- Pesca dall'ordine salvato, minimo una carta, modificatore prima della pesca,
  soglia, fallimento e conteggio; testo delle carte rivelate ignorato.
- Una conversione per ispirazione e per fato disponibile; limite individuale,
  reinvio identico, una sola prova concorrente, proprietà e revisione.
- Rimescolamento a metà pesca e quando tutte le carte sono state usate;
  conservazione delle quindici copie, escluse le preparate dalla pesca.
- SIGKILL dopo una conversione, riavvio e recupero: stessa prova, ordine,
  ispirazione e ricevute. Ripristino su un host senza pacchetto di contenuti.
- Migrazione di sessioni e backup 1/2, ordine esatto preservato. Backup con
  ispirazione eccedente, rivelate mancanti/duplicate, eroe inesistente,
  conversioni eccedenti o caratteristica incoerente rifiutati atomicamente,
  anche quando il checksum viene ricalcolato.
- La revisione ha rilevato il formato intermedio dello schema 2 senza il campo
  `preparation`. La nuova regressione falliva con 422 prima della correzione;
  ripristino e riavvio ora migrano quel formato e conservano catalogo e identità.
  [Rapporto della revisione](../reviews/2026-11-02-skill-tests.md).

## Browser

Chromium sul Mac di sviluppo, viste distinte a **390 × 844** e **1512 px**.
Catalogo sintetico per le azioni di verifica; catalogo privato caricato
separatamente per controllare la compatibilità dell'host. Nessun materiale
privato aggiunto a Git.

Ingresso, scelta di due eroi, preparazione, ispirazione, pesca, conversione,
conclusione e osservazione simultanea dal PC eseguiti con i controlli reali.
Dieci asserzioni di `tests/browser/skill-test-regressions.js` passano in entrambe
le viste: modulo e focus stabili durante il polling, scelte conservate, nessun
overflow, controlli visibili di almeno 44 pixel, ordine nascosto, carte e totali
coerenti, vista condivisa priva di comandi personali. La scelta di eroe 2,
Saggezza, conteggio e modificatore −1 è rimasta invariata durante il polling.

Escape chiude il lettore e restituisce il focus alla carta; spendere l'ultima
ispirazione porta il focus allo stato della prova. Emulando la perdita del
collegamento, i comandi restano disabilitati anche modificando il modulo.
Console senza errori o avvisi durante il percorso online; gli errori di rete
della prova offline sono attesi.

Schermate locali, escluse da Git:
`.scratch/skill-tests-browser-synthetic/{mobile-form,mobile-test,desktop-test}.png`.
Il rilevatore di stile è stato eseguito una volta: segnala avvisi nella lobby
preesistente (testi piccoli, placeholder e decorazioni). Questa consegna conserva
quella superficie e verifica separatamente la nuova area delle prove.

## Limiti

Non attesta Windows, Safari iPhone, Chrome Android o cinque telefoni su LAN
senza WAN: restano nel ticket #5. Non certifica capacità delle carte,
combattimento, Scoperta, generazione della mappa o campagna completa.
Lo schema 3 richiede una copia precedente per un ritorno al vecchio host.
