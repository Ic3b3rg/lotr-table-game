# Mappa di viaggio persistente e viaggio interrompibile

Incremento successivo a #29, base `main` `1687ecc` dopo il merge della PR #30.
Il proprietario ha autorizzato scelta autonoma del prossimo task e delle
soluzioni tecniche. Stack esistente: TypeScript, host HTTP, SQLite, HTML/CSS
e SVG per geometria; nessuna nuova dipendenza.

## Contratto

- Dopo la preparazione, il gruppo può aprire il tratto di mappa caricato dal
  pacchetto locale. Prima dei round, oppure in Azione prima di qualunque
  turno del round corrente; nessuna prova o Scoperta aperta. Una mappa già
  avviata non si sostituisce con un altro caricamento.
- Il primo pacchetto privato è il frammento **302A** verificato dall'app
  1.6.6#1128: tre vere caselle, collegamenti 0–1 e 1–2, partenza all’indice sorgente 1 (Casella 2 nell’interfaccia).
  Gli esagoni del disegno non diventano caselle aggiuntive. Immagine,
  coordinate e poligoni provengono dai prefab/mesh/UV reali.
- Il frammento usa l'orientamento canonico; non ricrea la rotazione casuale,
  il generatore, le sezioni, gli eventi o i nemici dell'avventura 1. Questi
  limiti sono visibili prima dell'avvio e nella mappa. Non è una nuova
  avventura inventata né una campagna giocabile; è la base persistente per
  posizione e viaggio. Il modello non limita le future mappe a tre caselle.
- La definizione è validata all'ingresso e congelata nel salvataggio quando
  il gruppo la sceglie. Identità e hash della definizione impediscono di
  confermare un pacchetto cambiato. Dopo ripristino, il tratto funziona anche
  senza pacchetto; le immagini opzionali si reinstallano separatamente.
- Ogni eroe parte nella casella indicata e conserva la propria posizione;
  più eroi possono occupare la stessa casella. Il tavolo condiviso osserva,
  il proprietario dell'eroe attivo comanda dal telefono.
- **Inizia viaggio · 1 azione** addebita una delle due azioni e concede due
  movimenti. Può essere ripetuto, anche con movimenti residui: al massimo
  quattro da due viaggi nello stesso turno. Si può terminare senza muoversi.
- Ogni movimento richiede origine attuale e destinazione adiacente nel
  grafo. Né distanza visiva, né esagoni, né vicinanza dei bordi neri creano
  collegamenti. Una destinazione uguale all'origine non è un movimento.
- L'eroe può risolvere l'altra azione e gli effetti disponibili fra i due
  movimenti; i movimenti residui restano salvati. Una prova o Scoperta aperta
  sospende i movimenti. Non si aggiungono capacità Scatto o movimenti gratis
  senza il relativo motore degli effetti.
- Concludere il turno rinuncia ai movimenti inutilizzati, che non passano
  ad altri eroi o round. I cambi di fase conservano le posizioni. Aprire
  viaggio senza mappa, fuori turno, senza azioni o con rivelazioni aperte è
  rifiutato senza addebiti. Muovere senza residuo non spende altre azioni.
- Non sono presenti esplorazione, terreni battaglia o nemici nel frammento;
  non se ne inventano esiti. Entrata inesplorata/provocazione/terreni saranno
  collegati ai rispettivi motori prima di supportare tali configurazioni.
- Ogni comando porta generazione, revisione, identificativi mappa/round/turno
  e richiesta. Ricevute, budget e posizione sono atomici e idempotenti.
  SIGKILL, recupero e backup conservano posizione e residuo interrompibile.
- Schema **6**: stati/backup 1–5 migrano con mappa assente, senza cambiare
  turni, azioni, carte, ricevute o rivelazioni aperte. Mappa, grafo, roster o
  residui incoerenti sono rifiutati senza sostituire il tavolo. Downgrade con
  copia precedente all'aggiornamento.
- Interfaccia con vera sagoma della tessera, figure separate, selezione e
  anteprima prima della conferma, posizioni animate e movimento ridotto.
  Camera esplorabile e centrabile, comandi tastiera/tocco, alternativa tramite
  selettore di casella. Polling conserva selezione/focus e non riavvia animazioni.
  Estensione del linguaggio diorama 2.5D già scelto, senza ridisegnare la lobby.

## Fonti e scelte

[Rules Reference ufficiale](https://images-cdn.fantasyflightgames.com/filer_public/01/a0/01a0c9f7-4427-4113-9406-f53d6bde2ff5/journeys_in_middle-earth_rules_reference.pdf),
§6 p. 7, §60 p. 19, §108 p. 27; ricontrollati il 2 novembre 2026. Futuri
limiti: §37 p. 15, §71 p. 21, §92 p. 24 e §111 p. 27. Decisioni di gruppo
e persistenza: ADR-0002. Fedeltà e incrementi indipendenti: criteri approvati
in `game-fidelity-checks.md`.

Scelta dell'implementatore: consegnare prima grafo e movimento sul frammento
dimostrabile, mantenendo separato il generatore ancora da verificare. Evita
di attribuire al motore una mappa completa o una casualità non dimostrate.
File privati e contenuti dell'app rimangono esclusi da Git; test con testi e
geometria inventati. La futura estensione alle mappe complete conserva il
confine definizione/topologia/posizioni, senza dipendere dalle tre caselle.

## Piano e verifiche

`implement` e `tdd`, stesso confine HTTP reale già approvato per la sessione.

1. Apertura mappa, definizione congelata e posizioni del roster: test rosso,
   schema, caricamento privato, lettura pubblica e comando concordato.
2. Viaggio e movimento: costo, due/quattro movimenti, ripetizione, interazione
   intermedia, proprietà, adiacenza, concorrenza, rinuncia e reinvii.
3. Riavvio durante residuo, backup senza pacchetto, migrazione 5 con turno e
   rivelazione aperti; rifiuto di dati incoerenti e accesso sicuro alle immagini.
4. Interfaccia desktop/390 px con cammino, anteprima, camera e focus stabili;
   verificare un secondo turno e un secondo round. Suite, typecheck, formato,
   revisione indipendente Standards/Spec e PR.
