# Catalogo fisico base: contratto #57

Specifica del 3 novembre 2026 per [#57](https://github.com/Ic3b3rg/lotr-table-game/issues/57), base `b9c0f465e79f6002d3ea8773ba5207000d4df921`, 275 test. L'esecuzione autonoma e la traduzione sono già autorizzate; review Standards/Spec e integrazione spettano al root.

## Obiettivo e confine

Consegnare un catalogo privato consumabile di danni, paure, benefici e titoli della scatola base, con un validatore pubblico generico. Il catalogo descrive contenuti ed effetti: non esegue capacità, pescate, prevenzioni, preparazione, acquisizioni o salvataggi. Non chiude #33. Host, sessione, UI, schema condiviso, mappe e freeze sono fuori ownership.

Autorità: [baseline](fidelity-baseline.md), inventari [workbook](../research/card-workbook-inventory.md), [componenti](../research/base-component-coverage.md), [identità](../research/base-card-identity-reconciliation.md), [regole](../research/rules-fidelity-matrix.md), [runtime realizzato](../research/first-adventure-realized-runtime-contract.md), [fonti ufficiali](../research/official-source-inventory.md) e [archivio immagini](../research/card-archives-audit.md). Originali e helper root sono in sola lettura. Nessuna nuova dipendenza, checkout, app avviata, accesso ai salvataggi o scrittura GitHub.

## Unità e completezza

| Famiglia | Definizioni attese | Copie fisiche attese |
| --- | ---: | ---: |
| damage | 18 | 28 |
| fear | 18 | 28 |
| boon | 3 | 15 |
| title | 21 | 21 |

Sono 60 definizioni e 92 copie. Un ID di definizione non è un ID modello Unity né un ID copia. Le copie hanno ID globale stabile e ordinale contiguo per definizione. Non si deducono molteplicità dal nome o dal totale. Una deduzione aritmetica è ammessa soltanto con premesse indipendenti documentate che determinino univocamente ogni quantità, senza conflitti.

Tutti i titoli 1–21, compresi 10/13/21, conservano numero stampato, TitleModel e collegamenti SkillModel effettivi. L'assenza circoscritta del binding SkillModel di Titolo 17 è un dato verificabile, non un effetto mancante: conservarla esplicitamente senza generare un modello. Una lacuna di contenuto o quantità blocca la completezza della relativa famiglia.

## Formato `base-physical-v1`

Input JSON strict con `formatVersion: 1`, `profile: "base-physical-v1"`, `language: "it"`, `sources`, `cards`, `errata`. Nessun certificato/checkpoint in input. L'ordine delle definizioni e delle copie è preservato; il validatore non corregge, filtra o completa i dati.

Le fonti dichiarano ID, tipo (workbook, modello/localizzazione app, regolamento, errata, carta corretta, immagine originale ospitata da terzi o evidenza derivata), lingua, edizione nota o null, URI e SHA-256 del materiale conservato. Il mirror non diventa autorità editoriale. Ogni riferimento contiene `sourceId` e localizzatore puntuale (cella, pagina/paragrafo, oggetto/chiave o faccia).

I campi verificabili sono fatti `{value, status, evidence, errataIds, note}`; `status` è `verified`, `unresolved` o `conflict`. Null significa dato non disponibile dove ammesso, mai zero inventato. La prova per campo punta alle fonti dichiarate; correzioni e limiti restano leggibili. `verified` significa controllo dichiarato contro quelle prove, non certificazione crittografica/editoriale né equivalenza runtime.

Ogni carta contiene ID, famiglia e ordine; nome italiano con origine; alias inglesi; quantità; copie distinte; stampa (tipo, numero, rango, tratti, simboli); fronte/retro e orientamento; testo italiano e originale di confronto; annotazioni meccaniche; regole d'uso della famiglia; binding app soltanto per i titoli. Le annotazioni separano tempi, condizioni, costi, bersagli, durata, operazioni, valori e simboli: sono descrittive e non costituiscono un linguaggio eseguibile.

Il testo localizzato distingue `original-it`, `working-translation` e `app-localization`. Una traduzione richiede originale inglese e confronto esplicito delle dimensioni meccaniche. I nomi riconciliati usano Main_it; gli altri sono traduzioni di lavoro. Un erratum identifica carta, campi interessati, fonte ufficiale e disposizione `applied`/`already-incorporated`; l'originale rimane nella provenienza privata. Verifica dei riferimenti bidirezionali fra fatto ed erratum.

Facce e orientamenti sconosciuti rimangono espliciti e impediscono la validità completa del campo. Un retro comune non è un secondo effetto. Per i titoli: acquisizione secondo istruzione sorgente, preparazione immediata salvo diversa istruzione, capacità utilizzabile solo preparata, proprietà conservata per la campagna, rimozione limitata all'avventura. Fonte R §105 e FAQ IT p.2; non è implementazione runtime.

## API e diagnostica

`inspectPhysicalContent(value: unknown)` valida struttura e riferimenti, restituisce un risultato profondamente congelato e separato dal chiamante. Input invalido strutturalmente/referenzialmente produce errore; input ben formato ma incompleto produce `status: "diagnostic"`, motivi puntuali e copertura per identità/famiglia, senza proprietà `catalog`. Soltanto `status: "verified"` espone `catalog`. `requirePhysicalCatalog(value: unknown)` restituisce quel catalogo o rifiuta il diagnostico. Il risultato include conteggi, limiti e anomalie preservate; non scambia uno stato fornito dal chiamante per attestazione esterna.

Rifiutare versioni/chiavi/tipi sconosciuti, ID e alias ambigui, riferimenti mancanti, copie duplicate/insufficienti, ordinali non contigui, numeri titolo duplicati, binding cross-card e stati di verifica incompatibili con dati o fonti. Stato verified richiede prove e dati completi; conflitti/unresolved devono avere motivo esplicito. Le famiglie indipendenti possono risultare complete anche in un diagnostico complessivo.

Limiti pubblici: input CLI massimo 8 MiB; al massimo 100 definizioni, 200 copie, 128 fonti, 128 errata; massimo 16.384 caratteri per stringa, profondità 24 e 100.000 nodi prima della validazione di schema; array e sotto-oggetti bounded. Non interpretare URI come percorsi da leggere o URL da scaricare.

## CLI e I/O

`node dist/physical-content.mjs --input input.json --output nuovo.json`: opzioni obbligatorie, nessun posizionale/duplicato. `readBounded` e `writeNew` di map-io; input byte per byte intatto, UTF-8 rigoroso, output atomico esclusivo con permesso 0600 e impronta SHA-256 dell'input. Exit 0 catalogo verificato, 2 diagnostico, 1 errore struttura/I/O. Nessun output per input invalido; nessuna sovrascrittura di file, alias hardlink/symlink o input. Nessun server.

## File, stile e comandi

- `src/physical-content/{model,validation,catalog,main}.ts`: schema, invarianti, API, CLI.
- `tests/fixtures/physical-content.mjs` e `tests/physical-content*.test.mjs`: esclusivamente dati inventati, API e processi reali.
- `scripts/build.mjs`: sole due entry library/CLI necessarie.
- `.scratch/physical-content/`: builder, traduzioni, originale EN, immagini, input/output, confronto indipendente e manifest privati.
- `docs/research/physical-content-catalog.md`: report tecnico pubblico senza testi reali o immagini.

TypeScript strict, zod già presente, import e stile come i moduli map-*. Nessuna modifica al contratto catalogo condiviso. Build `npm run build`; test mirati `node --test tests/physical-content*.test.mjs`; suite `npm test`; `npm run typecheck`; `npm run format:check`; `git diff --check`.

## Accettazione

TDD pubblico normale/limite/negativo su identità, copie, provenienza/lingua, errata, congelamento e I/O. Pack privato effettivo confrontato indipendentemente con XLSX originale, identità/modelli già estratti, immagini mirate e PDF ufficiali. Tutte le 60 voci richiedono confronto meccanico esplicito EN→IT; hash sorgente prima/dopo, conteggi per identità e famiglia, limiti e riproduzione registrati. Se rimane un dato indispensabile dopo ricerca mirata, consegnare le famiglie complete e una domanda precisa senza dichiarare intero catalogo completo. Commit locali ordinati, checkout pulito.
