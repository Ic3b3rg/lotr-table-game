# Adventure 1: executable startup and checkpoint contract

Primary-source research for [issue #38](https://github.com/Ic3b3rg/lotr-table-game/issues/38), 2 November 2026, branch `feat/first-adventure-start`, HEAD `6edd974`. Research only: no implementation, dependency installation, official-app execution, personal-save access or GitHub mutation. Original prose, decoded FSMs and extraction outputs remain in ignored `.scratch/first-adventure-start/`; this is the only public deliverable.

**Decision for implementation:** map composition **and the selected startup encounter closure** are prerequisites to the authentic startup. The official loader builds the map before calling `BeginAdventure(false)`. The principal prefix requires **initial Scout 2 for every hero**, automatic exploration of the start and custom 100A tiles, revelation of section 1, **a Spirit 1 test for every hero**, and the initial objective. Automatic exploration of 302A also processes whatever encounters the generator placed there; it is not an empty-tile operation. A normal principal introduction acknowledgement is not a scenario choice. The fixed person-token choice belongs to a separate encounter FSM. The isolated canonical 302A fragment cannot supply this executable scenario. These conclusions are static evidence, not a claim that this project or the entire adventure has runtime parity. [A `0x06003932`, `0x06000b8a`, `0x060038b8`, `0x06003c93 IL_1833–1898`, `0x06001349`, `0x06003888`; R20275 states 13/2/4/24/14/15/16/3/17/20/1; IT `A1_M1_S1_INTRO_2`, `A1_M1_S1_TEST`; R27649.]

## Evidence notation and primary sources

**E** means a serialized field, metadata constant or executable IL body was inspected. **I** means a proposed adaptation for this fully digital product. **U** marks remaining uncertainty. Script outputs are reproducibility aids; the owning assets, assemblies and official rules below own the claims.

| Reference | Owning source and locator |
| --- | --- |
| A | Personal Steam 24301165, JiME **1.6.6#1128**, Unity **2022.3.62f2**; `JiME.app/Contents/Resources/Data/Managed/Assembly-CSharp.dll`, SHA-256 `8869ef87b7d49f4993911904e35d78b72f8339e91158bbe8784c9691a9d743c6`. Method tokens below are MethodDef tokens in this exact file; IL offsets are relative to method code. |
| P | Same installation, `Data/Managed/PlayMaker.dll`, SHA-256 `a7b91f8e0eeb2c3edf351eed4ca722088d6d0281d3db718d7db153c9ff756b54`. |
| S / R / G / L4 | `Data/sharedassets0.assets`, `resources.assets`, `globalgamemanagers` ResourceManager, and `level4`. Numbers are Unity pathIDs, not scenario IDs. `R20275.s[24].a[1]` means `fsm.states[24].actionData` action index 1, both zero based. |
| IT | `Data/StreamingAssets/bundles/3151bee06bca9e12ef40034fe03fc1eb`, SHA-256 `021cb0f200afd2d87369bc6663d1cbd6c157b21ee9dfcab1bd532d3ebe330606`; TextAsset `BonesOfArnor_it`, pathID `-2938581942859744165`, CSV columns `KEY,Italian`. |
| MAIN | `.../bundles/6a822186acd50201e5ab5439407de4a6`, SHA-256 `c6b5dd76a635eb7082a24b7dbfca146460b8131f85aff9f07e7e9e3713d29cdf`; TextAsset `Main_it`, pathID `-7439224213581943799`, same columns. |
| Rules | [Official Italian Learn to Play](https://cdn.svc.asmodee.net/production-asmodeeit/uploads/2022/09/Viaggi_nella_Terra_di_Mezzo.pdf), printed pp. 7, 10, 11, 16; [official Rules Reference](https://images-cdn.fantasyflightgames.com/filer_public/01/a0/01a0c9f7-4427-4113-9406-f53d6bde2ff5/journeys_in_middle-earth_rules_reference.pdf), §§37, 49, 80, 81. |

Installation identification and schema corrections are in [official-app-inventory](official-app-inventory.md) and [official-app-schema-validation](official-app-schema-validation.md). This audit reuses the installed AssetStudio type-tree backend, TPK MonoBehaviour header and existing local `dnfile`/`dncil`; it does not retry a whole-app extraction. The default backend under-reads R19891 globals (23,420/33,648 bytes); the corrected AssetStudio read consumes **33,648/33,648**, with independent C/Python agreement. The failed partial read is not evidence for values.

## Prerequisites before implementing #38

1. **E — Bind the correct scenario.** S805 has `_id=1`, `Type=0`, `IsPreGenerated=0`, fixed threat limit 64, required base product S2319, and `Prefab.Path=Assets/Resources/Adventures_Runtime/Cam_1/1_Bandit Hunt.prefab`. G13 maps the trimmed resource path to R2663. Its Adventure R22792 points back to S805 and its principal FSM is R20275. Do not select a scenario by a translated title or array offset. [S805; G13 selected container entry; R2663/R22792; A `Adventure.Awake 0x06000b86`.]
2. **E — Supply a generated map, including the custom geometry.** R23310 describes four sections and their connection constraints; it does not contain the completed map. R22701 forces standard 302A plus **custom** 100A. Custom R21590 has one space R25982 and four geometric hexes; standard S2635/100A alone does not encode this shape. The start tile uses three spaces and twelve hexes, so section 0 has four movement spaces. [R23310, R22701, R21590/R25982; L4:20266; A `0x06003932`, `0x06001319`, `0x06003c93`; [topology audit](journey-map-topology.md).]
   **E/U — Resolve the realized start-tile encounters too.** Section0 is included in encounter-group/random placement and its `.711` fill loop. The loop attempts to fill until encounter count reaches at least `.711×4=2.844`, or placement fails. After the fixed person occupies custom100A, other eligible locations are on302A. `TrySeedEncounterFromCollection` checks occupancy and `TileSpace.MeetsRequirements`, with no start-tile exclusion; that predicate checks specific tile/index or required/excluded traits. Thus principal state14 can execute additional PRE_REVEAL/REVEALED hooks before state15. Actual chosen IDs and effects remain unknown without a realized generation trace. Do not suppress these encounters to obtain a shorter startup. [A `0x06003c93 IL_0e31–0ef4,1833–1898`, `0x06001349 IL_0066–00d2,018e–019d`, `0x06000ead`, `0x06003888 IL_0155–0272`; R22701.]
3. **E/I — Add setup requests around existing card mechanics.** Source text requires Scout 2 in state 24 and Spirit 1 in state 17. Neither is a `DisplayMessageChallenge` action there: the physical-game companion expects players to resolve them. The digital table must track one completion per hero, revealed cards, ordering/preparation, inspiration and any pending conversion before acknowledging the corresponding source message. Initial Scout 2 is distinct from rally scouting; Aragorn's bonus is tied to the rally phase. [R20275.s[24/17]; IT keys above; Italian manual pp. 10–11, 16; project `src/server/scouting.ts`, `src/shared/rally-scout.ts`, `src/server/skill-tests.ts`.]
4. **E/I — Define typed startup persistence.** The original app forbids ordinary saves during setup and dialogs. Copying its state-name-only model is insufficient for #38's save-at-every-command requirement. Add an authoritative startup request/cursor, not a client-only text carousel. [A `GameData.CanSave 0x06000cac`; `FsmSerializer.SerializeFsm 0x060015b7`; [approved session contract](../planning/game-fidelity-checks.md); issue #38.]
5. **I — Freeze and validate a private scenario pack.** Bind source identity, locale, compiled requests/effects, map inputs and realized map to the save. Existing saves without a scenario must still load. An absent pack must block only the new scenario start. This extends existing catalog/map freezing, not official-app behavior. [Issue #38; project `src/server/store.ts`, `src/server/journey-map.ts`, `src/shared/journey-map.ts`.]

**Smallest independently verifiable preceding issue:** “Compose and freeze the A1 journey map before `SCENARIO_BEGIN`.” Acceptance can stop at map output, with no combat or scenario UI: correct source pools/custom 100A, all four sections, compatible joins, reciprocal movement adjacency, actual tile transforms and encounter assignments, deterministic replay of the chosen generation result, and durable reload. Its first independently testable unit is **section 0: 302A + custom 100A using the actual join/rotation rules**; this alone must not be presented as the full A1 map. Once map output exists, follow the chosen nodes on302A to their actual FSMs/templates and typed reveal effects as a separate bounded prerequisite. The loader's full-map dependency remains. [I, based on R23310/R22701 and A `0x06003932 IL_02b0–0543`, `0x06001332`, `0x06003ca4`, `0x06003888`.]

## Principal FSM: complete structural inventory

**E — R20275** is 188,796/188,796 bytes, `dataVersion=2`, start `State 7` (index 0), **35 states, 24 declared events, 6 global transitions, 50 enabled actions of 22 types**. All states have `isSequence=false`. Both principal template pointers are null. In the table, short action names expand via the action inventory below; every row refers to `R20275.fsm.states[index]`. `—` means no serialized local transition/action, not victory or failure. [R20275; P `FsmState.ActivateActions 0x060005b5`.]

| Index | Source state name | Enabled actions, serialized order | Local event → target index |
| ---: | --- | --- | --- |
| 0 | State 7 | — | — |
| 1 | Finished 2 | FinishProcessingEvent | — |
| 2 | Intro | DisplayMessage | FINISHED → 4 |
| 3 | Tiles | SetSectionVisibility | FINISHED → 17 |
| 4 | Place Start Tile | GetStartTileId; RevealTile; DisplayMessage | FINISHED → 24 |
| 5 | Add Clue Total | IntAdd | FINISHED → 19 |
| 6 | CLUES? | IntSwitch | TRUE → 29; FINISHED → 0 |
| 7 | REVEAL FORT | SendEventByName | FINISHED → 0 |
| 8 | Last Area Visible? | CheckBool | TRUE → 25; FALSE → 10 |
| 9 | Section 2 Tiles | SetSectionVisibility | FINISHED → 18 |
| 10 | Sectoin 2 Intro | DisplayMessage | FINISHED → 9 |
| 11 | Fort Tile Explored? | IsTileExplored | TRUE → 7; FALSE → 12 |
| 12 | EXPLORE TILE | ExploreTile | FINISHED → 0 |
| 13 | Set Threats | AddThreatEvent | FINISHED → 2 |
| 14 | EXPLORE START TILE | ExploreTile | FINISHED → 15 |
| 15 | TOMB TILE | RevealTile; DisplayMessage | FINISHED → 16 |
| 16 | TOMB | ExploreTile | FINISHED → 3 |
| 17 | 1 Test | DisplayMessage | FINISHED → 20 |
| 18 | SET BOOL | SetBoolValue | FINISHED → 25 |
| 19 | NO CLUES? | IntSwitch | TRUE → 0; FINISHED → 8 |
| 20 | Set Objective | SetObjective; DisplayMessage | FINISHED → 1 |
| 21 | Enemies | SpawnEnemyGroup | FINISHED → 22 |
| 22 | SET OBJECTIVE | SetObjective; DisplayMessage | FINISHED → 0 |
| 23 | Enemies 2 | SpawnEnemyGroup | FINISHED → 22 |
| 24 | Hero placement | DisplayMessage; HighlightTileSpace | FINISHED → 14 |
| 25 | 2 CLUES? | IntSwitch | TRUE → 26; FINISHED → 27 |
| 26 | CLUE MESSAGE | DisplayMessage; AddLore; SetObjective | FINISHED → 0 |
| 27 | 1 CLUE? | IntSwitch | TRUE → 28; FINISHED → 6 |
| 28 | CLUE MESSAGE 2 | DisplayMessage; AddLore; SetObjective | FINISHED → 0 |
| 29 | Focus Camera | FocusCameraOnWorldPositions | FINISHED → 11 |
| 30 | State 2 | SetBoolValue; AwardXP; AddLore | FINISHED → 32 |
| 31 | State 1 | DisplayMessage; SetBoolValue; AwardXP; AddLore | FINISHED → 32 |
| 32 | Set Next Adventure | SetNextAdventure; ProceedToNextGame | FINISHED → 33 |
| 33 | Fin | FinishFSM | — |
| 34 | Display Message | DisplayMessage | FINISHED → 31 |

The six global edges are `SCENARIO_BEGIN→13`, `A1_CLUES_FOUND→5`, `A1_THIEVES→21`, `A1_THIEVES_ATTACK→23`, `ADVENTURE_END_VICTORY→30`, `ADVENTURE_END_FAILURE→34`. The other declared names are `FINISHED`, `0`, `1`, `1+2`, `1+3`, `2`, `2+3`, `3`, `All`, `CANCEL`, `CONFIRM`, `FAILED`, `FALSE`, `NO ESCAPE`, `NODE CLICKED`, `NORMAL`, `TRUE`, `THREAT_EVENT_START`; declaration does not make each one an initial prompt or an active global edge. [R20275.`fsm.events/globalTransitions`.]

### Action types and owning executable semantics

Prefixes: **J** = `FFG.JIME.Actions.`, **C** = `FFG.Common.Actions.`, **H** = `HutongGames.PlayMaker.Actions.`. All tokens in this table belong to **A**, including the H action classes shipped in Assembly-CSharp; the action-data loader belongs to P. Counts are principal-FSM occurrences, not all nested uses. [R20275 action arrays; A TypeDef/MethodDef and bodies identified below.]

| Type | Count | Owning method token(s) and verified meaning |
| --- | ---: | --- |
| C.FinishProcessingEvent | 1 | `0x0600164a`: sets owner's `IYieldable.ProcessingState=0`, then finishes the action. It does not finish the adventure. |
| J.DisplayMessage | 12 | `0x0600115b/115c/115d`: resolve packet, show ordinary message, log/close on progress, finish on hide callback. |
| J.SetSectionVisibility | 2 | `0x060012c3`, coroutine `0x06003c5f`: true invokes `Adventure.CoroutineRevealSection`; false hides and updates tokens. Not exploration or an encounter choice. |
| J.GetStartTileId | 1 | `0x06001284`: writes `GameMap.StartTile.Model.HashId`. `Map.StartTile`, `0x06000d55`, is first tile of section 0. |
| J.RevealTile | 2 | `0x060011ed/11e8`: base resolves the tile by GameObject or map ID; makes it visible, highlights/calls out, optionally focuses camera. Does not explore it. |
| H.IntAdd | 1 | `0x06001e83`: adds the FsmInt value; here **-1**, despite state name “Add Clue Total.” `everyFrame=false`. |
| H.IntSwitch | 4 | `0x06001de2/1de4`: equality against each ordered comparison; send matching event; otherwise action completion permits FINISHED. No greater-than inference. |
| H.SendEventByName | 1 | `0x060023d7` plus event-target enum in P: state 7 broadcasts `A1_FORT_REVEAL`, target=4 `BroadcastAll`, delay=0, everyFrame=false. |
| C.CheckBool | 1 | Inherits H.BoolTest `0x06001d74`; true/false sends corresponding event. A TypeDef confirms inheritance. |
| J.IsTileExplored | 1 | `0x060011cc`, tile getter `0x06000e7a`: explored means no ExploreNode, or that node not visible. Checks actual tile state. |
| J.ExploreTile | 3 | `0x0600127c`, action coroutine `0x06003c4d`, adventure coroutine `0x06003888`: hides exploration node, removes sepia, processes node PRE_REVEAL/REVEALED events and applicable adjacent-section event, optional intro/outro. |
| J.AddThreatEvent | 1 | `0x06001257`: resolves ThreatEvent component; optional override only when enabled; adds uniquely and marks the meter. Does not itself raise threat or run the event. |
| H.SetBoolValue | 3 | `0x06001eb2`: assignment to the bound variable; everyFrame=false here. |
| J.SetObjective | 4 | `0x0600120f`: resolves/compresses packet into `SerializedGame.CurrentObjective`, updates label, finishes. Separate DisplayMessage actions announce it. |
| J.SpawnEnemyGroup | 2 | `0x06001217/1218`: eligibility, budget and specified size, then spawn/tracker/logic. Source name does not mean “attack now.” |
| J.HighlightTileSpace | 1 | `0x0600128f`: index/clamp into `Tile.Spaces`, highlight and optional camera movement. Does not persist physical hero positions. |
| J.AddLore | 4 | `0x06001251`: adds campaign lore and waits for visual completion. |
| C.FocusCameraOnWorldPositions | 1 | `0x06001657/1653`: averages positions. With OverrideDefaults=false, actual duration/zoom are **1.0/0.75**, not serialized 0.7/0.5714286. |
| J.AwardXP | 2 | `0x0600125f`: each hero's currently selected role gets `max(0,availableXP)+XP`. |
| J.SetNextAdventure | 1 | `0x060012be`: clears alternatives; assigns selected model ID outside quest-launcher mode. |
| J.ProceedToNextGame | 1 | `0x060012a4` → controller `0x06000c97`: records played model in completed IDs, resets state and transitions to rest/map; not a numeric ID increment. |
| C.FinishFSM | 1 | Inherits H.FinishFSM `0x06002316`: calls `Fsm.Stop`. No automatic campaign completion. |

**E — Parameter decoding is structural, not a string search.** For action `a`, `actionStartIndex[a]` through the next start index delimits fields; `paramName`, `paramDataType`, `paramDataPos`, `paramByteDataSize` index the owning stores. Relevant `ParamDataType` constants in P are 0/int32, 1/bool, 2/float32, 3/string, 5/Unity-object reference, 7/enum, 12/array, 15/FsmFloat, 16/FsmInt, 17/FsmBool, 18/FsmString, 19/FsmGameObject, 20/FsmOwnerDefault, 23/FsmEvent, 24/FsmObject, 28/FsmVector3, 31/FsmEventTarget, 40/custom class. Primitive bytes are little endian; arrays recurse over `arrayParamSizes/types`, custom classes over `customTypeNames/sizes`. Fsm variable **names** are bound at load time; a stored sample `value` is not a constant when named. [P `ActionData.CreateAction 0x0600033c`, `LoadActionField 0x06000340 IL_0649–078a`, `GetFsmInt 0x06000345`, `GetFsmBool 0x06000346`, `Fsm.GetFsmInt 0x06000493`; metadata enum `ParamDataType`.]

**E — Ordering matters.** P activates enabled actions in array order, but with `isSequence=false` proceeds past an unfinished action; it stops if the FSM switches state. Thus message/highlight and message/instant effect may coexist within a source state. A port that waits after every listed action changes that behavior. Persist the source state plus action/effect completion, rather than equating a table row with one atomic UI page. [P `0x060005b5 IL_0007–0089`.]

## Ordered startup, original Italian provenance and next command

**E — Initialization before SCENARIO_BEGIN:** loader instantiates the prefab, resets scene globals, initializes heroes, and for this non-pregenerated journey calls builder initialization and map construction. Builder input `PlayerCount` is the hero array length, not joined human/browser count. Fresh start sets Round=1, threat meter reset and ThreatMax=64. The serialized global asset R19891 has `Adventure/Bandits/Clues=3`, Fort ID=0, Fort Position=(0,0,0), Win?=false; local principal defaults include `100A=1507440`, StartTileId=0 and SECTION 2=false. The fort encounter's start state later writes its actual tile ID/position; the timer's start turns IsRunning on, with TimerValue=2 and DUDE_TIMER/REVEALED_DUDES=false. There is no required invented global `INIT` edge in R20275. [A `0x06003932`, `0x06001318`, `0x06000cdc/0cb0`, `0x06000b8a`, `0x06000ce1`; R19891; R20275.variables; R27686.s[2]; R20635.s[0]/variables.]

**E — Display-field provenance:** S805.`NameKey=A1_TITLE`, `LocationKey=A1_LOCATION`, `RestStoryKey=A1_DESCRIPTION`, all owned by IT. The executable adventure introduction instead comes from R20275.s[2].a[0].Message.Key=`A1_M1_INTRO`. Available `A1_DESCRIPTION_2` or unused `C1_INTRO` must not replace it merely because of their names. Original strings, source TextAsset references and individual value hashes are available privately in `localization-private.json`. [S805; R20275.s[2/14]; IT.]

The verified **principal-only** prefix is **13, 2, 4, 24, 14, 15, 16, 3, 17, 20, 1**. Nested generated events during state14 still need the realized map and may add prompts/effects. The following table gives the fixed setup boundaries, not a claim that nothing else can execute between them. Keys retain their source table; no original narrative is reproduced here. [R20275; A `CoroutineRunSetup 0x060038b8`, `CoroutineProcessEvent 0x060038a6`, `CoroutineExploreTile 0x06003888`.]

| Order / source | Exact inputs and source behavior | Request/checkpoint needed in the digital table (I) |
| --- | --- | --- |
| Before event | Successful map generated and nodes instantiated; initial FSM states entered. | Persist map realization and bindings before narrative acknowledgement is offered. |
| 13 | AddThreatEvent GO R3499 → component R27941, default threshold **15**, info IT `A1_THREAT_1_INFO`; OverrideDefaultThreat=false, so parameter ThreatValue=0 is unused. | Active threshold registration once; no enemy spawn here. |
| 2 | DisplayMessage IT `A1_M1_INTRO`, no arguments. | Original introduction with normal progress acknowledgement. No choice/confirm-cancel branch. |
| 4 | GetStartTileId writes `$StartTileId`; RevealTile has FocusCamera=true, SpecifyGameObject=false, TileId=$StartTileId. MAIN `PLACE_TILE_NO_FLAVOR`, argument 0 = localization key `302A`. | Show actual generated start tile/rotation; acknowledge placement. |
| 24 | IT `A1_M1_S1_INTRO_2`; HighlightTileSpace SpecifyIndex=true, IndexSpace=**1**, TileId=$StartTileId, FocusCamera=true. Text also requires **each hero Scout 2**. | Place all digital heroes at source `302A.Spaces[1]` (UI Casella 2); resolve each hero's initial Scout 2 exactly once before leaving this request. |
| 14 | ExploreTile($StartTileId): OverrideDefaultIntro=false, SkipIntro=true, SkipAdjacentSectionEvent=false, NoInspiration=true, SkipOutro=true. Stored `C1_INTRO` override is **unused**. | Mark source start explored; process its real node hooks. No generic exploration reward should be granted. |
| 15 | RevealTile SpecifyGameObject=true, Tile GO **R6413**, FocusCamera=true; numeric TileId=0 is unused. MAIN `PLACE_TILE_NO_FLAVOR`, argument 0 = `100A`. | Show the **custom** generated 100A placement and its prompt. |
| 16 | ExploreTile($100A=1507440): SkipIntro=true, SkipAdjacentSectionEvent=false, NoInspiration=false, SkipOutro=true, override=false. | Explore the custom tile; this invokes its placed encounter's reveal FSM. `NoInspiration=false` does not by itself award inspiration when intro is skipped. |
| Nested during 16 | Encounter S934/ID100100 → GO R5676 / GameNode R20590 / FSM **R27649** receives REVEALED. Its state 0 displays MAIN `PLACE_PERSON` with argument 0=IT `A1_M1_E1_START`; state 17 broadcasts SET_REVEALED_DUDES, then state 1 finishes processing and waits in state 2. | Place one person token on custom 100A's sole space, show source introduction, checkpoint its visible state and timer flag. This fixed reveal spawns no enemy; that does not certify generated302A nodes. |
| 3 | SetSectionVisibility SectionId=**1**, IsVisible=true, ignore array empty. Coroutine reveals each previously hidden tile with MAIN `UI_SECTION_REVEAL_PLACE_TILE_FORMATTED`, argument = actual tile model name; then reveals exploration nodes. | Requires real section 1 tile list, placement order and geometry. A static “302A only” board cannot execute this row. |
| 17 | Ordinary DisplayMessage IT `A1_M1_S1_TEST`. Prose instructions: **every hero Spirit test, difficulty 1; success grants 1 inspiration**. U+F461 is Spirit, verified by Italian manual pp. 10/16. | Per-hero setup test requests with persistent cards/results/reward; no action spent. This is not an app-entered summed challenge and must not auto-pass. |
| 20 | SetObjective and DisplayMessage both use IT `A1_M1_OBJECTIVE_0`. SetObjective insert 0=`BLANK_OBJECTIVE`; display insert 0=`OBJECTIVE` (IT). Objective directs the group toward the thieves. | Store objective key, resolved original text/arguments and acknowledgement separately. |
| 1 / setup wrapper | FinishProcessingEvent releases setup processing. Wrapper shows hero phase, processes ROUND_START only if used, clears alternative adventure IDs and autosaves. R20275 has no ROUND_START transition. | End setup, enable the existing first-round/turn flow once, retain objective and all physical-component state. |

**E — Localization traps:** `IA_LocalizationPacket.ResolveArguments` counts actual `{0}`…`{7}` placeholders and rewrites insert `IsUsed`; its stored false values must not be used to drop all inserts. Filter=8 resolves `LocalizationKey.Key`, filter=1 resolves VariableInt+Delta; packet runtime/compressed fields are not the source key. `A1_M1_OBJECTIVE_0` needs the different heading arguments above; tile placement needs 302A/100A, and PLACE_PERSON needs the encounter description. [A `0x06000b7f/0b80`, `0x06000b84 IL_008c–00b6,02e4–0303`; R20275 packets; R27649.s[0].a[0].] Private `packet-provenance.json` records 79 packets and consumed inserts; `localization-private.json` contains the 89 selected, nonmissing keys with owning table/object/hash.

**E/I — Quest-directed next gameplay command:** after all setup/generated requests finish, choose an eligible hero's turn and travel along the generated adjacency toward the person token; viewing a token and cancelling is free. Committing one of its interaction-icon options requires the acting hero in the token's space and an interact action. The original app does not enforce physical positions; this table must. Movement into an unexplored tile instead suspends movement for exploration/confirm. Generated starting encounters can present other tokens or requests; their identity cannot be filled in before generation. [R27649.s[2/6]; A `0x06003888`; source choice labels all contain U+F475; [Rules Reference §§37,49](https://images-cdn.fantasyflightgames.com/filer_public/01/a0/01a0c9f7-4427-4113-9406-f53d6bde2ff5/journeys_in_middle-earth_rules_reference.pdf#page=16); Italian manual p. 7; project `src/server/rounds.ts`, `src/server/journey-map.ts`.]

### First fixed quest choice, confirmation and enemy branch

**E — No branching principal intro:** principal state 2 only has FINISHED. The first click on the fixed person is R27649 state 2 `NODE CLICKED→6`. State 6 displays IT `A1_M1_E1_CHOICE`, with these exact choice packets and events; HasDependencies=false on each, plus UI_CANCEL/CANCEL. The callback's name `HideFinishedConfirmCallback` does not add a second confirmation dialog: `OnChoice` closes the popup, then sends the selected event. This does not assert it is the first choice among every possible generated start encounter. [R27649.s[6].a[0]; A `0x0600117e/1181/1182/1183`; `GameNode.OnNodeClicked 0x06000d0f`.]

| Choice key | Event / source destination | Subsequent source behavior |
| --- | --- | --- |
| `A1_M1_E1_GREET` | CONFIRM → state 7 | Hide token, message `A1_M1_E1_GREET_A`, then A1_THIEVES. |
| `A1_M1_E1_INTIMIDATE` | NORMAL → state 3 | Strength challenge, key `A1_M1_E1_INTIMIDATE_TEST`; results 0→Fail, 1–2→Pass, 3–99→Best. Best broadcasts A1_THIEVES_ATTACK, others A1_THIEVES. |
| `A1_M1_E1_SNEAK` | PASS → state 15 | Agility challenge, key `A1_M1_E1_SNEAK_TEST`; 0→Fail sneak, 1–99→pass sneak; both later broadcast A1_THIEVES. |
| `UI_CANCEL` | CANCEL → state 2 | Return to token wait; no interaction committed. |

**E — Exact challenge semantics:** `DisplayMessageChallenge.GetResultEvent` returns the **first ordered pair whose bound is ≥ entered Sum**, otherwise the last event. The intimidate bounds `[0,2,3]` therefore do not mean “need 2 for partial success.” `OnValueChanged` accumulates and clamps 0–99. Preserve actor, sum, test results and branch. Relevant outcomes contain physical effects only in the source messages: intimidation fail applies 2 fear; best grants Emboldened; successful sneak grants Hidden. They need typed digital effects before those branches can be enabled faithfully. [A `0x0600117b IL_0007–004e`, `0x0600117c`; R27649.s[3/8/9/10/11/12/15]; IT associated result keys; Italian manual p. 10 identifies U+F463 Strength/U+F462 Agility.]

**E — First enemy request:** principal states 21 and 23 both specify S1629 EnemyModel ID2 (Ruffian), size=2, IgnoreCost=false, AdditionalPoints=13, RandomBonuses=false, Bonuses=[], Logic GO R2309/FSM R24473, SpawnPosition GO R6413, FocusCamera=true; success **and failure** events are FINISHED. Two figures cost 13 per S1629. IL adds 13 to current EnemyPoints for eligibility, requests the specified size subject to spawn eligibility/availability, subtracts cost on successful spawn and clamps residual points to 0…5×hero count. This is budget handling, not 13 extra enemies. Both branches then set objective `A1_M1_OBJECTIVE_1`. The **difference** is packet insert 0: state 21 uses `UI_ZERO_WIDTH_SPACE`, state 23 uses `A1_M1_E1_ENEMIES_A`, which grants an attack without spending an action. There is no automatic attack action here. [R20275.s[21/23/22]; S1629.Costs; A `0x06001218 IL_003f–0138,0277–02dc`; IT message and insertion keys.]

After the encounter branch broadcasts, R27649 also broadcasts SET_DUDE_TIMER and SET_REVEALED_DUDES, then hides the token. The latter is a **BoolFlip**, not “set true”; replaying it twice reverses the state. [R27649.s[13/14/16/18/5]; R20635.s[10/12].]

## Required nested FSM/template closure

**E — Fixed references resolved:** six specified EncounterModels S934–939 were resolved through G13 to their prefab GameObjects and full FSMs. The A1 subtree contributes nine FSMs; together there are **15 FSMs / 172 states**, plus the four-state exploration template. No additional nonnull template reference appeared in these decoded objects. This closure covers fixed A1 references; dynamically selected random encounters are a separate map-generation dependency. [G13 selected entries; R22792.CustomTiles/Timers; R23310 Sections; complete byte/pointer checks in private `asset-validation.json`.]

| Role | Model → GameObject → FSM (R unless S noted) | States / necessary boundary |
| --- | --- | --- |
| Thieves/person | S934 ID100100 → 5676 → 27649 | 20; REVEALED, choice, challenges, broadcasts. |
| Thicket clue | S935 ID100101 → 5624 → 27597 | 13; fixed section 3 encounter. |
| Tree clue | S936 ID100102 → 5660 → 27633 | 16; fixed section 2 encounter. |
| Bog clue | S937 ID100103 → 5681 → 27654 | 13; fixed section 3 encounter. |
| Ridge clue | S938 ID100104 → 5538 → 27511 | 10; fixed section 2 encounter. |
| Fort | S939 ID100105 → 5713 → 27686 | 18; start binds global Fort ID/Position; PRE_REVEAL / A1_FORT_REVEAL; later challenge/victory. |
| Enemy logic | 2309 → 24473 | 7; DEFEATED→escape, lore, section 2 visibility, clue objective, FINAL ESCAPE broadcast. |
| Timer | 5280 → 20635 | 16; ROUND_END decrements TimerValue; can remove enemies/person and signal enemy logic; FINAL ESCAPE stops it. |
| Threat 15 | 3499, ThreatEvent27941 → 20900 | 4; next threshold 25. |
| Threat 25 | 4758, ThreatEvent27777 → 24517 | 4; next threshold 40. |
| Threat 40 | 3667, ThreatEvent22474 → 25917 | 4; next threshold 48. |
| Threat 48 | 3899, ThreatEvent25608 → 25174 | 5; darkness true; next threshold 55. |
| Threat 55 | 4325, ThreatEvent21389 → 27029 | 3; threat cap remains model's 64. |
| Custom-tile exploration | GameNode23872 / GO4772 → FSM27232 → **FsmTemplate19941** | 4 cached states; runtime template is also 4 states. |
| Principal | 2663 → 20275 | 35; inventoried above. |

**E — Resolve the template, not only its cached instance:** P `PlayMakerFSM.Init 0x06000050` calls `InitTemplate 0x06000051` when playing with a template; it constructs the runtime FSM from template.fsm and instance variables. R19941 is 18,660/18,660 bytes. Its `NODE CLICKED→Display Message` uses MAIN `UI_CONFIRM_EXPLORE`, labels UI_CONFIRM/UI_CANCEL; CANCEL returns to Waiting, CONFIRM→GetTileId(Self=true)→ExploreTile with all skip/override flags false, then HideThisNode/FinishFSM. R27232's older cached packet uses `AddToLog`; current `DisplayMessageBase` actually declares `IgnoreLog`. Do not reinterpret an obsolete field name as a live flag. [R19941/R27232; A `0x06001174/1175`; P `0x0600033c/0340`, `0x06000050/0051`; A DisplayMessageBase TypeDef.]

## Map timing, parameters and randomness

**E — Runtime entry:** `CoroutineRestSceneToGame` obtains a seed from `DateTime.Now.GetHashCode` (A `0x0600394a IL_0103–0125`), not the MapBuilder inspector's sample Seed=411398192. Loader sets LastUsedSeed, calls CreateMap, waits until not building, and retries errors with **builder.Seed+1**, increasing timeout 6 seconds at a time to a maximum 30; only after success assigns GameMap and calls BeginAdventure(false). `RandomSeed=1` in the prefab does not establish the runtime seed. [A `0x06003932 IL_02ea–04b0,052d–053e`; R23310.]

**E — Builder inputs** are adventure ID, seed, custom tile bucket, hero count, unlocked chains and campaign-used encounter/group IDs. `CreateMap` creates `System.Random(seed)`, shuffles standard tiles, filters encounters by source collection, language, traits, repeatability and campaign history, distributes `(heroCount−1)×2` extra spaces across eligible sections, then runs construction. R22701 ignores player scaling; the other three do not. A scenario pack restricted to the base must preserve product/language filtering and cannot choose arbitrary expansion encounters. [A `InitializeBuilder 0x06001318`; `CreateMap 0x06001319 IL_00e7–0281,037c–0467`; S805.RequiredProducts.]

Section order below is the R23310.Sections array; these are parameters, **not already chosen tiles**. All AllowedTileSets masks are 40; all explicit start flags other than section 0 are false. Floats are rounded for reading; private source values retain float32 precision. [R23310; R22701/R20342/R24621/R21578.]

| Section / builder | Min…max spaces | Ignore scaling | Tile/section clump | Relative size | Random fill | Fixed requirements |
| --- | --- | --- | --- | --- | --- | --- |
| 0 / R22701 | 4…4 | true | 1 / .5 | 1 | .711 | Force standard302A; require custom100A; S934 on100A, SpecifySpaceIndex=false. |
| 1 / R20342 | 2…3 | false | .75 / .75 | .579 | .270 | No fixed encounters/trait requirements. |
| 2 / R24621 | 4…5 | false | .883 / .75 | .5 | .697 | Trait4×1, trait32×1; encounters S936 and S938. |
| 3 / R21578 | 5…6 | false | .8 / .889 | .75 | .625 | Trait32×1, trait4×1, trait1×1; S935, S937, S939. |

Required section connections are **0–1, 2–3, 3–1, 2–1**; InvalidConnections=[], AdventureEncounters=[], SpecifiedEncounterGroup=null. Empty fixed lists do not mean section 1 is encounter-free: the generator later seeds encounter groups and random/item encounters into remaining eligible spaces. [R23310; A `0x06003c93 IL_1329–192e`.]

**E — Construction includes backtracking**, required tiles, trait/size/random fill, tile attachment, section composition, geometric connections, fixed encounters, encounter groups/random encounters, instantiation and texture finalization. Section0 first attachment explicitly selects its forced302A; `PlaceStartTile` anchors at cube zero and chooses `rng.Next(0,6)` rotation. Cross-tile movement must come from `CalculateConnectedSpaces` and compatible source Edge joins/passages, not visual nearness. `FFGRandom.Next(rng,min,max)` converts NextDouble to float32 before scaling. [A `0x06003c93`, `0x06003ca4`, `SectionBuilder.PlaceStartTile 0x06001356`, `MapBuilder.CalculateConnectedSpaces 0x06001332`, `FFGRandom.Next 0x06000ab8`; [topology audit](journey-map-topology.md).]

**U — No realized map has been certified here.** The ordered input pool, exact backtracking/draw consumption, successful seed, placement order for section revelation, random encounter choices and final transforms still require a port/verified trace. Do not use the inspector's Transform positions as a generated layout or treat a new seeded generator's valid invariants as proof of equivalence. The private IL contains the owning methods; no missing owner decision is required to investigate them. [A methods above; [approved randomness criteria](../planning/game-fidelity-checks.md).]

## Checkpoint and private-pack contract

**E — Original persistence:** GameSerializer.Save records timestamp, global variable data, selected products, AdventureData/current adventure and current scene (A `0x06000e6a`). AdventureSerializer.Save records realized sections/tiles and transforms, explored/visible flags, encounter identity/space/visibility/token type/FSM, enemy units and health/armor/sorcery/logic/bonuses, active threat events, reserves and ThreatMax (A `0x06000e5f`). SceneData and FsmSerializer hold FSM names, active state and named bool/int/float/string/vector3 values; they do not represent a per-action popup continuation or this project's physical decks/hero positions (A `0x060015b7`). `CanSave` rejects setup, showing messages and other transient states (A `0x06000cac`). [Official Rules Reference §80](https://images-cdn.fantasyflightgames.com/filer_public/01/a0/01a0c9f7-4427-4113-9406-f53d6bde2ff5/journeys_in_middle-earth_rules_reference.pdf#page=22) explicitly leaves physical positions and decks to players.

**I — Freeze in the save, not merely on disk:** this is the proposed #38 contract, justified by the source dependencies above and the approved stronger recovery requirement.

| Frozen component | Minimum data |
| --- | --- |
| Pack identity | Version/schema, source assembly/asset/bundle hashes, campaign/adventure IDs, stable file+pathID/object mappings, selected base products, locale; hash of the validated private definition. |
| Executable startup | Source FSM/state/action identity, literal-vs-variable bindings/defaults, enabled actions, event targets, packet keys/inserts, exact Italian values/markup/icons, typed physical instructions and their field provenance. The compiled content subset and full originals stay private; neither belongs in public source or this report. |
| Map | Chosen seed and actual successful retry seed, algorithm/version, pool ordering/decisions or RNG state, **realized** tiles/sections/rotations/anchors/spaces/adjacency/encounters, placement sequence, reveal/explore flags and node bindings. A seed alone cannot recover with a different pool or algorithm. |
| Runtime cursor | Adventure instance ID; phase; principal and relevant nested FSM state; action/effect completion bitmap or equivalent; event queue/continuation stack; current objective; active threshold/timer/global variables. Track partial nested exploration before returning to the principal state. |
| Pending request | Stable request ID/generation/revision; source cursor; kind (acknowledge, initial scout, setup test, choice, exploration confirm); actor/hero or group consent; allowed options/events; selected option; input/result and effect-commit status. Opening/reading/cancelling must not consume an interaction action. |
| Physical state | Existing prepared company/card-copy IDs/deck order/discards/prepared/revealed cards, inspiration, startup scout/test completion per hero, hero/token positions, turn/travel budgets; later boons/damage/fear/enemy positions. |
| Command recovery | Existing identity/recovery, expected generation/revision, request fingerprint and durable receipt. Commit cursor + effects + physical state + receipt together; retry returns the prior receipt and cannot flip timer twice, redraw, grant inspiration twice, repeat initial scout or spawn again. |

Suggested durable boundaries are pack+map acquisition; each normal-message request; each hero's initial scout reveal/resolution; each hero's setup-test reveal/conversion/reward; each nested node reveal; every revealed-tile placement; objective commit/acknowledgement; setup-to-round handoff; later token choice/confirm and challenge inputs. These are **new product guarantees**, not a claim that Unity saves at those points. Source A's checkpoint is after the complete SCENARIO_BEGIN process and ROUND_START; the new product must additionally make the interrupted prefix recoverable. [I; issue #38; A `0x060038b8 IL_0096–00b7,0136–018f`; project `src/server/store.ts` transactions/command receipts and `src/server/backup-format.ts`.]

## Buildable slice and remaining issues toward #33

**I — After map output and the chosen startup-node closure**, implement one private, source-bound startup interpreter/compiled sequence for the verified prefix, including any generated nested requests. Acceptance: prepared heroes → original title/introduction → generated placement → each hero Scout2 → start/custom exploration and their real nested events + person reveal → section1 reveal → each hero Spirit1 with inspiration result → objective0 → first legal hero turn/travel command. Reload or restore at every request must preserve the same cards, text, cursor and map. Retain the principal intro's ordinary acknowledgement; add choices only when owning source nodes require them. If later quest interactions are not yet executable, token inspection/cancel can work while interaction commits clearly remain unavailable; this slice is startup, not a complete adventure. Without the chosen startup nodes resolved, a source-correct checkpoint can stop **before state14**, but it cannot meet #38's objective0 acceptance. [Issue #38; source prefix and Rules cited above.]

**I — Keep entry state explicit.** Start a new scenario only at a legal prepared-company boundary with no pending scout/test or active turn/travel. An old standalone 302A map or freeform scout/test cannot prove that the source startup has run. Preserve those legacy tables; do not silently label their canonical layout as generated A1, erase card state, or rerun initial effects against an already active round. The existing 14-adventure routing graph is definition/routing evidence, not a gameplay runtime. [Issue #38 compatibility requirement; project `src/server/journey-map.ts`, `src/server/scouting.ts`, `src/server/rounds.ts`; [routing audit](base-campaign-routing.md).]

Concrete further issues, proposed only (none created by this audit):

| Issue/dependency | Independently verifiable result and owning source |
| --- | --- |
| A1 map composition/freeze — **before #38 acceptance** | Builder output and source-legal joins for all four sections, fixed/random encounters and replay; source methods and section table above. Can start with a separately verified section0 unit. |
| Realized startup-node closure — **before objective0 / #38 acceptance** | From the generated302A space assignments, resolve each selected EncounterModel, prefab/FSM/template and PRE_REVEAL/REVEALED request/effect. Execute or explicitly block before state14; do not treat the fixed15-FSM audit as this dynamic closure. A `0x06003c93`, `0x06001349`, `0x06000ead`, `0x06003888`. |
| Setup Scout2 / Spirit1 orchestration — **inside #38 or explicit prerequisite** | Per-hero once-only initial requests, no rally bonus or action cost, durable decks/inspiration; R20275.s[24/17], original IT fields, existing scout/test services. |
| Token interactions and nested continuations | Person options, cancel, stat tests, upper-bound results, physical effects and branch broadcasts; explorer template's confirm/cancel; R27649/R19941, A `0x0600117b/1182/1174`. |
| Enemy groups, attacks, boons, damage/fear, last stands | First 2 Ruffians, free-attack option, Hidden/Emboldened, fear2, tracker/position/activation/defeat/provoke; R20275.s[21/23], R27649 result messages, S1629, A `0x06001218` and controller `SignalEndGame 0x06000c96`. |
| Exploration and objective progression | Enemy defeat or timer reveals section2; clue encounters decrement global3; first found clue reveals section3, 2/1 remaining grant lore+objective2, zero exposes fort; guard sentinel -1 and once-only events. R24473/R20635, R20275.s[5–12,18–19,25–29], S935–939. |
| Shadow, threat and timers | Threat15/25/40/48/55 chain; cap64 failure; timer2 decrement/end, enemy removal and darkness at48; R20900/24517/25917/25174/27029/R20635, S805, A `CoroutineEndRound 0x06003902`. |
| Fort and victory | R27686 PRE_REVEAL checks clues and computes Difficulty=1+heroCount; later accumulated test uses the same upper-bound selector, source target distinguishes failure/retry from success→EndGame(true). Spawn budget10×heroCount restricted section3; resolve source prose/stat, enemies and repeated test checkpoints before completion. R27686.s[8/13/17/16]; A EndGame `0x06001192` → `0x06000c96`. |
| Adventure outcome → camp → ID2 | Victory: principal30 sets Win?=true, awards4XP and2lore; failure:34/31 messages, Win?=false,3XP and1lore. Both go32→SetNextAdventure(S806 ID2)→ProceedToNextGame→33. Preserve role XP, camp cleanup/advancement and next setup. R20275.s[30–34]; A `0x0600125f/1251/12be/12a4/0c97`; [routing audit](base-campaign-routing.md). |
| Three-player full-adventure acceptance #33 | Real UI commands, both outcomes, every fixed/random branch in scope, interruptions during tests/moves/attacks/choices and camp/ID2 recovery. Static inventory or the existing novice flow/83-test baseline is not this evidence. [Issue #38 and [approved fidelity checks](../planning/game-fidelity-checks.md).] |

## Verification and explicit unresolved claims

Bounded deterministic commands, from repo root, using existing dependencies only:

```sh
PYTHONDONTWRITEBYTECODE=1 .scratch/unity-audit-venv/bin/python .scratch/first-adventure-start/decode.py
PYTHONDONTWRITEBYTECODE=1 .scratch/unity-audit-venv/bin/python .scratch/first-adventure-start/extract.py
PYTHONDONTWRITEBYTECODE=1 .scratch/unity-audit-venv/bin/python .scratch/first-adventure-start/capture_il.py
PYTHONDONTWRITEBYTECODE=1 .scratch/unity-audit-venv/bin/python .scratch/first-adventure-start/localization.py
PYTHONDONTWRITEBYTECODE=1 .scratch/unity-audit-venv/bin/python .scratch/first-adventure-start/verify.py
PYTHONDONTWRITEBYTECODE=1 .scratch/unity-audit-venv/bin/python .scratch/first-adventure-start/verify_report.py
```

Results: **185 objects, 804,882 bytes**, all consumed exactly with C/Python agreement; **564 nonnull pointer occurrences** resolved with expected/compatible classes, 1,320 nulls. **15 FSMs / 172 states + 1 template / 4 states**, all local/global targets resolved; all serialized parameter indexes consumed exactly once, action boundaries respected. Principal **35/24/6/50/22** state/event/global-edge/action/type counts verified; all 50 actions enabled. **89/89 selected Italian keys present**, 79 localization packets checked against actual placeholder arity. **1,122 selected IL bodies / 103,149 code bytes** redecoded from A/P; instruction lengths and direct branch targets verified; assembly hashes match. Deterministic principal paths are startup `[13,2,4,24,14,15,16,3,17,20,1]`, victory `[30,32,33]`, failure `[34,31,32,33]`; source choice and explorer-confirm/cancel edges verified, and intimidation dispatch checked for all inputs 0–99. These are source/trace invariants, not execution of Unity or a test of an implemented gameplay runtime. Private `verification-summary.json` retains results.

Report checks also confirm 35 ordered principal-state rows, 22 action-type rows, resolving relative document links and no complete original narrative value longer than 100 characters copied. Git whitespace validation passes; the only nonignored working-tree change is this report.

| Unresolved / limit | How to resolve using available sources |
| --- | --- |
| **U: no concrete generated layout or successful-seed trace**; neither standard302A's canonical rotation nor custom100A's prefab Transform is a played map. | Implement/trace the bounded A1 builder from A `0x06001319/3c93/3ca4/1332` and callees, exact source tile pools/joins; compare deterministic placement and encounter records. A later separately authorized disposable-game app comparison can strengthen evidence; personal saves are unnecessary. |
| **U: runtime RNG equivalence** across pool filters, float operations, rollback and seed retries. | Port System.Random/FFGRandom and FFGTools.Randomize with exact ordered inputs/draw transcript. Test rejected placements and retries as well as successful maps. Source seed alone and adjacency invariants do not prove parity. |
| **U: dynamic encounter closure** after generation; this audit resolves the six fixed encounters, not every candidate random group. This can affect startup itself, before the fixed person reveal and objective0. | First select the source-correct base/language/history pools; follow each chosen EncounterModel.Prefab through G13, then nested FSM/template references before enabling that realization. Source section0 fill and state14 exploration forbid assuming an empty302A. |
| **U: all later physical prose effects/stat instructions** are not a certified typed effect pack. | Resolve original IT/MAIN rows, symbols via official manual, apply errata to relevant cards, and compile per-field provenance. In particular do not enable first-choice fail/best/sneak effects or free attack with only a popup. |
| **U: exact Unity scheduling and in-progress action restoration** have no live observation here. | Inspect remaining P state-switch/update and scene/FSM restore callees; test the new explicit continuation model against bounded traces, then separately compare disposable runtime sessions. Preserve the documented source concurrent action-entry behavior. |
| **U: full adventure, save compatibility and camp/ID2 parity** are not proved by these reads. | Complete the capability issues and #33's UI/recovery/outcome tests. The root implementer owns implementation, PR/merge/closure and final three-player acceptance. |

Root can continue with the explicit map prerequisite and startup orchestration without asking for more narrative or saved-game material: the owning sources and private decoders are available. No indispensable source/owner decision was found missing; the remaining blockers are unimplemented or unverified mechanics, kept explicit above.
