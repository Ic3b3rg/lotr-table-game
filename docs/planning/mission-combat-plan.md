# Primo scontro — piano di implementazione #108

> Esecuzione personale con `superpowers:executing-plans` e TDD. Nessun agente;
> le review Standards/Spec fresche e l’integrazione spettano al root.

**Obiettivo:** segnalino→opzioni/carte→spawn→combattimento o timer→callback→ritorno.
**Architettura:** estendere il consumer scenario e il controller condivisi.
Capacità facoltativa congelata, senza duplicare i quattro FSM esistenti.
**Stack:** TypeScript strict, Zod, DOM, Node24.11.1 e dipendenze esistenti.
**Spec:** [mission-combat-spec.md](mission-combat-spec.md).

## Vincoli globali

Un checkout, un implementer, nessuna installazione o scrittura remota.
Materiali ricevuti read-only; helper/DB soltanto in copie proprie.
57null/unverified e156 immutato. Positivi esclusivamente inventati.
Ledger/origine/pack storici invariati; sole migrazioni strutturali.
Nessun consumer simulato, pool filtrato, reroll o indebolimento dei controlli.

## Attenzione di review

- Parametri/certificati coerentemente risignati ma owner/receiver errati:
  rifiuto prima degli effetti, compreso il seed storico.
- Un solo posto applicativo libero: diagnosi immutabile, nessuno shrink.
- L’attore muore nel figlio: conservare effetti globali e risultato padre,
  senza offrire un nuovo attacco o aprire una finestra di perdita anticipata.
- Sconfitta durante attacco concesso: premio/callback e ritorno una volta;
  fuga in Ombra non crea un turno o un premio di combattimento.
- Retry su richiesta precedente e doppia callback: receipt stabile e payload/
  viste interi; nomi arbitrari di variabili/eventi restano validi.

## 1. Contratto e slice verticale compiler/runtime

File: `src/shared/scenario.ts`, `src/shared/clues.ts`,
`src/scenario/first-combat.ts`, `compiler.ts`, `pack.ts`, `handlers.ts`,
`runtime.ts`, `encounter-physical.ts`, `src/server/scenario.ts`;
fixture/test inventati `tests/fixtures/mission-combat.mjs`,
`tests/mission-combat-compiler.test.mjs`, `tests/mission-combat-runtime.test.mjs`.

- [ ] RED compiler: capacità e certificato completo, owner esclusivi,
  opzioni/challenge letterali, spawn normale/variante, posa/configurazione,
  receiver/timer. Rigettare forme parziali, doppie o fuori scope.
- [ ] RED consumer: costo/cancel/conversioni, tutti esiti, benefici veri,
  spawn/budget/riserve/carenza e timer non azzerato.
- [ ] Implementare `validateFirstCombat(pack)`, binding startup e
  `spawnFirstCombat(state, instance, action, effectId)` nel consumer scenario;
  nuove istruzioni `spawnFixed`/`removeEnemies` soltanto nei propri owner.
- [ ] GREEN mirato; commit locale della slice.

## 2. Attacco concesso e callback sul controller esistente

File: `src/shared/combat-controller.ts`, `src/combat/controller.ts`,
`preflight.ts`, `src/scenario/first-combat.ts`, `runtime.ts`,
`src/client/scenario.ts`, `combat.ts`, `guide.ts` dove pertinenti.
Test: `tests/mission-combat-attacks.test.mjs`, `mission-combat-timer.test.mjs`.

- [ ] RED normale/fallimento senza concessione; variante con uso/rinuncia,
  owner/bersaglio/cursor e zero costo aggiuntivo con carte/spese vere.
- [ ] RED sconfitta e fuga distinte: risorse, premio, callback, sezione2,
  obiettivo0/3, cleanup e ritorno; superstiti/P1/P2/Ombra nei confini esistenti.
- [ ] Integrare concessione e callback tipizzate nello stesso registro;
  preflight completo prima di costo/RNG, compreso gate57 senza filtro.
- [ ] GREEN mirato e UI italiana per attesa/concessione/ritorno; commit.

## 3. Transazioni, migrazione e recupero

File: `src/server/state.ts`, contratti di schema pertinenti e validatori
scenario/combat; test `tests/mission-combat-{migration,transaction,recovery}.test.mjs`.

- [ ] RED vecchi formati anche seed, dizionari arbitrari validi;
  actor/hero/space/source/card/cursor, concurrent/stale/retry.
- [ ] Introdurre schema24 strutturale senza default gameplay o retrofit.
- [ ] SIGKILL e restore packless su host vuoti prima/dopo i nuovi commit;
  confrontare payload e viste interi, negativi risignati422 immutabili.
- [ ] GREEN mirato; commit locale.

## 4. Primarie/oracle, QA nativa e compatibilità dal commit

Solo `.scratch/encounter108/work/` contiene adapter, driver e dati privati.

- [ ] Rilettura bounded a due reader, owner IL/packet/modelli; oracle
  indipendente per il slice e confronto statico del nuovo compiler.
- [ ] Fixture nativa ante-startup,3 identità, quattro larghezze, HTTP IPv4;
  DOM/Input per visita/spawn/attacchi/ritorni, guida/lettore/focus/tastiera.
- [ ] Ispezionare screenshot effettivi, conservare tentativi; export,
  negativi, restore corrente e recupero dei tre posti. Chiudere superfici proprie.
- [ ] Ricostruire validator dal commit;503 file/17 viste94 e tutte serie96–106,
  export/finali, hash prima del parse e confronti interi.156 solo statico.

## 5. Verifica e consegna

- [ ] Eseguire `npm test` da sola, concorrenza4, dopo controlli pesanti.
- [ ] `npm run typecheck`, `npm run format:check`, `git diff --check`;
  privacy diff/file/storia, nessuna fonte/carta/IR/FSM/IL/JSON/immagine in Git.
- [ ] Report pubblico `docs/development/mission-combat.md`, README privato,
  sigillo byte/hash, comandi/tentativi/limiti; commit ordinati e albero pulito.
- [ ] Root riceve SHA e prove per le due review fresche; nessun push/PR.
