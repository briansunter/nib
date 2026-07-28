# Personal-site-driven framework review

Date: 2026-07-28

Scope: `@briansunter/nib`, `@briansunter/nib-images`, and the real
`personal-site-nib` consumer.

This review started from the consumer and worked back toward the framework.
That order matters: a framework abstraction should remove repeated application
machinery without absorbing one site's content model, CSS vocabulary, or
provider choices.

## Executive assessment

Nib's main architecture is sound:

- routes and content are discovered at build time;
- React renders complete static HTML;
- browser code enters only through explicit islands, behaviors, or the
  optional navigation integration;
- page sources and collections keep validation at the content boundary;
- renderer plugins extend head and tree output without taking over rendering;
- finalizers operate against an exact publication manifest;
- Sharp remains outside the core package in `@briansunter/nib-images`.

The personal site does not justify a larger framework. It validates the current
small seams and reveals places where their contracts needed to be stricter.
The best improvements are correctness checks, removal of duplicate facades,
clearer documentation, and smaller application-owned feature modules.

The framework should not gain a generic recipe, gallery, map, Pagefind,
newsletter, analytics, or CMS layer. Those systems have application-specific
data and lifecycle policy. Promote one only after a second independent consumer
proves a common contract.

## Architecture map

```text
application authoring
  nib.config.ts
  pages + layouts + shell
  data files + page sources + collections
  optional islands and behaviors
            |
            v
project adapter
  virtual route/content/client modules
  target and stylesheet ownership guards
            |
            v
renderer
  route registry -> page/layout/shell composition
  ordered renderer extensions -> head/tree
            |
            v
transactional build
  Vite client + server graphs
  prerendered pages/resources/redirects
  finalizers + hosting companions
  publication swap into dist/client
            |
            v
optional browser capabilities
  islands | behaviors | enhanced navigation
```

The layers have distinct ownership:

- Authoring APIs describe content and rendering intent.
- The project adapter translates files and configured sources into build
  modules.
- The renderer owns route identity, validation, composition, and metadata.
- The build owns output artifacts and the transactional publication boundary.
- Client runtimes own only explicitly marked browser behavior.

Keeping these responsibilities separate is more valuable than reducing the raw
file count. Large orchestration modules should be split only when the result
creates a stable responsibility, not merely to move lines elsewhere.

## Consumer findings that belong in Nib

### Content contracts

Generated page sources exposed three edge cases:

1. An empty generated data set is valid and should produce no routes.
2. Draft generated pages must also be absent from collections derived with
   `fromPageSource()`, otherwise feeds and indexes can leak unpublished data.
3. `collectionId` is a public string identity and must reject empty or
   non-string runtime values.

Filesystem collection loaders also need to check the resolved real path, not
only the authored path. Otherwise a symlink below the configured collection
root can escape that root.

### Runtime contracts

Generated client entries register islands before behaviors. Teardown must
therefore run in reverse registration order so a behavior can clean up while
the React-owned subtree it enhanced still exists.

Island SSR is synchronous. The authoring type now says so explicitly rather
than accepting an async component that the renderer cannot execute.

### Navigation contracts

Enhanced navigation must preserve native browser semantics. It now:

- respects the effective target inherited from the first `<base target>`;
- leaves `noreferrer`, `referrerpolicy`, and `ping` links to the browser;
- recognizes standard classic JavaScript MIME types during document swaps;
- ignores non-finite application-owned history indices;
- retains a requested fragment when a redirect crosses origins;
- dispatches `hashchange` when a same-document link is implemented through
  the History API.

Navigation remains optional but belongs in the core package. It is tightly
coupled to runtime teardown, persistent nodes, generated client entries, and
document synchronization. A separate package would add version-skew risk
without creating a meaningful independent capability.

### Publication and verification

The publication manifest is the shared truth for routes and artifacts. The
inspector now rejects malformed manifest entries rather than trusting optional
fields and verifies that root-absolute references stay under a configured
non-root base.

`siteHref()` is for local absolute route paths. Rejecting relative and external
inputs is safer than silently rewriting them as if they were routes.

RSS stylesheet paths use the same base-aware publication rule as feed links.
RSS, sitemap, and search now share one resource-path validator and reject query
or fragment suffixes consistently.

Unknown hosting adapter names fail explicitly instead of silently generating an
S3-shaped artifact.

### Image rewriting

The optional image finalizer must preserve HTML authored at the use site. Its
content-image rewrite now:

- retains inline styles after generated intrinsic/responsive styles;
- retains valid `fetchpriority="low"` and `"auto"` values as well as `"high"`;
- leaves an image already inside an authored `<picture>` alone instead of
  generating invalid nested `<picture>` elements.

These are framework fixes because the contract applies to any HTML consumer,
even though the personal site's pin cards exposed them.

## Simplifications made in the framework

- Root integration exports now point directly to their implementations instead
  of passing through one-line metadata, search, and Markdown-media facades.
- Three unused source facades that were not package entries were removed.
- RSS and search no longer duplicate collection-capability detection.
- RSS and sitemap no longer duplicate XML escaping.
- Resource-route validation is shared by RSS, sitemap, and search.
- Stylesheet ownership recognizes the actual `*.client.ts(x)` island/behavior
  entries rather than treating every file in those directories as a browser
  entry.
- CLI commands reject missing option values and unknown command options instead
  of falling back to surprising defaults.
- The architecture test follows dynamic imports as well as static imports.
- Root tests no longer rediscover the image package's suite, and watch commands
  identify the build-dependent contract tests explicitly.

These are intentionally small extractions. A generic runtime superclass,
generic page-definition DSL, or generic feature-plugin layer would hide the
domain boundaries and make the system harder to trace.

## What remains application-owned

| Capability | Current boundary | Decision |
| --- | --- | --- |
| Responsive image generation | `@briansunter/nib-images` | Keep optional; Sharp and build caches do not belong in core. |
| Enhanced navigation | Nib subpath/integration | Keep opt-in in core because it coordinates Nib documents and runtimes. |
| Pagefind | Personal-site build finalizer + behavior | Keep app-owned until another consumer needs the same indexing contract. |
| Mermaid and KaTeX | Markdown/build features | Keep app-owned; pages should ship generated output, not general renderers. |
| PhotoSwipe galleries | Personal-site feature | Keep app-owned; first consolidate its markup, history, and cleanup contract. |
| Leaflet travel/pin maps | Personal-site features | Keep app-owned; their data and controls differ materially. |
| Cooklang and unit conversion | Personal-site recipe domain | Keep app-owned; extract a local library before considering publication. |
| Newsletter and analytics | Provider/application policy | Keep app-owned; privacy, endpoints, and consent are not rendering concerns. |
| Hosting provider deployment | Publication-manifest consumer | A provider-specific optional package is justified when it performs real deployment configuration. |

The existing `s3` hosting artifact is a portable manifest, not a complete AWS
S3/CloudFront deployment adapter. Renaming that public adapter is a breaking
change and should wait for a deliberate compatibility plan. A future
provider-specific package can consume `.nib/publication.json` without changing
the renderer.

## Personal-site simplification direction

The consumer should be organized around authoritative data flows:

```text
canonical imported content
        |
        +-- Markdown files -> routes and page-derived collections
        |
        +-- project/recipe/tag JSON -> page sources
                                  -> fromPageSource collections
        |
        +-- app-owned finalizers -> Pagefind and compatibility evidence
```

The three JSON page sources need one small typed local helper for the repeated
parse/map/metadata wiring. That helper belongs in the site because project,
recipe, and tag schemas and URL rules are site policy.

Interactive features should be behaviors when they enhance server-rendered
markup. A React island is useful only when React owns a meaningful stateful
subtree. The recipe filter currently mutates server-rendered cards and is
simpler as a behavior.

Large features should first become cohesive local folders:

- `features/gallery`
- `features/pins`
- `features/travel`
- `features/recipes`
- `features/search`

That move improves ownership without prematurely publishing packages.

Global CSS should contain tokens, reset/base rules, and truly shared
components. Route/vendor CSS should be imported from the behavior or feature
that owns it. Nib deliberately does not infer route-scoped server CSS; explicit
client ownership keeps the deployed graph predictable.

## Follow-up candidates

These are useful but should not be folded into this compatibility-preserving
pass:

1. Rename internal island modules so the site-wide controller and per-island
   hydrator are easier to distinguish.
2. Parse each finalized HTML document once in `nib-images`, then process files
   with bounded concurrency and promise-based source deduplication.
3. Move image-manifest verification behind a verifier extension supplied by
   `nib-images` when extension ordering and package ergonomics are proven.
4. Remove legacy personal-video conventions from `markdownMedia()` in a
   versioned API change; retain only the explicit allow-listed iframe helper.
5. Consolidate or rename the overlapping `metadata()` and `siteMetadata()`
   concepts in a future public API review.
6. Audit public compatibility entries (`file`/`glob` at root, `/hosting`, and
   overlapping client exports) before a major version rather than removing
   them opportunistically.

## Maintenance rules

- Prefer one authoritative route/publication manifest over output crawling.
- Parse and validate untrusted runtime values even when TypeScript narrows the
  authoring API.
- Keep page data, route snapshots, and deployment metadata separate.
- Make optional browser behavior explicit and preserve native fallback.
- Extract shared code only after two call sites demonstrate the same invariant.
- Do not promote a consumer feature to Nib merely because it is large.
- Treat build, type, test, publication inspection, and browser interaction as
  separate evidence.
