# Physical Resolution P0 Implementation Plan

> Esecuzione inline con TDD, nessuna delega o altro checkout. Spec/piano ed
> esecuzione già autorizzati; review fresche e integrazione esclusivamente al root.

**Goal:** risolvere e recuperare conseguenze coperte fonte con due mazzi reali.

**Architecture:** modulo fisico profondo con programmi stretti, freeze privato,
replay di copie/casualità/costi e proiezione pubblica; adattatore al consumer
scenario esistente, Store.once e UI di richieste con soli input legali.

**Tech Stack:** Node24.11.1, TypeScript/Zod/SQLite/DOM, dipendenze esistenti.

**Spec:** [physical-resolution-p0-spec.md](physical-resolution-p0-spec.md).

## Global Constraints

- Schema11 migra1–10, preservando tutti i tavoli e consumer precedenti.
- Originali, contenuti e prove private soltanto scratch; raw verificato read-only.
- Nessun nuovo agente/checkout/install/GitHub write;4339 e dati root intoccabili.
- Nessun nuovo executor originale P1/P2/P3 e nessuna quantità beneficio inventata.
- Spec/piano committati prima del codice; TDD e commit per incremento verde.

## Review Focus

- Cancellazione concorde di cronologie: replay più completamenti fonte obbligatori.
- Stato vuoto dopo un costo accettato: sospensione precisa senza perdere progressi.
- Due actor o intent simultanei: un solo figlio/costo e risposta/rifiuto coerente.
- Dati nascosti in risposte indirette: scansione sessione/eventi/receipt/DOM/log.
- Restore senza pack: stessi mazzi/cursori/casualità, generation nuova soltanto.

## Task1 — modulo e contratti

Files: `src/shared/physical.ts`, `src/physical-resolution/{index,random,
runtime,validate,view}.ts`, build, `tests/physical-resolution.test.mjs` e fixture.
Consuma: raw con requirePhysicalFamily. Produce: freezePhysical, openPhysical,
answerPhysical, validatePhysical, physicalView con stato/programma tipizzati.

- [x] Test RED per raw/famiglie,56 copie, inizializzazione e proiezione privata.
- [x] Implementare freeze e casualità versionata; verificare GREEN e tipi.
- [x] Test RED per prevenzione/costo, subire, scartare/fondo, figli, zero/gate/vuoto.
- [x] Implementare replay deterministico, scelte e invarianti; GREEN e commit.

## Task2 — consumer autorevole e persistenza

Files: shared scenario/protocol, server state/store/scenario/commands,
scenario runtime/handlers/pack e validatori, tests physical HTTP/recovery/migration.
Consuma Task1; produce azione physical, task/request fonte, SCENARIO_INPUT
tipizzati e schema11 con vista pubblica distinta.

- [x] RED pack rigoroso, source mismatch, actor/cursor/revision e ACK respinto.
- [x] Implementare fonte sintetica esplicita e inizializzazione source-bound.
- [x] RED migrazioni1–10/pending e privacy sessione/receipt/eventi; GREEN.
- [x] RED retry/concorrenza/crash/restore/alterazioni risignate, inclusa doppia
      rimozione ricevute e completamento figlio saltato; GREEN e commit.

## Task3 — UI integrata

Files: client physical/scenario/guide/style, tests renderer e browser helper.
Consuma solo physicalView e richiesta fonte. Produce controlli di allocazione
e scarto per actor autorizzato, conteggi e prossimo passo per tutti.

- [x] RED renderer/input/accessibilità e assenza identità nascoste.
- [x] Implementare nello stile corrente, guida/focus/status e attesa altrui.
- [x] Verificare GREEN suite e tipi; commit UI integrata.

## Task4 — accettazione e consegna

Files: soli report tecnici pubblici e scratch privata del task.

- [x] Ricontrollare hash raw/contesto/fonti prima e dopo senza rigenerare freeze.
- [x] Preparare programma sintetico e host isolato4353; tre identità indipendenti.
- [x] Solo UI: inizializzazione/richieste/allocazioni, trasferimenti/scarti e
      ritorno padre/conclusione; zero conferme per operazioni automatiche.
- [x] UI backup/import, recovery, riavvii a ogni richiesta, pack assente dopo
      freeze; confronti readonly integrali di gameplay/ricevute.
- [x] Tastiera/focus/guida/status e320/768/1024/1440, evidenze PNG private ispezionate.
- [x] npm test, typecheck, format:check, diffcheck; report con comandi/hash/limiti.
- [x] Commit finali, chiusura soli processi/schede propri, HEAD/branch/checkout pulito.
