# Nib architecture

Status: current

Last reviewed: 2026-08-11

Nib is a static-first React authoring framework. React and TSX run during
development and prerendering; production documents are HTML with optional,
route-scoped DOM behaviors. Nib does not hydrate React in the browser.

## Package and project seam

Nib owns routing, Vite configuration, development SSR, prerendering, HTML
documents, publication artifacts, behavior discovery, and optional client
navigation. A consumer owns:

```text
nib.config.ts
public/                                      optional
src/pages/**/page.tsx or page.md
src/pages/**/page.<configured extension>
src/pages/**/layout.tsx
src/layouts/*.tsx
src/content/                                 optional
src/behaviors/**/index.client.ts             optional
src/site-shell.tsx                           optional
src/style.css                                optional
```

Universal authoring values and `ClientBehavior` come from
`@briansunter/nib`. Filesystem-backed collection helpers come from
`@briansunter/nib/server`. The generated virtual client entry uses the private
`@briansunter/nib/internal/client` subpath. Client navigation remains an
explicit public integration at `@briansunter/nib/client/navigation`.

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
hooks can emit assets. When no stylesheet, behavior, or configured client entry
exists, Nib builds a private inert entry and does not link it from generated
HTML. `dist/server` is only a prerendering intermediate.

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
during SSR. One render pass produces the HTML and the set of behavior IDs used
by that route. Renderer plugins may wrap ordinary static output and contribute
structured head elements, but framework marker ownership stays with Nib.

## Client behaviors

`<Behavior name="feature">` accepts exactly one intrinsic DOM child and clones
it with `data-nib-behavior="feature"`. Optional `defer="idle"` or
`defer="visible"` adds `data-nib-defer`. Application code must not author either
framework attribute itself.

The name maps to a folder entry:

```text
<Behavior name="search">           -> src/behaviors/search/index.client.ts
<Behavior name="gallery/filters">  -> src/behaviors/gallery/filters/index.client.ts
```

The module default export satisfies this contract:

```ts
type ClientBehavior = (
  root: HTMLElement,
  signal: AbortSignal,
) => void | Promise<void>
```

The runtime discovers modules lazily. Immediate roots start on mount, idle
roots use `requestIdleCallback` with a timer fallback, and visible roots observe
the marked root itself with an `IntersectionObserver`. A failed module load may
be retried. Cleanup aborts nested behavior signals deepest first before DOM
detachment.

Pages without behavior markers omit the behavior script. Projects without
behavior modules do not build the behavior runtime. Essential content must
therefore remain in the prerendered HTML.

CSS imported by a behavior module is resolved through that module's transitive
Vite manifest graph and linked only on routes that render the behavior. This
applies to deferred behavior roots too, preventing a flash of unstyled static
markup. Immediate behavior chunks may be module-preloaded; deferred chunks are
not. Styles and preloads are deduplicated against global and configured client
entries.

## Optional client entries and navigation

Plugins may contribute site-wide browser initializers by module and export name.
Nib combines them into one client-bootstrap entry. Each initializer receives an
`AbortSignal`; startup failure and hot replacement abort it.

`clientNavigation()` contributes the browser controller explicitly. It
intercepts eligible same-origin links and GET forms, fetches complete static
documents, preloads new styles, unmounts registered runtimes, swaps `#root` and
head state, then remounts behaviors. Unsafe failures fall back to a hard native
navigation. Native links and forms remain the baseline. Persisted or hash focus
is preserved; ordinary swaps focus the new route content before applying the
requested top or traversal scroll position.

Route-local controllers use `writeNavigationHistory()` from
`@briansunter/nib/client/navigation` for same-document query/hash state. That
keeps feature entries on the loaded document's history index and prevents Back
or Forward from causing an unnecessary document fetch and behavior remount.

## Plugins and images

`NibPlugin` contributions are target-aware and ordered. Plugins may add Vite
adapters, page sources, derived routes, renderer wrappers/head elements,
client initializers, and finalizers. Nib retains route collision, path, output,
marker, and publication ownership.

`@briansunter/nib-images` is a separate optional package. It performs local
image inspection and transformation at build time and renders static
`<picture>` output; it adds no browser runtime.

## Base paths and publication

The base path comes from configuration, `SITE_BASE_PATH`, the GitHub repository
name in Actions, or `/`. It must start and end with `/`. The same value drives
Vite assets, lazy behavior chunks, `siteHref`, development route matching, and
publication artifacts.

Only `dist/client` is deployed. It contains static route documents, assets,
hosting companions, and the immutable publication manifest.

## Deliberate constraints

Nib omits whole-page hydration, browser React roots, runtime data loaders,
server actions, runtime dynamic routes, React Server Components, nested named
Markdown layouts, and inline JSX in Markdown. Browser interaction is DOM-first
and must be attached through explicit behavior roots or a configured client
integration.

## Validation

Framework changes run type checking, unit tests, scaffold and packed-package
consumer tests, production/base-path builds, preview requests, output
inspection, and documentation/blog example builds. Browser-facing changes also
verify client navigation and real behavior mount/cleanup semantics.
