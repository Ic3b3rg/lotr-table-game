# Piano di implementazione del catalogo fisico #57

Esecuzione inline nel solo checkout assegnato; niente subagenti. Specifica: [physical-content-spec.md](physical-content-spec.md). Base `b9c0f465e79f6002d3ea8773ba5207000d4df921`. Review finale e GitHub al root come richiesto.

## Vincoli e attenzione di review

60 definizioni / 92 copie nelle quattro famiglie; testi reali soltanto in scratch ignorata; input immutato/output congelato; nessuna dipendenza nuova o integrazione gameplay. Le prove devono intercettare certificati in input, riferimento a fonte non dichiarata, quantità inventata per chiudere i totali, alias/copie ambigui, correzione italiana applicata all'identità sbagliata e binding TitleModel/SkillModel fabbricato.

## 1. Contratto e catalogo consumabile

- [x] Scrivere fixture sintetica completa (60 identità inventate) e test di API per catalogo verificato, ordine/copie, isolamento dall'input e diagnostico per famiglia incompleta; osservare RED.
- [x] Implementare `model.ts`, `validation.ts`, `catalog.ts`, export library da build: `inspectPhysicalContent(unknown)` / `requirePhysicalCatalog(unknown)`. GREEN con confronto letterale dei conteggi e deep freeze.
- [x] Aggiungere test RED per versioni, chiavi, tipi, bounds, cicli, ID/alias/ordine, riferimenti, copie, titoli, lingue, origine, errata e stati incompatibili; implementare invarianti fino a GREEN.
- [x] Suite, typecheck, formatter; commit locale della slice.

## 2. CLI esclusiva

- [x] Test RED con processi reali per output completo e diagnostico, impronta input e input intatto; implementare `main.ts` con map-io, due entry build.
- [x] Test RED per input/output uguali, output preesistente/hardlink/symlink, race fra scrittori, JSON/UTF-8/bounds/opzioni invalidi; GREEN senza output parziale.
- [x] Suite e verifiche; commit locale della CLI.

## 3. Pack privato delle quattro famiglie

- [x] Rileggere solo celle/oggetti pertinenti dagli estratti esistenti e confrontare il workbook originale; verificare hash senza modificarlo. Ricercare copie/facce mancanti prima nelle fonti ufficiali, poi nelle immagini originali qualificate.
- [x] Preparare confronti indipendenti per tutte le voci: quantità, facce, numeri, tratti, simboli, effetti e singole dimensioni della traduzione; documentare errata di Titolo 21 e anomalie di binding. Costruire input e manifest privati riproducibili; validare tramite API e CLI reali.
- [x] Verificare tutti i titoli, incl. 10/13/21; nessun effetto dedotto dal nome. Distinguere chiaramente annotazioni da executor.
- [x] Ripetere estrazione/confronto in un output privato separato; verificare impronte e assenza di mutazioni agli originali. Report pubblico tecnico e commit.

- [ ] Dato ancora indispensabile: quantità per identità delle 15 copie beneficio; domanda al proprietario pendente dopo ricerca mirata. Le tre famiglie indipendenti sono complete, non il catalogo complessivo.

## 4. Consegna

- [x] Esaminare il diff rispetto a specifica/ownership e verificare che Git non includa materiale reale.
- [x] `npm test`, `npm run typecheck`, `npm run format:check`, `git diff --check`; registrare risultati e limiti nel report.
- [x] Commit locali finali, HEAD/branch/stato pulito e comandi riproducibili per il root; nessun push/PR/merge/chiusura issue.

## Registro

- Baseline verificata: `npm test`, 275/275; Node 24.11.1 e node_modules root riutilizzati con collegamento locale ignorato.
- Decisione già autorizzata: specifica/piano non aprono una nuova richiesta di approvazione; l'implementazione procede integralmente come richiesto. I limiti di dati restano espliciti e non si aggirano con assunzioni.
- Ruling: aggiungere export API/CLI della singola famiglia verificata, con profilo distinto — la ricerca lascia per ora aperta solo la ripartizione delle 15 copie beneficio; le altre famiglie devono restare consumabili autonomamente — costo se non necessario: una piccola superficie API documentata e testata. Nessuna quantità è assunta.

- Esito: software/CLI completati, 356/356 test e controlli finali verdi; pack privato con 60 definizioni, tre export verificati e diagnostico complessivo. Confronto indipendente 60/60, 13 mutazioni respinte, 42 modelli e 25 hash sorgente invariati. Riproduzione input byte-identica. Il report registra il solo dato mancante, senza dichiarare #57 completata.
