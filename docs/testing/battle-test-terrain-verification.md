# Battle physical terrain verification (#139)

This is the actual physical consumer and owner UI described by the
[specification](../planning/battle-test-terrain-spec.md) and
[plan](../planning/battle-test-terrain-plan.md). It uses the existing command
envelopes, Store.once, combat controller and episode3 return. Activation is an
explicit frozen `testTerrain` source policy; schema34 preserves older source
policies and rejects prospective forms disguised as schemas1–33.

## Verification map

| Evidence | What it checks |
| --- | --- |
| `battle-test-terrain-source.test.mjs` | Installed source compilation, fixed rule pins, missing/forged policy, exact placed-token type/identity and current actor space frozen by the real controller |
| `battle-test-terrain-attack.test.mjs` | Independent icon multiset, both keywords, fire before/after conversion and item spending, mixed success/fate copies, exact discard, paid costs, decline/no fate, cross-test choices |
| `battle-test-terrain-negate.test.mjs` | One/two actual colocated token contexts, remaining fate, distinct icons on one copy, zero inspiration, no reuse, successive-test reset, other-cell and no-test paths |
| `battle-test-terrain-keywords.test.mjs` | Independent finite armor/sorcery/figure arithmetic, pierce/smite, combined modifiers, duplicates and existing stun immunity; historical smite remains gated |
| `battle-test-terrain-recycle.test.mjs` | A legal reset → Scout → exchange redraws the exact paid fire copy; its exclusion persists for the entire attack. A real P2 child retains the payment, copy and attack result through one return |
| `battle-test-terrain-http.test.mjs` | Three-owner installed camp→battle source, complete fire/pierce and fire/smite attacks, performed boulder negate, real reply and one ordinary return; complete rejected payloads and concurrent receipts |
| `battle-test-terrain-recovery.test.mjs` | SIGKILL before/after fire-payment COMMIT, pending choice/fate/payment/child/return, retry, packless restart/empty restore, exact copies/allowance, and paired valid source/physical history rejected against fixed episode origin |
| `battle-test-terrain-migration.test.mjs` | Exact structural guards, inert dictionary keys, whole schema33 payload migration and old activated battle packless restore retaining its old gate |
| `qa-battle-test-terrain.mjs` | Dedicated owned Chrome/CDP helper: three owners plus PC, four widths, native camp/startup/terrain writes, file restore, reload, waiting, reader/help/focus and privacy |

The main A2 source has one initial boulder. The two-token cases exercise the real
physical consumer with explicit finite invented placed-token contexts; they do
not relax the verified startup's terrain cardinalities. Other original source
closures and optional bush use remain gated.

## Meaningful RED and GREEN

The initial unchanged consumer returned the exact fire and boulder
`ATTACK_CLOSURE` messages from real `START_ATTACK` commands after camp departure.
Both rejected payloads, including all receipts, were identical. The finite-figure
consumer separately rejected smite before its prospective branch was added.
The recycled-copy regression produced25 successes where the independent
multiset required24; exclusion now follows that physical copy through reset,
Scout and exchange without refunding other paid costs.

Focused checks include44 source/controller/physical regressions, three complete
HTTP terrain cases, two crash/recovery cases, and historical activation checks.
Build, TypeScript and the existing formatting contract are checked separately.
Raw commands, relevant owned environment, stdout, stderr, actual exits and test
footers are retained from the first source-verification runner. Every nonzero
attempt and its diagnosis is retained, including fixture errors and one recovery
attempt invalidated by an intervening build. No unchanged1115 baseline rerun,
test suppression, timeout change, dependency installation or seed/pool filtering
is part of this verification.

## Native and privacy boundary

The finite invented camp bootstrap is declared before native advancement.
Subsequent game mutations, including file restore, use native controls. Separate
diagnostics read session/backup state; they do not advance the game. Each of the
three owners completes a real source attack and return. Fire uses Perforante,
Punizione and decline in separate owner turns; boulder uses an actual enemy
negate. Each attack consumes one action while preserving two unused travel
movements in this fixture. A1 archives remain identical.

The script checks320/768/1024/1440, owner/waiter controls, exact fate copy/icon labels, native card reader,
Escape focus, guide text, reload and packless UI file restore. Captures actually
opened for visual inspection are listed separately in ignored evidence; other
screenshots and DOM assertions are not represented as human viewing. At320 the
long choice list scrolls vertically; it has no horizontal overflow.

Privacy distinguishes the existing public unordered inventory and previously
revealed setup history from hidden deck order. New terrain choices use opaque
test-bound copy identities. Session/command projections and DOM checks reject
new hidden-copy associations, hidden order, recovery hashes, entropy and private
archive hashes. The current app polls the public session; it does not add an
event stream. Full backups and CDP traces remain private administrative evidence.

All dedicated native browser contexts, profiles and host processes close before
the final canonical run. Only owned surfaces are controlled; no protected Root
host, profile, process or save is inspected.

## Final gate and handoff

The final gate is one ALONE `npm test` on the frozen changed product, using the
repository's existing build and concurrency4 command. Head, all source/build/
test/script files, configuration and lockfile are pinned before and compared
after the run and at handoff. The exact final verdict, raw footer, frozen hashes,
ordered commits and complete ignored evidence manifest are recorded in the
designated implementation report. There is no second green canonical run.

Original sources were checked statically only. #57 remains
NULL/UNVERIFIED/BLOCKED, original156 remains STATIC/GATED, and no original party,
State or save was constructed or played. This slice does not certify devices,
Unity, the whole original campaign, A2 Shadow/A3, #135 special orders or the
separate acceptance issues. The parent owns fresh review, integration and closure.

## Final Root review and verification

The final frozen executable/test revision is
`8e9260b105c466735631710990de690c7b0f1ec0`. Exactly one complete canonical at that
revision passed: **1147 tests, 1147 pass, zero fail/cancelled/skipped/todo**,
`1774305.351041 ms`; actual npm and driver exits were both **0**. The command was
`python3 .scratch/root-review-139/run.py canonical-final-8e9260b npm test`, using
the existing concurrency4 command and owned temporary/cache directories with
the npm update notifier disabled before the first npm subprocess.

Root independently checked all12 final manifest entries, the raw footer and
exits, byte-identical Root/owned reports, all944 ordinary product rows and exact
file sets before/after/current. The672 total driver rows also remained identical.
The final report is4333 bytes/SHA256
`df84fe9f80dd878ba124bf9cd6ea33a71cd5d41dde75a33bd78e62f9d9f0df15`;
the3434-byte manifest SHA256 is
`f0ab862caf34e3212355663f7ec74220b41d1eb11debd3891dd3c64e81502f7d`.
They are retained under the owned `.scratch/root-review-139/final-canonical-8e9260b/`.
This documentation is added after the frozen run; executable inputs stay pinned
to that tested revision.

**Standards:** no required whole-range violation. The optional
`boonEnemyPositions` naming suggestion is deferred. Fresh scoped reviews of the
two Root corrections found no required violations or new actionable smells.

**Spec:** the original recovery-test acceptance failure is addressed within the
source-owned replay contract. An export is sorted by player/request identity;
its array tail does not identify a replay-owned receipt. The corrected test
selects actual journal identities and checks every exercised intent family,
requiring attack, cycle and scenario coverage. Altered revisions stay within the
current revision, so rejection requires reconciliation rather than the generic
future-revision bound. HTTP422, `INVALID_INPUT`, complete unchanged payloads and
the later alternative-history checks remain mandatory. The focused recovery
reached all six families. No production receipt validator changed.

The earlier worker canonical1145/1146 exit1 is preserved. Its selected receipt
type was not recorded and remains unknown. A separate finite invented94-receipt
probe rejected all89 source-owned mutations but accepted five pre-scenario
administrative/generation header mutations. **Ruling:** retain the existing
legacy semantics and triage retrospective administrative authentication in
[#140](https://github.com/Ic3b3rg/lotr-table-game/issues/140), rather than infer a
new journal from missing historical intents. **Cost:** a coherent backup can
still carry a forged pre-scenario administrative `appliedRevision` header. Full
historical receipt-table authenticity is not certified.

A separate frozen1764d68 canonical1145/1146 exit1 is also retained. It stopped on
`fetch failed`/`ECONNRESET` while reading a backup before the final forged-restore
check. A real-host regression reproduced reuse of an expired pooled connection
after synchronous client validation. The test helper now sends
`Connection: close`; it adds no retry, cache, catch or server-timeout change.
The regression fails before that correction and passes after it, also requiring
stopped-host failures to propagate. All six focused host/combat/terrain recovery
cases then passed, zero skips, exit0 (`251015.968291 ms`). **Cost:** this Node-fetch
helper no longer covers connection-pool reuse; native browser networking is
unchanged. The precise socket lifecycle of the original failed canonical was
not captured, so the reproduced mechanism is not retrospective proof of that
instance. No failed attempt is represented as green.

Native verification remains finite invented gameplay with three independent
owners and a shared PC view, on the same Mac/Chrome at320/768/1024/1440. Root
personally opened the final320px fire and boulder captures; the worker's other
capture inspections are listed separately. Physical phones/LAN, Windows,
Safari, Unity and the complete original campaign remain uncertified. #57 stays
blocked with unknown quantities, original156 stays static/gated, and A2 Shadow,
A3 and the separate original-game acceptance issues remain open.
