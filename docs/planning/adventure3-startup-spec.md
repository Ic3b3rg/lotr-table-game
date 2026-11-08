# Second camp and the first playable Adventure 3 turn

Task #144 starts at `7693de01dc1da10303fa5e61d935a617bdec2311`. It extends the existing camp departure, scenario compiler, physical controller and replay ledger. The acceptance boundary is the first legal ordinary Adventure 3 turn and action, from both legally reached Adventure 2 outcomes.

## Bounded source contract

Static Steam build 24301165 / 1.6.6#1128 identifies Adventure 3 as S807, prefab R2666, Adventure R22795, principal R20278 and builder R23313. R27344 explicitly selects S807 after either Adventure 2 outcome. Adventure 2 victory awards 4 XP and 2 Lore; failure awards 3 XP and 1 Lore. The existing product ownership branch remains authoritative.

S807 selects a generated journey map, threat limit 68, no custom tiles, one reserve of three S1655 enemies, and zero reserved elite banners. Neither destination nor map follows arithmetic on the previous adventure ID.

Builder section order is R22703, R26554, R20345, R24624, R25354, R24200, R21581. Required connections are (0,1), (1,3), (1,4), (1,5), (1,6), (1,2). Section 0 requires S993; sections 2, 4 and 6 require S996, S995 and S994 respectively. Sections 0/1 use tile set 8 and scale with company size; sections 2–6 use tile sets 3 and ignore scaling. Retain source array order, float32 inputs, complete pools, failed attempts and RNG progression.

Principal startup registers the threat event, presents the introduction with Scout 3 for each hero, reveals and places heroes on the start tile, explores that tile, reveals/explores the ranger tile if distinct, reveals section 0, and spawns groups using seven points per hero and filter (3,0,128). The ranger prefab initializes the global tile binding and its reveal callback must complete before the principal returns. Startup then checks the persisted `Adventure/Bandits/Win?` global and, when false, applies the source message's facedown Fear to each hero before objective 0. This binding is the Adventure 1 outcome; retain the separate Adventure 2 outcome as well. Complete the source controller's first round event and every mandatory physical child before offering an ordinary action.

Source facts are derived from byte-complete raw reads and IL in ignored task scratch. Original text, images, raw objects and IL stay untracked. The authorized pinned `level4` supplement closes the initial capsule's journey-scene gap: retain all 120 bucket entries in their serialized order, all geometry, the map position (-11.240086555480957, 0.9968953132629395, 0), and the actual six corner constants. The 120 exploration-node identities and local poses are independently extracted from those tiles.

The starting space is random (`SpecifyIndex=false`), rather than the first adventure's fixed index. `unity-range-port-v1` records a separate deterministic bounded draw and its seed, maximum and result in the private origin. The existing portable subtractive RNG and float32/logical-clock map policies remain explicit ports; native Unity/JIT/RNG/clock equivalence is not certified. The presentation-only half-second ranger initialization delay is collapsed by this portable startup policy.

## Authority and persistence

Startup can place a ready enemy in the heroes' space. The new recipe therefore requires the existing source combat closure for mandatory travel provocations before the A2 origin. This reuses the ordinary combat/physical controller and retains every eligible model and instruction. It does not enable later A3 attacks, encounters or Shadow. Missing authority blocks departure before effects; an older A2 origin never gains a program retrospectively.

Freeze second-camp and Adventure 3 authority prospectively in the new Adventure 2 departure recipe, before creating that episode. Existing Adventure 2 origins remain gated. Clients continue to send the existing commands and opaque offer/request fingerprints; they cannot supply seeds, programs or artifacts.

The new boundary extends the existing linear archive with the complete Adventure 2 domain while retaining Adventure 1 unchanged. Archives contain domains, not nested State or copies of authentication and receipt tables. Replay validates each prefix with its original authority and semantics, then reconstructs each departure and every active command. New schema/cycle discriminators must reject new forms disguised as historical schemas without scanning arbitrary dictionaries for words.

Preserve campaign Lore, outcomes, cumulative counters, inventories, titles and per-hero/per-role XP. Return temporary cards and rematerialize decks from confirmed recipes. All required source, physical supply, ownership and complete startup closure checks precede resetting, spending, revealing or drawing. Choice changes invalidate confirmations. Repeated requests return identical receipts; stale, cross-owner and concurrent losing commands leave the entire payload unchanged.

## Acceptance and boundaries

Use complete finite invented A1 → camp → A2 histories for positive tests. Verify both outcomes at HTTP, second-camp purchases/refunds and changed roles/accessories, defeated heroes, all mandatory startup children, objective, first turn and ordinary action. Compare whole domains and receipts across restart, COMMIT/SIGKILL and empty-host packless restore. Reject re-signed archive/authority/chain/receipt tampering.

Three independent owners and a shared PC must complete both routes with native UI inputs after declared invented bootstrap, at 320/768/1024/1440. Verify waiting ownership, reader/help, focus, privacy and reload; distinguish generated screenshots from those actually inspected.

Preserve ordinary 4 MiB and restore 16 MiB limits unless a legitimate measured payload requires a separately reported bounded change. Quantity #57 remains NULL/UNVERIFIED/BLOCKED and original #156 STATIC/GATED. Later Adventure 3 consumers remain gated before effects. No original gameplay, remote writes, installs, other private historical corpora, or root build/deploy are authorized.
