# Nib architecture

Nib is a static-first framework with a deliberately small authoring interface.
Consumers install `@briansunter/nib`; they do not copy its routing, Vite, SSR,
document, prerender, or hydration implementation.

This document describes the current implementation. `page.html` is not a
current route format; the forward-looking
[HTML pages, layouts, and islands proposal](html-pages-layouts-and-islands.md)
remains explicitly proposed.
The [type-safe plugins and image optimization design](type-safe-plugins-and-image-optimization.md)
documents the implemented plugin lifecycle and optional image package.

## Package and project seam

The package owns:

- the `nib init`, `dev`, `build`, and `preview` commands;
- configuration loading and validation;
- Vite integration, with optional styling adapters contributed by the project;
- virtual route and island entry modules;
- Markdown compilation and layout resolution;
- generic data-page discovery, validation, and collection loading;
- development SSR and production prerendering;
- document outlets, metadata, base paths, and 404 output;
- structured document-head contributions and publication manifests;
- island collection, serialization, client loading, and hydration.

A consumer project owns:

```text
nib.config.ts
src/pages/**/page.tsx or page.md
src/pages/**/page.<configured extension>
src/pages/**/layout.tsx
src/layouts/*.tsx
src/content/              optional collection inputs
src/islands/**/*.tsx
src/site-shell.tsx       optional
src/style.css            optional
public/                  optional
```

`nib.config.ts` is the configuration seam. `defineConfig` types the site
metadata, optional base path, optional app-owned Vite plugin contribution, and
optional app-owned shell. Pages and islands import authoring interfaces from
`@briansunter/nib`; package-internal exports are reserved for generated virtual
modules.

The repository’s `templates/default` directory is an initializer input, not
framework source in a generated project. `examples/docs` is a consumer of the
same published interface and doubles as the GitHub Pages site.

## Command pipeline

```text
nib.config.ts + src/
          |
          v
  Nib project adapter
          |
          +-- dev ----> Vite server + framework SSR middleware
          |
          +-- build --> client assets + server entry
                              |
                              v
                         prerender routes
                              |
                              v
                         dist/client
```

`src/framework/site.ts` is the deep module behind the command interface. It
creates the Vite configuration, builds client and server environments,
constructs the HTML template from the client manifest, executes the server
entry, and writes route output. Consumer projects do not contain a Vite config,
HTML entry, SSR entry, route registry, server, or prerender script.

Development uses the same generated server entry as production. Vite’s
runnable SSR environment evaluates it on requests, while production builds it
to `dist/server/entry-server.js`. Client pre-transform is disabled for the
custom SSR document path so unused speculative dependency requests do not
prevent clean server shutdown.

`dist/server` is a build intermediate. Only `dist/client` is deployed.

## Plugins and optional image optimization

`plugins` in `nib.config.ts` accepts an ordered readonly list of `NibPlugin`
objects. `@briansunter/nib/plugin` exposes the typed `vite`, `renderer`,
per-page, and finalization contexts. Nib validates names and hook shapes before
Vite starts, applies Vite contributions before its generated project adapters,
and attributes hook errors to the plugin and route. Production creates fresh
plugin contributions for the client and server graphs and identifies the
target in `NibVitePluginContext`; development identifies its combined
multi-environment graph separately. This prevents plugin-local Vite state from
leaking between builds.

Renderer extensions are instantiated once per server renderer. Their structured
head contributions, wrappers, and page transformations run in configuration
order, while finalizers run once after every production route (including the
generated 404) has rendered. Production collects rendered pages, awaits
finalizers, then writes HTML with bounded concurrency and emits
`.nib/publication.json`; development does not run finalizers.

The plugin host owns contribution resolution, renderer-extension construction,
ordering, hook error attribution, and finalization. Renderer plugins receive a
stable route snapshot rather than page modules, layouts, or page data. They may
change static status, head, and HTML, but Nib keeps the hydration metadata and
rejects changes to rendered island markup.

Plugins may also contribute typed page-source adapters and virtual page,
resource, or redirect routes before rendering. The host validates and merges
these registrations, then exposes one immutable resolved-route list to
inspection hooks. See
[Plugin content and routing](./plugin-content-and-routing.md) for ordering,
collision, output, head, and trailing-slash rules. Site and page metadata use
the same structured head contract as renderer plugins.

Tailwind is optional rather than a framework dependency. The initializer adds
`@tailwindcss/vite` and opts in through the narrow app-owned `vite` field in
`nib.config.ts` (`vite: () => tailwindcss()`). Sites that use plain CSS or
another styling adapter omit it. This field can contribute only Vite plugins;
Nib continues to own entries, SSR, base-path, and output configuration.

`@briansunter/nib-images` is a separate workspace/package and the only package
that depends on Sharp. Its `images()` plugin handles explicit local
`?nib-image` imports and its static `Image` component registers transforms while
rendering. Finalization writes content-addressed AVIF/WebP and JPEG/PNG fallback
assets under `dist/client/assets/nib`, reusing checksum-validated entries in
`.nib/cache/images` across builds. Cache reads and output links run in parallel
while a separate global queue bounds active Sharp transforms. Image-only routes
remain static and have no island runtime. The component entry does not import
Sharp or Node APIs; build integration is exported from
`@briansunter/nib-images/plugin`. Development serves validated, revalidatable
requests under `/@nib-images/`. Imported sources are watched explicitly; HMR
re-inspects changed content, byte-identical rewrites retain their cache key and
ETag, and editor overwrite races are retried. Internal absolute paths are
non-enumerable on source metadata. Remote URLs, Markdown image rewriting, SVG
rasterization, and animated-image conversion are intentionally outside this
release.

Within the image package, a shared request module owns cache keys and the
development URL grammar; a transform executor owns cache misses and bounded
Sharp work; and a source catalog owns authorization, metadata inspection, and
HMR refresh. The development Vite adapter and production registry are thin
adapters over those modules, so they cannot silently diverge on request identity
or cache behavior.

The image package is separately versioned from the Bun workspace root. Release
Please tracks the root package and `@briansunter/nib-images` independently; the
release workflow publishes only the package(s) whose release output is true.
It deliberately does not use Release Please's `node-workspace` plugin: that
plugin follows development dependencies and would patch-release the root when
only the optional image package changed. The entire `packages/` subtree and
the root's shared `bun.lock` are excluded from root release detection, so an
image-only dependency update does not turn into a framework release. CI,
examples, tests, and release metadata are likewise excluded; root source and
published documentation changes still release Nib. The image package declares the
supported pre-1.0 Nib range explicitly. If a future Nib change makes that
contract incompatible, update the image peer range in the same change so both
packages receive their own intentional releases.
Publishing uses npm Trusted Publishing (GitHub Actions OIDC), so each public
npm package must have its own trusted-publisher entry for `.github/workflows/release.yml`
before automated releases. npm requires a package to exist before its trusted
publisher can be configured; bootstrap a brand-new package once with an
interactive 2FA publish, then configure OIDC and remove any CI token.

## Virtual modules

`src/framework/project-vite-plugin.ts` generates two modules:

- `virtual:nib/server-entry` discovers pages, layouts, and islands with literal
  Vite globs, then delegates route setup and document rendering to the deep
  `createProjectRenderer` module.
- `virtual:nib/client-entry` discovers island modules lazily and starts the
  island runtime.

Both use project-root `/src/...` globs. This keeps route and island discovery in
the framework while ensuring Vite still sees literal glob patterns and can
split island chunks.

The server and client virtual modules use separate package-internal exports.
That avoids loading browser hydration code during SSR and keeps the public
authoring interface small.

## File routing

Each folder below `src/pages` may contain exactly one route module:

```text
src/pages/page.tsx             -> /
src/pages/about/page.tsx       -> /about/
src/pages/guides/start/page.md -> /guides/start/
src/pages/catalog/page.csv     -> one or many configured routes
src/pages/404/page.tsx         -> /404.html
```

`createRoutes` normalizes file paths, expands generated data pages, filters
drafts, rejects duplicates across every page type, resolves metadata and
folder/named layouts, and creates a static route map. Unknown development
requests use the custom `/404` route when present and otherwise a generated
fallback.

Dynamic parameters and a client router are intentionally absent.

## Page types

### TSX pages

A TSX page default-exports a React component and may export `meta`. It can use
ordinary React components for static composition. Browser lifecycle behavior
belongs in a React island.

### Markdown pages

The Markdown Vite adapter:

1. extracts frontmatter with `gray-matter`;
2. validates frontmatter with the configured schema or Nib's Zod default;
3. parses Markdown and GitHub-Flavored Markdown;
4. applies configured Unified `remarkPlugins`;
5. converts the Markdown tree and applies configured `rehypePlugins`;
6. serializes HTML through Rehype;
7. generates a React page module;
8. exposes the validated frontmatter and optional named layout to the route.

Unified plugins receive a VFile with the source path in `history`, allowing
source-relative diagnostics and asset resolution while Nib retains ownership
of module generation and route publication.

Keeping parsing in `src/framework/markdown.ts` gives syntax and validation
locality independent of Vite code generation. Inline JSX is not supported.

### Generic data pages

`definePageSource` registers one or more file extensions, an optional file
matcher, a parser/loader function, a schema or validator, and a static React
component. The Vite adapter turns matching `page.<extension>` files into page
modules. A loader returns one page descriptor for the containing folder route,
or an array of descriptors with explicit paths to fan one input file out into
many routes.

Nib re-exports Zod 4 as the default validation library but depends only on a
`parse(value)` shape at the interface. A custom `validate(value, context)`
function is the lower-level alternative; a definition must choose one. Parsed
and transformed values are passed directly to the page as `data`.

### Collections

`defineCollection` pairs an async build-time loader with the same validation
seam. Loaders return `{ id, data }` entries or an ID-keyed record. The built-in
`glob()` and `file()` helpers cover recursive file collections and aggregate
data files; arbitrary loader functions can use project-root `read()`.

Collections load before the route map and are passed to TSX pages, generated
page components, layouts, and the site shell. `PageProps<typeof config>` maps
the config's collection definitions to inferred `{ id, data }` lists without a
generated type file or global registry.

## Layout composition

`src/pages/layout.tsx` wraps every page and nested folder layouts wrap their
subtree from root to leaf. An optional flat named layout from `src/layouts`
wraps the page inside that folder stack. Layouts receive children, route and
site information, collections, data-page `data`, and Markdown `frontmatter`.
`PageLayoutProps` keeps its one-argument backwards-compatible form and accepts
a third type argument when a layout needs different types for those two
payloads.

## Page shell and documents

The configured shell receives `children`, the resolved route, and site
metadata. When omitted, Nib renders a small semantic header and main region.
This gives consumers full visual control without making them own the framework
renderer.

Nib generates the HTML document template. `renderDocument` requires exactly
one head outlet and one SSR outlet. It retains the marked island entry only on
routes that contain islands and rejects missing or duplicate island entries.
Static routes therefore contain HTML and CSS without the island runtime.

## React islands

A React island is an explicit hydration seam created with `defineIsland`. It
has a stable path-matching ID, JSON-serializable props, and a `load`, `idle`, or
`visible` strategy.

During server rendering, each island becomes a `<nib-island>` element with:

- server-rendered child markup;
- stable island and instance IDs;
- hydration strategy and serialized props;
- an `identifierPrefix` for stable React `useId` output.

The client runtime validates metadata and the loaded module before calling
`hydrateRoot`. Visible hydration observes all element children and falls back
to the parent for text-only roots. Each element is marked before scheduling, so
repeated bootstraps cannot hydrate it twice.

Each top-level island owns an independent React root and context tree. An island
rendered inside another island is composed as an ordinary child component in
the same root, so the outer hydration strategy controls the subtree. Island
props must survive an exact JSON round trip; only top-level props are serialized
into boundary metadata. See the
[interactive island design](interactive-react-islands.md) for rationale and
trade-offs.

## Base paths

The base path is selected in this order:

1. `base` in `nib.config.ts`;
2. `SITE_BASE_PATH`;
3. `/<repository>/` in GitHub Actions;
4. `/`.

Base values must start and end with `/`. Vite rewrites asset and lazy island
chunk URLs. `siteHref` uses the same build-time constant for application links,
and the SSR renderer strips the base before route matching.

## Scaffolding

`nib init` copies `templates/default` only into a missing or empty directory,
replaces the framework version placeholder with the running package version,
and installs with the invoking npm-compatible package manager unless
`--no-install` is present. It refuses to merge into a non-empty directory.

The generated project contains no `src/framework`, Vite config, HTML template,
server entry, or prerender script. That absence is covered by scaffold and
packed-package consumer tests.

## Constraints

Nib deliberately omits runtime dynamic route parameters, client-side routing,
server actions, runtime data loaders, React Server Components, independently
hydrated nested island roots, nested named Markdown layouts, and inline JSX in
Markdown.

These omissions keep the static route map deterministic and the package
interface smaller than its implementation.

## Validation

Framework changes run:

```bash
bun run typecheck
bun run test
bun run build
SITE_BASE_PATH=/nib/ bun run build
bun run check:version-policy
```

The complete gate includes unit and type tests, scaffold overwrite protection,
production builds, base-path development requests, packed npm installation,
generated-project typechecking/building, preview requests, island hydration in
a browser, package-content inspection, and the documentation example build.
