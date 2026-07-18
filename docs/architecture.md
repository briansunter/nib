# Nib architecture

Nib is a static-first React site starter. It uses TSX as its HTML templating
language, Markdown for content, Vite for development and bundling, and explicit
React islands for browser interaction.

This document describes the current implementation and the constraints that
keep it small.

## Design goals

- Produce complete, crawlable HTML for every known route.
- Keep TSX pages, Markdown pages, layouts, and ordinary components static.
- Ship React to the browser only when a route contains a React island.
- Load only the island modules used by the current route.
- Keep route discovery and rendering deterministic at build time.
- Work from `/` or a configured static-host base path.
- Fail early for invalid routes, island IDs, or serialized props.

Nib does not provide dynamic route parameters, client-side routing, server
actions, runtime data loaders, React Server Components, nested islands, or
inline JSX in Markdown.

## Rendering pipeline

```text
src/pages/**/page.tsx or page.md
                 |
                 v
          build-time route map
                 |
                 v
         static page tree --collects--> React island definitions + props
                 |                                  |
                 |                                  v
                 |                         independent island SSR roots
                 v                                  |
         complete page HTML <-----------------------+
                 |
                 +-- no islands: HTML + CSS
                 |
                 +-- islands: runtime + used island chunks
```

The same renderer handles development requests and production prerendering:

1. `src/routes.ts` eagerly discovers `page.tsx` and `page.md` modules.
2. `createRoutes` normalizes source paths, applies metadata, filters drafts, and
   creates the static route map.
3. `renderReactPage` renders the shared `App` shell and route component.
4. A two-pass island renderer collects definitions and JSON props, renders each
   island as an independent root, and inserts its SSR markup.
5. `renderDocument` inserts metadata and page HTML into `index.html`.
6. Static pages have the marked island entry removed.
7. `scripts/prerender.ts` writes each route below `dist/client`.

The SSR entry strips Vite's configured base path before route matching. This
keeps development requests and prerender calls on the same route interface.

`dist/server` exists only so the prerender step can execute the production SSR
entry. It is not a deployment target.

## File routing

Each folder below `src/pages` may contain exactly one page module:

```text
src/pages/page.tsx            -> /
src/pages/about/page.tsx      -> /about/
src/pages/guides/start/page.md -> /guides/start/
src/pages/404/page.tsx        -> /404.html
```

Routes are discovered with `import.meta.glob` in `src/routes.ts`. The route map
is therefore fixed when Vite builds the site. `src/framework/router.ts` owns
route construction, while `src/framework/paths.ts` owns path normalization and
source-to-route conversion.

## Page types

### TSX pages

A TSX page default-exports a React component and may export `meta`. It can use
ordinary React components for static composition. Hooks that depend on a
browser lifecycle belong inside a React island.

### Markdown pages

`src/framework/vite-plugin.ts` compiles `page.md` files before React sees them:

1. `gray-matter` extracts frontmatter.
2. Remark parses Markdown and GitHub-Flavored Markdown.
3. Rehype serializes the content to HTML.
4. The Vite plugin creates a Markdown page module.
5. An optional flat layout module wraps the rendered article.

The compiler validates supported frontmatter fields (`title`, `description`,
`draft`, and `layout`) before generating the page module.

Keeping Markdown parsing in `src/framework/markdown.ts` makes the syntax and
frontmatter behavior independently testable. Inline JSX is intentionally not
part of this pipeline.

`page.html` is not a current route format. The forward-looking
[HTML pages, layouts, and islands proposal](html-pages-layouts-and-islands.md)
describes how Nib could accept standards-conforming HTML without weakening
typed island bindings. Until that proposal is implemented, use TSX for
component-heavy pages and Markdown for prose.

## React islands

A React island is an explicit hydration boundary created with `defineIsland`.
The boundary has a stable ID, JSON-serializable props, and one of three
hydration strategies: `load`, `idle`, or `visible`.

For the design rationale and migration trade-offs, see the
[interactive island design record](interactive-react-islands.md). This file is
the shorter source of truth for current implementation contracts.

Island IDs match normalized module paths:

```text
src/islands/counter.tsx      -> counter
src/islands/cart/summary.tsx -> cart/summary
```

That convention gives the server collector and browser module registry the same
key without a compiler transform.

During server rendering, each island becomes a `<nib-island>` custom element
containing:

- server-rendered child markup;
- the island ID and a stable instance ID;
- the hydration strategy;
- serialized props;
- a React `identifierPrefix` for stable `useId` output.

The browser runtime in `src/entry-islands.tsx` discovers those elements and
delegates loading, metadata validation, and `hydrateRoot` wiring to
`src/framework/island-runtime.ts`. Visibility scheduling observes all element
children and falls back to the island's parent for text-only roots. Each
element is marked before scheduling so repeated bootstraps cannot hydrate it
twice.

### Island constraints

- Props must survive a JSON round trip.
- Initial rendering must be deterministic on the server and browser.
- Browser-only state is read in an effect or event handler.
- Islands cannot nest.
- Islands do not share a React context tree.
- Frequently coordinated controls should be one island with static children.
- Secrets must never be passed as props because props are present in HTML.

## Base paths

`vite.config.ts` chooses its base path in this order:

1. `SITE_BASE_PATH` when explicitly set;
2. `/<repository>/` in GitHub Actions;
3. `/` everywhere else.

Vite rewrites generated asset and dynamic-import URLs. Application links use
`siteHref` from `src/framework/urls.ts` so they follow the same base path.

## Development behavior

`server.ts` runs Vite in middleware mode and renders requests through the same
route and document pipeline used by the build.

The HTML template must contain exactly one head outlet, one SSR outlet, and at
most one marked island entry block. Static pages remove that block; island
pages fail early if it is missing.

Static page, layout, shell, and site-config edits trigger a full reload because
there is no persistent page-level React root. Island modules use React Fast
Refresh when possible.

## Naming contract

- **Nib** is the product and repository name.
- **`@briansunter/nib`** is the npm package name.
- **TSX page** and **Markdown page** are the two page types.
- **React island** is an interactive, independently hydrated subtree.
- **prerender** is the build operation; **prerendered** describes its output.

Internal functions may use the `nib` prefix when they integrate with Vite or
emit framework markers, such as `nibMarkdown`, `nibIslandsEntry`, and
`data-nib-islands`.

## Validation

Run the full repository gate after framework or documentation changes:

```bash
bun run typecheck
bun run test
bun run build
```

When base-path behavior changes, also build with:

```bash
SITE_BASE_PATH=/nib/ bun run build
```

Inspect generated static and island routes under `dist/client` to confirm that
only island routes retain the marked client entry.
