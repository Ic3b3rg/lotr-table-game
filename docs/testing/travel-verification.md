# Verifica di mappa e viaggio persistenti

2 novembre 2026, issue #31, base `main` a `1687ecc` dopo il merge della PR #30.

[Revisione indipendente e correzione](../reviews/2026-11-02-travel.md).

## Automatiche

`npm test`: **70/70 passati**, nessun test saltato: 60 precedenti e dieci
nuovi casi sul confine HTTP reale. `npm run typecheck` e
`npm run format:check` passano. Nessuna nuova dipendenza.

Prima dell'implementazione la lettura del piano mappa rispondeva 404 e i
comandi viaggio 422. Le prove ora verificano:

- Consenso del gruppo, piano e hash, posizioni iniziali condivise, definizione
  congelata e divieto di sostituire la mappa o aprirla a turno iniziato.
- Costo di un'azione, due movimenti, viaggio ripetuto e quattro movimenti;
  interazione fra i due passi, senza perdere il residuo. Fine turno anche
  senza muoversi, rinuncia ai residui e posizioni separate per eroe.
- Grafo distinto dalla distanza sul disegno: niente salto, permanenza nello
  stesso spazio o attraversamento non collegato. Origine, proprietà, mappa,
  round/turno superati, concorrenza e reinvii proteggono il costo e la posizione.
- SIGKILL dopo il primo movimento: stesso residuo, grafo, posizione e ricevuta.
  Ripristino su host senza pacchetto e ripresa del secondo movimento; nuova
  generazione impedisce vecchi comandi. Il pacchetto cambiato non riscrive
  una mappa già congelata.
- Migrazione dello schema 5 con turno e prova d'interazione aperti: azione,
  carte e ricevute conservate, mappa assente. Le migrazioni 1/2/3/4 precedenti
  restano verificate. Geometria, collegamenti, roster e residui incoerenti
  sono respinti atomicamente anche con checksum valido.
- Immagini PNG dichiarate, limite e confinamento nella cartella assets;
  file non dichiarati, contenuti non PNG, percorsi e symlink esterni respinti.

La revisione ha trovato un residuo alterato che poteva sfruttare il conteggio
totale delle azioni, compresa un'interazione. La regressione HTTP rispondeva
200 invece di 422. Ora il residuo viene riconciliato con le ricevute viaggio
e movimento della stessa mappa/round/turno/eroe: un'interazione non concede
movimenti. Il backup alterato è rifiutato senza sostituire il tavolo; anche
l'avvio da un salvataggio locale alterato viene rifiutato. Suite completa
rieseguita dopo la correzione, con 70 passati e nessun test saltato.

Test pubblici con contenuti e geometria inventati. Dati e immagini originali
del frammento rimangono nel pacchetto privato.

## Browser

Chromium sul Mac: telefono **390×844**, vista condivisa **1440×1000**.
Compagnia Aragorn/Beravor e vera tessera 302A; recupero del posto e tutti
i nuovi comandi eseguiti nell'interfaccia. Preparazione iniziale tramite API.

Eseguiti: apertura concordata del tratto, inizio round/turno, viaggio, selezione
e anteprima, primo movimento, destinazione non adiacente bloccata; interazione
come seconda azione, sospensione durante la prova, conclusione e secondo
movimento ancora disponibile. Poi viaggio del secondo eroe, rinuncia a un
residuo, tre passaggi dell'Ombra, Scoperta di entrambi e viaggio nel round 2.
Posizioni conservate, movimenti rinnovati soltanto dal nuovo viaggio.

È emerso un difetto di ricezione del tocco nella precedente proiezione CSS
3D: una casella visibile non coincideva sempre con il bersaglio raggiunto.
Riprodotto con `elementFromPoint`, risolto con proiezione affine del terreno
e figure separate. I tre bersagli ora corrispondono ai rispettivi centri e
registrano il tocco. Dopo la correzione, continuata la partita fino al round 2
senza altre ricariche.

Le **13 asserzioni** di `tests/browser/travel-regressions.js` passano sulle
due viste: caselle e posizioni, nodi/selezione/focus/camera stabili al polling,
assenza di overflow, bersagli ≥44 px anche dopo zoom, vista condivisa senza
comandi personali, movimento bloccato nei casi richiesti, movimento ridotto
e immagine disponibile. `map-hit-targets.js` verifica i tre centri sul telefono.
Provati anche freccia destra, Home, comandi della camera e zoom. Console delle
due viste senza errori o avvisi.

Schermate finali e rapporto locali: `.scratch/travel-browser-31/mobile.png`,
`desktop.png`, `design-audit.json`, `tests.log`. Il rilevatore, eseguito una
volta, mantiene 26 avvisi ereditati della lobby/superficie. Non è una verifica
globale di accessibilità né una prova di Safari iOS, Android o della LAN.

## Limiti

Il tratto è la sola 302A in orientamento canonico, con partenza all'indice
sorgente 1. Il generatore, le giunzioni fra tessere e l'avventura 1 completa
non sono implementati. Figure tramite ritratti separati e posizioni animate;
le pose del personaggio della direzione diorama completa seguiranno.

Non sono automatizzati esplorazione, nemici/provocazioni, terreni battaglia,
tratti delle caselle, capacità e Scatto. Schema 6: downgrade con copia
precedente. Prova fisica ancora in #5. [Provenienza della mappa](../research/journey-map-topology.md).

Il tavolo privato sulla porta 4339 è aggiornato, con pacchetto 302A disponibile.
Conservata prima la copia schema 5
`.scratch/travel-browser-31/pre-upgrade-private-session.json`. Il confronto
prima/dopo conserva identità, revisione, carte, round e ricevute; aggiunge
soltanto schema 6 e mappa assente. Dopo la correzione del controllo movimenti,
entrambi gli host sono ripartiti con payload identico; le 13 asserzioni browser
passano ancora sulle due viste. Nessuna configurazione di una partita reale
è stata automatizzata al posto del gruppo.
