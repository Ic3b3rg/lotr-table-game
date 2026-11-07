# Fire and boulders in battle physical tests (#139)

This slice extends the existing camp departure → battle → combat controller →
physical test → source return. `START_ATTACK`, `COMBAT_INPUT`, `CYCLE_INPUT`,
`PHYSICAL_INPUT`, Store.once and episode3 remain the authoritative interfaces.
There is no new public command, client program, random input or terrain journal.

## Verified authority

The static capsule manifest is 16,777 bytes, SHA256
`05a5e7a44c564c56bf647598d12ba34a1c77bcced9bb3e03e17af01455dd2a03`,
declaring 85 ordinary relative files / 209,113,554 bytes. Needed rows and their
ancestors were checked for traversal, duplicates, symlinks, size and SHA256
before interpretation. Embedded historical paths are inert. Original material,
extraction and raw evidence stay ignored; positive gameplay is invented and finite.

Rules Reference text SHA256
`a31697b0dcce6cdc003d3b178b00a4d7bbc7d12efee527b8843bec8e5f38a0c4`
and original PDF SHA256
`f94dfcf5d5118b7fedadb3634edf41fefb97975c1f0732caa8d4519e9a89a260`
establish the physical rules:

- §§16.1–16.2: each colocated boulder can convert one available fate without
  inspiration, once per actual negate test. A new test has a new allowance;
  retry, a new request or another damage allocation does not create a test.
- §40.1: during an attack, discard one attack-revealed card with a printed fate
  for pierce **or** smite. Every icon on the paid copy is excluded from the
  test. Other copies and independently paid inspiration stay unchanged.
- §§1.7–1.8, 27.2, 100.1–100.5: this discard pays only terrain, revealed ability
  text is ignored, costs are not reused, tests reveal/convert/calculate in order,
  then discard remaining cards. Test abilities resolve in conversion; the
  attack-wide fire choice also remains available before applying item results,
  provided already-paid costs can still be backed entirely by other icons.
- §§38, 88: a spent fate cannot pay another effect; converted fate is no longer
  available fate. Fire removes a converted icon's success as well as printed
  successes. A copy already used to pay an independent fate-spending cost is
  ineligible for fire. Item costs are pooled successes; a later fire payment can
  rebind those costs to surviving icons only when their count is sufficient.
- §59.5–59.6: modifiers do not stack; pierce ignores armor, smite ignores sorcery.
  The existing finite-figure kernel applies all other modifier interactions.

Italian manual text SHA256
`0ebc7fb510bec738d333d5fdb1c4ae52f4ed8c577fa1be1083fb31f66fb2e962`
confirms **Perforante = pierce**, **Punizione = smite**. FAQ/errata2.0 text
SHA256 `6377e29b94c9714a446a43d0a840d142bd18374febb58536b048848897e453d3`
limits each ability to once per attack and corrects Gimli's after-test ability;
fire therefore pays at most once per attack, and cannot trigger a prepared-card
discard ability. Corrected-card text was also checked. No relevant terrain
exception appears in these errata.

Application placement authority is distinct: the pinned map126 selected level5
and level6 artifacts both map fire `resources.assets:21123` / Transform11205 to
`b1/C`, boulder `resources.assets:21425` / Transform10475 to `b1/L`.
This is static placement evidence, not Unity execution or normative timing.
Workbook card policies and the existing #137 source closure retain their
published provenance and gates.

## Private contract chosen before product implementation

`BattleCombatCapability.testTerrain` is optional and strict, version
`source-battle-test-terrain-v1`, with fixed rule/errata/translation hashes and
literal fire/boulder policies. Omission preserves #137's exact gates. It is
validated by the installed-source compiler, departure validator and frozen
episode source; a fixture-only switch is insufficient.

Schema34 explicitly rejects prospective terrain forms at actual capability,
physical-run and snapshot locations in schemas1–33, including cycle seeds and
episode archives. Ordinary dictionary keys are data. Migration changes only
the schema version; old policies, outputs, costs and receipts are replayed using
their original branches. An old activated source never acquires the policy.

`spatial.testTerrain` freezes policy/source and board fingerprints and exact
placed `{anchor, kind, spaceId}` tokens. The host derives it from the verified
selected layout, current placed-token identities/types, and live spatial hero
positions whenever it opens a physical run. The physical consumer checks the
actor's colocated tokens on each actual test, including descendants. Cycle3
reconstructs this context from its fixed departure origin on restore; re-signing
both a source and a history does not replace that proof.

The adjacent `terrain-accounting` helper owns only copy/icon arithmetic and
per-test allowance. It does not own randomness, rules dispatch, receipts or
source returns. Fire options identify the exact revealed copy with a test-bound
opaque token; boulder options identify the visible placed token. Conversion,
fire, decline and item payment use existing choose/select controls. New optional
terrain fields in the existing test view explain colocated tokens, remaining
free conversions, paid copy, excluded icons and keyword. Old views serialize
without these fields. Hidden deck order, raw copy associations, source/history
hashes and future fate are never added to public projections.

## Acceptance and limits

Meaningful consumer RED must reach the current fire and boulder gates through
an invented three-owner camp departure, preserving the complete rejected
payload. GREEN must pay fire for each keyword in separate complete attacks,
perform a real boulder negate, and return once with action/travel residual.
An independent small multiset/finite-figure oracle checks icon removal before
and after conversion and spending; it is not another compiler output.

Source, phase, owner, source fingerprint, cursor, copy, test, stale generation
and revision guards compare full domain and receipt payloads. Recovery covers
same-request concurrency, retries, pending choice/payment/child/return, SIGKILL
around COMMIT, restart and empty-host restore without packs. Historical A1,
#137 and schema1–33 remain covered.

Native acceptance uses three separate owners plus PC at320/768/1024/1440,
after a declared invented finite bootstrap. All subsequent game writes use
native controls; read-only diagnostics are recorded separately. Capture viewing
is distinguished from assertions. Owned hosts/profiles close before one final
frozen changed-product concurrency4 canonical test, run alone.

#57 remains NULL/UNVERIFIED/BLOCKED; original156 remains STATIC/GATED. No assumed
stock, seed/outcome/pool filtering, original State/save/gameplay, new bush use,
A2 encounter/Shadow/A3, #135 special orders, hardware or whole-campaign claim.
The parent owns fresh review, small fixes, integration and closure.
