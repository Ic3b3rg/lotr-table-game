# Bonus di Aragorn: conteggi e ripresa

Issue #35, 2 novembre 2026. Fonti: manuale italiano fornito, pagine stampate
11 e 14, Compendio inglese §61.1–61.2. [Contratto](../planning/aragorn-scout-spec.md).

## Test dell'host

Sei nuovi test sul processo HTTP reale, con contenuti inventati e l'identità
canonica necessaria a selezionare la capacità. Il primo risultato corretto
prima dell'implementazione era rosso: **2 anziché 3**. Dopo la correzione:

- Tre proprietari, stessa casella: tre carte ciascuno, stesse prime carte del
  mazzo già ricomposto; nessun costo, nuova mescolata o cambiamento del round.
- Caselle adiacenti e distanza due, eroe visivamente più vicino ma senza
  collegamento; il grafo determina il risultato. Un nome «Aragorn» su un'altra
  identità non assegna bonus. Il bonus proprio non dipende dalla posizione.
- Scoperta indipendente prima dei round rimane due. Senza posizioni, la
  dichiarazione esplicita degli altri eroi è richiesta; con mappa viene
  rifiutata. Proprietà, reinvii e limiti delle scelte mantengono i controlli.
- SIGKILL, riavvio, backup su altro host e recupero conservano esattamente la
  pesca di tre carte. La risoluzione non cambia l'ordine di quelle restituite.
- Stato schema 7 con gruppo e Scoperta 2 già aperta migra allo schema 8
  conservando pesca e ricevute. Si conclude la stessa Scoperta senza ripescare.
- Un backup che forza tre carte lontano da Aragorn è rifiutato senza sostituire
  la sessione.

Suite complessiva **83/83**, typecheck e formato riusciti. Nessuna nuova
dipendenza. Gli stati 1–7 sono migrati; i conteggi precedenti delle rivelazioni
pendenti restano validi, con gli stessi mazzi e ricevute.

## Continuazione reale nei tre browser

Ripresa della compagnia nuova dell'[avvio guidato](guided-start-verification.md),
host separato dai dati dell'utente e tre contesti indipendenti: Anna/Aragorn,
Bruno/Beravor, Carla/Bilbo. Tutti i movimenti e gli avanzamenti seguenti sono
avvenuti con la UI, senza chiamate API scriventi o modifiche SQLite.

1. Nel round 2, Aragorn in Casella 3 e gli altri in Casella 2 sono adiacenti.
   Ogni proprietario vede «2 + 1 di Aragorn», preme **Scopri 3** e riceve
   realmente tre carte. Le tre risoluzioni permettono l'apertura del round 3.
2. Nel round 3 Aragorn resta in Casella 3; Beravor e Bilbo viaggiano dalla
   Casella 2 alla 1. Fra loro e Aragorn ci sono due collegamenti. Roster,
   spiegazione, pulsante e carte effettive danno **3 / 2 / 2**. Il tentativo
   di selezionare direttamente Casella 1 da Casella 3 era correttamente
   bloccato: il grafo richiede il passaggio dalla 2.
3. Nel round 4 Aragorn percorre Casella 3 → 2 → 1 con una sola azione viaggio.
   Tutti sono nella stessa casella e rivelano **3 / 3 / 3** anche qui. Dopo
   le risoluzioni, il gruppo apre il round 5. Nessuna nuova azione viene
   addebitata per il bonus o per Scoperta.

Il cambio tra profili viene verificato dopo l'aggiornamento visibile della UI.
Un clic immediato prima del polling può ricevere il conflitto di revisione:
la conferma resta nel modulo e il nuovo tentativo usa lo stato aggiornato.

## UI, documentazione e limiti

Verifica a 1440 e 390 px, senza overflow. Pulsante e spiegazione sono accostati;
la lista distingue conteggio futuro e pesca già salvata. Nei tavoli con mappa
non compare alcuna domanda di vicinanza. Un contesto separato con **sole
letture GET simulate**, senza azioni sullo stato dell'host, verifica la vista
senza posizioni: domanda nativa visibile, nessuna risposta preselezionata,
campo obbligatorio, pesca disabilitata. Selezionando «vicino» il pulsante diventa
**Scopri 3** e si abilita. La prova della dichiarazione sull'host è nei test HTTP.

Catture private in `.scratch/ux-three-player/bonus-*.png`. Il rilevatore riporta
quattro classificazioni già ereditate (intestazione, QR nascosto senza src
iniziale, padding realmente presente e palette); nessuna modifica di identità
visiva o degli asset. Revisione UI indipendente: **ship** nel perimetro toccato.
Non sono certificati dispositivi fisici o tecnologie assistive non provate.

La #33 rimane aperta: il round 5 nel frammento non è l'esito della prima
avventura. Mappa completa, eventi, nemici, combattimento, danni e paure, altre
capacità, minaccia, obiettivi, conclusione e campo restano da implementare.
