# Nib Framework Cleanup Plan

> Historical implementation record. Names and constraints below describe the
> framework at that stage; use the current README and architecture reference
> for the `enhance()` API, React islands, and native navigation model.

Status: implemented and verified

Baseline: `08ef502d84d1f85669f82489aed0c45989719bd9`

Reference implementation at the time of the audit:
the now-standalone `../personal-site-nib`, compared with its source site at
`b10a973a677cee207d1258edf0d95170078829dd`. The repository now uses
`examples/blog` as its dependency-light, fictional CI consumer.

Scope: correctness, simplification, and modularity improvements in the Nib
framework and optional plugins. The personal-site implementation is evidence
for real requirements, not a source of application-specific policy for core.

Implementation was subsequently authorized. Publishing and releasing remain
outside this plan.

## Outcome

Keep Nib's existing static-first architecture while fixing the small number of
confirmed correctness gaps and removing framework behavior that belongs to an
application.

The completed result should:

- preserve complete static HTML and normal browser navigation;
- keep image processing and browser behaviors optional;
- enforce server/client, stylesheet, island, and behavior ownership reliably;
- support non-root deployment bases without mismatching URLs and artifacts;
- make client teardown safe even when application cleanup throws;
- give output plugins exact publication artifacts instead of requiring output
  crawls and route reconstruction;
- keep generated markup neutral and styling-policy-free;
- avoid new abstractions unless they remove demonstrated duplication.

## Current evidence

At the baseline:

- root typecheck passes;
- the image package passes 22 tests;
- the framework passes 208 tests;
- packed-consumer tests pass;
- the personal-site replica verifies 493 canonical route/meta/social
  comparisons and 493 semantic page comparisons with zero differences;
- `nib check` verifies 668 routes and 24,378 local references;
- Pagefind indexes 440 pages;
- performance and broken-route checks pass;
- local `master` and `origin/master` are equal and clean.

Focused probes nevertheless confirmed:

1. content-image originals and failed-transform fallbacks are deployed to the
   wrong physical location under a non-root base;
2. nested behavior markers can make renderer ownership validation fail open;
3. a throwing behavior cleanup leaves stale mounted state, and a throwing
   runtime controller prevents later controllers from being cleaned up;
4. stylesheet text in comments can trigger the page-style ownership error;
5. development always links `src/style.css` even though that file is optional;
6. finalizers repeatedly crawl output that the framework has already indexed.

## Required invariants

Every batch must preserve:

1. Static routes contain complete, crawlable HTML.
2. Routes without islands or behaviors ship no corresponding client runtime.
3. Island and behavior IDs, hydration strategies, props, and owned markup fail
   closed when invalid.
4. Application cleanup cannot leave framework bookkeeping in a mounted state.
5. Public URLs include the configured base exactly once; physical artifacts do
   not duplicate the URL base inside the client output directory.
6. Project-root traversal and output containment remain fail-closed.
7. Page-only server CSS either has a supported client owner or produces a
   deterministic source-oriented error.
8. Generated framework markup contains no personal-site typography, color, or
   image-sizing policy.
9. Existing root-base, trailing-slash, static-output, and package-consumer
    behavior remains compatible unless explicitly called out.

## Non-goals

- Do not redesign Nib's plugin system.
- Do not add route-scoped CSS.
- Do not add Leaflet, Mermaid, PhotoSwipe, Pagefind, or Cooklang to core.
- Do not move Sharp into the universal framework package.
- Do not combine islands and behaviors into a generic lifecycle engine.
- Do not add a generic JSON-page or integration framework.
- Do not pass parsed DOM trees through public finalizer APIs.
- Do not introduce dynamic imports where static client-only entries suffice.
- Do not extract Pagefind into a package before a second real consumer exists.

## Dependency order

1. Batch 1: base-safe content-image originals and fallbacks.
2. Batch 2: parser-based renderer marker ownership.
3. Batch 3: exception-safe client lifecycle teardown.
4. Batch 4: resolved stylesheet ownership and one HTML template.
5. Batch 5: neutral generated Markdown and image metadata.
6. Batch 6: publication artifacts for finalizers.
7. Batch 7: ordered verification workflow.

Batches 1 through 4 are correctness work and should land before the modularity
cleanup in Batches 5 and 6. Batch 7 is small and independent.

Root and reference-site verification had to run sequentially while they shared
framework output. The in-repository blog is now a root workspace and uses the
same clean install as CI.

## Batch 1: Base-safe content images

### Purpose

Ensure authored content images, linked originals, and failed optimization
fallbacks deploy correctly for both `/` and non-root bases.

### Changes

1. Separate public URL construction from physical artifact construction.
2. Write an authored `/site-assets/image.png` to
   `dist/client/site-assets/image.png`, regardless of a `/journal/` URL base.
3. Emit `/journal/site-assets/image.png` for a `/journal/` deployment.
4. Preserve URLs that already contain the configured base without duplicating
   it.
5. Apply the same normalization to `<img src>`, linked original `<a href>`, and
   failed Sharp-transform restoration.
6. Deduplicate source copies within one finalization run.

### Tests

- Root-base optimized content image.
- Non-root-base optimized content image.
- Root- and non-root corrupt image fallback.
- Linked original image under both bases.
- Already-base-prefixed source URL.
- Traversal and escaping-symlink rejection.

### Acceptance

- Every emitted content-image URL maps to an existing artifact.
- The configured base appears exactly once in public URLs.
- The configured base does not appear as a redundant physical output segment.
- Existing root-base snapshots remain unchanged.

### Commit

`fix(images): make content originals and fallbacks base-safe`

## Batch 2: Parser-based renderer marker ownership

### Purpose

Prevent renderer plugins from changing or deleting framework-owned island and
behavior subtrees, including nested or malformed input.

### Changes

1. Replace regular-expression marker extraction with the existing parse5 HTML
   document machinery.
2. Capture ordered island and behavior subtrees before renderer transforms.
3. Compare the complete owned subtrees after every transform.
4. Fail closed when marker structure is malformed or cannot be compared.
5. Preserve plugin name, hook, and route attribution in diagnostics.

### Tests

- One and multiple island markers.
- One and multiple behavior markers.
- Nested behavior markup.
- Nested markup containing similar tag text in attributes or scripts.
- Missing or mismatched closing markers.
- Allowed transformation outside owned subtrees.
- Reordering, deleting, or editing an owned subtree.

### Acceptance

- No renderer transform can alter owned marker markup undetected.
- Valid existing transforms produce identical output.
- The implementation has one parser-backed ownership path rather than parallel
  island and behavior regex logic.

### Commit

`fix(plugin): fail closed on renderer-owned client markup`

## Batch 3: Exception-safe client lifecycle teardown

### Purpose

Guarantee that one application cleanup failure cannot retain stale framework
state or prevent unrelated runtimes from cleaning up.

### Changes

1. Mark behavior state inactive and remove mounted bookkeeping even when the
   application cleanup callback throws.
2. Cancel scheduled work and abort the behavior signal before invoking
   application cleanup.
3. Attempt every controller during unmount and destroy.
4. Collect failures and throw one `AggregateError` only after all cleanup
   attempts finish.
5. Preserve the navigation hard-reload fallback after teardown failures.
6. Store and restore the previous `history.scrollRestoration` value.
7. Remove navigation-owned temporary state and timers on destroy.

### Tests

- Throwing behavior cleanup followed by a successful remount.
- Two controllers where the first unmount throws.
- Two controllers where the first destroy throws.
- Pending idle or visible behavior during teardown.
- Navigation teardown restores automatic or pre-existing scroll restoration.
- Failed teardown attempts all remaining runtimes before hard navigation.

### Acceptance

- Framework state is clean after every teardown attempt.
- Every registered runtime gets exactly one cleanup attempt.
- A behavior can remount after its previous cleanup threw.
- Navigation restart does not inherit stale global scroll behavior.

### Commit

`fix(client): make runtime teardown exception-safe`

## Batch 4: Resolved stylesheet ownership and one HTML template

### Purpose

Retain the page-style ownership invariant without false positives, while
removing development/production template drift.

### Changes

1. Enforce stylesheet ownership using Vite-resolved import edges rather than
   regular-expression scans of source text.
2. Preserve the existing diagnostic and remediation guidance.
3. Cover aliases and query strings after resolution.
4. Do not treat imports in comments or ordinary string literals as module
   edges.
5. Build development and production documents through one template function.
6. Pass explicit island, behavior, enhancement, and stylesheet URLs to that
   function.
7. Include development `src/style.css` only when it exists.

### Tests

- Unsupported page, layout, and server data-page CSS imports.
- Supported global, island, behavior, and plugin client-entry CSS.
- Comments and strings containing import-like text.
- Static and dynamic CSS imports.
- Aliased CSS imports and query parameters.
- Development with and without `src/style.css`.
- Root and non-root entry URLs.

### Acceptance

- Every real unsupported stylesheet edge fails deterministically.
- Non-import text never triggers the ownership error.
- Development does not request a missing optional stylesheet.
- Development and production share one document-template implementation.

### Commit

`refactor(styles): enforce ownership on resolved module edges`

## Batch 5: Neutral generated presentation hooks

### Purpose

Keep framework output reusable by removing personal-site visual policy from
generated Markdown and image markup.

### Changes

1. Replace generated Markdown's Tailwind typography/color class list with a
   neutral `nib-markdown` hook or no default class.
2. Move the replica's prose classes into its layout or stylesheet.
3. Remove `--nib-image-comfort-width` from the image package.
4. Retain only objective image metadata that has a demonstrated consumer.
5. Rename ambiguous variables to source-specific names if retained, such as
   `--nib-image-source-width` and `--nib-image-source-height`.
6. Make orientation mathematically objective or move the near-square
   categorization into the replica.
7. Document every emitted image data attribute and CSS custom property.

### Tests

- Framework source contains no Tailwind typography or color policy.
- Image markup snapshots contain only documented hooks.
- Replica visual and semantic parity remains intact after styles move locally.
- Consumer-defined `className` and `style` continue to override defaults.

### Acceptance

- Nib emits structural hooks, not a site's aesthetic decisions.
- The personal-site replica retains its intended visual layout.
- No undocumented DOM hook is accidentally promoted to public API.

### Commit

`refactor: move presentation policy out of generated markup`

## Batch 6: Publication artifacts for finalizers

### Purpose

Let output plugins operate on exact framework-known artifacts without
recursively crawling the build and reconstructing route semantics.

### Interface

Extend `NibFinalizeContext` with an immutable publication manifest or a minimal
immutable page-artifact list containing:

- route URL;
- route kind;
- artifact path relative to `clientDirectory`;
- content type where relevant.

Do not expose parsed page DOM or mutable framework state.

### Changes

1. Construct the publication data before finalizers run.
2. Pass it through the generated server finalization boundary.
3. Update content-image finalization to inspect exact page artifacts.
4. Update the app-owned Pagefind plugin to consume exact page artifacts.
5. Remove Pagefind's artifact-to-route reconstruction.
6. Remove duplicate image output crawls and source copies.
7. Write `.nib/publication.json` from the same immutable data after finalizers.

### Tests

- Root and non-root route URLs.
- All trailing-slash policies.
- Index, extensionless, resource, redirect, and 404 artifacts.
- A finalizer sees immutable publication data.
- Image and Pagefind finalizers perform no recursive client-output crawl.
- Finalizer errors retain plugin attribution.

### Acceptance

- Finalizers consume the framework's authoritative route/artifact mapping.
- Pagefind and image processing do not independently rediscover the build.
- Publication JSON and finalizer data cannot drift.
- The API remains small enough for current consumers.

### Commit

`feat(plugin): expose publication artifacts to finalizers`

## Batch 7: Ordered verification workflow

### Purpose

Prevent shared build output from creating misleading validation failures.

### Changes

1. Add one ordered root command for framework plus replica verification, or
   isolate their framework build directories.
2. Keep the full replica verification cached, scheduled, or manually
   invokable if its 5,880 generated image assets are too expensive for every
   pull request.
3. Add the focused regression fixtures from Batches 1 through 4 to normal CI.
4. Enable or separately run unused-import checking and remove the currently
   reported unused type imports.

### Tests

- The ordered verification command succeeds from a clean checkout.
- Root and replica verification cannot overwrite each other's framework output.

### Acceptance

- One documented command produces trustworthy complete validation.
- CI covers the newly fixed invariants without requiring the full replica image
  corpus on every change.

### Commit

`test: add ordered framework and replica verification`

## Complete validation

After each batch, run its focused tests and `git diff --check`.

After Batches 1 through 4:

1. `bun run typecheck`
2. image-package tests
3. framework tests
4. packed-consumer tests
5. production root-base fixture
6. production non-root-base fixture

After Batches 5 through 7, run the complete ordered gate:

1. root typecheck;
2. full root test suite;
3. package-consumer verification;
4. documentation build and link checks;
5. in-repository blog template `bun run verify`;
6. targeted browser checks for navigation, images, behaviors, and code blocks;
7. `git diff --check`;
8. clean-worktree review.

Keep framework and consumer validation ordered when they share generated
framework output.

## Completion criteria

The plan is complete only when:

- every confirmed bug has a regression test;
- all seven batches meet their acceptance criteria;
- no personal-site styling policy remains in framework-generated markup;
- output plugins use authoritative publication artifacts;
- the complete sequential validation gate passes;
- the standalone reference site retains exact route, metadata, semantic-content, reference,
  search, performance, and targeted visual behavior;
- documentation explains the final public contracts;
- commits remain independently reviewable and reversible.

## Completion evidence

Implemented across the framework, `@nib/images`, documentation, and the
standalone reference site:

- content-image public URLs and physical artifacts are base-safe, including
  linked originals and failed-transform fallbacks;
- renderer-owned island and behavior markup is validated through parse5;
- behavior, island, coordinator, and HMR teardown is exception-safe;
- stylesheet ownership follows Vite-resolved module edges, and development and
  production share one HTML template;
- generated Markdown and image markup exposes neutral, documented hooks;
- finalizers consume the immutable publication manifest instead of crawling
  output;
- `bun run verify` runs the complete root, documentation, and blog-template
  gate in the required order.

Final verification:

- 26 image-package tests pass;
- 227 framework tests pass;
- packed-consumer tests pass;
- the docs build succeeds;
- the replica matches 493 route/meta and 493 semantic-content references;
- `nib check` validates 668 routes and 24,378 local references;
- Pagefind indexes 440 pages;
- performance, broken-route, image, code-block, tweet, and Markdown assertions
  pass;
- targeted desktop and mobile browser checks confirm centered, bounded article
  media and code blocks and no console errors;
- `git diff --check` and unused-import checks pass.
