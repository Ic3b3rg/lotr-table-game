# Camp skill decks implementation plan

> Execute inline with superpowers:executing-plans and meaningful TDD. Sole
> implementer; Root performs fresh Standards/Spec review and integration.

**Goal:** Produce private verifiable skill decks before activation and triggers.

**Architecture:** An independently validated projected source feeds recipe
derivation, capability, deterministic realization, and full replay verification.
The CLI is a thin bounded-file adapter using the existing exclusive atomic writer.

**Tech stack:** Node 24, TypeScript, existing Zod/esbuild/canonical JSON utilities.

**Spec:** [camp-decks-spec.md](camp-decks-spec.md).

## Global constraints

- Base `a70b78ab3099a59d8b0e1381a3eb2ba5ce87d180`, lock unchanged; no installation.
- Exactly two new dist targets; all 24 prior outputs retain exact bytes.
- No existing runtime/source/tool/validator changes except build target registration.
- No activation, schema, host, UI, journal, session or original A1 RNG changes.
- All three benefit quantities remain null/unverified; original156 static/gated.
- All genuine content and evidence stay ignored including Git history.
- Only supplied isolated checkout, explicit read-only inputs/tools and report path.
- No delegates, remote writes, push, PR, merge or watches.

## Review focus

- Separate capability and catalog identity can disagree: selected incompleteness gates.
- Campaign skillCopies contain free old roles: only inventory-backed upgrades survive.
- A source within budget can expand beyond the artifact budget: reject before return.
- Self-consistent re-signing can conceal changed entropy: trusted realization pins reject.
- Older current confirmations remain valid: reject future/null/stale, not older revisions.

## Task 1: Contract, provenance and baseline

- [x] Verify external brief/manifest pins before parse; selected rows before use.
- [x] Verify clean base/tree/lock; copy allowed dependencies locally and build baseline.
- [x] Record tracked-file and all 24 dist hashes in ignored evidence.
- [x] Write this public spec and plan before product code; commit documentation.

## Task 2: Authority, recipes and capability

Files: `src/camp-decks/model.ts`, `source.ts`, `index.ts`;
`tests/fixtures/camp-decks.mjs`, `tests/camp-decks-source.test.mjs`.

Interfaces: `parseSource(unknown)` produces defensive validated source plus derived
recipes; `campDeckCapability(unknown)` reports technical readiness and pending gates.

- [ ] RED: role change keeps old-role purchases/removed titles, rejects forged recipe,
      ownership, duplicate roles, incomplete selected capability, unsafe JSON and stale
      confirmations; accepts older current confirmations.
- [ ] Implement strict projection and inventory/weakness conservation; derive the
      existing recipe shape/hash from authority, not supplied recipe.
- [ ] GREEN: targeted tests and typecheck; preserve actual RED logs; local commit.

## Task 3: Materialization and replay

Files: `src/camp-decks/random.ts`, `decks.ts`; `tests/camp-decks.test.mjs`.

Interfaces: `materializeCampDecks(unknown, unknown)` returns artifact or gate;
`verifyCampDeckArtifact(unknown, expectedPins?)` returns rederived artifact.

- [ ] RED: exact top-first assignment, independent streams, prepared exclusion,
      stable basic copies, legal >30/>56 decks, full trace/order tampering and changed
      seed pins, defensive copies, gates before entropy reads and complete-output budget.
- [ ] Implement documented SHA256 rejection-sampled Fisher-Yates streams, source/
      realization/artifact pins and complete replay comparison; budget full output.
- [ ] GREEN: targeted tests/typecheck; local commit.

## Task 4: Private CLI and independent oracle

Files: `src/camp-decks/main.ts`, `tests/camp-decks-cli.test.mjs`;
minimal `scripts/build.mjs` target registration, `docs/camp-decks.md`.

- [ ] RED: CLI exits 0/1/2, mode0600, exclusive/concurrent atomic publication,
      no publication for invalid inputs and full-output budget failures.
- [ ] Implement CLI and two target registration; GREEN targeted tests; local commit.
- [ ] In ignored evidence, independently read original catalog/capability/workbook/
      normative evidence; generate H2–5 technical invented inventory/episode matrix.
- [ ] Python checker derives expected identities/copies/multisets/orders/trace directly
      from sources, documents common policy/hash assumptions, saves failures and success.

## Task 5: Final evidence and ordered handoff

Files: `docs/testing/camp-decks-verification.md`; ignored report/README/manifest/pin.

- [ ] Build, typecheck, format, diff and privacy checks; compare all pre-existing
      source/tool/validator bytes, unchanged lock and 24 prior dist bytes; exactly 2 targets.
- [ ] Run final complete canonical `npm test` once, alone/concurrency4; save npm exit
      and test/pass/fail/skip/cancel/todo counts against baseline942.
- [ ] Finish API/CLI and public verification documentation; commit and clean tree.
- [ ] Seal evidence with manifest and external bytes/SHA pin, read-only references,
      reproducible README and full report; copy report only to authorized Root path.
- [ ] Return status, branch/checkout/head/commits, actual tests/exit, evidence pin,
      report paths and material concerns. No PR/remote operations.
