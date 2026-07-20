# Nib

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/nib-wordmark-light.svg" />
    <source media="(prefers-color-scheme: light)" srcset="docs/nib-wordmark-dark.svg" />
    <img src="docs/nib-wordmark-dark.svg" alt="Nib" width="220" />
  </picture>
</p>

Nib is a static-site framework for React. It handles routing, Vite, development
SSR, HTML documents, and prerendering; a site supplies pages, layouts, data,
styles, and optional React islands.

Every known route is emitted as complete HTML. Static pages ship HTML and CSS.
Pages with islands load React and only the island modules they use.

## Quick start

Nib requires Node 20.19 or newer.

```bash
npx @briansunter/nib init my-site
cd my-site
npm run dev
```
## Features

- File-based routes from `src/pages`, including a static `404.html`.
- React pages rendered to HTML without whole-page hydration.
- GitHub-Flavored Markdown with validated frontmatter.
- Folder layouts for route trees and named layouts for Markdown.
- Typed data pages that can turn YAML, CSV, or another format into one or many
  routes.
- Plugin-contributed data formats and virtual page, XML, or text routes.
- Configured redirects and `always`, `never`, or `ignore` trailing-slash policy.
- Structured site, page, and renderer-plugin document-head contributions.
- Configurable Unified remark and rehype Markdown extensions.
- Build-time collections for indexes, navigation, and related content.
- React islands with `load`, `idle`, and `visible` hydration.
- Optional Vite styling adapters; the starter opts into Tailwind without making
  it a framework dependency.
- Base-path support for GitHub Pages and other subpath deployments.
- A single `nib.config.ts` configuration point for site metadata, content sources,
  collections, an optional app-owned Vite adapter, and an optional shell.

## Authoring model

```text
nib.config.ts
public/
src/
├── pages/
│   ├── page.tsx                 -> /
│   ├── about/page.tsx           -> /about/
│   ├── notes/page.md            -> /notes/
│   ├── catalog/page.csv         -> configured data routes
│   ├── 404/page.tsx             -> /404.html
│   └── layout.tsx               -> wraps the route tree
├── layouts/
│   └── docs.tsx                 -> named Markdown layout
├── islands/
│   └── counter.tsx              -> opt-in browser interaction
├── content/                     -> optional collection inputs
├── site-shell.tsx               -> optional page chrome
└── style.css
```

Each route folder contains one `page.tsx`, `page.md`, or configured
`page.<extension>`. Routes are discovered at build time, so there is no client
router or runtime route loader.

TSX pages may export typed metadata. Markdown pages support `title`,
`description`, `draft`, and `layout` frontmatter by default; `defineMarkdown`
can replace that schema. `definePageSource` handles custom page formats, while
`defineCollection` loads typed data shared across routes. Use
`fromPageSource(source)` when an index should reuse the same validated entries
that generated its data pages. If a page renderer imports a plugin-transformed
module (for example `?nib-image`), declare it with
`pageRenderer('./src/data-pages', 'ProjectPage')`; Nib imports that module from
its configured Vite page-source graph rather than while loading `nib.config.ts`.

For pages and layouts that consume route, collection, or layout data, use the
identity helpers to make the prop contract explicit at the module seam:

```tsx
import { defineLayout, definePage, type PageLayoutProps, type PageProps } from '@briansunter/nib'
import type config from '../../../nib.config'

export default definePage<typeof config>(({ collections }: PageProps<typeof config>) => (
  <ul>{collections.posts.map((post) => <li key={post.id}>{post.data.title}</li>)}</ul>
))

export const DocsLayout = defineLayout<{ title: string }, typeof config>(
  ({ children, frontmatter }: PageLayoutProps<{ title: string }, typeof config>) => (
    <article><h1>{frontmatter?.title}</h1>{children}</article>
  ),
)
```

`defineDataPage` provides the same check for a custom data-page component.
These helpers return the original component and add no browser or build
runtime code.

### Document head

Site configuration and page metadata can add typed head elements without taking
ownership of Nib's document template. Attributes are escaped and event-handler
attributes are rejected; script and style text is protected from closing its
raw-text element.

```ts
import { defineConfig } from '@briansunter/nib'
import type { PageMeta } from '@briansunter/nib'

export default defineConfig({
  site: {
    title: 'My site',
    head: {
      elements: [{
        tag: 'link',
        attributes: { rel: 'alternate', type: 'application/rss+xml', href: '/rss.xml' },
      }],
    },
  },
})

export const meta = {
  head: {
    elements: [{ tag: 'meta', attributes: { name: 'theme-color', content: '#0f172a' } }],
  },
} satisfies PageMeta
```

Renderer plugins can contribute the same `HeadContribution` shape from their
typed `renderer().head(context)` hook. Nib emits site, page, then plugin
contributions in that order.

## Optional Vite adapters

Nib owns Vite's entries, SSR, base path, and output settings. A project can add
Vite plugins through the narrow `vite` factory in `nib.config.ts`; the factory
runs separately for development, client, and server graphs. The starter uses it
for Tailwind:

```ts
import { defineConfig } from '@briansunter/nib'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  site: {
    title: 'My site',
    description: 'Recent writing from My site.',
    origin: 'https://my-site.example',
  },
  vite: () => tailwindcss(),
})
```

Use `plugins` instead for packages that need Nib lifecycle hooks in addition to
Vite, such as the optional image optimizer below.

## Routes, redirects, sitemap, and RSS

Configured redirects emit safe redirect HTML in static builds and real HTTP
redirects during development. `trailingSlash` controls canonical route paths
and matching across development, preview, and static output: `always` writes
directory indexes, while `never` writes extensionless HTML files for leaf
routes and indexes for route parents that contain child pages. Preview redirects
an alternate spelling to the canonical URL. When deploying `never`, configure a
host that serves extensionless page files as `text/html` and rewrites a
parent's extensionless URL to its index artifact.

```ts
import { defineConfig } from '@briansunter/nib'
import { rss } from '@briansunter/nib/rss'
import { sitemap } from '@briansunter/nib/sitemap'

export default defineConfig({
  site: { title: 'My site' },
  trailingSlash: 'always',
  redirects: {
    '/old': '/new',
    '/external': {
      destination: 'https://example.com/new',
      status: 302,
    },
  },
  plugins: [
    sitemap({}),
    rss({
      items: [
        { title: 'Hello', link: '/posts/hello/', pubDate: '2026-07-19' },
      ],
    }),
  ],
})
```

Plugins can also contribute typed page-source adapters, virtual React pages,
static resources, and redirects. `@briansunter/nib/rss` is a first-party RSS
2.0 resource-route helper: item `link` values may be absolute URLs or Nib route
paths, which are resolved with the configured `base`. Its `items` option can
also be an async function receiving the immutable initial route manifest, so a
feed can draw from any project-specific typed data source. The generic resource
route API remains available for Atom, JSON Feed, or another custom format.
After registrations are merged, inspection hooks receive an immutable resolved-
route manifest. Nib retains path normalization, collision detection, base paths,
and output-file ownership.

Builds also emit `dist/client/.nib/publication.json`. It records the manifest
version, base path, trailing-slash policy, and each published route's kind,
canonical path, artifact, status, content type, and redirect destination when
applicable. Static-host adapters can use it instead of reimplementing Nib's
extensionless and directory-index rules.

Run `nib check` after a build to validate publication artifacts, titles, image
alt text, island-runtime ownership, and internal links. Node consumers that
need the same report can import `verifySite` from
`@briansunter/nib/verify`; the browser-facing package entry intentionally does
not load the filesystem-based verifier.

Development and preview bind to loopback by default. To expose a server through
a known hostname such as a Tailscale name, bind explicitly and allow only that
host; repeat the option for more than one hostname:

```bash
npx @briansunter/nib dev --host 0.0.0.0 --allowed-host macmini.example.ts.net
npx @briansunter/nib preview --host 0.0.0.0 --allowed-host macmini.example.ts.net
```

`--host` controls the network interface and `--allowed-host` controls accepted
HTTP `Host` headers. Keep the allowlist explicit rather than opening every host.

## Markdown extensions

`markdown.remarkPlugins` run after Nib's GitHub-Flavored Markdown parser, and
`markdown.rehypePlugins` run before HTML serialization:

```ts
import { defineConfig } from '@briansunter/nib'
import remarkToc from 'remark-toc'
import rehypeExternalLinks from 'rehype-external-links'

export default defineConfig({
  site: { title: 'My site' },
  markdown: {
    remarkPlugins: [[remarkToc, { heading: 'Contents' }]],
    rehypePlugins: [[rehypeExternalLinks, { rel: ['nofollow'] }]],
  },
})
```

Configured Unified plugins receive a VFile whose `history` contains the
Markdown source path. This makes source-relative diagnostics and asset
resolution possible without changing the generated page API.

## React islands

Ordinary React components remain static. Put browser state and event handlers
under `src/islands` and mark the boundary with `defineIsland`:

```tsx
import { defineIsland } from '@briansunter/nib'
import { useState } from 'react'

function Counter({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount)
  return (
    <button onClick={() => setCount((value) => value + 1)}>
      Count: {count}
    </button>
  )
}

export default defineIsland('counter', Counter)
```

Island IDs match their path below `src/islands`, and props must be
JSON-serializable. A route without islands does not include the island runtime.

## Scope

Nib is for sites whose routes and data can be resolved at build time. It does
not add dynamic route parameters, client-side routing, server actions, runtime
data loaders, React Server Components, or JSX inside Markdown.

## Documentation

The [documentation site](https://briansunter.github.io/nib/docs/) covers setup,
pages, Markdown, layouts, data sources, collections, islands, and GitHub Pages.

## Optional optimized images

Install the image package only in projects that need local image transformation:

```bash
npm install @briansunter/nib-images
```

Configure it as a normal typed Nib plugin, then import local raster files with
the explicit `?nib-image` query. `Image` emits static responsive `<picture>`
markup with intrinsic dimensions, lazy loading by default, and no island runtime.
Set `maxWidth` to put a hard ceiling on emitted transforms when a full or
constrained image will never be displayed at its source width.

```tsx
import { Image } from '@briansunter/nib-images'
import hero from './hero.jpg?nib-image'

export default function Home() {
  return <Image src={hero} alt="Mountain trail" layout="full" maxWidth={1280} priority />
}
```

```ts
// nib.config.ts
import { defineConfig } from '@briansunter/nib'
import { images } from '@briansunter/nib-images/plugin'

export default defineConfig({
  site: { title: 'My site' },
  plugins: [images()],
})
```

See [image optimization](examples/docs/src/pages/docs/image-optimization/page.md)
for layouts, cache behavior, and the current SVG/animated-image limits.

For implementation details and design rationale:

- [Architecture](docs/architecture.md)
- [React islands](docs/interactive-react-islands.md)
- [HTML pages proposal](docs/html-pages-layouts-and-islands.md) — proposed, not
  part of the current API
- [Type-safe plugins and image optimization](docs/type-safe-plugins-and-image-optimization.md)
  — implemented design, APIs, and validation matrix

## Contributing

The repository test suite is run by Vitest through the package scripts. Use
`bun run test` (or `bun run test:watch` while editing); invoking `bun test`
directly uses Bun's separate test runner and is not supported for these files.

```bash
bun install --frozen-lockfile
bun run typecheck
bun run test
bun run build
bun run check:version-policy
```

Framework source lives in `src`, the published initializer in
`templates/default`, and the documentation site in `examples/docs`. Optional
publishable packages live under `packages/*`; the image package can be built
or tested directly with `bun run --cwd packages/nib-images <script>`.
