# Covo e vittoria — piano di implementazione

> Esecuzione personale con executing-plans e TDD; nessun altro agente.

Goal: interazione certificata del covo → prova/carte/conseguenze → vittoria → campo.
Architecture: capacità congelata al seam scenario e riuso della conclusione;
nessun nuovo comando o executor. Stack: Node24, TypeScript5.9, Zod4.6, DOM.
Spec: [lair-victory-spec.md](lair-victory-spec.md).

Vincoli globali: originali solo scratch; quantità57 bloccate; origine1/Azione
immutabile; nessuna esenzione replay; nessuna delega/installazione/GHwrite;
review e integrazione al root. Test e deadline invariati.

Review focus: capacità nel seed storico; ricompense in stati estranei;
attore sconfitto fra costo e prova; successo con perdita differita già dovuta;
preflight di premi/campo prima di carte/RNG. Ognuno ha un test nella slice1–2.

- [x] Slice1 — RED compiler/consumer e schema: fixture lair inventata,
      certificati/binding, EndGame owner, due rami premio, legacy seed; prova reale
      con fallimento e nuovo ingresso, limite incluso e valore successivo.
      Files: shared/scenario/protocol/clues, scenario/compiler/handlers/pack/
      clue-capability/failure-capability/conclusion/runtime, server/state,
      client/conclusion/guide/encounter-inspection, tests/fixtures/lair-victory,
      tests/lair-victory-compiler/runtime/migration. Implementare il minimo per
      GREEN; costruire pack originale solo staticamente e confrontarlo con oracle.
- [x] Slice2 — RED→GREEN HTTP e persistenza: test sul vero Store.once,
      attore/stale/retry/concorrenza e preflight senza mutazioni; test carte,
      conversioni/figli, P1/P2, superstiti, perdita/vittoria nelle finestre fonte,
      cause/contesto e ritorno/passaggio/campo singoli. SIGKILL e restore host vuoto
      senza pack ai nuovi confini, confronti interi e negativi risignati.
- [x] Slice3 — QA nativa inventata: precondizioni ante-startup; tre contesti
      propri e tre identità, porta4401 se disponibile, tutte le larghezze,
      percorso reale DOM/Input fino al campo, guida/lettore/focus/tastiera;
      export/finale e chiusura verificata delle sole superfici proprie.
- [x] Slice4 — Commit prodotto, validator definitivo e confronti503/17/18/14,
      export/finali; hash/byte prima del parse. QA/validator terminati prima di
      npm test completo a concorrenza4. Typecheck/formato/diff/privacy storia,
      rapporto pubblico/README/sigillo, commit locali ordinati e checkout pulito.

Ogni slice: osservare RED pertinente, implementare, GREEN mirato e commit.
Il registro privato conserva i tentativi di setup separati dai RED validi.
La suite canonica completa resta l'ultima verifica pesante.
