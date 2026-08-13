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
styles, and optional client enhancements or React islands.

Every known route is emitted as complete HTML. Browser interaction is explicit,
route-scoped, and absent by default. DOM enhancements add no browser React;
React runs in the browser only for islands a route explicitly renders. Links
and forms use native document navigation; Nib has no client router.

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
responsive images, client enhancements, feeds,
search data, redirects, and hosting output.

## Features

- File-based routes from `src/pages`, including a static `404.html`.
- React pages rendered to HTML with no browser runtime by default.
- GitHub-Flavored Markdown with validated frontmatter.
- Folder layouts for route trees and named layouts for Markdown.
- Typed data pages that can turn YAML, CSV, or another format into one or many
  routes.
- Plugin-contributed data formats and virtual page, XML, or text routes.
- Configured redirects and `always`, `never`, or `ignore` trailing-slash policy.
- Required page titles and optional renderer-plugin document-head contributions.
- Configurable Unified remark and rehype Markdown extensions.
- Build-time collections for indexes, navigation, and related content.
- Wrapper-free client enhancements with immediate or `visible` startup.
- Optional React islands with `load` or `visible` hydration and serialized props.
- An optional application-wide `src/client.ts` initializer for browser setup
  that is not scoped to one enhanced element.
- Native document navigation for links and forms; no client router or document
  swapping runtime.
- Optional Vite styling adapters; the starter opts into Tailwind without making
  it a framework dependency.
- Base-path support for GitHub Pages and other subpath deployments.
- A small `nib.config.ts` configuration point for framework options, content
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
├── enhancements/
│   └── reveal/
│       └── index.client.ts      -> scoped DOM enhancement
├── islands/
│   └── counter.tsx              -> optional React island
├── content/                     -> optional collection inputs
├── client.ts                    -> optional application-wide browser setup
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
import {
  defineCollection,
  enhance,
  type ClientEnhancement,
  type ClientInitializer,
} from '@briansunter/nib'
import { island } from '@briansunter/nib/react'
import { glob, jsonFile, jsonValue } from '@briansunter/nib/server'
```

The root package owns universal authoring and imperative enhancement contracts,
`/react` owns opt-in React island definitions, and `/server` owns
filesystem-backed loaders. Nib rejects a `.server.ts(x)` module imported by
the production client graph or a `.client.ts(x)` module imported by the
production server graph.

The server entry includes three validated JSON collection helpers. `jsonFile()`
loads an array as one entry per element, `jsonGlob()` loads one entry per
matched file, and `jsonValue()` loads a whole object or other JSON value as one
entry (with the id `default` unless `id` is supplied):

```ts
import { defineCollection, z } from '@briansunter/nib'
import { jsonValue } from '@briansunter/nib/server'

export const settings = defineCollection(jsonValue({
  file: 'src/content/settings.json',
  schema: z.object({ title: z.string(), featured: z.boolean() }),
}))
```

All three helpers parse through the same source-labeled error boundary before
schema validation, so malformed JSON reports the loader and project-relative
file instead of an unlocated `JSON.parse` failure.

Application-wide CSS belongs in `src/style.css`. CSS can also be owned by a
client enhancement, React island, or `src/client.ts`. A stylesheet imported
only by a page, layout, or server-rendered component cannot reach the deployed
client graph, so Nib reports it as a build/development error instead of
publishing an unstyled page.

For progressive enhancement, spread `enhance()` onto an existing HTML element
and put one matching implementation at
`src/enhancements/reveal/index.client.ts`:

```tsx
import { enhance } from '@briansunter/nib'

export function Reveal() {
  return (
    <section {...enhance('reveal')}>
      <button type="button">Show details</button>
      <p data-details hidden>Complete static content.</p>
    </section>
  )
}
```

```ts
import type { ClientEnhancement } from '@briansunter/nib'

export default ((root, signal) => {
  const button = root.querySelector('button')
  const details = root.querySelector<HTMLElement>('[data-details]')
  button?.addEventListener('click', () => {
    if (details) details.hidden = !details.hidden
  }, { signal })
}) satisfies ClientEnhancement
```

The implementation receives its scoped `root` and `signal` as positional
arguments. Plain JavaScript can default-export the mount function directly.
Routes without enhancement markers omit the enhancement script, and projects
without enhancement modules do not build that runtime. Enhancements may nest
when each owns a different element; cleanup aborts the deepest root first.

Use a React island only when a feature needs React state or hooks in the
browser. Island IDs come from their file paths below `src/islands`, and each
module default-exports `island(Component)` or
`island(Component, { when: 'visible' })` from `@briansunter/nib/react`. `load`
is the default, and there is no `idle` strategy:

```tsx
// src/islands/counter.tsx
import { useState } from 'react'
import { island } from '@briansunter/nib/react'

function Counter({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount)
  return <button onClick={() => setCount(count + 1)}>Count: {count}</button>
}

export default island(Counter, { when: 'visible' })
```

Import and render the default export like an ordinary component. Nib renders
its initial HTML on the server, serializes JSON-safe props, and hydrates that
island on load or as it approaches the viewport. Routes without islands omit
the island runtime, and an island-free project ships no client React.

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
Use `metadata()` for canonical, Open Graph, Twitter, and optional generic
structured data. Its static image accepts either a URL string or the same
structured `MetadataImage` as page metadata, including alt text and dimensions.
A resolver can compute social defaults from the route, frontmatter, or data:

```ts
import { metadata } from '@briansunter/nib'

metadata({
  siteName: 'Example',
  twitterSite: '@example',
  image: {
    src: '/social/default.png',
    alt: 'Example',
    width: 1200,
    height: 630,
    type: 'image/png',
  },
  resolve: ({ route, data }) => {
    const project = data as { slug?: string } | undefined
    return {
      ...(route.path.startsWith('/projects/') && project?.slug
        ? { image: `/social/projects/${project.slug}.png` }
        : {}),
      type: route.path.startsWith('/writing/') ? 'article' : 'website',
    }
  },
})
```

Each of `image`, `type`, and `twitterCard` resolves independently. Explicit
`route.meta` wins first, then `resolve(context)`, then the static plugin value.
The resolver is synchronous because it runs during the already-data-backed
page render; perform I/O in a collection or page source instead.

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

Authored route identities must be absolute local paths. Nib rejects queries,
hashes, backslashes, repeated separators, dot segments (including encoded dot
segments), and encoded path separators before applying the trailing-slash
policy. Local redirect destinations may add a query or hash, but their path is
validated by the same rules and cannot point back to the source pathname.

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

Builds also emit `dist/client/.nib/client.json`. This versioned client-provenance
report records runtime entries, convention-owned enhancement/island modules, and
route-owned stylesheets and module preloads discovered while rendering each page.
Site verifiers can enforce generic ownership and preload invariants from this
typed report without reparsing HTML or Vite's private manifest.

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
`semanticHtmlSnapshot()` and `compareSemanticHtml()`. It also exports
`renderReactPage()` and `RenderedReactPage` for tests that need Nib's actual
static React boundary rather than a separate renderer. `createBuildOutput()`
provides the same manifest-guarded artifact adapter received by plugin
finalizers, which keeps finalizer tests out of internal package entries:

```tsx
import { renderReactPage } from '@briansunter/nib/testing'

const rendered = renderReactPage(<main>Article</main>)
expect(rendered.html).toContain('<main>Article</main>')
expect(rendered.enhancements).toEqual([])
```

```ts
import { createBuildOutput } from '@briansunter/nib/testing'

const output = createBuildOutput(clientDirectory, publication)
await output.write('search/index.json', '{}')
```

The render helper returns HTML plus the discovered enhancement and island
manifests. Its optional second argument lists Markdown bodies the page must
render exactly once, and it applies the same marker, serialization, and parser
validation as a real build. The
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

## Client enhancement loading

Enhancement JavaScript is lazy by module. Immediate roots may preload their own
chunk; roots configured with `{ when: 'visible' }` wait until the marked
element approaches the viewport. CSS imported by an enhancement is linked on
every route that renders that enhancement, including visible roots, and is
deduplicated against global and application-client styles.

`enhance()` returns the canonical `data-nib-enhancement` and optional
`data-nib-when` attributes. Spread the result onto the intrinsic HTML element
that the client module should receive. Nib treats final rendered HTML as the
source of truth and validates the same marker contract in raw HTML.

## React island loading

An island module lives at `src/islands/<id>.tsx` and must default-export
`island(Component)`. Nested paths produce nested IDs. The optional `when` value
is `load` (the default) or `visible`; it is fixed for every instance of that
island. Props must be JSON-serializable because Nib embeds them in the static
document for hydration. Island CSS is route-scoped like enhancement CSS.

Nib server-renders each island as complete initial HTML. Only routes that
render an island link the island runtime and React client code. Routes made
from ordinary TSX, Markdown, data pages, and DOM enhancements remain free of
client React.

Render an island where a custom HTML element is valid flow content. Do not put
an island directly inside restricted parser contexts such as `table`, `tbody`,
`tr`, or `select`; make the containing table or control subtree the island
instead. Nib parses the emitted document and fails the build if the browser
would restructure an island boundary before hydration.

## Native navigation and optional application client

Nib does not intercept links or forms. Navigation loads each destination's
prerendered document through the browser's native behavior; there is no client
router, document swap, prefetch controller, or navigation history API.

Use enhancements for browser code owned by one rendered element. When an
application needs one site-wide browser initializer instead, add the exact
optional entry `src/client.ts`:

```ts
import type { ClientInitializer } from '@briansunter/nib'

export default ((signal) => {
  const reportOnline = () => {
    document.documentElement.toggleAttribute('data-online', navigator.onLine)
  }
  reportOnline()
  window.addEventListener('online', reportOnline, { signal })
  window.addEventListener('offline', reportOnline, { signal })
}) satisfies ClientInitializer
```

Nib discovers this file without configuration and invokes its default export
with an `AbortSignal`. It may finish synchronously or return a promise. Use the
signal for listener cleanup; Nib aborts it when replacing the client module in
development. CSS imported from `src/client.ts` is application-wide. Projects
without this file do not build or link an application entry. Links and forms use
native browser navigation.

Generated Markdown uses the neutral `nib-markdown` class. Sites own typography,
colors, widths, and other prose presentation through their layouts or global
stylesheet.

## Scope

Nib is for sites whose routes and data can be resolved at build time. It does
not add dynamic route parameters, runtime routes, server actions, runtime data
loaders, React Server Components, whole-page hydration, a client router, or JSX
inside Markdown. React hydration is limited to explicitly declared islands.

## Documentation

The [documentation site](https://briansunter.github.io/nib/docs/) covers setup,
pages, Markdown, layouts, data sources, collections, client enhancements,
React islands, and GitHub Pages.

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

For public paths stored in collections or frontmatter, configure an image
`content` root and import `resolveContentImage(path)` from the server-only
`@briansunter/nib-images/content` entry. The plugin generates that lookup from
the configured directories, replacing a consumer-owned eager
`import.meta.glob` map. Unknown paths return `undefined`, duplicate public
mappings fail the build, and browser-target imports are rejected.

See [image optimization](examples/docs/src/pages/docs/image-optimization/page.md)
for layouts, cache behavior, and the current SVG/animated-image limits.

For implementation details and design rationale:

- [Architecture](docs/reference/architecture.md)
- [Client enhancements](docs/decisions/client-enhancements.md)
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
