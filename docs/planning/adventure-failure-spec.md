# Conclusione fallita e primo campo — #91

Contratto: issue91; base `738bc8a`, ADR2–3. Implementazione personale nel
checkout assegnato; review Standards/Spec e integrazione al root.

## Confini verificati prima del codice

- `CoroutineEndRound` (`06003902`, IL00f3–015c) controlla gli eroi sconfitti
  prima del cap e prima di attivazioni/oscurità/eventi/minaccia. Una perdita
  sopraggiunta durante l’Ombra non ripete quel controllo anticipatamente.
- `CoroutineLastStandFinished` (`06003bf4`, IL0336–0371) chiude la risposta
  dell’Ultimo Sforzo, poi `IsAdventureOver` (`06000c93`) distingue l’assenza
  di superstiti. Il confine immediato conserva il padre fisico terminale;
  con superstiti restano dovuti risultati, figli e movimento fonte.
- `SignalEndGame` (`06000c96`) segna la conclusione, verifica l’abilità
  equipaggiata della compagnia (`06000cd8`), pulisce le regole dell’avventura
  ed emette l’evento al principale. `RecordAdventureCompleted` è un no-op
  in questa build: non attribuirgli una registrazione inesistente.
- Il ramo fallimento del principale è34→31→32→33. Parametri privati,
  messaggi italiani e azioni concorrenti provengono dalle primarie; XP al
  ruolo selezionato all’ingresso di AwardXP (`0600125f`), Sapienza una volta.
- `SetNextAdventure` (`060012be`) svuota le alternative e usa il modello
  referenziato. `ProceedToNextGame` (`060012a4`→`06000c97`) registra il modello
  concluso, resetta lo stato della scena e passa alla mappa della campagna.
  `FinishProcessingEvent`, `FinishFSM` e completamento avventura sono distinti.
- Loader `06003920/3938`, mappa `06001050/1051/1054/1055`: destinazione,
  descrizione del modello prossimo (salvo override), quindi campo. Nessun
  incremento numerico o titolo dedotto. Due AdventureModel letti integralmente
  (344/396 byte), con decoder C/Python concordi e puntatori controllati.

## Modello e limiti

Capacità facoltativa `source-adventure-failure-v1` certificata e congelata
prima dello startup, su schema16. Migrazione15→16 puramente strutturale:
nessuna capacità aggiunta, origine v2 invariata, nessuna ricostruzione.
Il replay unico comprende trigger, conclusione, premi, mappa e campo.
L’episodio resta integralmente conservato e non più giocabile; il campo
possiede lo stato ripulito per il seguito, senza cancellare prove, causalità,
carte/RNG/gruppi, risultati o ricevute. Il pending eventualmente interrotto
al confine immediato resta nella prova della conclusione.

Il campo mostra esito, XP per ruolo, Sapienza, equipaggiamento e destinazione.
Le opzioni non possedute o non chiuse rimangono esplicitamente indisponibili
prima di ogni costo. L’acquisto di abilità/upgrade e il campo completo restano
fuori closure; nessuna spesa o nuova carta viene inventata. Cambio ruolo solo
se chiuso dalle primarie, con XP sempre sul ruolo premiato. La destinazione
successiva è un handoff tipizzato che richiede contenuto/mappa: A2 non avviata.
Vittoria, combattimento finale, soglie40/48/55 e benefici57 restano gated.
La perdita da eroe non attraversa né simula questi percorsi.

## Piano TDD

1. Fixture inventata e RED del compiler: attestazione, closure e riferimento
   modello; capacità assente conserva il comportamento storico.
2. RED ai consumer: eroe/tutti, priorità, perdita differita durante Ombra,
   padre/figli/movimento e premi concorrenti per ruolo una sola volta.
3. Transazioni reali: Store.once, retry/concorrenza/stale, richieste illecite,
   SIGKILL packless a perdita/messaggi/premi/mappa/campo; replay integrale e
   alterazioni risignate respinte.
4. UI italiana contestuale, tre identità e nuovo pack congelato da freeze
   ante-startup via filepicker. Input nativi, nessuna mutazione ausiliaria;
   eventuale nuovo gate autentico documentato senza ripetere il sorteggio.
5. Compatibilità52 nativi/299 storici, suite completa finale una volta salvo
   modifiche/fallimenti, typecheck/formato/diff/privacy anche storia.
   Report e sigillo privato dopo chiusura dei soli processi propri; commit
   locali puliti, nessun push/PR/GHwrite o accesso al tavolo protetto.
