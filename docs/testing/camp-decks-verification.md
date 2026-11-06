# Camp skill-deck verification (#128)

Implemented on clean main `a70b78ab3099a59d8b0e1381a3eb2ba5ce87d180` after
#126/PR127, in the supplied isolated checkout. The public
[spec](../planning/camp-decks-spec.md) and [plan](../planning/camp-decks-plan.md)
were committed before product code. [API/CLI documentation](../camp-decks.md)
defines the projected source, fingerprints, stream policy and pending activation.

## Result

Pure standalone TypeScript library and private CLI, with exactly two new targets:
`dist/camp-decks-library.mjs` and `dist/camp-decks.mjs`. No dependency or lock change.
All 24 prior output files match the base build byte for byte. Of 797 baseline
tracked files, only `scripts/build.mjs` changed: exactly two target registrations.
Every pre-existing source, tool and validator retains its bytes.

The materialization rederives recipes and confirmations from authoritative
projection, allocates stable copies, reclaims all twenty weaknesses, follows the
explicit group permutation, prepares new role1 structurally, and deterministically
shuffles the remaining complete decks. Full replay compares all source, order,
multiset, placement, trace, resources and lineage data, with optional independent
source/realization/artifact pins. A changed seed changes realization/artifact pins.
Integrity is not editorial or saved-game authenticity.

## Actual validation

Node `v24.11.1`, npm `11.6.2`, TypeScript `5.9.3`, unchanged pinned lock.

| Check                                                 | Actual result                                                                              |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Base build                                            | Exit 0; 24 output hashes retained                                                          |
| Build including two targets                           | Exit 0, including the build inside canonical npm test                                      |
| Typecheck                                             | Exit 0 on final product code                                                               |
| Repository formatting                                 | Exit 0 on final product code                                                               |
| Focused source/library/CLI tests                      | 34 passed, 0 failed/skipped/cancelled/todo; exit 0                                         |
| One complete canonical `npm test`, alone/concurrency4 | **976 passed**, 0 failed/skipped/cancelled/todo; npm exit **0**                            |
| Canonical baseline and duration                       | 942 existing + 34 new; 1,261,896.685375 ms                                                 |
| Post-canonical byte/diff/privacy audit                | Exit 0; 24 prior outputs identical, exactly 2 new; only allowed build registration changed |
| Independent final private oracle                      | All 6 cases matched complete expected artifacts/diagnostics                                |

There was exactly one complete canonical invocation. Focused TDD runs are separate
and do not replace it. The final code and tests were unchanged after that run
started; the final documentation commit records its result.

Reproduce public checks from the checkout with the pinned dependencies available:

```sh
npm run build
npm run typecheck
npm run format:check
node --test --test-concurrency=4 tests/camp-decks-source.test.mjs tests/camp-decks.test.mjs tests/camp-decks-cli.test.mjs
npm test
```

Run the last command alone with its registered concurrency4. Do not install
packages or acquire original content to run the public invented fixtures.

## Meaningful TDD and regressions

The ignored evidence preserves every actual attempt, command, exit and log:

| RED attempt                             | Actual failure before implementation/fix                |
| --------------------------------------- | ------------------------------------------------------- |
| Source/capability                       | 5 failing tests out of 9                                |
| Deck materialization/replay             | 13 failing tests out of 13                              |
| CLI                                     | 4 failing tests out of 6                                |
| Separate embedded source/lineage copies | Mutating source changed result lineage: 99 instead of 2 |
| Nested proxies                          | Reflection executed a trap: 1 instead of 0              |
| Opaque JSON provenance                  | Zod stripped a legitimate own data key                  |

All subsequently pass. Boundary tests additionally cover exact recipe maximum200
and rejection of201, legal decks over30/56, all old weakness zones and reserve,
changed roles, old-role purchases, removed titles, older unchanged confirmations,
future/null/stale confirmations, forged summaries, identity/ownership/duplicate
failures, selected content gates before entropy reads, seed pinning, coherently
re-signed tampering, input immutability, independent copies, complete-output budget
failure and JSON roundtrip. CLI tests exercise exits0/1/2, private0600 permissions,
exclusive/concurrent publication, invalid UTF-8/options/pins, no overwrite, cleaned
staging and no partial destination on errors. Rejection-sampling tests cover the
uint32 cutoff and sizes above56.

## Independent private oracle

Original definitions, workbook, norms, mappings, normalized inputs, artifacts and
full reports stay in ignored `.scratch/camp-decks-128/evidence/`, including all Git
history. The source manifest pin was checked before parse, then all20 selected
rows totaling63,399,074 bytes were verified for unique paths, containment,
no symlinks/traversal, exact bytes and SHA256. The additional explicit reference
manifest was pinned before using four selected normalized normative rows. Nested
historical paths were never treated as authority. No received helper ran in place.

The operative adapter projects74 frozen skills,54 upgrades and21 workbook titles.
It preserves the separate54-card capability, including its incomplete identity.
Editorial title IDs are explicitly mapped privately and make no prior-runtime-ID
claim; the absent title17 SkillModel binding remains absent. All private inventories,
players and episodes are **technical inventions**, not original saved games.

A separate Python checker independently rereads original catalog/capability/proof/
scenario, resolves workbook sheet relationships, verifies title rows/counts and
upgrade identities, and grounds composition in pinned normative evidence. Expected
complete multisets/orders were created before TypeScript materialization. It
implements the documented canonical/hash/shuffle policy independently and compares
all physical cards, draw/prepared placement, weakness assignments/reserve, trace,
resources, lineage, fingerprints and canonical bytes.

| Private case                | Draw-deck sizes    | Result                    |
| --------------------------- | ------------------ | ------------------------- |
| H2                          | 16, 16             | Full match                |
| H3                          | 16, 16, 16         | Full match                |
| H4                          | 16, 16, 16, 16     | Full match                |
| H5                          | 16, 16, 16, 16, 16 | Full match                |
| H2 grown                    | 68, 16             | Full match, no truncation |
| Selected incomplete content | No decks/draws     | Exact gate diagnostic     |

Final product CLI checks ran18 commands:15 exit0, one expected invalid gate
verification exit1, and two legitimate gate commands exit2. All source files
remained unchanged. Separate re-signed order, multiset and trace attacks failed
both independent oracle and product replay. A changed seed failed the expected
realization/artifact pins; a source-only pin correctly does not bind entropy.
Actual expected failures and original first-pass outputs remain preserved.

Shared assumptions are explicit: technical invented authoritative inventory/choices,
repository canonical JSON on the selected corpus, and SHA256-FY-v1 policy. This is
not a Unity/JIT implementation, original campaign acceptance or editorial
authentication proof. Private README, receipts, complete manifest and separate
outer byte/SHA pin provide reproduction and sealing details without publishing
original content.

## Remaining boundary

All positive outputs remain before activation/preparation triggers, with
`runtimeReady:false` and adventure start disabled. Atomic host activation and
trusted entropy/receipt freezing, physical cleanup, prepare/after-setup triggers,
consumables, XP initialization, Scout3/startup/enemies and the later post-loss
weakness packet remain pending. Inspiration, equipment, balances and history are
source provenance. There are no State/ScenarioPack/schema29, Store.once/cycle/
replay, host/HTTP/UI, original A1 origin/RNG or old preparation changes.

All three benefit quantities from #57 remain null/unverified and blocked. Original
checkpoint #156 remains static/gated. #33/#89/#65/#57 remain open. No protected
live-table access, new original game, resume, whole-game/original-victory,
Unity/JIT or physical phone/Windows/Safari certification was performed. Root owns
fresh Standards/Spec review and integration; no delegation or remote writes were
performed by this implementer.

## Integrazione Root

L'albero della consegna `981fde9` è stato integrato senza variazioni, poi corretto
in `2b52852` dopo review Standards e Spec indipendenti. Due P2 riprodotti:
allocazioni dei descriptor prima del limite del contenitore e getter ereditati
letti dallo schema. Ora i limiti precedono i descriptor e gli schemi ricevono solo
proprietà JSON proprie, con rifiuto degli accessor inattesi prima delle letture.
Anche un dato ereditato non può riempire un campo obbligatorio mancante.

Le regressioni RED sono conservate; **36/36** test mirati passano. Una nuova review
scoped conferma entrambi i finding risolti, senza nuovi difetti. Il Root ha
riprodotto sei casi con il checker separato, 18 comandi CLI e i negativi risignati;
i 29 documenti dati confrontati rimangono byte-identici alla consegna.

La prima canonica Root registra **974/978**, exit npm **1**, per tre timer di
avvio host e un HTTP 408. I tentativi e gli errori restano conservati. Gli stessi
casi passano successivamente 1/1 e 4/4 senza modifiche a prodotto, timeout o test.
La verifica completa finale sullo stesso `2b52852`, ALONE/concurrency 4, registra
**978/978**, exit npm **0**, zero fail/skip/cancel/todo, 1.271,858 secondi. Non è
stata dimostrata una causa ambientale specifica dei primi errori.

Tutti gli input effettivi e i 24 vecchi dist restano identici. Build, typecheck,
formato, diff e privacy verificati; solo i due target aggiuntivi sono registrati.
La chiusura riguarda il modulo standalone, senza attivazione del seguito o
accettazione di una partita originale. [Review Root](../reviews/2026-11-06-camp-decks.md).
