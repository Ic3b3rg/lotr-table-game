# First Adventure Startup Implementation Plan

> Esecuzione inline con TDD; nessuna delega. Utente ha già autorizzato spec,
> piano ed esecuzione senza conferme di routine. Review finale al root.

**Goal:** dalla realizzazione salvata a obiettivo0 e primo turno legale dalla UI.

**Architecture:** IR stretta e manifest privato separati da un executor bounded;
binding e checkpoint persistenti, servizi carte esistenti e adattatore mappa.
Store.once conserva atomicamente effetti/richiesta/ricevuta.

**Tech Stack:** Node24.11.1, TypeScript, Zod, SQLite, DOM; dipendenze esistenti.

**Spec:** [first-adventure-start-spec.md](first-adventure-start-spec.md).

## Global Constraints

- Solo checkout assegnato; niente subagenti, nuovi checkout o dipendenze.
- Nessuna scrittura GitHub/Unity/modifica a originali; dati fonte in scratch.
- Freeze/RNG immutabili; unknown/unsupported non sono gioco valido.
- Compatibilità schema1–9, pending generation, carte e ricevute senza perdita.

## Review Focus

- Secondo prefab302A diverso da H3: closure e callback reali prima dell'avvio.
- Stale/cross-hero/restore con carte aperte: nessun doppio effetto o draw.
- Premio al cap e conversione: esito fonte anche con incremento zero.
- Nodi nascosti/ascoltatori e bool flip: persistenza distinta dalla visibilità.
- Geometria negativa e caselle non adiacenti: niente clipping o archi inventati.

## Task1: pacchetto e consumer persistente

Files: `src/shared/scenario.ts`, `src/scenario/{pack,geometry}.ts`,
`src/server/{state,store,generation-state,backup-format}.ts`, build e fixture.
Interfacce: parseScenarioPack/validateScenarioBinding; ScenarioSchema;
projectionToJourney(projection,startSpace) senza RNG.

- [ ] Test rosso: pack strict, unknown, closure/source mismatch, geometria e migrazione9.
- [ ] Eseguire test e osservare fallimenti; implementare schema/parser/adattatore.
- [ ] Suite/tipi verdi, commit del contratto e della migrazione.

## Task2: executor e autorità HTTP

Files: `src/scenario/{runtime,validate}.ts`, `src/server/scenario.ts`,
protocol/commands/main/store, test HTTP sintetici e helper.
Interfacce: startScenario(state,pack), scenarioInput(state,actor,command),
scenarioStateProblem e scenarioReceiptProblem. Richieste source-bound;
carte risolte tramite applyScouting/applySkillTest, reward once-only.

- [ ] Test rossi in incrementi: intro/init; reveal/nested; Scout/Spirit;
  obiettivo/handoff e capability gates; attori/stale/duplicati.
- [ ] Implementare ogni incremento fino a verde, mantenendo build/freeze invariati.
- [ ] Test rossi recovery/backup midway e receipt mismatch, poi verdi.
- [ ] Suite/tipi verdi e commit separati delle parti verificabili.

## Task3: compiler e prove fonte bounded

Files: `src/scenario/compiler.ts`, entry di libreria e test inventati;
script/output originali soltanto `.scratch/runtime/`.
Interfacce: compiler valida IR/provenienza/action manifest/closure; pacchetto
indipendente dal seed e legabile soltanto a prefab auditati effettivi.

- [ ] Test rosso di compiler con manifest incompleto/azione sconosciuta.
- [ ] Implementare e compilare principal/timer + union prefab H3/UI con
  loading posizionale, binding, callback/init/receiver e nuovi nodi verificati.
- [ ] Confrontare trace/checkpoint reali H3 e UI distinti; commit codice/metadata.

## Task4: percorso UI e verifica runtime

Files: `src/client/{scenario,source-text,guided-start,map-board,journey-map,
game-actions,app,guide}.ts`, style; test renderer inventati e browser script.
Interfacce: offer scenario, source requests e servizi UI carte; mappa filtrata
per visibilità runtime, ispezione gratuita e gate espliciti dei commit.

- [ ] Test rosso di testo sicuro/icone/markup e binding dei controlli.
- [ ] Implementare UI con nome/istruzioni/actor/next action/guida/backup.
- [ ] Import UI autentico53 con tre identità, avvio fino a primo turno,
  crash/reload/backup/restore alle richieste; nessuna scrittura API/SQLite.
- [ ] Verificare focus/tastiera,320/768/1024/1440, console e stato autorevole.
- [ ] Suite/tipi/formato/diff verdi; report/manifest e commit puliti.

## Handoff

Riportare commit/HEAD/branch/checkout, prove riproducibili e limiti concreti.
Il root farà review Standards/Spec e integrazione; nessuna PR nel child.
