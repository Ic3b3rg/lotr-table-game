# Camp departure and first battle turn (#132)

This is the implementer's delivery record before independent review. The [Root review and final verification](../reviews/2026-11-07-camp-departure.md) records four corrected P2 findings, both amended UI flows and the final **1,041/1,041** canonical result; its findings supersede the initial source-message/bonus handling described below.

The implementation connects a confirmed first camp to a new battle episode, including three owners' physical choices and an ordinary legal movement. The positive fixtures are entirely invented. Original156 remains **STATIC/GATED**; this report does not certify original gameplay or declare the whole original adventure playable.

## Source and numeric contract

The selected static capsule was verified before parsing: 16,777-byte manifest, SHA256 `05a5e7a44c564c56bf647598d12ba34a1c77bcced9bb3e03e17af01455dd2a03`; 85 ordinary relative rows, 209,113,554 bytes, each byte count and SHA verified before copying. Nested historical paths remained data. No historical script or original game session was executed.

The source grounding is [contract120](../research/first-camp-transition-runtime-contract.md), [contract124](../research/second-adventure-battle-board-runtime-contract.md), selected method bodies from the pinned Steam1.6.6#1128 assembly, and the independently supplied board oracle. Workbook, rules/errata and app provenance remain distinct.

| Rule                      | Implemented boundary                                                                                                                                              |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Initial threat thresholds | 3H and 13H; 9 and39 for three heroes                                                                                                                              |
| Battle topology           | Ten spaces, nineteen geometric adjacencies, three blocked walls, sixteen passages, thirteen anchors                                                               |
| Initial cards             | Role1 prepared outside the deck; source Scout3 for each hero, with actual preparation continuations; no repeated A1 Spirit1                                       |
| Loss                      | After Scout3, one additional common-top weakness goes to each owner's deck bottom; EN and conflicting IT hashes retained; multihero ownership stays gated         |
| Terrain                   | Two bushes, three walls, fire and rock, in principal order                                                                                                        |
| Spawn                     | Source points with 4H/6H/5H budgets, filters1024/0/136 then0/0/136 twice, full owned product0 pool, finite live availability and complete supported bonus closure |
| Search                    | Two lore on source entry, once; then objective0 and the source handoff                                                                                            |
| Benefit quantities57      | All three original quantities remain null/unverified; departure gated before entropy or reset                                                                     |

Battle spawning follows the source's live point selection, local group randomization and group/bonus/figure choices. It does not apply the travel generator's spend fraction. A two-hero ranged point with budget8 and minimum cost10 legally remains empty. Six normal and six elite banner slots are source-bound; reservations reduce elite availability. Unsupported source closure gates instead of trimming a pool, rerolling or inventing reserves. The independent SHA256 streams make saved replay deterministic; there is no Unity/JIT random parity claim.

Both actual private board sources recompiled to their supplied serialized artifacts; the full adjacency/wall/placement graphs and float values/bits matched the independent oracle. The actual private A1 source recompiled to fingerprint `e82a6af60c2ef1a7bd920bd01cfcf691f7e1f1073b85a1b35724def5b7c6d818`, with no departure capability added. Technical #128 H2–H5, large and gated inputs were checked statically. Standalone #126 and #128 outputs retain `runtimeReady:false` and `adventureStartEnabled:false` where defined.

## Transaction, replay and compatibility

Schema31 archives the complete A1 game domain without session administration or recursive State copies. The existing physical ledger's new seed records the departure intent, actor, source, entropy and realization receipt; subsequent commands remain in that ledger. Validation reconstructs A1 from frozen source, derives departure again, then replays the active episode and validates every receipt. Coherent output hashes alone do not establish validity.

Cleanup returns personal damage, fear, boons and old weaknesses; resets temporary resources, defeat and Last Stand difficulty; preserves ownership, upgrades, titles, role XP, lore and cumulative globals. A newly selected role gets XP0 only when its balance is absent. Explicit array conversion preserves #128 top-first order in the pop-based consumer. Historical composition limits and physical random bounds retain their original replay semantics. Large owned decks use the new episode lineage and bounded physical stream.

Preflight rejects stale confirmations, missing identities/windows, incorrect fronts/board/target/spawn bindings, unknown quantities, foreign owners, stale source requests and client programs/seeds before entropy. Selected accessories require the implemented source-bound custody/depletion consumer; other accessory semantics remain gated. Historical schemas1–30 migrate structurally only, with rejection of new forms at exact schema locations and acceptance of unrelated dictionary words.

Real HTTP/SQLite checks cover duplicate and concurrent departure, full receipt equality, SIGKILL before and after COMMIT, pending role triggers/Scout3/spawn, packless restart and empty-host restore, and re-signed archive/boundary/composition/entropy/reset/command attacks. Two attacks rebuild all A2 origins and hashes from coherently edited A1 outputs and ledgers; frozen A1 source replay still rejects them. All rejections compare complete game payloads and receipts.

The storage transaction uses the existing synchronous SQLite service ([Node24 DatabaseSync](https://nodejs.org/download/release/v24.11.1/docs/api/sqlite.html#class-databasesync)). Dependencies were used read-only from the explicitly authorized installed tree through a checkout-local symlink; no installation or lockfile change occurred.

## UI and browser evidence

Native browser QA is reproducible with `node scripts/qa-camp-departure.mjs win` and `loss`. It creates its own localhost hosts, dedicated Chrome profile and four isolated contexts; it never inventories existing browser targets. The driver uses the official [CDP DOM](https://chromedevtools.github.io/devtools-protocol/tot/DOM/), [Target](https://chromedevtools.github.io/devtools-protocol/tot/Target/) and [Browser](https://chromedevtools.github.io/devtools-protocol/tot/Browser/) interfaces. Node-side game diagnostics after the declared invented camp bootstrap are read-only; progression, personal recovery, choices, export and file restore use native UI controls.

Both invented win and loss flows passed in Chrome157.0.8103.39 with three recovered personal identities and a shared PC. Each performed all camp confirmations, explicit draw-order agreement, three role-trigger choices and three Scout3 choices, source placements and handoff, START_TURN, travel and one legal move. A wall-separated destination kept the movement button disabled. At pending Scout3 each flow refreshed both views, exported a backup through the UI (2,381,320 bytes win; 2,407,858 bytes loss), removed all external source files, killed its host, restored that file through the UI to a new empty host, recovered the three identities through the UI and completed play. Full private archived/active payloads and receipts matched after administrative restore fields were normalized.

Script assertions cover camp and battle at320/768/1024/1440: no document overflow, labelled camp selectors/status, ten rendered map cells, three wall lines and eleven markers in these two runs. Reader Escape restored focus to its invoking card. The saved AX trees confirm the accessible name “Destinazione” and disabled wall-crossing movement control. No unhandled JavaScript exception was observed; controlled host disconnection is part of recovery.

Physically viewed: the win320 card reader, Scout3 fields, camp agreement/departure, guide/search and first-turn wall control; the win1440 and loss1024/320 battle viewport captures; and the loss768 camp controls. Tall panels extend beyond the viewport captures, so these are not full-board or full-page visual audits. Other widths, all owners, payload equality, complete geometry/marker counts and recovery results are script assertions. No screen-reader hardware or physical device was used.

Failed attempts are retained in ignored evidence, including the initially hidden-board rendering defect, stale polling assumptions in the harness and headless macOS select-key behavior. Focused RED/GREEN also covers readable purchased campaign cards without expanding the initial74-card catalog, visible wall layering and the native departure agreement.

## Verification result

Focused results before freeze:20/20 preflight/migration/packless recovery;3/3 commit/concurrency tests;2/2 ownership/tamper tests;3/3 wall/loss/large-resource tests;22/22 later preflight and selected-upgrade checks;41/41 historical migration/kernel/UI regression checks;6/6 final native/public-lineage/migration/reader/map checks. Each command's complete output and exit code is retained in ignored evidence, including failed attempts. The final review added early rejection for battle scope/geometry/result tags disguised as historical schemas and sorted the public lineage's identity lists to avoid exposing initial deck order.

The first canonical attempt at `3bde41a` completed with exit1: 1,034 tests, 1,033 passed, one failed, zero cancelled/skipped/todo, 1,391,156.706667ms. Its tamper test deleted the last row of a UUID-sorted command table; that sometimes selected an optional historical lobby receipt accepted by the unchanged A1 validator. Focused diagnosis confirmed the same acceptance before and after departure. Commit `5a29e66` targets mandatory A1-start and departure receipts deterministically, keeps the rejection and whole-payload equality assertions, and adds both deletion cases. The corrected focused test passed1/1. Production validation was unchanged; all failed canonical output is retained.

A second canonical attempt at `5a29e66` also completed with exit1: 1,034 tests, 1,033 passed, one failed, zero cancelled/skipped/todo, 1,363,643.986792ms. Its only failure was `fetch failed / ECONNRESET` on the final backup GET in the unchanged eleven-crash historical recovery test. That test passed1/1 unchanged in focused diagnosis (92,547.880917ms); diagnostic tracing did not retry requests. No product, assertion or timeout change was made for this reset. Its exact cause remains unestablished and is retained as a transport concern. Both before/after product fingerprints and complete failed outputs are retained.

The final canonical attempt passed at frozen product `5a29e66c128a94f6b242d56aabf702d2a479e706`: **1,034/1,034**, exit0, zero failed/cancelled/skipped/todo, duration1,356,967.327ms. `npm test` ran its build and `node --test --test-concurrency=4 tests/*.test.mjs` alone, with no browsers or other heavy jobs. Final build/typecheck/format/diff/privacy and actual private recompilation checks passed. The unchanged998-test baseline was not rerun as a bootstrap.

Before/after frozen rows were identical:596 source/tool/test/config files with SHA256 `cc5ad4ec7f6392bb48c19c964a770f438782296fe035fc81ee926fcb46368b37`;26 dist files with SHA256 `bddb787452e3136bd910882cfaf6caa1da763a4d71bce77208fdf77467c0a604`. These fingerprints hash the sorted path/byte-count/SHA rows, rather than concatenated file bytes. The lockfile SHA256 stayed `4e4c88b451d6f5847803e8f86133bed8de0873085d2b00484334216e54b00509`. Only this verification document was added after the passing freeze; no product file changed.

## Limits

- Original quantities57 and the original session156 gate remain unchanged. No original adventure was started, resumed or played.
- The implemented A2 boundary ends with ordinary action turns and movement. Later battle encounters, combat and the next Shadow phase remain gated pending their own source consumers.
- The selected upgraded accessory's depletion and after-setup windows are exercised natively. Unimplemented item/skill windows stay gated; there is no generic program injection.
- Removed titles and more-than56 owned cards are exercised at the resource/kernel layer with an explicitly declared later-campaign ownership fixture. That fixture deliberately fails native A1 history validation: a first camp cannot legally earn all54 upgrades. Native first-camp tests cover real changed roles, purchases/refunds and personal/shared upgrades.
- Browser assertions are desktop Chromium with emulated widths. They certify no physical phone, Windows, Safari, screen-reader hardware, original editorial authenticity or Unity behavior.
- One canonical attempt encountered an unreproduced `ECONNRESET` during a backup GET; focused unchanged recovery and the final canonical passed. The precise transport cause remains unestablished.
- Early fixture helpers used their own OS temporary directories before checkout-local TMPDIR/cache configuration. Their fixture cleanup removed the owned temporary data; the path-boundary deviation and initial npm-cache uncertainty are disclosed in private evidence.
- Work was performed by the assigned implementer without subagents. Self-review is followed by the parent's independent review and integration; no remote writes were made.
