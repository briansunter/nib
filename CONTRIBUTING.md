# Contributing to Nib

Nib is a static-first framework. Refactors must preserve complete static HTML,
runtime-free output for sites that do not opt into browser features, and the
published execution-target boundaries.

## Repository roles

- `src/` contains the framework package and its public entry facades.
- `packages/nib-images/` is an independently versioned optional package.
- `examples/docs/` is the deployed documentation consumer.
- `examples/blog/` is the full-featured integration consumer.
- `templates/default/` is copied by `nib init`.
- `tests/fixtures/` contains read-only fixture inputs. Tests must copy a fixture
  to a temporary directory before writing to it.
- `docs/` contains reference, decision, design, and historical material.

See `organization.md` for the target internal layout and migration rules.

## Required verification

Run the complete local gate before handing off a source change:

```sh
bun run verify
bun run check:version-policy
git diff --check
```

`bun run verify` covers framework and image-package typechecking, unused-code
checks, unit/integration tests, packed-package consumers, docs output, and the
blog build and inspection.

For public entry-point work, also inspect a package dry run:

```sh
npm pack --dry-run
npm pack --dry-run --workspace @briansunter/nib-images
```

## Generated and local artifacts

- Root package output belongs in `dist/framework/`.
- Site output belongs in `<site>/dist/`.
- Nib and plugin cache/state belongs in `<site>/.nib/`.
- Retained local package archives and benchmark output belong in
  `.artifacts/`; ordinary tests should use an operating-system temporary
  directory instead.
- `dist/`, `.nib/`, `.artifacts/`, and coverage output are ignored and must not
  be committed.

The framework publishes only `dist/client` for a site. `dist/server` is a
prerender intermediate. Optional-package finalizers must use the publication
manifest and client output path rather than reconstructing routes by crawling
arbitrary output.

## Architectural constraints

1. Preserve existing public package specifiers unless a separately approved
   release explicitly changes them.
2. Keep Node-only code out of universal and browser entry graphs.
3. Keep browser-only code out of server graphs.
4. Keep Sharp and image transformation in `@briansunter/nib-images`.
5. Keep plugin routes immutable and collection access capability-based.
6. Use explicit generated-module or finalization contracts across separate
   Vite graph instances; do not rely on shared plugin-instance memory.
7. Keep checked-in fixtures read-only.
8. Make file moves separately from behavior changes where practical.
