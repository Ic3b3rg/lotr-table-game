# Incontro nel perimetro base — piano #104

[Specifica](base-products-encounter-spec.md) antecedente al codice;
implementazione personale, review e integrazione al root. Node24.11.1,
TypeScript5.9.3/Zod4.6.7/DOM esistenti; nessuna installazione.

- [x] Slice1: RED su capacità attestata, input[0], guard locale e freeze;
      GREEN compiler/parse/handler con ramo esterno diagnostico. Fixture
      inventate sul vero programma e oracle privato indipendente14/14.
- [x] Slice2: RED costo→carte/conversioni→premio o Scatto→cleanup/ritorno;
      implementare insieme runtime, preflight, concessione/movimento,
      provocazioni/esplorazione e UI. Schema22 e rifiuti storici nel seed.
- [x] Slice3: HTTP/SQLite/Store.once, attori/fonte/copie/cursor, concurrent/
      stale/retry; P1/P2/sconfitta e callback. SIGKILL/restore packless ai
      confini nuovi, payload/viste interi e negativi risignati. Commit puliti.
- [x] Slice4: QA nativa inventata su propria porta4405 o altra propria,
      precondizioni ante-startup e3 identità; poi solo DOM/Input fino al
      ritorno. Quattro larghezze, guida/lettore/focus/tastiera/no overflow,
      export/restore e chiusura superfici. Conservare tentativi senza rewind.
- [x] Slice5: validator ricostruito dal commit; byte/hash prima del parse,
      confronti503/17/18/14/17/19 ed export/finali. Poi suite canonica da
      sola a concorrenza4, typecheck/formato/diff/privacy storia. Report
      pubblico, README/sigillo privati, HEAD/branch/commit/pulizia.

Verifica mirata: `npm run build` e
`node --test --test-concurrency=4 tests/base-products-*.test.mjs`.
Finale: `npm test`, `npm run typecheck`, `npm run format:check`,
`git diff --check`. Test Node pubblici soltanto inventati; fonti e oracle
privati. Originali static/compiler/oracle soltanto, gate57 e156 intatti.
