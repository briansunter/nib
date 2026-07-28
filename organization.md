# Nib repository organization evaluation and improvement plan

Status: implemented with simplified scope

Implemented: 2026-07-28

Audit date: 2026-07-28

Baseline: `master` at `aec333c` (`v0.15.0`, `nib-images-v0.5.0`)

Scope: repository structure, source layout, internal plugin architecture,
package boundaries, tests, build metadata, documentation, and generated
artifacts.

## Implementation outcome

The reorganization was implemented as a compatibility-preserving internal
refactor. The result deliberately keeps the repository small:

- the existing two npm packages and every public import specifier remain;
- package entries now have one checked source/output/declaration manifest;
- navigation, build, inspection, extension hosting, integrations, content
  sources, and image content processing have feature directories;
- public and long-lived internal paths use thin facades, so consumers and
  contributors are not forced through a big-bang rename;
- navigation and image HTML processing were split only at cohesive behavior
  seams; no empty layers or generic framework abstractions were added;
- mutable fixture tests run from temporary copies;
- documentation is classified as reference, decisions, design, or history;
- both packages explicitly record the current `UNLICENSED` policy.

The phased plan below is retained as the decision record and verification
checklist for the work.

### Simplicity decisions

The implementation intentionally stops short of mirroring every suggested
directory in the illustrative target tree:

- build and inspection each keep one readable lifecycle module plus extracted
  contracts/helpers, instead of six small orchestration files;
- existing test filenames stay stable; architecture guards and hermetic
  fixtures were added, but suites were not mass-moved for cosmetic symmetry;
- image processing gained a content directory and a reusable exact-source HTML
  parser, while transform, catalog, cache, and executor files remain at the
  package root because they are already cohesive;
- compatibility facades remain where tests and internal consumers use the old
  path. They can disappear only during a future breaking or explicitly scoped
  cleanup.

These choices satisfy the dependency and ownership goals without making
contributors traverse extra one-function modules.

## Executive assessment

Nib's architecture is good, but its physical organization is no longer
optimal for its current size.

The important external boundaries are already correct:

- `@briansunter/nib` is the static-first framework package.
- `@briansunter/nib-images` is independently versioned and keeps Sharp out of
  the core package and browser bundles.
- universal, browser, server, plugin, testing, verification, and internal
  server entry points are deliberately separated.
- plugin route snapshots are immutable, collection access is capability-based,
  and Vite contributions are created separately for each graph.
- examples and fixtures exercise the framework as consumers rather than
  duplicating framework machinery.

Those boundaries should be preserved. Nib does **not** need a larger monorepo,
more npm packages, or a more general plugin API.

The main problem is internal discoverability. Forty-four implementation files
share a flat `src/framework/` directory, several files have become subsystem
containers, and public entry-point metadata is repeated across package,
bundler, and declaration configuration. A contributor can understand the
design from the documentation, but cannot infer the same design quickly from
the tree.

The recommended direction is:

1. add architecture guardrails and fix small hygiene gaps;
2. split the navigation subsystem, the clearest current hotspot;
3. divide framework internals by existing responsibilities, without changing
   behavior or public imports;
4. separate plugin contracts from plugin execution;
5. reorganize tests and historical documentation gradually;
6. leave optional package boundaries and the plugin hook model intact.

## Summary verdict

| Area | Assessment | Recommended action |
| --- | --- | --- |
| npm package boundaries | Strong and appropriately minimal | Keep the root package and `packages/nib-images`; do not create packages for routing, Markdown, RSS, sitemap, or navigation |
| Public execution-target boundaries | Strong | Preserve all current import specifiers; make source paths mirror them more clearly |
| Plugin API | Strong, small, and appropriately constrained | Keep the public lifecycle; split contracts, validation, and host execution internally |
| Framework source tree | Functional but too flat | Add feature-oriented subdirectories and small compatibility facades |
| Build orchestration | Correct but concentrated | Split `site.ts` along its existing build, publication, dev, and preview seams |
| Browser navigation | Over-concentrated | Split the controller before adding more behavior |
| Image package | Correct package boundary; growing internals | Keep separate; split content rewriting only when that code is next changed |
| Tests | Broad and boundary-aware | Add architecture contract tests, isolate all mutable fixtures, and split the largest suites |
| Documentation | Rich but mixed in purpose | Separate reference, decisions, design proposals, and completed project history |
| Generated/local artifacts | Mostly ignored, ownership not fully explicit | Ignore `.nib/` in the starter and document where framework, site, cache, and pack artifacts belong |

## Current repository shape

The audited tree has 268 tracked files. The core `src/` tree has 68 TypeScript
files, including 44 under `src/framework/`. The root test directory has 46
top-level TypeScript suites, and `packages/nib-images/src` has 18 TypeScript
files.

The present high-level structure is:

```text
.
├── src/
│   ├── *.ts                     public facades, built-in integrations, CLI,
│   │                            and some large implementations
│   ├── framework/               44 flat framework implementation files
│   ├── navigation/              history, cache, and navigation types
│   └── runtime/                 browser runtimes and private server bridge
├── packages/
│   └── nib-images/              separately released optional package
├── tests/                       flat suites plus consumer fixtures
├── examples/
│   ├── docs/                    documentation app and Pages deployment
│   └── blog/                    full-featured integration example
├── templates/default/           `nib init` source
├── docs/                        architecture, ADRs, and design documents
├── skills/nib/                  packaged Codex skill
├── scripts/                     release and benchmark helpers
└── dist/                        ignored framework/site/package artifacts
```

This is a sensible small-project layout that has accumulated enough features
to need a second level of internal organization.

## What should remain unchanged

### Keep the two-package boundary

`packages/nib-images` is a justified package because it has all of the reasons
for a real package boundary:

- a heavy, optional Sharp dependency;
- separate public authoring and plugin entry points;
- separate versioning and release state;
- a peer contract with Nib;
- static-only behavior that must be kept out of client graphs.

RSS, sitemap, metadata, search, navigation, Markdown media, routing, and
hosting do not currently meet the same threshold. They are small first-party
capabilities with no comparable dependency or release need. Moving each into a
package would increase manifests, release configuration, build steps, and
compatibility surfaces without improving isolation.

### Keep the current plugin lifecycle

The `NibPlugin` contract in `src/framework/plugin.ts` is deliberately compact:

- declarative `pageSources`;
- declarative, server-safe `clientEntries`;
- graph-specific `vite()` contributions;
- ordered `routes()` contributions;
- a build-scoped `renderer()` extension with `head`, `wrapPage`, and
  `finalize`.

This is enough for the current integrations. It gives plugins extension points
without handing them mutable configuration, route internals, island metadata,
or arbitrary output ownership.

The fact that `finalize` is returned by `renderer()` is not worth a breaking
API change by itself. It lets one build-scoped extension share state between
page wrapping and finalization, which the image package uses correctly. The
internal host can be renamed and reorganized without changing this public
shape.

### Keep examples as repository consumers

`examples/docs` and `examples/blog` have distinct, useful roles:

- docs is the deployed reference site;
- blog is the feature-rich integration consumer.

They do not need independent package manifests or workspace identities merely
for symmetry. Their roles should be documented, and their verification should
remain explicit in root scripts.

### Keep tests outside published source

The current repository-level test placement is appropriate for package,
build, dev-server, fixture, and packed-consumer tests. The improvement should
be organization by test intent, not wholesale co-location beside source.

## Detailed findings

### 1. `src/framework` is now a catch-all

The directory contains configuration validation, content compilation,
Markdown, routing, metadata, React rendering, plugin hosting, Vite adapters,
build orchestration, publication, hosting, inspection, verification, testing
helpers, and client-adjacent primitives.

Several files show the resulting concentration:

| File | Lines at audit | Responsibilities |
| --- | ---: | --- |
| `src/framework/verify.ts` | 829 | file indexing, publication parsing, image provenance, HTML inspection, references, extensions, issue reporting, and verification |
| `src/framework/site.ts` | 662 | Vite graphs, HTML template, staged builds, publication, dev server, and preview server |
| `src/framework/content.ts` | 427 | authoring definitions, validators, page-source discovery, generated modules, and data-page compilation |
| `src/framework/types.ts` | 403 | content, config, authoring, route, render, and internal runtime contracts |
| `src/framework/project-renderer.ts` | 332 | collections, route assembly, plugin route execution, page composition, rendering, and finalization |
| `src/framework/plugin.ts` | 322 | public contracts, validation, errors, Vite flattening, renderer pipeline, route snapshots, and route-provider execution |
| `src/framework/router.ts` | 314 | file, generated, redirect, and plugin route assembly and lookup |
| `src/framework/publication.ts` | 307 | URL policy, artifact mapping, redirects, and publication manifests |

The issue is not that these modules are necessarily incorrect. It is that
directory locality no longer helps a reader find the correct module or see the
allowed dependency direction.

### 2. Navigation is the clearest immediate hotspot

`src/client-navigation.ts` is 1,344 lines. It currently owns:

- link and form eligibility;
- prefetch policy;
- fetched page/cache coordination;
- head, stylesheet, and script synchronization;
- persisted DOM elements;
- focus, live-region, hash, and scroll behavior;
- history state;
- View Transitions;
- lifecycle events;
- controller ownership and startup.

Some primitives have already moved to `src/navigation/history.ts`,
`page-cache.ts`, and `types.ts`, but most behavior remains in one controller
module. Its test suite, `tests/client-navigation.test.ts`, is correspondingly
1,065 lines.

This should be the first structural extraction because the responsibilities
and test seams already exist. The goal is not to create tiny files; it is to
make document synchronization, persistence/accessibility, link policy, and
controller lifecycle independently reviewable.

### 3. Public entry points do not map cleanly to source paths

The package has a good public subpath design, but its representation is spread
across:

1. `package.json#exports`;
2. the `entries` map in `vite.framework.config.ts`;
3. TypeScript declaration output from `tsconfig.build.json`;
4. facade files such as `src/client-islands.ts`;
5. special output aliases such as `client/islands` and `internal/server`.

For example:

- `@briansunter/nib/client/islands` uses
  `src/client-islands.ts`, emits JavaScript to
  `dist/framework/client/islands.js`, and currently points types at
  `dist/framework/client-islands.d.ts`;
- `@briansunter/nib/internal/server` uses
  `src/runtime/server.ts`, emits JavaScript to
  `dist/framework/internal/server.js`, and points types at
  `dist/framework/runtime/server.d.ts`;
- the image package's declaration build maps
  `@briansunter/nib/plugin` directly to
  `dist/framework/framework/plugin.d.ts`, exposing the core's internal
  declaration topology.

These mappings work today, but they are easy to desynchronize. The repository
needs a checked entry-point manifest and source facades that mirror public
subpaths.

### 4. Foundational types and plugin contracts depend on each other

`src/framework/types.ts` imports `NibPlugin`, `NibVitePluginContext`, and
`Awaitable` from `plugin.ts`, while `plugin.ts` imports route, site, head,
content, and validator contracts from `types.ts`.

A static relative-import scan found one strongly connected component spanning
these contracts and their type-only downstream references. The cycle is
currently broken at runtime by `import type`, so this is not a demonstrated
runtime defect. It is nevertheless the reverse of the desired architectural
direction: foundational domain contracts should not depend on their plugin
consumer.

The fix is to split contracts by ownership:

- domain and authoring contracts;
- content contracts;
- plugin contracts;
- composed configuration contracts;
- internal resolved/rendered contracts.

Plugin contracts may depend on foundational domain/content contracts. Nib
configuration may compose plugin and content contracts. Foundational
contracts should not import plugin hosting code.

### 5. Three different things are called “plugin”

The code uses the word for:

- a Nib lifecycle plugin (`NibPlugin`);
- app-owned raw Vite contributions (`NibConfig.vite`);
- framework-owned Vite adapters (`nibProject`, Markdown/data-page adapters,
  island adapters, and boundary guards).

The distinctions are valid, but filenames such as `plugin.ts`,
`vite-plugin.ts`, and `project-vite-plugin.ts` do not reveal which layer they
belong to.

Use role-oriented names internally:

- `extensions/contracts.ts` and `extensions/host.ts`;
- `vite/project-entry.ts`;
- `vite/content-adapters.ts`;
- `vite/island-entry.ts`;
- `vite/target-boundary.ts`;
- `vite/style-ownership.ts`.

Public names and `nib.config.ts` syntax should remain unchanged.

### 6. First-party integration implementations are mixed with public facades

Root `src/` currently contains both thin public facades and implementations:

- `src/plugin.ts`, `server.ts`, `testing.ts`, and `client*.ts` are facades;
- `src/rss.ts`, `sitemap.ts`, `metadata.ts`, `search.ts`, and
  `navigation.ts` contain first-party integration implementations;
- Markdown media is implemented under `src/framework/markdown-media.ts`.

Move implementation into `src/integrations/` and retain thin root entry files
for every existing public import. This makes package entry points obvious and
keeps built-in extensions together without turning them into separate
packages.

### 7. Page-source aggregation is correctly implemented but poorly located

`configuredPageSources()` in
`src/framework/plugin-contributions.ts` combines:

- direct `config.pageSources`;
- plugin-provided page sources;
- page sources referenced by configured collections.

Deduplication by object identity is intentional. The behavior is content
configuration resolution, not only a plugin contribution. Move it to
`framework/content/page-sources.ts`, name the internal operation
`resolveConfiguredPageSources`, and retain a temporary internal re-export
during migration.

### 8. Boundary enforcement is strong but should share one suffix policy

The project already has valuable executable boundaries:

- `target-boundary.ts` rejects `.client.*` imports in server graphs and
  `.server.*` imports in client graphs, with an import-chain diagnostic;
- `style-ownership.ts` rejects server-visible CSS that no client entry owns.

Their filename policies differ:

- the target boundary accepts broader JavaScript and TypeScript suffixes;
- stylesheet ownership recognizes only `.client.ts` and `.client.tsx`;
- the ADR names `.client.ts(x)` and `.server.ts(x)`.

Define the supported suffixes once and reuse the same classifier in both
guards. Either support the wider JavaScript set consistently or reject it
consistently.

### 9. Some integration tests mutate checked-in fixtures

Most tests already use temporary directories, but two important suites still
write below tracked fixtures:

- `tests/site-build.test.ts` builds into
  `tests/fixtures/basic-site/dist` and creates/removes public collision files;
- `tests/image-site.test.ts` builds and caches below
  `tests/fixtures/image-site`.

Cleanup in `afterAll` is not enough for interrupted, retried, focused, or
parallel runs. Add a shared `copyFixture()` helper that creates a per-suite or
per-test temporary project. Checked-in fixture trees should be read-only
inputs.

### 10. Tests are broad, but their physical grouping no longer communicates intent

The flat root includes:

- focused unit tests;
- type-only contract tests;
- Vite adapter tests;
- full build/dev/preview integration tests;
- packed-package consumer tests;
- example/documentation tests;
- fixtures.

The largest suites mirror the largest implementation containers:

- `tests/client-navigation.test.ts` is 1,065 lines;
- `packages/nib-images/tests/image-component.test.tsx` is 1,007 lines.

Split tests as their source seams are extracted. Do not perform a standalone
mass rename. A gradual target is:

```text
tests/
├── architecture/
├── unit/
│   ├── content/
│   ├── extensions/
│   ├── navigation/
│   ├── rendering/
│   └── routing/
├── integration/
│   ├── build/
│   ├── dev/
│   ├── examples/
│   └── package/
├── types/
├── helpers/
└── fixtures/
```

### 11. Documentation mixes current reference, decisions, proposals, and history

The repository has strong architecture documentation, but readers must infer
document status from content:

- `PLAN.md` is a large completed implementation plan;
- `STATUS.md` records old baselines and completed batches rather than current
  repository status;
- the accepted navigation ADR still says “Proposed decision,” includes
  “Required validation before acceptance,” and says implementation remains
  separate;
- the accepted client-behavior ADR still says Nib “will support” the feature;
- `docs/` mixes implemented architecture, accepted ADRs, and forward-looking
  proposals;
- the complete `docs/` and `skills/` directories are included in the npm
  package.

Use explicit document classes:

```text
docs/
├── reference/       current implementation and user-facing architecture
├── decisions/       accepted ADRs
├── design/          proposed or exploratory designs
└── history/         completed plans and historical status snapshots
```

Every decision/design document should have `Status`, `Last reviewed`, and
links to the implementation or tests that now prove it. Decide deliberately
which document classes belong in the published npm package.

### 12. Local artifact ownership needs one policy

The root `dist/` is currently an ignored catch-all that may contain:

- framework library output;
- client/server output when the repository root is used as a site;
- local pack artifacts under `dist/package`;
- intermediate server bundles.

Consumer sites also generate `.nib/` cache/state. The blog example ignores
`.nib/`, but `templates/default/gitignore` does not, so a newly initialized
site can expose image cache files to version control after enabling images.

Adopt and document these locations:

- `dist/framework/`: root package build output;
- `<site>/dist/`: site output;
- `<site>/.nib/`: ignored framework/plugin cache and transient state;
- a temporary directory or ignored `.artifacts/`: manually retained package
  archives and benchmark artifacts.

Add `.nib/` to the starter template's generated ignore file and cover it in
`tests/scaffold.test.ts`.

### 13. Package licensing is unspecified

There is no tracked license file and neither package manifest declares a
license. This may be intentional, but a public npm package should make that
choice explicit. Decide whether the project is proprietary or licensed; then
add the matching manifest metadata and file if appropriate. Do not guess a
license during mechanical reorganization.

## Target dependency direction

The target is a layered internal tree, not more public packages:

```text
foundational contracts
        ↓
content / routing / rendering / runtime primitives
        ↓
extension contracts and first-party integrations
        ↓
configuration composition and Vite adapters
        ↓
build / dev / preview / inspection orchestration
        ↓
thin package entry points and CLI
```

Rules:

1. Foundational contracts import no plugin host, Vite adapter, build
   orchestrator, or Node-only implementation.
2. Universal entry points import no Node-only or browser-only module.
3. Browser entry points import no Node built-ins.
4. Server and build layers may depend on universal contracts and framework
   features.
5. Optional packages depend only on published Nib entry points, never
   `src/framework/*` or declaration files that expose that topology.
6. Integrations use the same public plugin contracts available to third-party
   packages unless a capability is explicitly first-party/internal.
7. Vite graph instances share contracts or serialized/generated modules, not
   mutable plugin-instance memory.
8. Public package specifiers and runtime-free-by-default behavior do not change
   during reorganization.

## Recommended target tree

This is a destination map. It should be reached in small, behavior-preserving
commits.

```text
.
├── src/
│   ├── index.ts                       # thin public package entry
│   ├── cli.ts                         # thin executable build entry
│   ├── plugin.ts                      # thin public plugin entry
│   ├── rss.ts                         # thin public integration entry
│   ├── sitemap.ts                     # thin public integration entry
│   ├── navigation.ts                  # thin public plugin entry
│   ├── server.ts                      # thin public server entry
│   ├── client.ts                      # thin public aggregate client entry
│   ├── hosting.ts                     # thin public hosting entry
│   ├── testing.ts                     # thin public testing entry
│   ├── verify.ts                      # thin public inspection entry
│   ├── client/
│   │   ├── islands.ts                 # mirrors /client/islands
│   │   ├── behaviors.ts               # mirrors /client/behaviors
│   │   └── navigation.ts              # mirrors /client/navigation
│   ├── internal/
│   │   └── server.ts                  # mirrors /internal/server
│   ├── framework/
│   │   ├── contracts/
│   │   │   ├── authoring.ts
│   │   │   ├── content.ts
│   │   │   ├── routes.ts
│   │   │   └── render.ts
│   │   ├── config/
│   │   ├── content/
│   │   ├── extensions/
│   │   │   ├── contracts.ts
│   │   │   ├── host.ts
│   │   │   └── contributions.ts
│   │   ├── routing/
│   │   ├── rendering/
│   │   ├── vite/
│   │   ├── build/
│   │   ├── inspection/
│   │   └── hosting/
│   ├── integrations/
│   │   ├── markdown-media.ts
│   │   ├── metadata.ts
│   │   ├── navigation.ts
│   │   ├── rss.ts
│   │   ├── search.ts
│   │   └── sitemap.ts
│   ├── runtime/
│   │   ├── behaviors.ts
│   │   ├── coordinator.ts
│   │   └── islands.ts
│   └── navigation/
│       ├── controller.ts
│       ├── document-sync.ts
│       ├── persistence.ts
│       ├── accessibility.ts
│       ├── link-policy.ts
│       ├── history.ts
│       ├── page-cache.ts
│       └── types.ts
├── packages/
│   └── nib-images/
│       └── src/
│           ├── index.ts                # public component/types
│           ├── plugin.ts               # public plugin entry
│           ├── source/
│           ├── transform/
│           ├── content/
│           └── cache/
├── tests/
│   ├── architecture/
│   ├── unit/
│   ├── integration/
│   ├── types/
│   ├── helpers/
│   └── fixtures/
├── examples/
│   ├── docs/
│   └── blog/
├── templates/default/
├── docs/
│   ├── reference/
│   ├── decisions/
│   ├── design/
│   └── history/
├── skills/nib/
├── scripts/
└── .artifacts/                         # optional and ignored
```

Not every directory must be created immediately. Create a directory only when
at least two cohesive modules have a reason to live there.

## Phased improvement plan

### Phase 0: Protect the current architecture

Goal: make structural refactoring safe before moving implementation.

Changes:

1. Add a checked package-entry manifest or an architecture test that verifies:
   - every `package.json` code export has one Vite build entry;
   - every Vite library entry is exported or explicitly internal;
   - every export's JavaScript and declaration target exists after build;
   - the packed package resolves every supported public specifier;
   - root and image-package entry maps remain independent.
2. Add a lightweight import-boundary check:
   - foundational contracts cannot import plugin/build hosts;
   - browser entries cannot import Node built-ins;
   - universal entries cannot import browser-only or server-only modules;
   - no new runtime cycles are introduced.
3. Extract a shared client/server filename classifier and use it in both
   target-boundary and style-ownership guards.
4. Add `.nib/` to `templates/default/gitignore` and assert it in the scaffold
   test.
5. Add one shared temporary fixture helper and convert
   `site-build.test.ts` and `image-site.test.ts`.
6. Record the artifact policy in contributor-facing documentation.

Acceptance:

- all existing public import specifiers remain identical;
- `bun run verify` and `bun run check:version-policy` pass;
- packed-consumer tests resolve every exported subpath;
- no test writes below a checked-in fixture;
- interrupted tests cannot leave tracked or untracked fixture artifacts.

### Phase 1: Modularize client navigation

Goal: reduce the highest-concentration browser module without changing its
public controller or fallback behavior.

Suggested extraction order:

1. move the public browser facade to `src/client/navigation.ts`;
2. extract link/form eligibility and prefetch annotations;
3. extract head/style/script comparison and synchronization;
4. extract persisted-element indexing/restoration;
5. extract accessibility announcements, hash focus, and scroll helpers;
6. leave lifecycle orchestration in `navigation/controller.ts`;
7. retain current `history.ts`, `page-cache.ts`, and `types.ts`;
8. split the test suite along the same responsibilities.

Acceptance:

- `@briansunter/nib/client/navigation` and
  `@briansunter/nib/navigation` are unchanged;
- disabled navigation still ships no navigation runtime;
- all abort, fallback, history, persistence, focus, script, style, and View
  Transition tests pass;
- a live docs/blog smoke test covers static → island/behavior → static
  navigation and back/forward traversal;
- emitted client chunks do not add new unconditional dependencies.

### Phase 2: Split framework orchestration along existing seams

Goal: make framework lifecycle code navigable while preserving the
implementation model.

Split `site.ts` into:

- Vite graph configuration;
- manifest-to-HTML template construction;
- publication rendering/writing;
- staged build promotion;
- development server;
- preview server.

Keep a small `site.ts` facade until all internal imports have migrated.

Split `verify.ts` into:

- filesystem and publication indexing;
- image provenance inspection;
- parsed document facts;
- local reference resolution;
- extension execution;
- issue ordering and report formatting.

Move `configuredPageSources` into the content area during this phase.

Acceptance:

- build output and publication manifests are byte-equivalent where ordering is
  part of the contract;
- dev, build, preview, trailing-slash, base-path, and hosting tests pass;
- `nib inspect` and `nib check` report the same issue codes and deterministic
  order;
- no public exports change.

### Phase 3: Clarify contracts and plugin hosting

Goal: establish a one-way dependency graph without expanding the plugin API.

Changes:

1. split `types.ts` into foundational domain/content/authoring contracts and
   internal resolved/render contracts;
2. move `NibPlugin` interfaces to `extensions/contracts.ts`;
3. move validation, error attribution, Vite flattening, route-provider
   execution, and renderer-pipeline execution to `extensions/host.ts`;
4. make composed `NibConfig` depend on content and plugin contracts;
5. remove the `types.ts` ↔ `plugin.ts` type cycle;
6. keep `src/plugin.ts` as the unchanged public facade;
7. make `packages/nib-images` resolve only the public plugin declaration
   entry, not `dist/framework/framework/plugin.d.ts`.

Acceptance:

- there is no strongly connected component across foundational contracts and
  the plugin host;
- plugin order, error attribution, route collisions, immutable snapshots,
  capability reads, renderer ownership, and finalization tests are unchanged;
- third-party plugin source compatibility is preserved.

### Phase 4: Group first-party integrations and align entry paths

Goal: make root source files visibly correspond to package entry points.

Changes:

1. move implementations for metadata, RSS, sitemap, search, client-navigation
   plugin setup, and Markdown media into `src/integrations/`;
2. keep thin root facades for all current package imports;
3. place browser facades under `src/client/` and the private bridge under
   `src/internal/server.ts`;
4. create one checked entry manifest used by the Vite config and export
   contract test;
5. align declaration output paths with JavaScript subpaths where practical.

Acceptance:

- the packed package has the same public specifiers and behavior;
- source paths, JavaScript output paths, and declaration paths have an
  explainable one-to-one mapping;
- first-party integrations continue to use public plugin contracts where
  possible.

### Phase 5: Refine the image package when next modified

Goal: improve the optional package internally without disturbing its correct
external boundary.

Changes:

1. split `content-images.ts` into HTML parsing, source authorization/copying,
   rewrite planning/application, and failed-transform restoration;
2. split the 1,007-line image test suite by component, development adapter,
   cache, content rewriting, and boundary behavior;
3. group source/catalog, transform/executor, cache, and content modules only as
   those seams are touched;
4. preserve `src/index.ts` and `src/plugin.ts` as the two package entry points.

Acceptance:

- Sharp remains absent from the Nib root package and browser bundles;
- cache keys, HMR, source containment, fallback restoration, responsive
  candidates, and publication-based rewriting remain identical;
- root and image package releases remain independently detectable.

### Phase 6: Normalize documentation and historical state

Goal: make current truth and historical planning immediately distinguishable.

Changes:

1. move implemented architecture into `docs/reference/`;
2. move accepted and proposed ADRs into `docs/decisions/`, updating their
   wording and implementation links;
3. move exploratory proposals into `docs/design/`;
4. archive the completed `PLAN.md` and historical `STATUS.md` under
   `docs/history/`, replacing root files only if an active plan/status is
   needed;
5. add status metadata and “last reviewed” dates;
6. decide which document classes and skill assets should ship in the npm
   package;
7. resolve and record the project license decision.

Acceptance:

- no accepted ADR still describes shipped work as merely proposed;
- all internal documentation links and docs-site tests pass;
- npm pack contents are intentional and reviewed;
- README points users to current reference material before historical design
  rationale.

## Recommended execution priority

| Priority | Work | Reason |
| --- | --- | --- |
| Now | entry-point contract test, `.nib/` starter ignore, shared fixture helper, suffix-policy alignment | Small changes that prevent release and repository hygiene failures |
| Next | navigation implementation and test split | Largest single maintenance hotspot and a public browser behavior surface |
| Next | `site.ts` and `verify.ts` extraction | High fan-out orchestration modules with clear existing seams |
| Then | contract/plugin-host split and type-cycle removal | Improves dependency direction after behavior is protected |
| Then | first-party integration grouping and source/output alignment | Mostly mechanical once entry contracts exist |
| When touched | image content-processing split | Valuable, but the package boundary is already correct |
| Last | broad docs/test moves | Useful discoverability work with high rename/link churn and low runtime risk |

## Migration rules

Every reorganization change should follow these constraints:

1. One responsibility move per commit; avoid a repository-wide rename.
2. Preserve public package specifiers and exported names.
3. Use compatibility facades and re-exports during internal moves.
4. Do not combine a file move with behavior changes unless the behavior change
   is independently tested.
5. Keep generated virtual-module strings and their public imports stable until
   entry-point contract tests exist.
6. Verify packed-package behavior, not only source-tree imports.
7. Keep static pages complete and runtime-free unless a feature is explicitly
   enabled.
8. Keep Sharp and image build state inside the optional image package.
9. Keep route, island, behavior, stylesheet, base-path, and output-containment
   validation fail-closed.
10. Preserve unrelated work and avoid release/publication changes during pure
    organization batches.

## Explicit non-goals

- no migration to a large monorepo tool;
- no package per built-in integration;
- no new generic lifecycle hooks;
- no default client navigation;
- no merger of islands and behaviors;
- no renderer ownership of island or hydration metadata;
- no Sharp dependency in core;
- no arbitrary plugin configuration mutation;
- no forced conversion of examples into workspaces;
- no big-bang source or test rename;
- no public API rename solely to make internal filenames prettier.

## Completion criteria

The organization effort is complete when:

- the repository tree communicates the documented dependency direction;
- public entry points have a checked mapping from source to JavaScript,
  declarations, package exports, and packed-package resolution;
- foundational contracts have no dependency on the plugin host;
- the navigation controller, site orchestrator, verifier, and image content
  processor each have cohesive, independently testable modules;
- first-party integration implementations are grouped behind stable facades;
- tests do not mutate checked-in fixtures;
- current reference, accepted decisions, proposals, and history are visibly
  distinct;
- starter projects ignore all Nib-generated cache/state;
- the full `bun run verify`, version-policy, package-consumer, and relevant live
  browser checks pass after every phase;
- there is no increase in default client runtime or core optional dependencies.

## Final recommendation

Proceed with the reorganization, but treat it as a series of guarded internal
refactors rather than an architectural rewrite.

The package split and plugin model are already close to optimal. The highest
return comes from making the code tree express those existing decisions:
checked entry points, one-way contracts, feature-oriented framework folders,
smaller navigation/build/inspection modules, hermetic fixtures, and clearly
classified documentation.
