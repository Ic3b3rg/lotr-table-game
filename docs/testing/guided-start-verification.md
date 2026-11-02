# Avvio guidato: verifica a tre giocatori

2 novembre 2026, issue #34. Host nuovo sul Mac, catalogo e mappa privati,
quattro PDF locali; Chromium con tre contesti personali indipendenti e uno
per il PC condiviso. Verifica desktop 1440 px e mobile emulato 390 px.

## Flusso reale dalla UI

Nessun ingresso, scelta o avanzamento è stato scritto tramite API o SQLite.
Le letture HTTP hanno raccolto evidenze; i soli comandi sono partiti dai
controlli del browser.

1. Anna entra, conserva il proprio codice e conferma tre giocatori. Il passo
   indica attesa di due compagni. Bruno e Carla entrano dai propri contesti.
2. Anna e Bruno selezionano entrambi Aragorn prima del salvataggio. Anna
   salva; Bruno riceve il conflitto di revisione senza perdere la scelta.
   Al nuovo tentativo l'eroe occupato è rifiutato. Bruno seleziona Beravor;
   Carla sceglie Bilbo. Ruoli e oggetti iniziali sono proposti e visibili.
3. Carla conferma l'accordo, prepara i mazzi e apre il tratto 302A. La guida
   passa da eroi a mazzi, mappa e primo round. Sul condiviso non compaiono
   pulsanti di scrittura della compagnia o dei turni.
4. Anna apre il round e il proprio turno, inizia viaggio, effettua una prova
   di Saggezza e si muove dalla Casella 2 alla 3. La scelta iniziale della
   stessa casella era correttamente bloccata. Il viaggio mantiene il residuo
   attraverso la prova e fine turno lo elimina.
5. Una singola ispirazione simulata come effetto già determinato viene
   registrata dalla UI per provare la conversione: i successi passano da
   uno a due. I quattro nodi delle carte rimangono identici; nessuna ripetizione
   della pesca. Questa è una verifica dello strumento, non un evento certificato
   dell'avventura. Ricaricare conserva carte ed esito e non anima la pesca.
6. Bruno effettua una prova nel proprio turno e conclude; Carla apre e
   conclude il suo. L'animazione di Bruno è `draw-card`, mentre nel profilo
   con movimento ridotto tutte le carte hanno `animation-name: none`.
7. Carla conferma i tre passaggi esplicitamente manuali dell'Ombra. Ogni
   proprietario sceglie una carta da preparare e conferma la Scoperta. Dopo
   tutti e tre i completamenti, Carla apre il round 2.
8. Un quarto contesto recupera Anna con il codice mostrato al primo ingresso.
   Restano tre giocatori, stessi eroi e round 2. Anche il browser precedente
   ricorda quel posto: la guida invita a usarne uno alla volta, senza promettere
   una revoca dei cookie che il sistema non implementa.

## Guida, concorrenza e regressioni

- Ricerca «fato» e focus nel campo rimangono durante la scelta di Carla e il
  polling. Esc chiude e restituisce il focus all'apertura. In un campo ricerca,
  il primo Esc può cancellare la ricerca nativa; il successivo chiude il dialogo.
- Dopo il rilievo UI, l'apertura globale mostra ricerca e indice con scroll 0;
  l'aiuto del passo mantiene il salto all'argomento. Guida a 16 px, pulsante
  mobile 121 × 44 px, nessun overflow orizzontale a 390 o 1440 px.
- Tutti e quattro i PDF forniti sono disponibili. Il PDF delle carte corrette
  è circa 42 MB: il limite verificato è 64 MB, con nomi consentiti, controllo
  di firma e confinamento. Test sintetico da 45 MB prima rosso, poi verde.
- Su un secondo tavolo nuovo due profili reali provano la modifica concorrente:
  Nadia sceglie quattro partendo da cinque, Paolo salva tre. La UI di Nadia
  mantiene quattro, consenso e modulo aperto, distingue il tre salvato e
  permette poi il salvataggio esplicito di quattro. Nessun ingresso è perso.
- Due fixture **di sola vista**, ottenute da una sessione pubblica di prova
  e iniettate nelle sole letture GET di un contesto isolato, riproducono il
  caso legacy senza mappa/round con prova oppure Scoperta pendente. Il passo
  dà precedenza alle carte: target `#skill-tests` o `#scouting`, con controlli
  visibili al proprietario. Queste fixture non avanzano lo stato dell'host e
  non fanno parte della prova della partita nuova descritta sopra. Persistenza
  e risoluzione dei salvataggi precedenti sono verificate dai test HTTP.
- L'anteprima T3 ha fallito due snapshot con timeout; il test è proseguito
  con Chrome DevTools. Le immagini private sono conservate solo in `.scratch`.
  Le catture complete sono state ripetute da scroll 0 per eliminare un artefatto
  del browser con l'intestazione sticky.

## Verifiche e limiti

Suite HTTP con processi host reali: **77/77**, inclusi gruppo, limiti, reinvii,
concorrenza, recupero, SIGKILL, backup, migrazioni 1–6 e PDF. Typecheck e
formato riusciti. Nessun nuovo pacchetto.

Il rilevatore UI ha riportato cinque avvisi: bordo dell'intestazione e palette
ereditati; QR inizialmente senza src ma nascosto; padding del viaggio realmente
presente; marchio mobile da 10 px corretto a 11 px. Nessuna seconda esecuzione
del rilevatore. La revisione visiva indipendente ha richiesto il solo ripristino
di ricerca/indice all'apertura globale e ha giudicato risolto quel rilievo.

Il round osservato aveva ancora Scoperta 2 per tutti: il bonus di Aragorn è
un difetto reale registrato in #35 e viene lavorato subito dopo questo merge.
Non sono stati provati Safari/Android fisici o un collegamento LAN fra dispositivi.
La **prima avventura completa a tre non è superata**: #33 resta aperta per
composizione/esplorazione, eventi, nemici, combattimento, danni/paure, capacità,
minaccia, obiettivi, esito e campo. Il tratto 302A non sostituisce tale requisito.
