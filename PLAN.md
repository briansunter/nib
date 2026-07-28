# Nib Base Library Improvement Plan

Status: proposed

Baseline: `cb98aa7fedb243f8c1ebef18cc38bec197744296`

Scope: reusable framework improvements learned from the exhaustive
`examples/personal-site-replica` implementation

## Outcome

Make advanced static sites easier to build without weakening Nib's core
contract:

- pages and layouts render complete static HTML;
- routes without interactive boundaries ship no React client runtime;
- server-only and browser-only code have explicit, enforceable boundaries;
- content metadata and Markdown bodies have one authoritative graph;
- unsupported styling and module-graph behavior fails during development or
  build instead of producing incomplete output;
- build inspection is structured, extensible, and reusable by migration tests.

This plan does not authorize implementation, publishing, pushing, or releasing.
Each batch ends at a local, validated commit unless separately approved.

## Evidence

The personal-site replica required reusable infrastructure that should not need
to be rebuilt by every advanced site:

- `examples/personal-site-replica/src/utils/clientNavigationInitializer.ts`:
  1,125 lines;
- four `examples/personal-site-replica/scripts/check-*.mjs` parity and output
  checkers: 1,770 lines;
- `examples/personal-site-replica/scripts/import-content.mjs`: 1,037 lines;
- parallel Markdown pages and `writing.json` metadata for the same 62 entries;
- a second Markdown/prose renderer for 58 generated project pages;
- manual dynamic imports that shield Leaflet from the SSR module graph;
- a private `window.__nibStartIslandRuntime` restart hook;
- global promotion of pin CSS after a page-only CSS import was absent from the
  client build.

The following reusable fixes already landed in the baseline and must not be
reimplemented:

- generated Markdown pages forward safe root attributes;
- trusted iframe presentation attributes are retained;
- explicitly authored responsive-image width ladders remain authoritative.

## Required invariants

Every batch must preserve these invariants:

1. Static pages contain complete, crawlable HTML and no island or behavior
   runtime unless explicitly used.
2. SSR output and the first browser render are structurally deterministic.
3. Island IDs, behavior IDs, hydration strategies, and serialized props fail
   closed when invalid.
4. Props crossing into browser code remain JSON-serializable and contain no
   secrets.
5. Dangerous Markdown HTML remains explicitly enabled and host-restricted
   media retains the existing safety policy.
6. Project-root traversal protections and output-path containment remain
   fail-closed.
7. Base paths, trailing-slash policies, development SSR, prerendering, and
   static deployment continue to work.
8. A failed client enhancement or optional navigation falls back to usable
   server-rendered HTML.
9. Visual and interaction testing remains required; static inspection is not
   presented as visual equivalence.
10. Capability-specific dependencies stay in optional packages or client-only
    chunks rather than entering the universal core graph.

## Non-goals

- Add Leaflet, Mermaid, PhotoSwipe, Pagefind, Cooklang, or Astro compatibility
  code to Nib core.
- Hydrate an entire page or infer interactivity from React hooks.
- Add runtime server loaders, server actions, React Server Components, or
  network-dependent builds.
- Make SPA navigation a default behavior.
- Encode personal-site selectors, route names, RSS identity fields, image caps,
  or parity expectations in framework code.
- Replace browser validation with generated reports.
- Remove existing root exports without a separately approved major-version
  migration.

## Dependency order

1. Batch 0: contract fixtures and architecture decisions. Starts from the
   baseline. Proposed commit: `test: capture advanced site boundary contracts`.
2. Batch 1: public server/client package boundaries. Depends on Batch 0.
   Proposed commit: `feat: expose server and client package boundaries`.
3. Batch 2: lifecycle runtime and client behavior primitive. Depends on Batch
   1. Proposed commit: `feat: add lifecycle-aware client behaviors`.
4. Batch 3: server-only CSS diagnostics. Depends on Batch 0. Proposed commit:
   `fix: reject undeployable page style imports`.
5. Batch 4: page-backed collections and resource capabilities. Depends on
   Batch 0. Proposed commit: `feat: derive collections from page metadata`.
6. Batch 5: unified Markdown content and layout roots. Depends on Batch 4.
   Proposed commit: `feat: add reusable markdown content slots`.
7. Batch 6: indexed inspection, verifier extensions, and provenance. Depends
   on Batch 0. Proposed commit: `feat: add structured publication inspection`.
8. Batch 7: optional client-navigation package. Depends on Batch 2 and an
   explicit decision. Proposed commit: `feat: add opt-in static site navigation`.

Batch 3 and Batch 6 are independent after Batch 0. Batch 4 can proceed in
parallel with the client-runtime track only when separate worktrees and
deterministic test aggregation are used.

## Batch 0: Freeze contracts and decisions

- **Purpose:** Establish behavioral fixtures before changing package graphs,
  hydration lifecycle, content ordering, or verification.
- **Non-goals:** No public API or production behavior changes.
- **Owned areas:** `tests/fixtures`, framework tests, package-consumer tests,
  architecture decision records under `docs/`.
- **Interfaces and invariants:** Record current static-page output,
  island-page output, package exports, Markdown defaults, base-path output, and
  publication-manifest behavior.
- **Sequence:**
  1. Add a fixture with one static route, one island route, one Markdown route,
     one data page, one resource, and one redirect.
  2. Add negative fixtures for a top-level browser-global import, page-only CSS,
     invalid cross-target imports, detached pending hydration, and malformed
     publication artifacts.
  3. Write an ADR for `.client`/`.server` discovery and a separate ADR for the
     typed client-behavior marker.
  4. Record whether route-scoped CSS is in scope; the minimum accepted behavior
     is a deterministic build error.
- **Focused validation:** Run only the new fixtures and package-consumer tests.
- **Acceptance:** Every later batch has a failing test that describes its
  intended behavior, while existing production snapshots remain unchanged.
- **Commit boundary:** Test and ADR changes only.
- **Rollback:** Revert the test commit without touching runtime code.
- **Approval boundary:** ADRs may choose additive APIs. Removing or renaming
  existing exports requires separate major-version approval.

## Batch 1: Public server and client boundaries

- **Purpose:** Let server-only code use normal static Node imports and give
  browser runtime contracts a supported public home.
- **Non-goals:** Do not remove compatibility exports or change island loading.
- **Owned areas:** `package.json` exports, `src/index.ts`,
  `src/framework/content.ts`, new public server/client entry modules, Vite graph
  guards, package-consumer fixtures.
- **Interface:**
  - `@briansunter/nib/server` for file/glob loaders, build-only content
    operations, and server plugin contracts;
  - `@briansunter/nib/client` for browser runtime and lifecycle contracts;
  - universal definitions and types remain available from
    `@briansunter/nib`.
- **Sequence:**
  1. Separate universal content definitions from filesystem-backed loaders.
  2. Move `node:fs/promises`, `node:path`, and `tinyglobby` use behind the
     server entry and convert them to static imports.
  3. Add public client/server package exports and declaration output.
  4. Preserve existing root loader exports through a documented compatibility
     layer and mark their eventual removal as major-version work.
  5. Add `.client` and `.server` graph guards with import-chain diagnostics.
  6. Prove React and island context have one module identity across exports.
- **Focused validation:** Content-loader traversal tests, client bundle fixture,
  server package-consumer fixture, packed-package file assertions.
- **Complete validation:** Root typecheck, root tests, framework build, docs
  build, and `git diff --check`.
- **Acceptance:**
  - client consumers require no Node shims;
  - client bundles contain no `node:` or `tinyglobby` implementation;
  - server loaders use static imports;
  - illegal target-crossing imports fail with their complete import chain;
  - current consumer source continues to compile.
- **Commit boundary:** One additive package-boundary commit.
- **Rollback:** Revert the commit; no content or generated output migration is
  allowed in this batch.
- **Approval boundary:** Deprecation is allowed; removal waits for a major
  release plan.

## Batch 2: Lifecycle runtime and client behaviors

- **Purpose:** Support progressive enhancement and repeated document mounting
  without private globals, empty React components, or app-authored SSR shields.
- **Non-goals:** Do not add client routing or client-only essential content.
- **Owned areas:** island scheduler/hydrator, public client runtime, generated
  client entry, new behavior registry and marker, runtime tests, selected
  replica behavior islands.
- **Interfaces:**

  ```ts
  const runtime = createIslandRuntime(modules)
  runtime.mount(root)
  runtime.unmount(root)
  runtime.destroy()
  ```

  A typed server-safe descriptor registers a client implementation without
  importing that implementation into SSR. The implementation receives a
  scoped root, validated props, and an `AbortSignal`.
- **Sequence:**
  1. Make hydration scheduling cancellable.
  2. Retain hydrated React roots and unmount them before their DOM is detached.
  3. Build the loader registry once per runtime.
  4. Add scoped mount, unmount, and destroy operations.
  5. Replace `window.__nibStartIslandRuntime` with the public controller.
  6. Add client behavior discovery that shares `load`, `idle`, and `visible`
     scheduling but does not require `react-dom/client`.
  7. Migrate behavior-only replica islands in a separate adoption commit.
  8. Statically import Leaflet from the relevant client behavior and retain
     Mermaid's conditional import only when bundle size still justifies it.
- **Focused validation:** Scheduler cancellation, root cleanup, duplicate IDs,
  invalid props, browser-global fixture, repeated mount, and no-React behavior
  fixture.
- **Complete validation:** Root suite, replica verification, and browser checks
  for static → interactive → static transitions.
- **Acceptance:**
  - removed roots run React and behavior cleanup exactly once;
  - pending idle/visible work cannot run on detached nodes;
  - behavior-only pages do not ship React DOM;
  - pages without islands or behaviors remain runtime-free;
  - the pin behavior contains no application-authored dynamic import;
  - the generated entry defines no private restart global.
- **Commit boundary:** First commit the framework controller and behavior API;
  then commit the replica migration separately.
- **Rollback:** The replica migration can revert independently. Reverting the
  framework commit restores the previous generated client entry.
- **Approval boundary:** None for the controller or progressive enhancement.
  Navigation remains Batch 7 and decision-gated.

## Batch 3: Make page-style ownership explicit

- **Purpose:** Prevent silent production output that is structurally correct but
  missing CSS reachable only from the server graph.
- **Non-goals:** Do not design route-level code splitting unless a separate ADR
  shows enough benefit to justify additional manifest and head complexity.
- **Owned areas:** project Vite adapter, build diagnostics, page/layout
  discovery tests, styling documentation.
- **Interface:** In the first iteration, `src/style.css` remains the supported
  deployable style entry. CSS reachable only through a page, layout, or
  server-only data-page module is rejected with a source-oriented diagnostic.
- **Sequence:**
  1. Add the failing page-only CSS fixture from Batch 0.
  2. Detect CSS edges owned exclusively by the server graph.
  3. Fail with the importing module, stylesheet, and supported remediation.
  4. Document global style ownership and optional plugin-owned CSS.
  5. Record route-scoped CSS as a future proposal rather than silently
     broadening this batch.
- **Focused validation:** Page, layout, data page, island, global style, and
  plugin-style fixtures in development and production.
- **Complete validation:** Framework build, docs build, replica build, and
  `git diff --check`.
- **Acceptance:** Every authored stylesheet is either represented in the
  deployed client graph or causes a deterministic development/build failure.
- **Commit boundary:** One diagnostic and documentation commit.
- **Rollback:** Revert the diagnostic if it rejects a supported Vite path; do
  not weaken it to a warning without a passing deployed-style fixture.
- **Approval boundary:** Route-scoped CSS support requires a new plan amendment.

## Batch 4: Page-backed collections and resource capabilities

- **Purpose:** Make validated page metadata queryable without a mirrored JSON
  database or unrestricted plugin access to internal page data.
- **Non-goals:** Do not make rendering depend on mutable plugin state or expose
  all page data to every plugin.
- **Owned areas:** content definitions, project-renderer ordering, route/page
  descriptors, collection loading, RSS/search resource helpers, content docs.
- **Interfaces:**
  - `fromPages()` or `fromMarkdownPages()` with explicit `match`, `id`, and
    `select` callbacks;
  - `fromCollection(collection, mapper)` capability for resource providers.
- **Sequence:**
  1. Create immutable page descriptors after module/frontmatter validation and
     before page-backed collection resolution.
  2. Add pure typed selectors over route, source, resolved metadata, and
     validated frontmatter.
  3. Detect duplicate IDs and dependency cycles before rendering.
  4. Add explicit immutable collection capabilities for RSS and search.
  5. Migrate the replica writing collection away from `writing.json`.
  6. Remove repeated filesystem parsing from RSS and search providers.
- **Focused validation:** Type inference, duplicate IDs, draft/match filtering,
  cycle diagnostics, collection least privilege, and deterministic ordering.
- **Complete validation:** Root suite and full replica parity for all writing,
  archive, tag, related-post, RSS, and search outputs.
- **Acceptance:**
  - deleting `writing.json` and its generator does not change any of the 62
    writing entries or their consumers;
  - editing one page's frontmatter updates every authorized consumer in one
    build;
  - resource providers perform no direct JSON or Markdown file parsing;
  - plugins see only explicitly granted immutable collections.
- **Commit boundary:** Commit the base API first, then the replica migration.
- **Rollback:** Revert the replica migration to its metadata mirror without
  reverting the additive framework API.
- **Approval boundary:** Any generic plugin access to complete page data is out
  of scope and requires a security review.

## Batch 5: Unified Markdown content and layout roots

- **Purpose:** Reuse one Markdown pipeline for file pages and data-generated
  pages while letting layouts control the semantic content root.
- **Non-goals:** Do not add MDX, implicit raw HTML, network plugins, or
  application-specific Shiki chrome.
- **Owned areas:** Markdown compiler, generated Markdown module, data-page
  types, layout props, HMR dependency tracking, replica project rendering,
  Markdown documentation.
- **Interfaces:**
  - `markdownBody(source, options)` for generated pages;
  - a typed `Content` component or `renderContent(rootProps)` layout contract;
  - optional named Markdown profiles with deterministic plugin ordering.
- **Sequence:**
  1. Specify a content-body value that carries source identity and compile
     options without pre-rendering HTML in the importer.
  2. Compile it with the existing Markdown compiler and source-located errors.
  3. Expose a framework-owned content renderer to data pages and layouts.
  4. Let layouts set the root tag, class, and safe static attributes while Nib
     retains ownership of compiled HTML.
  5. Guarantee content renders exactly once through nested layouts.
  6. Migrate project pages away from `marked`, `bodyHtml`, and
     `project-prose.ts`.
  7. Remove `cloneElement` from the article layout.
- **Focused validation:** Raw-HTML policy, plugin order, source paths, heading
  IDs, figures, smart typography, code highlighting, root attributes, nested
  layouts, and HMR invalidation.
- **Complete validation:** Root suite plus exact content parity for all 62
  writing and 58 project pages.
- **Acceptance:**
  - projects and Markdown pages use one compiler seam;
  - project prose/code/figure output remains exact;
  - layouts apply Pagefind and class attributes without element introspection;
  - existing default Markdown snapshots remain unchanged;
  - no compilation step performs network access.
- **Commit boundary:** Base content API and replica migration are separate
  commits.
- **Rollback:** The old project renderer remains usable until the migration
  commit passes full parity, then is deleted in that same commit.
- **Approval boundary:** Async Markdown compilation is backlog work. It requires
  a separate cache, dependency, determinism, and performance design.

## Batch 6: Structured publication inspection

- **Purpose:** Replace repeated output crawling with one indexed, read-only
  inspection model and structured issues.
- **Non-goals:** Do not encode site-specific parity policy or claim visual
  equivalence.
- **Owned areas:** publication verifier, CLI `check`/`inspect`, plugin
  post-build checks, testing subpath, `nib-images` provenance, negative
  fixtures.
- **Interfaces:**
  - `inspectSite()` returns immutable route/file indexes, parsed pages, metrics,
    and `SiteIssue[]`;
  - `verifySite()` applies built-in checks and reports all issues together;
  - read-only verifier extensions receive the shared parsed context;
  - `@briansunter/nib/testing` provides standards-based semantic comparison;
  - `.nib/images.json` records deterministic, non-sensitive image provenance.
- **Sequence:**
  1. Index publication routes and files once.
  2. Parse HTML with a standards-based server-only parser.
  3. Validate local `href`, `src`, `srcset`, `poster`, stylesheet, and script
     references.
  4. Aggregate stable issue codes instead of failing on the first error.
  5. Make `nib inspect --json` distinct from `nib check`.
  6. Add read-only extension checks with checker ownership in diagnostics.
  7. Add semantic comparison helpers with explicit versioned normalizers.
  8. Add image-use provenance and verify candidate existence, formats,
     dimensions, caps, and leaked authoring hints.
  9. Migrate the replica's generic checker logic while keeping personal policy
     in its configuration.
- **Focused validation:** Corrupted multi-issue fixture, malformed HTML,
  entities, repeated metadata, hidden content, base paths, trailing slashes,
  output containment, missing image candidates, and unknown report versions.
- **Complete validation:** Root suite and complete 493-page replica comparison.
- **Acceptance:**
  - one corrupted fixture reports every injected issue in one run;
  - no extension rereads the manifest or reparses a page;
  - the 822-line content checker shrinks below 250 lines of adapters and site
    policy;
  - all existing canonical-page and metadata comparisons remain exact;
  - same-machine warm inspection is at least three times faster than the
    recorded approximately 2.52-second `nib check` median;
  - reports contain no absolute source paths or secrets.
- **Commit boundary:** Inspector core, extension API, testing helpers, image
  provenance, and replica adoption should be separate reviewable commits.
- **Rollback:** Each adoption commit can return to the existing checker without
  reverting the additive inspection model.
- **Approval boundary:** Site-specific checks remain project-owned. Adding a
  dependency to the universal/browser package entry is prohibited.

## Batch 7: Decision-gated optional client navigation

- **Purpose:** Reuse the lifecycle runtime for sites that explicitly choose
  document swapping, history management, and view transitions.
- **Current constraint:** Client-side routing is a documented Nib non-goal.
  This batch cannot begin until an ADR changes that statement for an optional
  package or plugin.
- **Non-goals:** Do not enable navigation by default or require JavaScript for
  links.
- **Owned areas:** A first-party optional package/plugin, lifecycle events,
  browser fixtures, and replica router adoption. Core route rendering remains
  unchanged.
- **Interface:** An opt-in `clientNavigation()` plugin owns fetching,
  cancellation, head/body/style/script synchronization, history, prefetching,
  focus, scroll, persistence, lifecycle events, and runtime remounting.
- **Sequence:**
  1. Approve an ADR defining why an optional navigation package no longer
     violates the core non-goal.
  2. Extract only behavior proven by the replica; do not emulate Astro event
     names as the public API.
  3. Use typed `nib:*` lifecycle events and the Batch 2 runtime directly.
  4. Preserve hard-navigation fallback for unsupported documents and failures.
  5. Migrate the replica only after the package passes independent fixtures.
- **Focused validation:** Abort races, redirects, base paths, head/style/script
  order, static/island transitions, back/forward, scroll/focus restoration,
  persistence, view-transition fallback, and failed fetch fallback.
- **Complete validation:** Root and package suites plus the full replica browser
  interaction matrix.
- **Acceptance:**
  - interactive → static → interactive navigation mounts and unmounts exactly
    once;
  - pending work never targets detached DOM;
  - listeners and React roots do not accumulate;
  - persisted elements retain intended state;
  - disabling the plugin restores ordinary browser navigation and leaves
    default generated output unchanged.
- **Commit boundary:** Package introduction and replica adoption are separate
  commits.
- **Rollback:** Remove the optional plugin from site config to return to native
  navigation; no content migration is required.
- **Approval boundary:** Explicit product/API approval is required before this
  batch. Publishing or releasing it requires a separate release request.

## Complete validation gate

Run the following on the exact final revision after every batch that changes
public framework behavior:

```bash
bun run typecheck
bun run test
bun run build
bun run check:version-policy

cd examples/personal-site-replica
bun run verify

cd /Volumes/Storage/code/nib
git diff --check
```

Also require:

- packed-consumer tests for every new public subpath;
- bundle inspection proving Node code is absent from client artifacts;
- static-route inspection proving no unused runtime is shipped;
- browser checks for hydration, cleanup, navigation, focus, and scroll whenever
  the changed batch affects those behaviors;
- exact local commit SHA and a clean worktree before any push or release;
- separate authorization for push, pull request, merge, version change,
  publication, or deployment.

## Documentation gate

Each public API batch must update:

- `README.md`;
- `docs/architecture.md`;
- `docs/interactive-react-islands.md` when runtime behavior changes;
- the relevant page under `examples/docs/src/pages/docs/`;
- package export and consumer examples;
- the changelog or release metadata only when a release is separately
  authorized.

Documentation must clearly distinguish:

- universal, server-only, and client-only imports;
- SSR islands from client behaviors;
- static output inspection from browser/runtime proof;
- default framework behavior from opt-in packages;
- current APIs from proposals and decision-gated backlog.

## Progress tracking

This file is the dependency and acceptance authority. When implementation
begins, create `STATUS.md` containing only mutable state:

- active batch and branch/worktree;
- exact baseline and current SHA;
- completed focused and complete gates;
- remaining work and known failures;
- current pause or approval boundary.

Do not rewrite completed historical evidence in this plan to report progress.
Update `STATUS.md` instead.
