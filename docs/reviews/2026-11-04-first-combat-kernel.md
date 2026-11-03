# Review del nucleo di combattimento #77

Consegna `f97567d6a959841e2d48b9b2d257beb144a5f968`, base
`e198cc79c19708df7a26cd8e5205edec36ae65c5`. Due review indipendenti sui nove
commit, rispetto alla issue77 e alla specifica pubblica del nucleo.

## Standards

**0 rilievi P1/P2.** Input limitati prima di Zod, rifiuto di accessor e
prototipi non JSON, comandi atomici su copie, receipt idempotenti e replay
coerenti con ADR0002–0003. Le porte dei risultati sono interfacce host
fidate, senza route che conceda al client totali arbitrari. Fixture pubbliche
inventate; dati e mapping privati esclusi anche dalla storia Git. Nessuna
modifica ai vecchi test, run o gate. Nessuno smell Fowler aggiuntivo concreto.

La review ha eseguito 20 test mirati e quattro probe su getter, atomicità e
copie difensive; nessun getter eseguito. Nessuna suite completa o QA UI.

## Spec

**0 rilievi P1/P2.** Coperti compiler, binding, spawn sulla proiezione,
budget e riserva distinti, slot e successi non riutilizzabili, difese e
colpi per figura, continuazioni e checkpoint. Ordine delle difese e
contrattacco confrontati con i corpi fonte; dimensione corrente, selezione
prima del range e candidato con beneficio preservati. Il budget precede
la mutazione. Controller, fisica/P2, scenario/UI e Ombra restano esclusi e
gated come richiesto dalla specifica, senza scope creep.

La review ha eseguito 26 test mirati, zero skip. Nessuna modifica o prova
di gameplay originale; la verifica integrale dei sigilli compete al root.

## Verifica e disposizione del root

- Albero dei nove commit importati identico alla consegna. Suite finale
  567/567, zero skip/todo/fallimenti; typecheck, formato e diff passati.
- Verificati 41 input e 275 file/144.281.843 byte contro il sigillo ricevuto;
  checker primario e oracle del nucleo ripetuti nelle sole copie proprie.
- Otto artefatti rigenerati e sette comandi CLI riprodotti con risultati
  identici. Tutte16 combinazioni e23 selezioni fonte confrontate; le
  popolazioni restano12/11. Nessuna sequenza Unity certificata.
- Controllati 21 percorsi/37 snapshot nei nove commit e i confini della
  consegna. Nessuna fonte, narrativa o associazione privata pubblicata.

Prove e log separati dalle fonti ricevute nella scratch ignorata
`.scratch/combat-kernel-root-review/`. Nessuna installazione, host/browser
di accettazione UI o accesso al tavolo protetto.

Nucleo integrabile. Non abilita il combattimento originale nell'app;
controller, conseguenze, scenario e UI richiedono il loro incremento.
#33/#65/#57 restano aperte. Totali: Standards 0; Spec 0.
