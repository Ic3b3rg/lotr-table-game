# Verifica di turni, azioni e fasi persistenti

2 novembre 2026, issue #29, base `main` a `b3088ba` dopo il merge della PR #28.

## Automatiche

`npm test`: **60/60 passati**, nessun test saltato: i 51 precedenti e nove
nuovi casi sul confine HTTP reale. `npm run typecheck` e
`npm run format:check` passano. Nessuna dipendenza aggiunta.

I primi test di avvio del round, interazione e conferma dell'Ombra
fallivano con 422 prima dei rispettivi incrementi. Ora verificano:

- Ordine concordato, un solo turno attivo, zero/una/due azioni, ripetizione
  dell'interazione, costo atomico, parametri rifiutati senza addebiti,
  reinvii senza nuovo costo e prove da effetto senza consumo di azioni.
- Proprietà, due telefoni concorrenti, identificativi di turno/round
  superati, tutti i turni conclusi prima di Ombra e rivelazioni pendenti
  che impediscono il cambio di turno, passaggio o fase.
- Nemici, oscurità e minaccia nell'ordine; ricomposizione di tutti i mazzi
  prima della prima Scoperta, preparate escluse e quindici copie conservate.
  Scoperta 2 una volta per eroe, ordine esatto del mazzo dopo restituzione,
  nessun secondo rimescolamento; round successivo con nuova identità e
  contatori azzerati soltanto quando tutti hanno concluso.
- SIGKILL e ripristino su host vuoto durante interazione, Ombra e Scoperta
  di Riorganizzazione: stessi progressi, ordine, rivelate, costo e ricevute.
  Recupero del posto e nuova generazione proteggono i vecchi comandi.
- Schema 4 con Scoperta aperta migrato all'avvio e all'importazione senza
  ripescare; conservate le precedenti prove di migrazione 1/2/3 e dei
  formati intermedi. Round, progressi o Scoperta incoerenti sono rifiutati
  senza sostituire il tavolo, anche con checksum ricalcolato.

## Browser

Chromium sul Mac, catalogo inventato. Compagnia preparata tramite API
pubbliche; recupero e nuovo ciclo eseguiti con i controlli dell'interfaccia.
Vista personale **390 × 844**, condivisa **1440 × 1000**.

Eseguiti: avvio round, scelta dell'eroe 2 prima dell'eroe 1, interazione con
addebito di un'azione e blocco della fine turno durante la prova; conclusione
con una e zero azioni usate, tre conferme dell'Ombra, Scoperta 2 di entrambi
gli eroi con preparazione e assegnazione sotto il mazzo, avvio del round 2.
Il secondo eroe viene proposto dopo la prima Scoperta. La nuova fase abilita
subito i controlli coerenti: corretto il ripristino del precedente stato
disabilitato dopo una richiesta. Focus riportato sul risultato.

Le undici asserzioni in `tests/browser/rounds-regressions.js` passano in
Azione, Ombra e Riorganizzazione mobile e nella Riorganizzazione condivisa:
scelte e focus stabili al polling, nessun overflow, bersagli di almeno 44 px,
ordine coperto nascosto, progressi corretti, rivelazioni che bloccano il
turno, prove/scarti liberi nascosti nella Riorganizzazione e tavolo condiviso
senza comandi personali. Console delle due viste senza errori o avvisi.

Schermate locali escluse da Git: `.scratch/rounds-browser-29/mobile-shadow.png`
e `desktop-rally.png`; rapporto `design-audit.json`. Il rilevatore, eseguito
una volta, segnala 26 avvisi sulla lobby e superficie esistenti (etichette,
placeholder, decorazioni e involucro). Nessuna conformità globale dichiarata.

## Limiti

Sono persistiti coordinamento dei round e interazioni con prova. Viaggio,
attacco, capacità delle carte e finestre degli effetti non sono automatizzati.
I tre passaggi dell'Ombra sono esplicitamente manuali: il tavolo non calcola
nemici, oscurità, minaccia o esiti di scenario. Non è una campagna giocabile.
Le selezioni non confermate restano nel modulo finché la pagina rimane aperta.

Schema 5: il downgrade richiede una copia precedente all'aggiornamento.
La prova fisica Mac/Windows e telefoni senza WAN resta nell'issue #5.
