# Piano di implementazione degli indizi — #89

Spec: [clue-progression-spec.md](clue-progression-spec.md).
Esecuzione personale nel checkout assegnato; prove ricevute e tavolo protetto
mai modificati. Nessuna nuova approvazione ordinaria richiesta.

1. Ricontrollo bounded di R27597/R27633/R27654/R27511, principale R20275 e
   receiver R27686: parametri, binding, packet e owner eseguibili. Copie
   puntuali bloccate con byte/hash; helper adattati prima dell'esecuzione.
   Spec/piano precedono il codice.
2. RED→GREEN della capacità/versione e primitive mancanti nel formato fonte:
   uguaglianze ordinate, copia intera, somma letterale e limiti dinamici,
   presentazione dell'esplorazione imposta. Estendere schema/compiler/pack
   mantenendo la forma e i gate storici; typecheck e commit.
3. RED→GREEN dei quattro incontri e dei receiver nel runtime esistente:
   risorse, conseguenze fisiche, obiettivi, sezioni, covo e spawn. Preflight
   di tutta la closure prima del costo, riuso delle dipendenze fisiche87.
   Test mirati con fixture pubbliche inventate e oracle privato separato.
4. Transazioni/retry/stale/concorrenza e recupero packless nei confini reali;
   replay dell'intero gameplay, RNG, gruppi, mazzi e ricevute. Backup alterati
   e risignati respinti; compatibilità storica compresa87.
5. UI esistente e testi di disponibilità aggiornati; percorso autentico con
   tre proprietari e filepicker. Guida/lettore, tastiera/focus e quattro
   viewport. Recovery e prove visuali solo sui processi/contesti propri.
6. Typecheck, formato, diff/privacy anche in storia e suite completa finale.
   Report con rami, prerequisiti, fixture/gate/tentativi distinti; commit
   locali puliti, chiusura dei soli processi propri e sigillo privato.

Ogni passo dipende dal precedente e termina con test mirati e verifica
degli invarianti pertinenti. Gli input originali non entrano nei commit.
