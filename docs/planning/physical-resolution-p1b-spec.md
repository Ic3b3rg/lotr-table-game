# Fronti persistenti nel ciclo ordinario — #67

3 novembre 2026. Base `5cbf06a96efe1b2a2d3cfaeee5c12b706d507149`,
schema12,467 test. Autorità: issue67/65/61/33, contratto61,
spec/piano/verifica P1 e review P1a; ADR0001/0002. Implementazione inline
autorizzata nel checkout assegnato, senza delega o scritture GitHub.

## Uscita e confine

I normali comandi di turno, viaggio e Scoperta di Riorganizzazione devono
funzionare anche con carte scoperte. Una fonte ordinaria contiene il comando
autorizzato, round/turno/fase e il contesto storico della mappa. Il client
sceglie soltanto fra decisioni correnti: non invia eventi, oscurità o importi.
Comando accettato e continuazione conclusa sono stati distinti.

Il modulo di raccordo espone apply/validate/receipts/view. Il runtime fisico
continua a possedere copie, risorse, casualità e figli; il raccordo possiede
causalità ordinaria, budget e ritorno. Un ledger ordinato deve spiegare anche
le operazioni sulle risorse: nessun salto fra snapshot arbitrari, nuova
esenzione startup o riscrittura dei run precedenti. Il costo resta nella
stessa Store.once della richiesta e della ricevuta.

## Semantica

- FINE TURNO apre fine-turno/Riposo prima di cambiare turnEnded, turno attivo
  o residui. L'ordine simultaneo è una decisione di gioco. Tutti i figli
  terminano prima del ritorno singolo. La barriera P2 conserva il turno.
- Riposo proviene solo da policy confermata/hash-bound, scarta la preparata
  come costo e seleziona fino a X proprie coperte miste casualmente. Scarti
  imposti non attivano keyword. I seguiti della capacità pagata sopravvivono
  allo spostamento della copia. Le reazioni dopo Riposo si risolvono davvero.
- Il viaggio addebita un'azione e concede il budget modificato dalle passive
  attive in quell'istante. Ogni movimento verifica origine, grafo e residuo.
  Nessun evento o aggiornamento retroattivo delle posizioni dei vecchi run.
  Vicino include casella comune e adiacenza; Protezione resta stessa casella.
- Riorganizzazione ricompone i veri mazzi e apre la Scoperta2 ordinaria con
  bonus confermati. Divieti di cima, limite preparate e trigger di preparazione
  usano stato vivo, anche dopo figli. Carte trattenute da un padre restano
  escluse dalle pescate e dalle ricomposizioni figlie.
- Le prove effettivamente supportate usano caratteristiche/passive, costi e
  conversioni fonte; nessuna prova libera del client abilita un incontro.
  I vecchi ACK Ombra/interazione non sono executor. Consumer originali
  mancanti mantengono gate specifici prima di costi/effetti. Qualunque
  percorso manuale legacy usato nella QA deve essere dichiarato come tale;
  una precondizione di Riorganizzazione non certifica l'Ombra originale.
- Sorgenti di oscurità/interazione vere vengono collegate soltanto dove
  esiste un consumer che ne determina contesto e quantità. La discendenza
  di una paura da oscurità non emette una nuova oscurità.

## Integrità e compatibilità

Schema13 migra1–12 senza ripescare, preservando pending P0/P1a e ricevute.
Il formato fisico successivo conserva il replay precedente e aggiunge
contesto spaziale per fonte e operazioni ordinarie tipizzate. I validatori
ricostruiscono fonte, round/viaggio, risorse, ritorni e intenti delle ricevute.
Rimuovere due registri non basta a certificare un effetto. I limiti di
journal/esecuzione devono coprire i programmi ammessi, senza ridurre P0.

Regressioni PR66 obbligatorie: preparazione iniziale storica dopo scarto,
risorse condivise nelle alternative composte, identità stabili delle
prevenzioni e ricalcolo dei divieti dopo figli.

## Verifica e consegna

Seam TDD già autorizzati: interface fisica/raccordo, comandi HTTP/SQLite,
restore/replay e UI. Fixture pubbliche inventate. Corpus reale riusato con
letture mirate e hash; originali e associazioni soltanto nella scratch
ignorata. Test negativi, quantità/facce/posizioni, costi/reazioni, retry e
concorrenza, SIGKILL prima/dopo commit, restart/restore senza pack, backup
alterati risignati e cronologie cancellate.

Tre identità UI: fine turno con persistente e cessazione, veri viaggi,
Riorganizzazione e ripresa con figlio aperto. Avanzamento soltanto UI;
fixture/backup di partenza esplicitamente distinti dal percorso completo33.
Guida/focus/status e320/768/1024/1440, nessun leak delle coperte. Host/dati
propri4357 se libera;4339/PID12892 e skill-tests-browser intoccabili.
Suite completa, typecheck, format:check e diffcheck; nessun skip/suppression,
installazione o soglia ridotta. Rapporto e manifesto con hash distinguono
test, replay di artefatti e browser effettivo. Commit e checkout puliti,
processi propri chiusi. Review Standards/Spec e integrazione al root.

#65 resta aperta se rimangono sue capacità. P2/Ultimo Sforzo,
P3/incontri originali, P4/acquisizioni e #57 non sono completati da67.
5/5/5 non confermato; mazzo necessario vuoto conserva diagnosi e continuazione.
Telefoni/LAN/Windows/Safari e partita originale33 non certificati.
