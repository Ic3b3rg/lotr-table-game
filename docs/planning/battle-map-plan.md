# Compiler dei tabelloni battaglia — piano

**Obiettivo:** libreria e CLI offline per geometria verificabile; avvio A2 gated.
**Spec:** [battle-map-spec.md](battle-map-spec.md).
**Stack:** Node24, TypeScript strict, Zod e strumenti già installati.
**Esecuzione:** unico implementer, incrementale/TDD; nessuna delega.
Design approvato dal mandato: normali scelte tecniche affidate al builder.

## Vincoli globali

Solo `src/battle-map/`, due target in `scripts/build.mjs`, nuovi test inventati
e documentazione. Originali solo scratch ignorata. Nessun install, write GitHub,
startup/sessione/UI o sblocco57/156. API pure, JSON strict/bounded e pin fidati.
La build base è già catturata prima del prodotto:22 output,224 file fonte/tool.

## Punti di verifica

- Nonplain/getter/ciclo/sparse e budget: respinti prima del parser.
- Unione di patch e contatti d'angolo: caselle connesse, nessuna diagonale.
- Anchor su divisore interno contro confine fisico: unica regione o errore.
- Alterazioni risignate e fonti nuove coerenti: ricompilazione più pin originali.
- Output esistente e request gated: atomicità/no-overwrite ed exit2 con file0600.

## 1. Fonte, geometria e compile

File: `src/battle-map/model.ts`, `source.ts`, `geometry.ts`, `compiler.ts`,
`index.ts`; `tests/fixtures/battle-map.mjs`, `tests/battle-map.test.mjs`.

- [ ] Scrivere fixture inventata con regioni composte, board accostati,
  Transform piccoli/bit -0 e muro. Testare output completo atteso a mano.
- [ ] Osservare RED con entry libreria assente.
- [ ] Schema strict e riferimenti fonte: file/record/binding/texture/TRS/proiezioni.
- [ ] Derivare bounds, contatti, regioni connesse, archi e giunti; rifiutare
  overlap, UV discordi, proiezioni degeneri, riferimenti mancanti.
- [ ] Derivare piazzamenti unici e asse del muro; preservare ordine spawn.
- [ ] Compilare entrambe le alternative e confrontare proiezione logica.
- [ ] GREEN mirato; commit dell'incremento con spec/piano già registrati.

## 2. Verifica, pin e capability

File: completare `compiler.ts`; aggiungere `capability.ts`; estendere test nuovi.

- [ ] RED per roundtrip/copie, derivati alterati e risignati, source modificata
  coerente rifiutata con pin originali, input immutato, JSON ostile/budget.
- [ ] Implementare `verifyBattleMapArtifact(raw, expected?)` con ricompilazione
  e confronto intero, poi `battleMapCapability(artifact, request)` strict.
- [ ] Provare geometry ready e adventure-start disabled/runtimeReady false,
  tre quantità null/unverified; nessun parametro seed/H o effetti consumer.
- [ ] GREEN mirato e typecheck; commit.

## 3. CLI e persistenza

File: `src/battle-map/main.ts`, due entry in `scripts/build.mjs`,
`tests/battle-map-cli.test.mjs`, `docs/development/battle-map.md`.

- [ ] RED per compile/verify/capability, pin, opzioni e input UTF8 invalidi,
  nooverwrite/concorrenza, file0600, output gated con exit2.
- [ ] Riutilizzare readBounded/writeNew; nessun locator fonte aperto.
- [ ] GREEN mirato; documentare API/CLI/schema/limiti; commit.

## 4. Matrice reale e consegna

File operativi privati soltanto `.scratch/battle-map-compiler/`; pubblico
`docs/testing/battle-map-verification.md` senza contenuti originali.

- [ ] Adapter privato dai raw verificati e primarie selezionate; non dal
  contratto conclusivo. Checker distinto adattato in copie proprie.
- [ ] Confrontare entrambi i merge, tutte le coordinate/bit, regioni/archi,
  muri, mapping, spawn e binding con fonte/oracolo124; negativi risignati.
- [ ] Conservare comandi, tentativi, exit/stderr; manifest di prove proprie
  con righe relative, no symlink/traversal, pin separato e riferimenti distinti.
- [ ] Typecheck, build, format, diffcheck; confronto completo vecchi dist
  e sorgenti/validatori. Nessun import nuovo nelle vecchie entrypoint.
- [ ] Canonica finale una volta ALONE concurrency4 con exit npm e footer.
- [ ] Audit privacy nuovo diff/storia; verificare immutabilità input.
- [ ] Report con risultati/limiti/comandi, commit e workingtree pulita.

Autorevisione del piano: ogni requisito della spec ha un task; niente intervista,
secondo consumer, parser Unity generale o lavoro di backlog aggiunto.
