# Revisione delle prove abilità persistenti

2 novembre 2026. Due agenti indipendenti, con contesto nuovo, hanno esaminato
`e3f3255...b5da0c9`: commit `44b4c4a` e `b5da0c9`, issue #25,
[specifica](../planning/skill-tests-spec.md). Nessuna revisione umana implicita.

## Standards

Nessuna violazione concreta degli standard documentati né odore di codice
sostanziale individuato. Host autorevole, transazione e ricevute rispettano
ADR-0002; i nuovi comandi controllano proprietà e revisione. Il linguaggio
distingue giocatore ed eroe. Controllati diff, guardie, validazione e test;
il revisore non ha rieseguito la suite, già riportata nelle evidenze.

## Spec

**Un rilievo P1:** lo schema legacy 2 ridefiniva `preparation` senza conservare
il precedente `.default(null)`. I salvataggi intermedi del solo catalogo,
prodotti prima dell'aggiunta della preparazione (commit storico `3348400`),
omettono il campo: avvio e ripristino li rifiutavano. Violava il contratto
«Stati e backup 1/2 vengono migrati senza cambiare identità, ricevute,
catalogo o ordine». Nessun altro requisito mancante, errato o fuori perimetro
individuato dal revisore.

**Correzione:** ripristinato il valore predefinito nello schema legacy. La
regressione sull'HTTP fallisce con 422 prima della correzione; dopo verifica
sia importazione sia avvio dal vecchio stato, catalogo e recupero personale.
La correzione circoscritta è stata verificata dall'implementatore; non è stata
presentata come una seconda revisione indipendente. Suite finale: **40/40**,
typecheck e formattazione riusciti.

## UI

- **Validità delle evidenze:** esaminate tre schermate della sezione; misure
  390/1512 px e interazioni reali documentate nel rapporto del browser. I limiti
  dei dispositivi fisici sono espliciti.
- **Coerenza visiva:** bosco, carte avorio, azioni ottone, titoli Cormorant e
  componenti esistenti mantengono la direzione della sezione compagnia.
- **Interazione/accessibilità:** etichette native, campi da 48 px, focus visibile,
  stato ed errori, separazione personale/condivisa; prove registrate per polling,
  focus, collegamento perso, aree di tocco e overflow. Nessuna attestazione
  globale di accessibilità implicita.
- **Rilievi sostanziali:** nessuno nell'estensione. Gli avvisi del rilevatore
  riguardano la lobby precedente e non sono dichiarati risolti.
- **Esito:** **ship**, limitato a questa estensione, senza nuova acquisizione
  delle schermate o ricostruzione richiesta.

## Documentazione

Il controllo della documentazione non richiede modifiche a `DESIGN.md`:
l'estensione riusa il sistema esistente. README, PRODUCT e rapporto di verifica
descrivono capacità consegnata e limiti. Le prove fisiche rimangono nel ticket #5.

Rilievi originari: Standards **0**, Spec **1 P1**, corretto e coperto da
regressione. Nessun rilievo rimasto aperto da questa revisione.
