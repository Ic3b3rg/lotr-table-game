# Camp skill decks before activation (#128)

Base: `a70b78ab3099a59d8b0e1381a3eb2ba5ce87d180` after #126/PR127.

## Contract and authority

Create a pure Node TypeScript library in `src/camp-decks/` and a separate CLI.
Only new build targets are `dist/camp-decks-library.mjs` and
`dist/camp-decks.mjs`. Existing entrypoints, sources, tools, validators and all
24 existing output files retain their bytes, except the build target list.
There are no dependencies or installations.

The versioned strict source is an authoritative **projection**, not a State or
ScenarioPack. It supplies a catalog (six heroes, six roles, six basic definitions
with five copies each, five cards per hero, three per role, twenty weakness
definitions with one copy each, purchased identities, and twenty-one single-copy
titles), the separate 54-card camp-preparation capability, original roster and
owners, previous episode fingerprint, current revision, campaign inventory,
current hero selections/balances/owned copies, archived weakness locations,
confirmed recipes and an explicit exact group-agreed hero draw permutation.
Definition hashes and evidence locators are supplied data; the library never
opens locators. Normalized identities are authoritative inputs, not hardcoded
editorial mappings. Title identity does not require inventing a SkillModel.

`campDeckCapability(source: unknown)` validates and independently derives recipes
without entropy. `materializeCampDecks(source: unknown, entropy: unknown)` returns
a private artifact or an explicit capability gate. `verifyCampDeckArtifact(raw:
unknown, expectedPins?: unknown)` rederives the entire artifact and applies trusted
optional source, realization and artifact fingerprints. Invalid input/pins throw;
legitimately incomplete selected content gates. Unselected incomplete content is
preserved. Capability cannot promote a requires-content initial card merely
because the catalog calls its identity bound.

Recipes retain the existing CampRecipe shape and hash convention. Recompute
cards, futurePrepared, itemCopies, accessory, balances and gate from current
authority, then compare the supplied recipe and summaryHash. A current unchanged
summary may have an older positive confirmedRevision at or below source revision;
null/future confirmations and changed summaries are invalid. A content gate may
retain null confirmation and returns no random draws.

## Composition and conservation

Output heroes follow the original roster. Basic copy ordinal follows that roster,
independent of group draw order or campaign hero array order. Use the six basics,
five hero cards, three **new** role cards, inventory-backed purchases found in
owned skillCopies, and all owned titles, including titles removed in the previous
adventure. Old free role cards are never purchases. Inventory ownership and physical
copy uniqueness must agree; roles and equipment selections cannot be appropriated
or duplicated. Recipe maximum is 200 before the new weakness; legitimate decks
over 30 and over 56 cards remain complete.

Reclaim the whole twenty-copy weakness pool from deck/discard/prepared/revealed/
setAside/reserve locations tied to the archived episode and stable owner. Reject
missing, unknown, duplicate, or wrongly owned locations. Shuffle the canonical
catalog-ordered pool and assign its top card to each hero in the explicit group
permutation. Reserve length is `20-H`. Shuffle each hero's remaining cards with
the new weakness. New role number 1 is structurally prepared and excluded from
draw; discard/revealed/setAside are empty. No input is mutated. Equipment, balances,
resources, removed-card annotations and history survive as source/lineage data.

## Randomness and fingerprints

Policy `camp-decks-sha256-fy-v1`, top-first arrays (index 0 is top). Each independent
stream is `weakness-pool` or `hero:<heroId>`. Word at cursor c is the first unsigned
big-endian 32-bit word of SHA256 of canonical JSON
`[policy, seed, stream, c]`; cursor starts at zero. Seed is exactly 64 lowercase
hex digits, explicit and private. Descending Fisher-Yates chooses an index in
`[0,size)` using rejection below `floor(2^32/size)*size`, then remainder. Rejecting
the incomplete residue interval removes modulo bias. Sizes through 201 are
supported without changing the legacy PhysicalRandom implementation. Trace records
every word, cursor, size, acceptance and index, including rejection; verification
replays it without system randomness. There is no Unity/JIT parity claim.

sourceFingerprint hashes the full validated source. realizationFingerprint hashes
`{sourceFingerprint, entropy, policy}`. artifactFingerprint hashes the full artifact
body excluding only itself. All use repository canonical JSON and SHA256. Trusted
expected pins are separate API arguments, never taken from the untrusted artifact.
Integrity establishes consistency, not editorial authenticity: coherently invented
authority can pass without independently trusted pins. Future host entropy must be
generated after preflight and frozen with receipt/artifact in one transaction;
this module gives clients no host seed-selection policy.

## JSON and publication

Before any schema traversal, use repository physical-content JSON budgets and
descriptor checks: finite JSON only, ordinary/null objects and ordinary dense
arrays, no getters, custom prototypes, symbols, cycles or sparse/inherited indices.
Parsing copies defensively. Apply the same guard and canonical hashing budget to
the complete artifact before return and to verification input, including embedded
source, trace and preserved provenance. A bounded source that expands past the
complete-output budget fails before return/publication.

CLI: `capability|materialize|verify --input FILE --output NEW_FILE`.
Materialize additionally requires `--seed HEX`; verify accepts `--expect-source`,
`--expect-realization`, `--expect-artifact`. Reject unknown/duplicate/inapplicable
options. Bounded UTF-8 JSON reads; compact canonical output; atomic exclusive
publication with mode 0600 using the existing staged-file/hard-link writer. Never
overwrite even concurrently; no partial output. Exit 0 technical validity, 1 invalid
command/input/pin/publication, 2 legitimate gate with a diagnostic document saved.

## Permanent activation boundary

Every positive artifact explicitly says `runtimeReady:false`, adventure start
disabled, and materialized before activation/preparation triggers. Pending:
atomic registry activation preserving A1 origin/RNG; physical damage/fear/boon
cleanup; on-prepare/after-setup; consumable resets; new-role XP initialization;
Scout3 and later startup/enemies; post-loss weakness **after** Scout3 in a future
consumer; verified benefit quantities. Inspiration/resources are provenance, not
final active values. No State, schema29, Store.once, cycle/replay, host/HTTP/UI,
old state.preparation, journal or session changes.

All three benefit quantities from #57 remain null/unverified and blocked. Original
checkpoint #156 remains static/gated. #33/#89/#65/#57 remain open; no whole-game or
physical-device/platform certification. Private originals, mappings, real text and
artifacts stay ignored throughout Git history. No live-table access is permitted.

## Acceptance evidence

Public invented fixtures cover composition, ownership, full weakness conservation,
all old zones, role changes, removed titles, stable copies, exact order/trace,
large decks, confirmation revisions, capability gates, unsafe JSON, seed pins,
re-signed tampering, complete-output budgets, immutable boundaries and CLI exits,
0600/no-overwrite/concurrent publication. A private Python oracle grounds expected
cards in selected catalog/capability/workbook/norms and independently checks full
multisets/orders for H2–5 technical invented episodes. Preserve real failures.
Final build/typecheck/format/diff/privacy and baseline byte comparisons precede one
complete canonical `npm test`, alone with concurrency 4; record baseline 942 plus
actual added tests and all process/count results. Root reviews and integrates.
