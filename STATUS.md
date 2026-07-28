# Nib Base Library Improvement Status

- Active batch: Batch 6 — structured publication inspection
- Branch/worktree: `master` in `/Volumes/Storage/code/nib`
- Baseline: `cb98aa7fedb243f8c1ebef18cc38bec197744296`
- Current revision: Batch 5 base API landed at `1dda28800c41f79aad90f391d6a50c7946f06991`; replica adoption is validated and pending its commit
- Completed focused gates: Batch 1 boundary tests (15); Batch 2 typecheck, lifecycle/package/site tests (49), and full 493-page replica verification; Batch 3 style ownership tests, docs build, and replica build; Batch 4 page collections, duplicate IDs, immutable capabilities, least-privilege tests, 62-entry importer determinism, and capability-backed RSS/search; Batch 5 shared compiler, semantic content root, source diagnostics, exactly-once layout tests, and project-profile parity tests
- Completed complete gates: authoritative root test command (176 framework tests, 20 image-package tests, and 2 package-consumer tests), root typecheck, docs build, and full replica `verify` after the Batch 5 migration with 493 exact pages, 58 exact project bodies, 62 writing entries, 120 RSS items, 440 search items, and no broken routes or page issues
- Remaining work: Batches 6–7 and the complete validation/documentation gate
- Known failures: none
- Current boundary: Batch 7 requires an explicit ADR decision before implementation
