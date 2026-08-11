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
styles, and optional client behaviors.

Every known route is emitted as complete HTML. Browser interaction is explicit,
DOM-first, and route-scoped; Nib never hydrates React in production.

## Quick start

Nib requires Node 20.19 or newer.

```bash
npx @briansunter/nib init my-site
cd my-site
npm run dev
```

For a compact feature-complete example, see the
[Commonplace blog template](examples/blog/README.md). It uses fictional sample
content while demonstrating Markdown, collections, typed data pages,
responsive images, client behaviors, optional navigation, feeds,
search data, redirects, and hosting output.

## Features

- File-based routes from `src/pages`, including a static `404.html`.
- React pages rendered to HTML with no browser React runtime.
- GitHub-Flavored Markdown with validated frontmatter.
- Folder layouts for route trees and named layouts for Markdown.
- Typed data pages that can turn YAML, CSV, or another format into one or many
  routes.
- Plugin-contributed data formats and virtual page, XML, or text routes.
- Configured redirects and `always`, `never`, or `ignore` trailing-slash policy.
- Required page titles and optional renderer-plugin document-head contributions.
- Configurable Unified remark and rehype Markdown extensions.
- Build-time collections for indexes, navigation, and related content.
- Client behaviors with immediate, `idle`, and `visible` startup.
- Optional static document navigation with native-link fallback.
- Optional Vite styling adapters; the starter opts into Tailwind without making
  it a framework dependency.
- Base-path support for GitHub Pages and other subpath deployments.
- A small `nib.config.ts` configuration point for framework behavior, content
  sources, collections, optional integrations, and an optional shell.

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
├── behaviors/
│   └── reveal/
│       └── index.client.ts      -> scoped DOM enhancement
├── content/                     -> optional collection inputs
├── site-shell.tsx               -> optional page chrome
└── style.css
```

Each route folder contains one `page.tsx`, `page.md`, or configured
`page.<extension>`. Routes are discovered at build time, so there is no client
router or runtime route loader.

Every page supplies typed metadata with a required `title`. Markdown pages support `title`,
`description`, `draft`, `layout`, and social preview fields (`image`, `type`,
and `twitterCard`) by default; `defineMarkdown` can replace that schema.
`definePageSource` handles custom page formats, while
`defineCollection` loads typed data shared across routes. Use
`fromPageSource(source)` when an index should reuse the same validated entries
that generated its data pages. Use `fromPages()` or `fromMarkdownPages()` when
the pages themselves are authoritative and an index, archive, feed, or search
resource needs selected route metadata and validated frontmatter. If a page
renderer imports a plugin-transformed module (for example `?nib-image`), declare it with
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

Generated pages can compile prose through the same synchronous Markdown seam
as `page.md`:

```tsx
import { Content, markdownBody } from '@briansunter/nib'

const body = markdownBody(source, {
  file: 'src/content/projects/example.md',
  profile: config.markdown,
})

export function ProjectBody() {
  return <Content body={body} as="section" className="prose" data-pagefind-body="" />
}
```

`markdownBody()` retains the source identity for Unified diagnostics and
returns an opaque, frozen value. Only `Content` can render its compiled HTML.
For a Markdown route, `PageLayoutProps.Content` is the same body already bound
to the route; a named layout can render it with its own semantic tag, classes,
and static attributes instead of inspecting or cloning `children`. Nib fails
the server render if that route body is omitted or rendered more than once.

Keep execution targets explicit:

```ts
import { defineCollection } from '@briansunter/nib'
import { glob } from '@briansunter/nib/server'
import type { ClientBehavior } from '@briansunter/nib'
```

The root package is the universal authoring API, `/server` owns filesystem-backed
loaders, and `/client/navigation` owns the opt-in navigation controller. Nib also rejects a
`.server.ts(x)` module imported by the production client graph or a
`.client.ts(x)` module imported by the production server graph.

Application-wide CSS belongs in `src/style.css`. CSS can also be owned by a
client behavior or a plugin's client entry. A stylesheet imported
only by a page, layout, or server-rendered component cannot reach the deployed
client graph, so Nib reports it as a build/development error instead of
publishing an unstyled page.

For progressive enhancement, attach one behavior to an
existing element with `<Behavior name="reveal">` and put one matching implementation at
`src/behaviors/reveal/index.client.ts`:

```tsx
import { Behavior } from '@briansunter/nib'

export function Reveal() {
  return (
    <Behavior name="reveal">
      <section>
        <button type="button">Show details</button>
        <p data-details hidden>Complete static content.</p>
      </section>
    </Behavior>
  )
}
```

```ts
import type { ClientBehavior } from '@briansunter/nib'

export default ((root, signal) => {
  const button = root.querySelector('button')
  const details = root.querySelector<HTMLElement>('[data-details]')
  button?.addEventListener('click', () => {
    if (details) details.hidden = !details.hidden
  }, { signal })
}) satisfies ClientBehavior
```

The implementation receives its scoped root and an `AbortSignal`. Plain
JavaScript can default-export the mount function directly. Routes without
behavior markers omit the behavior script, and projects without behavior
modules do not build that runtime. Behaviors may nest when each owns a different
element; cleanup aborts the deepest root first.

### Site identity and document head

Site identity and navigation are application data, not framework configuration.
Keep them in an ordinary typed module and import that module wherever the
application needs it:

```ts
// src/site.ts
export const site = {
  name: 'My site',
  description: 'Recent writing from My site.',
  navigation: [
    { label: 'Home', href: '/' },
    { label: 'Notes', href: '/notes/' },
  ],
} as const
```

The shell can import `site.navigation`; pages remain the authority for their
own metadata:

```ts
import type { PageMeta } from '@briansunter/nib'

export const meta = {
  title: 'Notes | My site',
  description: 'Recent notes.',
  head: {
    elements: [{ tag: 'meta', attributes: { name: 'theme-color', content: '#0f172a' } }],
  },
} satisfies PageMeta
```

There is no `resolveHead` phase. Without a plugin, Nib emits page metadata
directly. Applications that want site-wide document policy can opt into the
typed first-party plugin:

```ts
import { defineConfig, siteMetadata } from '@briansunter/nib'
import { site } from './src/site'

export default defineConfig({
  plugins: [
    siteMetadata({
      title: site.name,
      description: site.description,
      titleTemplate: `%s | ${site.name}`,
    }),
  ],
})
```

The plugin uses its title for `/`, applies `titleTemplate` to non-home page
titles, and uses its description only when a page omits one. It can also add
shared structured head elements. Navigation remains ordinary app data.
Renderer plugins can contribute the same `HeadContribution` shape from their
typed `renderer().head(context)` hook. Nib emits page metadata followed by
plugin contributions; later `title` and `description` overrides win. Head
attributes are escaped, event-handler attributes are rejected, and script/style
text is protected from closing its raw-text element.
When the `metadata()` plugin is enabled, a page's `image`, `type`, and
`twitterCard` metadata override the plugin defaults independently, so article
pages can use their own social preview without duplicating or replacing
unrelated site-wide defaults.

## Optional Vite adapters

Nib owns Vite's entries, SSR, base path, and output settings. A project can add
Vite plugins through the narrow `vite` factory in `nib.config.ts`; the factory
runs separately for development, client, and server graphs. The starter uses it
for Tailwind:

```ts
import { defineConfig } from '@briansunter/nib'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  origin: 'https://my-site.example',
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
  origin: 'https://my-site.example',
  trailingSlash: 'always',
  redirects: {
    '/old': '/new',
    '/external': {
      destination: 'https://example.com/new',
      status: 302,
    },
  },
  plugins: [
    sitemap(),
    rss({
      title: 'My site',
      description: 'Recent writing from My site.',
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
also be an async function receiving the current immutable route manifest, or an
explicit `fromCollection(collection, mapper)` capability. A capability grants
that resource access to only the named collection and returns deeply frozen
build data. The generic resource route API remains available for Atom, JSON
Feed, or another custom format.
Route providers run in plugin order, so later providers receive an immutable
snapshot that includes routes already contributed by earlier plugins. Nib
retains path normalization, collision detection, base paths, and output-file
ownership.

Builds also emit `dist/client/.nib/publication.json`. It records the manifest
version, base path, trailing-slash policy, and each published route's kind,
canonical path, artifact, status, content type, and redirect destination when
applicable. Static-host adapters can use it instead of reimplementing Nib's
extensionless and directory-index rules. Plugin finalizers receive this same
frozen manifest as `context.publication`, so output integrations can open exact
artifacts without recursively crawling `dist/client` or reconstructing routes.

Run `nib check` after a build to validate publication artifacts, titles, image
alt text, and local `href`, `src`, `srcset`, and
`poster` references. Checks use one route/file index and one standards-parsed
document per page, then report every issue with a stable code. `nib inspect`
prints the read-only inspection summary without treating it as a verification
success; `nib inspect --json` emits its compact, path-safe report.

Node consumers can import `inspectSite`, `verifySite`, and
`SiteVerificationError` from `@briansunter/nib/verify`. The returned inspection
owns frozen route, file, and parsed-page indexes. The browser-facing package
entry intentionally does not load the filesystem or HTML parser.

Site-owned verification can be passed through `verifySite({ extensions })`.
Each extension receives that same parsed inspection rather than a source or
output path, and all of its diagnostics are stamped with the extension name.
Extensions should express site policy only; route resolution, HTML parsing, and
artifact ownership remain built-in checks.

`@briansunter/nib/testing` exposes the same standards parser through
`semanticHtmlSnapshot()` and `compareSemanticHtml()`. The
`nib-semantic-v1` normalizer compares visible text, repeated headings and dates,
links, and structural counts; `nib-typography-v1` retains curly quote
differences. These are content-parity helpers, not visual-equivalence claims.

When `@briansunter/nib-images` participates in a production build it writes a
deterministically sorted `.nib/images.json` candidate report. It contains only
content-derived source identities, output-relative files, formats, dimensions,
quality, and width caps—never authoring paths. The core inspector validates the
report and also rejects leaked `data-nib-width` authoring hints.

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
  markdown: {
    remarkPlugins: [[remarkToc, { heading: 'Contents' }]],
    rehypePlugins: [[rehypeExternalLinks, { rel: ['nofollow'] }]],
  },
})
```

Configured Unified plugins receive a VFile whose `history` contains the
Markdown source path. This makes source-relative diagnostics and asset
resolution possible without changing the generated page API.

## Behavior loading

Behavior JavaScript is lazy by module. Immediate roots may preload their own
chunk; `idle` and `visible` roots wait for their strategy. Visible startup
observes the marked root itself. CSS imported by a behavior is linked on every
route that renders that behavior, including deferred roots, and is deduplicated
against global and plugin-owned styles.

`Behavior` owns `data-nib-behavior` and `data-nib-defer`; do not set either
attribute on its child. The child must be one intrinsic DOM element so the
framework adds no layout wrapper.

## Optional client navigation

Nib uses ordinary document navigation by default. A site can explicitly add
same-origin document swapping, history, scroll/focus restoration, bounded
prefetching, and View Transitions:

```ts
// nib.config.ts
import { defineConfig } from '@briansunter/nib'
import { clientNavigation } from '@briansunter/nib/navigation'

export default defineConfig({
  plugins: [clientNavigation()],
})
```

Hover intent remains the compatibility default. Sites that want only annotated
prefetches can use `clientNavigation({ prefetch: 'explicit' })`; navigation
itself still enhances every eligible link.

The plugin contributes one static browser entry only when configured; no
dynamic import or React DOM dependency is added by navigation. Links remain
complete native fallbacks when JavaScript is disabled, a destination is
ineligible, or an enhanced navigation cannot complete safely.

After a document swap, Nib preserves focus inside a persisted element or moves
it to an explicit hash target. Otherwise it focuses the new route's `main`,
`#main-content`, or first `h1` without changing the intended scroll position.

Use `data-nib-prefetch="hover|tap|load|viewport|false"` to control prefetching,
`data-nib-navigation-reload` to force native navigation, and
`data-nib-navigation-persist="key"` to preserve a stable element across swaps.
The browser controller and typed `nib:navigation-*` events are exported from
`@briansunter/nib/client/navigation`.

Feature controllers that write query or hash state while client navigation is
active must use `writeNavigationHistory()` from that same browser entry instead
of calling `history.pushState()` or `history.replaceState()` directly. The
helper keeps feature entries on the loaded document's navigation index, so
Back and Forward update the feature in place without fetching or remounting the
document. It accepts only same-origin, same-path URLs; ordinary page changes
still belong to links, forms, or the navigation controller.

Generated Markdown uses the neutral `nib-markdown` class. Sites own typography,
colors, widths, and other prose presentation through their layouts or global
stylesheet.

## Scope

Nib is for sites whose routes and data can be resolved at build time. It does
not add dynamic route parameters, runtime routes, server actions, runtime data
loaders, React Server Components, or JSX inside Markdown. Client navigation is
an optional enhancement over the same prerendered route map, never the default
or a source of required content.

## Documentation

The [documentation site](https://briansunter.github.io/nib/docs/) covers setup,
pages, Markdown, layouts, data sources, collections, behaviors, and GitHub Pages.

Repository maintainers can run `bun run verify` for the ordered framework,
package-consumer, documentation, and blog-template gate. The example is a root
workspace, so `bun install --frozen-lockfile` installs the exact dependency
graph used by CI.

## Optional optimized images

Install the image package only in projects that need local image transformation:

```bash
npm install @briansunter/nib-images
```

Configure it as a normal typed Nib plugin, then import local raster files with
the explicit `?nib-image` query. `Image` emits static responsive `<picture>`
markup with intrinsic dimensions, lazy loading by default, and no client runtime.
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
  plugins: [images()],
})
```

See [image optimization](examples/docs/src/pages/docs/image-optimization/page.md)
for layouts, cache behavior, and the current SVG/animated-image limits.

For implementation details and design rationale:

- [Architecture](docs/reference/architecture.md)
- [Client behaviors](docs/decisions/client-behaviors.md)
- [Optional client navigation ADR](docs/decisions/optional-client-navigation.md)
- [Type-safe plugins and image optimization](docs/reference/type-safe-plugins-and-image-optimization.md)
- [Licensing](docs/reference/licensing.md)
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
`templates/default`, the documentation site in `examples/docs`, and the
feature-complete sample in `examples/blog`. Optional publishable packages live
under `packages/*`; the image package can be built or tested directly with
`bun run --cwd packages/nib-images <script>`.
