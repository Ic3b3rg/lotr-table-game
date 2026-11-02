# Avvio guidato, gruppo atteso e istruzioni sempre accessibili

Parte dell'[accettazione completa a tre giocatori #33](https://github.com/Ic3b3rg/lotr-table-game/issues/33).
Base `main` `f628708`, PR #32 già integrata. Questo incremento rende chiaro
l'avvio e verifica la UI disponibile a tre persone; **non chiude #33** né
sostituisce la prima avventura completa con il frammento 302A.

## Contratto del gruppo

- Il primo partecipante entra con il proprio nome e conserva il codice.
  Un partecipante conferma quanti giocatori aspettano: da uno a cinque,
  valore salvato e condiviso. Non si confondono giocatore, eroe e dispositivo.
- Prima di fissare la compagnia devono essere presenti tutti i giocatori
  previsti. Un gruppo da due a cinque assegna un solo eroe per persona anche
  quando è entrato soltanto il primo; solitario mantiene da due a quattro.
- Numero modificabile prima della preparazione, mai inferiore ai posti già
  presenti né incompatibile con scelte esistenti. Nessuna scelta viene
  cancellata implicitamente. Nuovi ingressi oltre il numero scelto sono
  respinti; recupero e reinvio di un ingresso restano validi a tavolo pieno.
- Dopo preparazione e mappa il gruppo avvia i round. Per gruppi configurati
  l'host rifiuta l'avvio senza mappa, evitando di bloccare l'apertura del
  tratto dopo il primo turno. I salvataggi precedenti conservano gli strumenti
  e i round indipendenti già disponibili.
- Comandi con consenso del gruppo, revisione, generazione e richiesta;
  conferma salvata prima della risposta. Recupero, riavvio e backup conservano
  il numero previsto. Schema **7**, migrazione 1–6 con gruppo non configurato;
  compagnie già pronte e round aperti sono conservati senza nuovi obblighi.

## Contratto dell'interfaccia

- Percorso visibile e numerato: entra al tavolo, concorda il numero, aspetta
  i compagni, scegli eroe/ruolo/oggetti, prepara i mazzi, apri la mappa,
  avvia il round e scegli chi agisce. Stato corrente, cosa manca e chi deve
  agire sono espressi in italiano semplice.
- Una vista guidata mostra il passo utile e i comandi contestuali; si può
  sempre passare a tutti gli strumenti e tornare alla guida. Preferenza del
  browser conservata; non altera le regole. L'avanzamento deriva dallo stato
  autorevole, non da una lista di passi marcata manualmente o salvata in locale.
- Vista condivisa orienta e mostra il QR, senza occupare un posto. Telefoni
  e vista personale sul PC permettono tutte le decisioni. Counter dei posti
  e nomi usano il gruppo atteso; si distingue attendere un compagno da dover
  compiere un'azione. A preparazione conclusa si indica recupero, non ingresso.
- Scelte locali non confermate e focus sopravvivono al polling. Se cambia
  la revisione durante una scelta, il modulo mantiene i dati e permette una
  nuova verifica/salvataggio, oppure ricaricare esplicitamente. Non cancella
  le scelte perché un altro giocatore ha salvato il suo eroe.
- Gli strumenti secondari, la prova tecnica e il catalogo completo non
  contendono il primo avvio. I dati originali e i limiti della versione sono
  consultabili; non si presenta il frammento come avventura completa.
- **Guida al tavolo** rimane nello stesso posto su PC e telefono. Include
  avvio, ruolo degli schermi, turno/viaggio/prova/Scoperta, recupero, backup,
  limiti attuali e prossimo passo. Ricerca per argomento, rimandi contestuali,
  chiusura/Esc e ritorno del focus; nessuna ripetizione automatica di un tour.
- Guida locale sempre disponibile senza rete esterna. I quattro PDF già
  forniti (manuale IT, Compendio EN, FAQ IT, carte corrette) sono consultabili
  offline se installati nel pacchetto privato; nomi consentiti, limiti e
  confinamento dei file. Assenza del PDF dichiarata senza rompere la guida.
  Nessun PDF originale entra nel repository pubblico.
- Le prove mostrano chiaramente pesca, simboli, fate/ispirazione ed esito.
  L'animazione presenta le carte già salvate dall'host; non esegue nuove
  estrazioni né cambia risultati. Una conversione non ripete la pesca.
  Movimento ridotto, controlli utilizzabili senza attendere animazioni e
  contenuto sempre accessibile anche dopo ricarica o ripristino.

## Accettazione di questo incremento

Host nuovo con carte e mappa private, PC condiviso e **tre profili personali**.
Tutti i passaggi che avanzano lo stato vengono eseguiti dalla UI: ingresso,
numero atteso, attesa, eroi distinti, conferma dei mazzi, mappa, primo turno,
viaggio e prova, altri due turni, Ombra esplicitamente manuale, Scoperta e
round successivo. Nessuna API scrivente o modifica SQLite nella prova browser.
Le API in sola lettura possono raccogliere evidenze.

Provare scelta contesa, revisione cambiata senza perdita dei dati, guida
aperta durante polling, ricerca, navigazione/focus, documenti locali, ricarica,
recupero di un posto da un quarto profilo, condivisione coerente. Verifica
desktop e 390 px, tastiera, contrasto e bersagli ≥44 px. Il rapporto distingue
ciò che funziona dai blocchi reali del motore che rimangono in #33.

## Fonti e piano

Regole: materiali privati già forniti e [Learn to Play ufficiale](https://images-cdn.fantasyflightgames.com/filer_public/74/c1/74c1ee20-a2d2-407f-93da-e6c2a4b25529/journeys_in_middle-earth_learn_to_play.pdf),
preparazione pp. 4–5 e prove pp. 10–11; Compendio, preparazione p. 5,
solitario §84 e prove §100. Le prove usano carte abilità: niente dadi aggiunti.

Ricerca UX del 2 novembre 2026: [NN/G, aiuto contestuale](https://www.nngroup.com/articles/onboarding-tutorials/),
[progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
e [W3C, posizione coerente dell'aiuto](https://www.w3.org/WAI/WCAG22/Understanding/consistent-help.html).
Scelta dell'implementatore: tutorial integrato nei comandi reali, istruzioni
brevi vicino all'azione e approfondimenti su richiesta. Nessuna nuova libreria.

1. TDD al confine HTTP già approvato: numero previsto, attesa, proprietà,
   limiti, compatibilità di scelte, consenso/reinvii, ripresa e migrazione.
2. Guida e PDF locali con test di lettura e confinamento; percorso derivato
   dallo stato, moduli stabili e gestione delle scelte concorrenti.
3. Pesca visibile con chiave della prova, movimento ridotto e prova browser
   integrale a tre persone, registrando eventuali ulteriori difetti.
4. Suite, typecheck, formato, revisione Standards/Spec e UI; PR, merge e
   chiusura dell'issue. Proseguire sui blocchi di #33 dopo l'integrazione.
