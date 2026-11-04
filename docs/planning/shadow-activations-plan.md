# Shadow activations implementation plan

**Goal:** vere attivazioni, conseguenze e seguito25 nello stesso ciclo85.
**Architecture:** estendere compiler/controller77/85 e round-source81;
capacità facoltativa congelata e ledger v2 invariato dall'origine.
**Tech stack:** TypeScript strict, Zod, Store.once/SQLite e UI DOM esistente.
**Spec:** [shadow-activations-spec.md](shadow-activations-spec.md).

Esecuzione inline senza deleghe, nuove approvazioni, installazioni o GHwrite.
Originali solo scratch ignorata. Nessuna quantità57 o accettazione sintetica.

1. Ricontrollare bounded A3902/difficoltà, famiglie di attivazione, terreno,
   owner25/40 e concessioni della compagnia dalle primarie ricevute83.
   Test RED del nuovo compiler e delle vecchie impronte; estendere
   `shared/combat.ts`, `combat/closure-compiler.ts`, `scenario/pack.ts`.
   GREEN, typecheck e commit del contratto/versione con spec/piano.
2. Test RED di selezione bersaglio, fallback/parità, percorsi minimi e
   alternativa senza movimento primario. Estendere `combat/movement.ts`,
   `selection.ts`, `controller.ts` e i relativi stati/view. Packet e
   aggiunte riusano il consumer fisico85. GREEN con regressioni85.
3. Test RED whole-phase gate, oscurità completa, ordine/rescan, soglie
   multiple, refresh e nuovo round. Estendere `scenario/round-source.ts`,
   `server/physical-cycle.ts` e compiler/certificazione del seguito25.
   Preflight strutturale prima di RNG/effetti; GREEN transazionale/replay.
4. Estendere UI personale esistente per istruzione, bersagli/percorsi,
   attese/ritorni. Usare browser nativo proprio, guida e lettore a quattro
   viewport. Accettazione autentica ante-startup; un gate reale resta un gate.
5. Recovery ai confini raggiunti e fixture separate per gli altri rami;
   matrice fonte privata, compatibilità storica, typecheck/formato/diff/privacy
   e suite completa finale. Report, sigillo privato e commit locali puliti.

Ogni capacità viene verificata RED→GREEN prima del passo dipendente. Review
root: nessun premio lontano; nessun gate per counter impossibile; movimento
gruppo dovuto dopo P2; selezione mantenuta sotto minimo; oscurità non geometrica;
normale effettivo e punti; no RNG o soglia tardiva nel preflight.
