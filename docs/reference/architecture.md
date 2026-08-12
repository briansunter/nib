# Nib architecture

Status: current

Last reviewed: 2026-08-11

Nib is a static-first React authoring framework. React and TSX run during
development and prerendering; production documents are HTML with optional,
route-scoped DOM enhancements and React islands. Nib never hydrates a whole
page; it hydrates React only inside explicit island roots.

## Package and project seam

Nib owns routing, Vite configuration, development SSR, prerendering, HTML
documents, publication artifacts, enhancement and island discovery, and
optional application-client discovery. A consumer owns:

```text
nib.config.ts
public/                                      optional
src/pages/**/page.tsx or page.md
src/pages/**/page.<configured extension>
src/pages/**/layout.tsx
src/layouts/*.tsx
src/content/                                 optional
src/enhancements/**/index.client.{js,ts}     optional
src/islands/**/*.tsx                         optional
src/client.ts                                optional
src/site-shell.tsx                           optional
src/style.css                                optional
```

Universal authoring values, `enhance`, `ClientEnhancement`, and
`ClientInitializer` come from `@briansunter/nib`. React islands use `island`
from `@briansunter/nib/react`. Filesystem-backed collection helpers come from
`@briansunter/nib/server`; generated virtual client entries use private
internal subpaths.

Production target guards reject `.client.ts(x)` imports from the server graph
and `.server.ts(x)` imports from the client graph with an import-chain
diagnostic.

## Build pipeline

```text
nib.config.ts + src/
          |
          +-- dev ----> Vite multi-environment server + SSR middleware
          |
          +-- build --> client graph + server entry
                              |
                              v
                         prerender routes
                              |
                              v
                         dist/client
```

The production client graph is always run so project and plugin Vite build
hooks can emit assets. When no stylesheet, enhancement, island, or application
client entry exists, Nib builds a private inert entry and does not link it from
generated HTML. `dist/server` is only a prerendering intermediate.

The build writes into a staging directory, preplans route artifacts, renders in
bounded deterministic batches, runs finalizers, writes
`.nib/publication.json`, then atomically promotes the completed output. A
failed build leaves the previous `dist` intact.

## Routes and rendering

Each folder below `src/pages` owns exactly one static route source. Nib supports
TSX, Markdown, configured data-page formats, resources, redirects, layouts,
typed collections, and a static `404.html`. Dynamic parameters and runtime
route discovery are intentionally absent.

React components compose the page, layouts, shell, and renderer-plugin wrappers
during SSR. Rendering produces the HTML and the sets of enhancement and island
IDs used by that route. Renderer plugins may wrap ordinary static output and
contribute structured head elements, but framework marker ownership stays with
Nib.

## Client enhancements

`enhance('feature')` returns attributes to spread onto the existing intrinsic
HTML element that owns an interaction. It emits
`data-nib-enhancement="feature"`; the optional `{ when: 'visible' }` adds
`data-nib-when="visible"`. The final rendered HTML is the source of truth, and
Nib validates the same marker contract in helper-authored and raw HTML.
Immediate startup is the default, and there is no `idle` strategy.

The name maps to a folder entry:

```text
enhance('search')           -> src/enhancements/search/index.client.ts
enhance('gallery/filters')  -> src/enhancements/gallery/filters/index.client.ts
```

The module default export receives `root` and `signal` as positional arguments:

```ts
type ClientEnhancement = (
  root: HTMLElement,
  signal: AbortSignal,
) => void | Promise<void>
```

The runtime discovers modules lazily. Immediate roots start on mount, and
visible roots observe the marked root itself with an `IntersectionObserver`.
A failed module load may be retried. Cleanup aborts nested enhancement signals
deepest first before DOM detachment.

Pages without enhancement markers omit the enhancement script. Projects
without enhancement modules do not build the enhancement runtime. The
enhancement runtime contains no React. Essential content must therefore remain
in the prerendered HTML.

CSS imported by an enhancement module is resolved through that module's
transitive Vite manifest graph and linked only on routes that render the
enhancement. This applies to visible roots too, preventing a flash of unstyled
static markup. Immediate enhancement chunks may be module-preloaded; visible
chunks are not. Styles and preloads are deduplicated against global,
application-client, and island entries.

## React islands

An island module lives at `src/islands/<id>.tsx` and must default-export a
definition created by `island(Component)` from `@briansunter/nib/react`.
Nested file paths create nested IDs without a separate registry:

```text
src/islands/counter.tsx       -> counter
src/islands/cart/summary.tsx  -> cart/summary
```

The component props must be JSON-serializable. Nib renders complete initial
HTML on the server, embeds the serialized props, and hydrates with the same
identifier prefix in the browser. `island(Component, { when: 'load' })` is the
default; `{ when: 'visible' }` waits until that island approaches the viewport.
There is no `idle` strategy.

Nib owns the generated `<nib-island>` boundary and its `data-nib-*` hydration
metadata. Applications render the path-derived island definition rather than
authoring or mutating that boundary.

Island CSS and JavaScript are linked only on routes that render the island.
Routes without islands omit the island runtime, and projects without island
modules build no React client runtime. Nested island definitions compose inside
their owning React root instead of creating redundant roots.

## Optional application client

Nib auto-discovers the exact optional entry `src/client.ts`. Its default export
is a `ClientInitializer`:

```ts
type ClientInitializer = (
  signal: AbortSignal,
) => void | Promise<void>
```

Nib emits and links the entry only when the file exists, invokes it once, and
aborts its signal during development replacement. This is the application-owned
escape hatch for site-wide listeners or integration startup that has no scoped
enhancement root. Plugins cannot contribute browser initializers. Links and
forms always use native browser navigation; Nib has no client router or
document-swapping navigation layer.

## Plugins and images

`NibPlugin` contributions are target-aware and ordered. Plugins may add Vite
adapters, page sources, derived routes, renderer wrappers/head elements,
and finalizers. Nib retains route collision, path, output, marker, and
publication ownership.

`@briansunter/nib-images` is a separate optional package. It performs local
image inspection and transformation at build time and renders static
`<picture>` output; it adds no browser runtime.

## Base paths and publication

The base path comes from configuration, `SITE_BASE_PATH`, the GitHub repository
name in Actions, or `/`. It must start and end with `/`. The same value drives
Vite assets, lazy enhancement and island chunks, `siteHref`, development route
matching, and publication artifacts.

Only `dist/client` is deployed. It contains static route documents, assets,
hosting companions, and the immutable publication manifest.

## Deliberate constraints

Nib omits whole-page hydration, runtime data loaders, server actions, runtime
dynamic routes, React Server Components, nested named Markdown layouts, and
inline JSX in Markdown. Browser interaction must use explicit enhancement
roots, explicit React islands, or the application-owned `src/client.ts`
initializer.

## Validation

Framework changes run type checking, unit tests, scaffold and packed-package
consumer tests, production/base-path builds, preview requests, output
inspection, and documentation/blog example builds. Browser-facing changes also
verify application-client startup, enhancement mount/cleanup semantics, island
hydration, and island-free output without client React.
