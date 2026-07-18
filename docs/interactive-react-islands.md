# Interactive React islands for TSX templates

Status: Implemented

## Summary

Nib should use TSX as the universal HTML templating language while hydrating only explicitly interactive React subtrees, or "islands," in the browser.

Pages, layouts, and ordinary components remain server-rendered React. They produce complete static HTML and ship no page-level JavaScript. A component becomes interactive only when it is defined with `defineIsland` and placed under `src/islands`. Each island is server-rendered for useful initial HTML, emitted as an independent React root, and hydrated by a small client runtime according to an explicit strategy such as `load`, `idle`, or `visible`.

This should replace whole-page hydration as Nib's default model. It keeps the framework small and static-hostable while letting authors build interactive controls in the same React/TSX component model used for the rest of the page.

## Context

Before this design, Nib supported interactive `page.tsx` files by rendering the entire `App` tree on the server and calling `hydrateRoot` on `#root` in `src/entry-client.tsx`.

That proves the React SSR path works, but it has costs that become more visible as a site grows:

- Every page is eagerly imported into the client route map.
- Static pages and Markdown pages still download and execute React hydration code.
- The current production JavaScript bundle is about 200 KB and contains the rendered content and component code for every route.
- A small interactive control forces the header, footer, layout, article, and page to participate in hydration.
- Markdown can only contain generated HTML; it has no explicit boundary for an interactive component.

The desired model is more precise: author all markup with TSX, render everything to static HTML, and opt only the stateful parts into browser React.

## Goals

- Keep `page.tsx` and React layouts as the primary typed templating system.
- Render complete, crawlable HTML for pages and interactive components.
- Allow state, effects, refs, and event handlers inside interactive React components.
- Ship no React client runtime on a page with no islands.
- Load only the JavaScript for islands present on the current page.
- Preserve file routes, prerendering, GitHub Pages base paths, Vite development, and static deployment.
- Keep the authoring API explicit, typed, and understandable without a custom JSX syntax.
- Fail during development or build for invalid island IDs or non-serializable props.

## Non-goals

- Client-side routing or SPA navigation.
- React Server Components.
- Server actions or runtime server data loaders.
- Sharing a React context across separate islands.
- Automatically turning every component that uses a hook into an island.
- Embedding arbitrary JSX directly in `page.md` in the first version.

## Authoring model

Static pages use ordinary TSX. Components can be split freely for organization, but they do not receive client JavaScript merely because they are React components.

```tsx
// src/pages/products/page.tsx
import QuantityPicker from '../../islands/quantity-picker'
import type { PageMeta } from '../../framework/types'

export const meta: PageMeta = {
  title: 'Products',
  description: 'Browse products.',
}

export default function ProductsPage() {
  return (
    <article>
      <h1>Products</h1>
      <p>This content is rendered once to static HTML.</p>
      <QuantityPicker initialQuantity={1} hydrate="load" />
    </article>
  )
}
```

Interactive components live under `src/islands` and use `defineIsland`:

```tsx
// src/islands/quantity-picker.tsx
import { useState } from 'react'
import { defineIsland } from '../framework/islands'

interface QuantityPickerProps {
  initialQuantity: number
}

function QuantityPicker({ initialQuantity }: QuantityPickerProps) {
  const [quantity, setQuantity] = useState(initialQuantity)

  return (
    <div>
      <button type="button" onClick={() => setQuantity((value) => value - 1)}>
        Remove one
      </button>
      <output>{quantity}</output>
      <button type="button" onClick={() => setQuantity((value) => value + 1)}>
        Add one
      </button>
    </div>
  )
}

export default defineIsland('quantity-picker', QuantityPicker)
```

`defineIsland` returns a typed React component. It adds the optional framework prop `hydrate` while retaining the implementation component's prop types. It also retains the implementation component on the definition so the browser runtime can hydrate that component rather than the boundary wrapper.

Island IDs must match their normalized path below `src/islands`:

```text
src/islands/quantity-picker.tsx -> quantity-picker
src/islands/cart/summary.tsx    -> cart/summary
```

This small amount of explicitness avoids a compiler transform and gives the server markup and client module registry the same stable key. The build must reject duplicates and ID/path mismatches.

## Hydration strategies

The first release should support three strategies:

| Strategy | Behavior | Intended use |
| --- | --- | --- |
| `load` | Hydrate as soon as the island runtime starts. | Primary controls that must respond immediately. |
| `idle` | Hydrate with `requestIdleCallback`, with a timer fallback. | Useful but non-critical interaction. |
| `visible` | Hydrate when `IntersectionObserver` reports the island near the viewport. | Below-the-fold or expensive widgets. |

`load` should be the default. Explicit strategies make performance behavior visible at the call site without adding Astro-specific JSX directives or new syntax to TypeScript.

Client-only rendering should not be part of the first version. An island must produce deterministic server HTML from its props. Browser-only setup belongs in an effect. This avoids blank initial UI, layout shift, and a second rendering mode.

## Architecture

```text
page.tsx / page.md
        |
        v
static React page tree --collects--> island definitions + JSON props
        |                                  |
        |                                  v
        |                         render each island as its
        |                         own React SSR root
        v                                  |
final static page HTML <-------------------+
        |
        +-- no islands: CSS + HTML only
        |
        +-- islands: small runtime -> lazy import used module -> hydrateRoot
```

### Framework types

The public contract can be kept small:

```ts
type HydrationStrategy = 'load' | 'idle' | 'visible'

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue }

interface IslandControlProps {
  hydrate?: HydrationStrategy
}

interface IslandDefinition<Props extends Record<string, JsonValue>> {
  (props: Props & IslandControlProps): React.ReactNode
  islandId: string
  Component: React.ComponentType<Props>
}

declare function defineIsland<Props extends Record<string, JsonValue>>(
  id: string,
  Component: React.ComponentType<Props>,
): IslandDefinition<Props>
```

The implementation may need a slightly more permissive recursive serializable type to handle optional properties, but the external rule should remain simple: island props must survive a JSON round trip. Functions, symbols, class instances, `Date`, `Map`, `Set`, cyclic values, and React nodes are invalid props.

### Server rendering

The static shell and each island must be rendered as different React roots. Rendering an island inline as part of the shell and later hydrating it as a separate root can produce different `useId` values.

Use a two-pass shell render:

1. Render the page under an island collector. Each island boundary records its definition, props, strategy, and stable instance number.
2. Render every recorded implementation component independently with `renderToString` and a unique `identifierPrefix` such as `nib-0-`.
3. Render the static shell with `renderToStaticMarkup`. In this pass, each boundary emits a `<nib-island>` container whose inner HTML is the corresponding independently rendered island markup.

The container includes only the data needed by the runtime:

```html
<nib-island
  data-island="quantity-picker"
  data-instance="nib-0"
  data-hydrate="load"
  data-props="{&quot;initialQuantity&quot;:1}"
>
  <div>...</div>
</nib-island>
```

`nib-island` should use `display: contents` in the framework stylesheet so it does not normally create a layout box. Direct placement in parser-sensitive structures such as `table`, `select`, or `svg` is unsupported in the first version; the island should own a valid containing element instead.

Both shell passes must be deterministic. This follows React's existing purity requirement and should be documented because side effects during render would otherwise run twice.

Nested island boundaries should throw a clear build-time or SSR error. If interactive pieces need shared state or context, they should be one larger island with ordinary child components.

### Client runtime

Replace the whole-page `entry-client.tsx` behavior with a focused `entry-islands.tsx` runtime.

The runtime creates a lazy module registry with Vite glob imports:

```ts
const islandModules = import.meta.glob<IslandModule>(
  '/src/islands/**/*.tsx',
)
```

Vite turns the lazy glob entries into dynamic imports and separate chunks. The runtime normalizes each file path to the same ID convention used by `defineIsland`.

For each `<nib-island>` element, the runtime:

1. Reads and validates the ID, instance prefix, strategy, and serialized props.
2. Schedules hydration according to the strategy.
3. Dynamically imports the matching module.
4. Confirms that its default export is an `IslandDefinition` with the expected ID.
5. Calls `hydrateRoot(container, <definition.Component {...props} />, { identifierPrefix })`.
6. Reports module-load and recoverable hydration errors with the island ID and instance ID.

Each DOM node must be marked as scheduled before waiting for visibility or idle time so HMR and repeated bootstrap calls cannot hydrate it twice.

### HTML template and build output

`index.html` should load global CSS independently from the island runtime. Its module script should carry a stable marker:

```html
<link rel="stylesheet" href="/src/style.css" />
<script data-nib-islands type="module" src="/src/entry-islands.tsx"></script>
```

`RenderedPage` should report whether the route contains islands. The development server and prerender step keep the marked script for island pages and remove it from pages without islands. The production template still lets Vite rewrite the entry to its hashed, base-aware asset URL before prerendering.

The result is:

- Static route: HTML and CSS, no React runtime.
- Island route: HTML, CSS, a small scheduler/registry entry, React, and only the dynamically imported island chunks that are activated.
- GitHub project page: the same behavior under `/<repository>/`, with asset and dynamic-import URLs handled by Vite's configured base path.

Generating Vite's SSR manifest is optional for the initial implementation. It can be added later to emit `modulepreload` links for `load` islands without changing the authoring API.

## Markdown

`page.md` should remain static Markdown in the first release. A TSX layout may place islands before, after, or beside its `children`, so documentation and article pages can still have interactive controls.

Arbitrary components inside Markdown should be a separate `page.mdx` feature if it becomes necessary. MDX can compile to the same React page tree and use the same `defineIsland` boundaries. Adding JSX-like syntax directly to the existing Remark HTML pipeline would create a second, less standard component compiler and should be avoided.

## State and composition rules

- An island owns one independent React root and context tree.
- Components that coordinate frequently should be one island.
- Separate islands may communicate through browser primitives or an explicitly shared external store, but that is an advanced pattern rather than the default.
- Initial state comes from serialized props and is visible in the HTML source.
- Secrets must never be passed as island props.
- Browser state such as `localStorage`, media queries, or element measurements is read in effects so the initial client render matches the server HTML.

## Development experience

- Vite continues to transform TSX and provide React Fast Refresh for island modules.
- Editing a static page, layout, app shell, or site config triggers a full page reload because there is no persistent page-level React root. That is an acceptable tradeoff for static-by-default output.
- Editing an island should preserve Fast Refresh where the Vite React plugin can do so; otherwise the runtime may replace that island root without navigating.
- Unknown island IDs, ID/path mismatches, duplicate IDs, invalid strategies, and serialization failures must show source-oriented errors during SSR or build.
- Hydration mismatches should include the island and instance IDs in `onRecoverableError` output.

## Migration from the current implementation

This is a deliberate change from page-level hydration. It should be introduced in a short migration rather than maintaining two permanent hydration systems.

1. Add the island definition, collector, serializer, client registry, and tests while the current entry still exists.
2. Move the home page counter into `src/islands/counter.tsx` and replace direct page-level `useState` usage with the island.
3. Switch server rendering to the two-pass static shell plus independent island roots.
4. Replace the root hydration entry with the island runtime and separate stylesheet link.
5. Make script removal conditional on the collected island count.
6. Update README, the documentation site, and `skills/nib/SKILL.md` to explain that page TSX is static and browser hooks belong in islands.
7. Measure and record the generated JavaScript for a static route and for a route with one counter island.

An interim `hydrate = 'page'` module export is not recommended. It would require two client manifests and two hydration paths, complicate build output, and make it unclear which component boundary owns browser state. The current codebase is small enough to migrate the existing interactive example directly.

## Validation and acceptance criteria

### Unit tests

- Normalize island file paths and reject duplicate or mismatched IDs.
- Serialize and deserialize all supported prop shapes.
- Reject unsupported values, cycles, and unsafe payload edge cases.
- Produce stable instance IDs and matching `identifierPrefix` values.
- Schedule `load`, `idle`, and `visible` exactly once.

### Render tests

- A static TSX page renders complete HTML without the island script.
- A Markdown page renders without the island script unless its layout adds an island.
- An island page contains useful SSR markup, props, strategy, and instance metadata.
- Multiple instances hydrate independently and components using `useId` do not warn or mismatch.
- A nested island fails with a clear error.

### Browser/build tests

- Clicking the example counter changes its state after hydration.
- With JavaScript disabled, the counter's initial content and the rest of the page remain visible.
- A `visible` island does not load before approaching the viewport and hydrates when observed.
- A production static page has no React or island entry script.
- A production island page loads the runtime and only the activated island chunk.
- The production build works with `SITE_BASE_PATH=/nib/` and dynamic imports resolve below that base.
- `bun run typecheck`, `bun run test`, and `bun run build` pass.

## Alternatives considered

### Keep hydrating the entire page

This is the smallest implementation and already works. It remains reasonable for an application where most of every route is interactive. It is not the best default for Nib because the project is positioned as a small static-site starter, and its content routes should not pay for every page module and a full-root hydration pass.

### Mount client-only components with `createRoot`

This is simpler than SSR islands, but interactive content would be absent from generated HTML and appear only after JavaScript runs. It gives up static output, accessibility, and layout stability where they matter most.

### Use MDX as the interactivity system

MDX is useful when components must appear inline in prose, but it is an authoring format rather than a hydration architecture. Without islands it would still hydrate the full page. It is compatible as a later input format.

### Adopt React Server Components

RSC would add a server/client module graph, bundler integration, and concepts intended for a larger application framework. Nib has no production server and does not need server actions or streamed runtime data. The complexity is not justified for static component islands.

### Use Web Components or handwritten JavaScript

Either could provide small isolated widgets, but it would introduce a second component and state model. The requirement is specifically to use React for both static TSX composition and interactive elements.

## Decision

Implement static TSX pages with opt-in, SSR-rendered React islands. Use an explicit `defineIsland` API, Vite's lazy glob imports, independent `hydrateRoot` calls, JSON-only props, and conditional inclusion of the client runtime. Keep Markdown static for now and treat MDX as a later authoring extension that reuses the same island mechanism.

## References

- [React `hydrateRoot`](https://react.dev/reference/react-dom/client/hydrateRoot)
- [React `renderToString`](https://react.dev/reference/react-dom/server/renderToString)
- [Vite glob imports and code splitting](https://vite.dev/guide/features.html#glob-import)
- [Vite SSR and SSR manifests](https://vite.dev/guide/ssr.html#generating-preload-directives)
