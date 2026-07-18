# HTML pages with layouts and React islands

Status: Proposed

## Decision

Keep `page.tsx` as Nib's primary component-bearing template format. If Nib adds
`page.html`, use standards-conforming HTML fragments for markup and an optional
typed `page.config.ts` companion for metadata, a React layout, and island
bindings.

Do not add import statements, JSX expressions, component props, or hydration
directives to HTML. A page places a bound island with one reserved custom
element:

```html
<nib-island data-slot="counter"></nib-island>
```

The companion TypeScript file imports the React values and supplies typed props:

```ts
import { bindIsland, defineHtmlPage } from '../../framework/html-pages'
import Counter from '../../islands/counter'
import DocsLayout from '../../layouts/docs'

export default defineHtmlPage({
  meta: {
    title: 'Counter',
    description: 'A counter embedded in a static HTML page.',
  },
  layout: DocsLayout,
  islands: {
    counter: bindIsland(Counter, {
      props: { initialCount: 0 },
      hydrate: 'visible',
    }),
  },
})
```

This is the cleanest HTML option, but it is intentionally less direct than
TSX. Use it for imported, generated, or markup-first content. Use TSX when a
page composes several React modules or derives props in code.

## Why HTML cannot cleanly import React components

HTML can load a JavaScript module with `<script type="module">`, and that module
can import a React component. The HTML parser does not bind the imported
JavaScript value to a tag such as `<Counter>`, though. Making that tag render a
React component requires framework compilation or a Custom Element adapter.

Custom Elements and `data-*` attributes are standards-defined extension
points, so `<nib-island data-slot="counter">` is conforming HTML syntax. Its
build-time meaning is still Nib-specific. There is no portable HTML syntax for
"import this React component, type-check these props, server-render it, and
hydrate it later."

Putting a component ID and JSON props directly in HTML would appear simpler:

```html
<!-- Not recommended -->
<nib-island
  data-component="counter"
  data-props='{"initialCount":0}'
  data-hydrate="visible"
></nib-island>
```

That loses the most useful part of the current island interface. TypeScript
types are erased at runtime, so the build could validate JSON but could not
check that `initialCount` is a required number without adding runtime schemas
or generated declarations. The typed companion keeps imports and props in the
language that understands them.

## Goals

- Discover `page.html` beside the existing `page.tsx` and `page.md` formats.
- Keep page markup valid HTML with no expression or import dialect.
- Wrap an HTML page in an imported React layout.
- Place independently server-rendered React islands within the HTML.
- Type-check each island's props in `page.config.ts`.
- Reuse the existing island serializer, SSR roots, hydration strategies, lazy
  client modules, and conditional client entry.
- Preserve static output, Vite base paths, development reloads, and useful
  source-oriented build errors.
- Keep HTML-specific parsing and rendering behind one deep module.

## Non-goals

- Treating each page as a complete document with its own `html`, `head`, or
  `body`. Nib continues to own the document shell in `index.html`.
- Arbitrary JavaScript expressions, loops, conditionals, or React imports in
  HTML.
- Inline event-handler attributes or page-local executable scripts. Browser
  behavior belongs in islands; site-wide scripts belong in `index.html`.
- Turning React islands into public Web Components.
- Vite asset imports such as `import image from './image.png'` inside HTML.
- Editor-time checking of slot names. Slot matching is a build-time check;
  imported island props remain a TypeScript check.
- A second hydration runtime or whole-page hydration for HTML routes.

## Authoring model

An HTML route contains:

```text
src/pages/examples/counter/
├── page.html
└── page.config.ts
```

`page.html` is an HTML body fragment. It may contain multiple top-level nodes
because Nib inserts the fragment into its existing page shell.

```html
<article class="prose prose-invert">
  <h1>Counter</h1>
  <p>This markup remains static.</p>
  <nib-island data-slot="counter"></nib-island>
</article>
```

The config file is optional when a page has no metadata, layout, or islands. It
is required when the HTML contains a `nib-island` slot. Each slot represents
one island instance; two counters with different props use two slot names.

The marker must:

- use an explicit closing tag because self-closing custom elements are not
  valid HTML syntax;
- have exactly one non-empty `data-slot` attribute;
- have no child content;
- appear outside parser-sensitive structures such as `table`, `select`, `svg`,
  and `math`;
- match exactly one binding in `page.config.ts`.

The source marker is replaced during prerendering. The generated page contains
the existing runtime form with `data-island`, serialized props, hydration
strategy, instance ID, and server-rendered fallback markup.

### Choosing a page format

| Need | Format |
| --- | --- |
| Prose with conventional frontmatter | `page.md` |
| Imported or generated static HTML | `page.html` |
| Inline React composition and the strongest locality | `page.tsx` |
| Browser state or event handlers | A React island used by HTML or TSX |

HTML support should not make TSX an implementation detail authors are expected
to avoid. TSX remains shorter and more type-safe for component-heavy pages.

## Typed interface

The public interface can remain small:

```ts
type HtmlLayout = ComponentType<{ children: ReactNode }>

interface HtmlPageOptions {
  meta?: PageMeta
  layout?: HtmlLayout
  islands?: Record<string, BoundIsland>
}

declare function defineHtmlPage(options: HtmlPageOptions): HtmlPageOptions

declare function bindIsland<Props extends object>(
  definition: IslandDefinition<Props>,
  options: {
    props: Props
    hydrate?: HydrationStrategy
  },
): BoundIsland
```

`bindIsland` infers `Props` from the result of `defineIsland`. The existing
compile-time and runtime JSON rules still apply. Functions, React nodes, dates,
maps, sets, class instances, cycles, explicit `undefined`, and non-finite
numbers remain invalid.

`layout` is an imported value rather than a string path. This makes the
dependency explicit, lets TypeScript check the `children` interface, and avoids
inventing a layout-import convention in HTML.

## Compilation and rendering

The HTML adapter should satisfy the same `PageModule` interface as the Markdown
adapter. Routing, metadata resolution, the application shell, prerendering, and
document assembly therefore do not need an HTML-specific path.

```text
page.html ----------> HTML compiler ----> template + named slots
page.config.ts -----> typed bindings ----+
                                         |
                                         v
                                  PageModule adapter
                                         |
                       React layout + application shell
                                         |
                     shared island collector and SSR roots
                                         |
                                         v
                                final static document
```

The implementation should preserve raw HTML rather than translate every tag
and attribute into React:

1. A Vite plugin reads `page.html` and parses it as an HTML body fragment.
2. The compiler records each `nib-island` source range and slot name. A
   standards-oriented parser such as `parse5` should be a direct dependency;
   regular expressions are not sufficient for raw-text elements, entities, or
   parser correction.
3. The plugin generates a normal page module that imports the optional
   `page.config.ts` and registers an opaque HTML-template request.
4. During the existing deterministic React shell render, the template request
   reserves island instances in document order and emits a temporary content
   marker. A React layout receives that marker as its `children`.
5. The shared island renderer serializes props and renders every definition as
   its own React SSR root with the existing `identifierPrefix` behavior.
6. The template renderer substitutes the rendered island containers into the
   recorded source ranges, then replaces the temporary content marker in the
   static React shell.
7. The existing document renderer keeps the island client entry only when at
   least one HTML or TSX island was collected.

This creates one new adapter at the page-source seam without creating another
island adapter. Deleting the HTML module would remove only HTML parsing and
template substitution; island behavior would remain concentrated in the
current renderer and client runtime.

Layouts treat HTML content as an opaque child. They may wrap, position, or
surround it with TSX and additional islands, but they must render `children`
exactly once and cannot inspect or clone individual HTML nodes. The template
renderer verifies that its temporary marker appears once in the completed
shell. This preserves markup exactly outside intentional URL and island
substitutions and matches the practical behavior of rendered Markdown.

## URLs, assets, and scripts

HTML embedded in a generated SSR module is not a native Vite HTML entry. The
adapter must define that difference instead of implying all `index.html`
features apply.

- Relative URLs keep normal HTML semantics.
- A local root-relative `href`, `src`, `poster`, or `srcset` URL should receive
  Nib's configured Vite base path, matching `siteHref`.
- Absolute URLs, protocol-relative URLs, hashes, `mailto:`, and other schemes
  remain unchanged.
- Static assets should live under `public/` or be referenced from CSS. Hashed
  JavaScript asset imports remain a TSX feature.
- Executable `script` elements and inline `on*` handlers should fail the HTML
  build. JSON-LD may be supported later with an explicit safe data-block rule.

URL rewriting and island replacement must use parsed source locations so
unrelated whitespace, attribute quoting, comments, and element ordering remain
unchanged.

## Validation and errors

TypeScript should report:

- missing, extra, or incorrectly typed island props;
- invalid hydration strategy values;
- layouts that do not accept `children`;
- invalid page metadata shapes.

The HTML build should report the page path and source location for:

- malformed HTML or document-only elements in a fragment;
- an unknown, duplicate, empty, or unused slot;
- a marker with children or unsupported attributes;
- an island in a parser-sensitive location;
- a marker without `page.config.ts`;
- a layout that drops or duplicates the opaque HTML child;
- executable scripts or inline event handlers;
- a duplicate route containing more than one of `page.tsx`, `page.md`, and
  `page.html`.

Existing island checks continue to reject invalid module IDs, non-serializable
props, nested islands, and non-deterministic renders.

## Development and output behavior

- Editing `page.html`, `page.config.ts`, or its layout triggers a full reload,
  like other static page sources.
- Editing the island module continues through React Fast Refresh where
  possible.
- Static HTML pages emit no React client entry.
- HTML pages with islands load the same shared runtime and only the island
  modules they use.
- HTML source and config are server/build inputs and are not shipped as page
  JavaScript.
- Tailwind scans `page.html` so classes used only in HTML are included.
- Dynamic island imports continue to use Vite's configured base path.

## Alternatives considered

### Use only TSX

This remains the best default. It has direct imports, typed props, expressions,
base-aware helpers, and one-file locality with no HTML parser. If HTML input is
not needed for imported or generated content, Nib should stop here.

### Put component IDs and JSON props in one HTML file

This is concise but untyped. Adding runtime schemas would duplicate component
types, while code generation would make the compiler and editor integration
substantially larger. It is not a good trade for a small starter.

### Register React islands as Custom Elements

Module scripts and Custom Elements are browser standards, but this creates a
second component interface based on string attributes and lifecycle callbacks.
Keeping SSR, JSON props, lazy loading, and hydration would duplicate the current
island implementation. This is appropriate only for a Web Components-first
project.

### Make every HTML page a Vite HTML entry

Native Vite entries handle scripts and assets well, but they introduce a
parallel build and routing path for layouts, metadata, 404 behavior,
prerendering, base paths, and route conflicts. That is an HTML-first framework
redesign rather than a Nib page adapter.

### Compile an HTML AST into React elements

This lets the current island collector see inline markers, but it requires
faithfully translating every HTML, SVG, style, attribute, whitespace, and
parser-correction behavior into React. Opaque template substitution has better
locality and preserves ordinary markup more directly.

### Add MDX instead

MDX is a better fit when authors want prose with inline imported components. It
does not serve authors who specifically need portable HTML source, and it still
uses a non-HTML component syntax.

## Implementation sequence

1. Add a pure HTML compiler with parser, source-location, slot, script, and URL
   tests.
2. Add `defineHtmlPage`, `bindIsland`, and type-check fixtures.
3. Extend route discovery and duplicate-route checks for `page.html`.
4. Add the opaque template renderer and reuse the existing island collector.
5. Add development reload and base-path integration.
6. Add render and browser tests, then document the feature in the README and
   documentation site only after it is implemented.

## Acceptance criteria

- A static `page.html` renders inside the application shell with no client
  script.
- An HTML page can use an imported React layout.
- A bound island has useful SSR markup and hydrates for `load`, `idle`, and
  `visible`.
- Incorrect component props fail TypeScript; incorrect slot names fail the
  build with a source location.
- Layout-owned and HTML-owned islands receive stable, unique instance prefixes.
- Source markup outside substitutions is preserved.
- Inline scripts, event handlers, nested islands, and parser-sensitive
  placements fail clearly.
- Production output works at `/` and `SITE_BASE_PATH=/nib/`.
- A static route contains no React runtime; an interactive route loads only its
  used island chunks.
- `bun run typecheck`, `bun run test`, and `bun run build` pass.

## Conclusion

There is a clean way to support HTML pages, layouts, and React islands without
inventing imports inside HTML: keep HTML declarative, put typed React bindings
in a companion TypeScript file, and compile both through the existing page and
island seams.

It is still not better than TSX for most Nib pages. The HTML adapter earns its
complexity only when preserving or ingesting real HTML is a requirement. Until
that use case exists, TSX plus Markdown remains the smaller and more coherent
default.

## References

- [HTML Standard: Custom Elements](https://html.spec.whatwg.org/dev/custom-elements.html)
- [HTML Standard: custom data attributes](https://html.spec.whatwg.org/multipage/dom.html#custom-data-attribute)
- [HTML Standard: module scripts and data blocks](https://html.spec.whatwg.org/dev/scripting.html)
- [TypeScript: erased types](https://www.typescriptlang.org/docs/handbook/typescript-from-scratch.html#erased-types)
- [Vite: glob imports](https://vite.dev/guide/features.html#glob-import)
