# Nib

Nib is a small static-site starter for React, Markdown, and opt-in islands.
Routes come from folders, every page is prerendered to HTML, and only explicit
React islands ship browser JavaScript.

Nib is a starter repository, not a framework dependency. Clone it, edit `src/`,
and own the resulting site. Releases are also published as
[`@briansunter/nib`](https://www.npmjs.com/package/@briansunter/nib) so the
source has a versioned, provenance-backed artifact.

## Quick start

You need [Bun](https://bun.sh/) and Git:

```bash
git clone https://github.com/briansunter/nib.git my-site
cd my-site
bun install
bun run dev
```

Open <http://localhost:5173>. Start by changing
[`src/site.config.ts`](src/site.config.ts), then replace the example pages under
`src/pages`.

## The model

| You add | Nib produces |
| --- | --- |
| `src/pages/page.tsx` | `/index.html` |
| `src/pages/about/page.tsx` | `/about/index.html` |
| `src/pages/notes/page.md` | `/notes/index.html` |
| `src/pages/404/page.tsx` | `/404.html` |
| `src/islands/counter.tsx` | An independently hydrated React island |

There are two page types:

- A **TSX page** provides typed, custom React markup.
- A **Markdown page** provides content with optional frontmatter and a TSX
  layout.

Both become static HTML. A **React island** is the only component boundary that
hydrates in the browser.

## Add a TSX page

Create `src/pages/hello/page.tsx`:

```tsx
import type { PageMeta } from '../../framework/types'

export const meta: PageMeta = {
  title: 'Hello',
  description: 'My first Nib page.',
}

export default function HelloPage() {
  return <h1>Hello from Nib</h1>
}
```

Open <http://localhost:5173/hello/>. Each route folder may contain one
`page.tsx` or one `page.md`, never both.

Use `siteHref` for internal links so they keep working when the site is hosted
below a base path:

```tsx
import { siteHref } from '../../framework/urls'

<a href={siteHref('/docs/')}>Read the docs</a>
```

## Add a Markdown page

Create `src/pages/notes/page.md`:

```md
---
title: Notes
description: A page written in Markdown.
layout: docs
---

# Notes

Write your content here.
```

Markdown pages support GitHub-Flavored Markdown. Frontmatter accepts:

| Field | Meaning |
| --- | --- |
| `title` | Page title and document metadata |
| `description` | Search and social description |
| `draft` | Omit the route and output when `true` |
| `layout` | A flat filename under `src/layouts` |

For example, `layout: docs` selects `src/layouts/docs.tsx`. The layout receives
the rendered Markdown article as `children`.

## Add a React island

Keep ordinary pages, layouts, and components static. Put state, effects, refs,
and event handlers in `src/islands`.

```tsx
// src/islands/counter.tsx
import { useState } from 'react'
import { defineIsland } from '../framework/islands'

function Counter({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount)

  return (
    <button type="button" onClick={() => setCount((value) => value + 1)}>
      Count: {count}
    </button>
  )
}

export default defineIsland('counter', Counter)
```

Use it from a TSX page or layout:

```tsx
import Counter from '../../islands/counter'

export default function ExamplePage() {
  return <Counter initialCount={0} hydrate="load" />
}
```

The island ID must match its path below `src/islands`:

```text
src/islands/counter.tsx      -> counter
src/islands/cart/summary.tsx -> cart/summary
```

The `hydrate` prop accepts:

| Value | Timing |
| --- | --- |
| `load` | Hydrate immediately; this is the default |
| `idle` | Wait for browser idle time |
| `visible` | Wait until the island approaches the viewport |

Props must be JSON-serializable. Islands cannot nest, and each island owns an
independent React root and context tree. Routes without islands ship no React
client entry.

## Configure the site

Site-wide metadata and header navigation live in `src/site.config.ts`:

```ts
export default {
  title: 'My Site',
  description: 'A short description of my site.',
  titleTemplate: '%s | My Site',
  navigation: [
    { label: 'Home', href: '/' },
    { label: 'Notes', href: '/notes/' },
  ],
}
```

Page metadata overrides these defaults.

## Build and deploy

```bash
bun run typecheck
bun run test
bun run build
bun run preview
```

`bun run build` typechecks, creates client and server bundles, and prerenders
every route. Deploy `dist/client`; `dist/server` is only an intermediate
prerendering bundle.

The included [GitHub Pages workflow](.github/workflows/pages.yml) validates pull
requests and deploys pushes to `master`. It derives the repository base path in
GitHub Actions, so assets, `siteHref` links, and island chunks work under
`/<repository>/`.

## Documentation

| Guide | Use it for |
| --- | --- |
| [Getting started](src/pages/docs/getting-started/page.md) | Build the example and add a first route |
| [Pages and routes](src/pages/docs/pages-and-routes/page.md) | File routing, metadata, links, and 404 behavior |
| [Markdown and layouts](src/pages/docs/markdown-and-layouts/page.md) | Frontmatter, content, and reusable wrappers |
| [React islands](src/pages/docs/react-islands/page.md) | Hydration timing, props, and island boundaries |
| [GitHub Pages](src/pages/docs/github-pages/page.md) | Base paths and static deployment |
| [Architecture](docs/architecture.md) | Rendering pipeline and design constraints |
| [Island design](docs/interactive-react-islands.md) | Rationale for independent SSR and hydration |
| [HTML pages proposal](docs/html-pages-layouts-and-islands.md) | Proposed typed bindings for markup-first HTML |
| [Releases](src/pages/docs/releases/page.md) | Version policy and npm publishing |

The same user guides are rendered at
[briansunter.github.io/nib/docs](https://briansunter.github.io/nib/docs/).

## Project structure

```text
src/
├── framework/       Nib routing, Markdown, rendering, and island internals
├── islands/         Browser-interactive React components
├── layouts/         Reusable Markdown page layouts
├── pages/           File-routed TSX and Markdown pages
├── App.tsx          Shared static page shell
├── routes.ts        Build-time route discovery
├── site.config.ts   Site metadata and navigation
└── style.css        Global styles
```

Nib deliberately omits dynamic route parameters, a client router, server
actions, runtime data loaders, nested islands, nested Markdown layout names, and
inline JSX in Markdown.

## Commands

| Command | Purpose |
| --- | --- |
| `bun run dev` | Start the SSR development server with Vite refresh |
| `bun run typecheck` | Check TypeScript without emitting files |
| `bun run test` | Run tests and enforce coverage |
| `bun run build` | Build and prerender the production site |
| `bun run preview` | Serve `dist/client` locally |
| `bun run check:version-policy` | Reject versions outside `0.x.y` |
| `bun pm pack --destination ./dist/package` | Inspect the npm package artifact |

## Naming

Use these names consistently in code and documentation:

- **Nib** — product and repository
- **`@briansunter/nib`** — npm package only
- **TSX page** and **Markdown page** — the two page types
- **React island** — an explicitly interactive, independently hydrated subtree
- **prerender** — the build step that writes static HTML

See [`skills/nib/SKILL.md`](skills/nib/SKILL.md) when asking an AI agent to
maintain a Nib site.
