# Camp skill-deck library and private CLI

This standalone component materializes skill decks **before activation and
preparation triggers**. A valid artifact has
`materialized.runtimeReady === false` and
`materialized.adventureStartEnabled === false`. It cannot start an adventure.
The [spec](planning/camp-decks-spec.md) defines authority, conservation and the
activation boundary; the [plan](planning/camp-decks-plan.md) records implementation
steps. [Verification evidence](testing/camp-decks-verification.md) records results.

## Library

```ts
import {
  campDeckCapability,
  materializeCampDecks,
  verifyCampDeckArtifact,
  type CampDeckSource,
  type CampDeckArtifact,
  type CampDeckPins,
} from './dist/camp-decks-library.mjs';

const capability = campDeckCapability(sourceUnknown);
const result = materializeCampDecks(sourceUnknown, { seed: privateSeed });
if (result.format === 'camp-decks-artifact-v1') {
  const artifact = verifyCampDeckArtifact(result, trustedExpectedPins);
}
```

These are synchronous pure operations. Invalid input, stale authority, missing
confirmation, mismatched expected pins, replay differences and budgets throw.
`materializeCampDecks` returns `camp-decks-gate-v1` with `entropyDraws:0` when
required content is legitimately incomplete. It validates capability before
reading entropy. Capability needs no seed and reports blockers and pending
integration prerequisites. `enabled` describes identity/recipe readiness; a later
complete-output budget failure still rejects materialization.

The technical seed is exactly 64 lowercase hex digits, represented by
`{seed: string}`. It is retained privately inside a positive artifact. Keep the
artifact and seed out of public documents and Git. The future host must choose
trusted entropy after preflight and atomically freeze source, entropy, receipt,
artifact and activation. This library cannot authorize client seed choices or
replace that transaction.

## Authoritative source projection

`CampDeckSource` / [`sourceSchema`](../src/camp-decks/model.ts) define the complete
strict `camp-decks-source-v1` format. Public, entirely invented examples are in
[the fixture](../tests/fixtures/camp-decks.mjs). No real title IDs are hardcoded.

| Field                 | Required authority                                                                                                                                          |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `revision`            | Current positive authoritative snapshot revision                                                                                                            |
| `catalog`             | Origin fingerprint; six hero and six role IDs; ordered definitions with supplied copy IDs, owner, number, identity, definition hash and evidence locators   |
| `capability`          | Separate projected 54-card `source-camp-preparation-v1` capability, tied to origin catalog and definition hashes; all identity statuses retained            |
| `originalRoster`      | Stable hero order, player owner and original episode role; determines basic copy ordinal                                                                    |
| `episode`             | Archived episode identity, fingerprint and win/loss provenance                                                                                              |
| `drawOrder`           | Explicit exact group-agreed permutation of roster heroes                                                                                                    |
| `campaign.heroes`     | Current role, owned skill/title/item copies, role balances and opaque JSON provenance                                                                       |
| `campaign.inventory`  | Unique supplied purchased/title/item/accessory copies and authoritative owner (`null` only for shared equipment)                                            |
| `campaign.provenance` | Opaque JSON resources/history, copied without executing or normalizing them                                                                                 |
| `oldWeaknesses`       | All twenty distinct copies with archived zone, hero/player ownership and episode fingerprint; reserve has null owners                                       |
| `choices`             | Hero/accessory selection, existing CampRecipe shape, canonical summary hash, positive current-or-older confirmation revision (null only for a gated recipe) |

Initial catalog series are six basic definitions with five supplied copies each,
five single-copy hero cards per hero, three single-copy cards per role, twenty
single-copy weaknesses and twenty-one single-copy titles. Other supplied
purchased definitions are single-copy. Initial capability rows must match the
corresponding catalog definition hashes/owners/numbers. Neither catalog status
nor text can override a capability row requiring content. For weaknesses the
`number` is an explicit catalog-order ordinal; it need not claim a printed number.
Title identity is separate from any effect or SkillModel binding.

The projected purchase list is the authoritative campSkills identity lookup,
including legitimate upgrades from old roles. `skillCopies` can also contain
original free cards; these are validated as old ownership and never interpreted
as purchases. Retain campaign-owned titles even when archived provenance marks
them removed in the previous adventure. Recipes are reconstructed using the new
role and compared in full, including item/accessory selections and balances.
A changed recipe cannot be legalized by replacing its summaryHash alone.

The source is sufficient without paths, State, ScenarioPack or backups. Evidence
locators are opaque data. Any supplied normalized editorial identities must be
attested separately; technical consistency alone does not establish authenticity.

## Result and pins

The positive `camp-decks-artifact-v1` embeds the validated source, explicit entropy,
policy, three fingerprints and the full materialization. `materialized` contains:

- Heroes in original roster order: player, new role, recipe hash, new weakness,
  structurally prepared role1, top-first draw deck, and empty discard/revealed/setAside.
- Whole shuffled weakness pool, explicit ordered assignments and reserve of `20-H`.
- Independent weakness-pool/per-hero stream traces with every word, rejection,
  index, size and cursor.
- Archived source lineage, resources, equipment, choices and history, copied
  separately from embedded source. These are not finalized active resources.
- Pending activation, physical cleanup, prepare/after-setup, consumable resets,
  new-role XP initialization, Scout3/startup/enemies, later post-loss weakness and
  verified benefit quantities.

Arrays are top-first: index 0 is the next card. Do not pass this order unchanged
to a consumer that draws by `pop()`; that future consumer needs an explicit
conversion. Decks may exceed 30 and 56 cards. A recipe permits 200 cards before
adding the weakness; role1 remains outside the shuffled deck. There is exactly
one new weakness per hero even after a loss. The later post-loss packet belongs
after Scout3 in a future consumer.

All fingerprints use repository canonical JSON and SHA256:

| Pin                      | Meaning                                                                                                               |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `sourceFingerprint`      | Full effective projected source, including current choices, confirmations, inventory, archived lineage and capability |
| `realizationFingerprint` | `{sourceFingerprint, entropy, policy}`; binds the seed and shuffle version                                            |
| `artifactFingerprint`    | Complete artifact excluding only its own fingerprint field                                                            |

`verifyCampDeckArtifact(artifact, pins)` reproduces and compares the complete
artifact, not just its digest or multiset. Pins are optional but must come from
independent trusted authority. A source-only pin deliberately permits another seed;
use a realization or artifact pin to bind the realization. A coherently invented
source can technically verify when no trusted source pin rejects it. No hash
provides original editorial or saved-game authentication by itself.

Policy `camp-decks-sha256-fy-v1` uses a SHA256 counter stream for each
`weakness-pool` / `hero:<heroId>` label. The first big-endian uint32 of canonical
`[policy, seed, label, cursor]` supplies each word. Descending Fisher-Yates rejects
words at or above `floor(2^32/size)*size`; accepted words use remainder. This
removes modulo bias and supports sizes through 201 independently of legacy
PhysicalRandom. It neither reuses A1 RNG nor claims Unity/JIT parity.

Before schema traversal, source/artifact/entropy/pins reject proxies, accessors,
custom prototypes, non-JSON values, cycles, sparse arrays and inherited array
indices. Shared limits are 8 MiB canonical bytes, 100,000 nodes, depth24, maximum
string length16,384 and 64 object properties. Both complete artifact construction
and verification apply the same limits; output expansion cannot publish an
unverifiable artifact. Inputs and returned results are defensively copied.

Container size limits are checked before element descriptors are inspected.
Ordinary prototypes with inherited accessors are rejected before traversal;
schema parsers receive only own JSON fields, including entropy and expected pins.
Inherited data cannot supply a missing required field.

## CLI

```sh
npm run build
node dist/camp-decks.mjs capability --input private-source.json --output new-capability.json
node dist/camp-decks.mjs materialize --input private-source.json --seed "$PRIVATE_SEED" --output new-artifact.json
node dist/camp-decks.mjs verify --input new-artifact.json --output new-verification.json \
  --expect-source "$TRUSTED_SOURCE" --expect-realization "$TRUSTED_REALIZATION" \
  --expect-artifact "$TRUSTED_ARTIFACT"
```

Choose paths inside ignored private storage. These examples assume externally
prepared source/seed/trusted pins; they do not generate authority. Verify flags
are optional individually. Seed is required only for materialize. Duplicate,
unknown, positional or inapplicable options are errors. UTF-8 reads are bounded
before parsing. Output is compact canonical JSON without an added newline, so
file and API byte budgets agree. Standard output contains a small receipt rather
than the positive artifact or seed.

| Exit | Result                                                           |
| ---- | ---------------------------------------------------------------- |
| 0    | Technically valid artifact/capability/verification               |
| 1    | Invalid command/input/pin/budget/publication; no new result file |
| 2    | Legitimate content gate; private diagnostic document saved       |

All publications stage a complete mode0600 file, sync it and exclusively link it
at the requested destination. Existing paths are never overwritten, including
concurrent publishers and gated diagnostics. Temporary staged files are cleaned
on ordinary errors. A crash may leave an unlinked private staging directory;
it cannot expose a partial destination. The CLI has no session or host effects.

The three benefit quantities from #57 remain null/unverified and blocked, original
checkpoint #156 remains static/gated, and #33/#89/#65/#57 remain open. This module
certifies neither whole-game startup nor original victory, Unity/JIT, physical
phones, Windows or Safari.
