# Combat controller implementation plan

**Goal:** attacco completo e provocazione dalla UI con ritorni persistiti.

**Architecture:** estendere77 e fronti P1/P2; il controller usa i gruppi81 e il
ledger ordinario v2. Il pack congela la nuova capacità prima dello startup.

**Tech stack:** TypeScript strict, Zod, SQLite/Store.once, browser DOM esistente.

**Spec:** [combat-controller-spec.md](combat-controller-spec.md).

## Vincoli e review

Esecuzione inline nel solo checkout assegnato, senza deleghe né approvazioni
ordinarie. Root eseguirà review indipendente e integrazione. Nessuna nuova
dipendenza o quantità57. Proteggere coperte, run storici e origine round1.
Controlli specifici: istruzione trattenuta dopo figli; slot ripetuti e zero colpi;
esiti diretti distinti dai figli; sconfitta durante provocazione; riserva ignota
distinta dal possesso assente. I test dei rispettivi passi coprono questi casi.

## Passi

1. **Compiler e primitive** (`src/combat/`, `src/shared/`): test inventati per
   closure ordinata, bonus/immunità, size alla ripresa e riduzione; osservarli
   RED, estendere le primitive, typecheck e test mirati GREEN. Congelare anche
   clausole source-linked, oggetti e interfaccia riserva senza quantità inventate.
2. **Consumer fisico** (`src/physical-resolution/`, `src/shared/physical.ts`):
   RED per finestre d'attacco, successi/slot una volta, carte padre trattenute,
   esiti diretti e aggiunte/frontiera. Estendere il consumer esistente e verificare
   GREEN con regressioni P1/P2. Interfaccia: figli tipizzati del programma fisico
   producono risultati autorevoli e continuazioni, mai importi dal client.
3. **Controller nel ledger** (`src/server/physical-cycle.ts`, `src/scenario/`,
   protocollo): RED per costo/pesca atomici, retry/stale, multi-gruppo,
   contrattacco e provocazione/ritorno. Integrare comandi e ricevute nel replay,
   stato condiviso81 e gate dell'intera closure; verificare GREEN e restore.
4. **UI personale** (`src/client/`): bersagli/armi/costo, anteprima/cancellazione,
   capacità, successi/slot, istruzione corrente e ritorno. Riutilizzare lettore,
   guida e form fisici. Verificare browser reale e quattro viewport con host,
   browser e profili propri, senza preview delle modifiche.
5. **Accettazione e consegna**: generare artefatti privati prima dello startup,
   eseguire il percorso autentico UI a tre identità e i recuperi ai confini.
   Matrice privata indipendente e backup storici, typecheck/formato/privacy/diff,
   suite completa finale, report e sigillo proprio. Commit locali puliti.

Ogni passo viene completato soltanto dopo la relativa verifica; un limite reale
rimane esplicito e impedisce di dichiarare completa la feature.
