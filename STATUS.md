# Nib Base Library Improvement Status

- Active batch: Batch 5 — unified Markdown content and layout roots
- Branch/worktree: `master` in `/Volumes/Storage/code/nib`
- Baseline: `cb98aa7fedb243f8c1ebef18cc38bec197744296`
- Current revision: Batch 4 base API landed at `2f86d0b060e88490410147659962942f6598a4bf`; replica adoption is validated and pending its commit
- Completed focused gates: Batch 1 boundary tests (15); Batch 2 typecheck, lifecycle/package/site tests (49), and full 493-page replica verification; Batch 3 style ownership tests, docs build, and replica build; Batch 4 page collections, duplicate IDs, immutable capabilities, least-privilege tests, 62-entry importer determinism, and capability-backed RSS/search
- Completed complete gates: authoritative root test command (172 framework tests, 20 image-package tests, and 2 package-consumer tests), root typecheck, docs build, and full replica `verify` with 493 exact pages, 62 writing entries, 120 RSS items, 440 search items, and no broken routes or page issues
- Remaining work: Batches 5–7 and the complete validation/documentation gate
- Known failures: none
- Current boundary: Batch 7 requires an explicit ADR decision before implementation
