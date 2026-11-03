# Piano del nucleo #77

Esecuzione inline già autorizzata; nessun altro agente o checkout.

1. **Compiler e fonte.** In `src/combat/`, schemi strict e compiler con
   artifact verificabile. Fixture inventata in `tests/fixtures/combat.mjs`.
   Test RED: manomettere size/binding, omettere un'istruzione, confondere
   Transform e proiezione, fondere slot uguali o usare un'azione sconosciuta.
   Implementare derivazione da record, riferimenti e dipendenze; build,
   test mirati e typecheck, poi commit.
2. **Spawn e checkpoint.** `createCombatKernel` / `restoreCombatKernel`:
   preflight, gruppo/figure e risorse separate, seed e journal riproducibili.
   Test RED: due barre, budget/clamp, fallimento, carenza non dimostrata,
   restore alterato, cross-source e retry. Implementare e verificare il slice.
3. **Slot e colpi.** Porta fidata delle prove, piano da copie equipaggiate
   e applicazione derivata. Test RED: due slot uguali distinti, doppia spesa,
   oggetto estraneo, zero colpi, difese/residui, modificatori/hook e2→1→0.
   Verifica mirata/typecheck, commit.
4. **Continuazioni e capability.** Selezione materializzata, popolazione
   completa, range/stato/cause e callback unico. Test RED:12/11, nessun
   ridraw a retry/restore, attaccante fisso, provocazione senza esaurimento,
   beneficio ancora nella popolazione e gate prima di costi. Commit.
5. **CLI e verifica privata.** `compile`, `verify`, `run` e `replay` con
   file nuovi esclusivi e limiti; prove via processi reali. Adattare helper
   solo nella scratch propria; checker separato contro primarie e matrice
   reale, hash/sigillo. `npm test` una volta finale, typecheck, formato,
   diff/privacy. Report pubblico e consegna con commit/comandi/hash/gate.

Focus della review: origine dei parametri e binding; disponibilità distinta
dal budget; piano vincolato al risultato fidato; ordine delle difese;
persistenza della popolazione e del risultato casuale; nessun consumer
fisico/scenario simulato da ACK. Ogni punto ha prove negli incrementi sopra.
