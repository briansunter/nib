# Nib

Nib is a self-contained static-site framework for React, Markdown, and opt-in
islands. It owns routing, Vite integration, development SSR, document
generation, prerendering, and island hydration. Your project owns only its
configuration, pages, layouts, islands, styles, and public files.

Every known route becomes complete HTML. Ordinary TSX and Markdown stay static;
only components declared with `defineIsland` ship browser JavaScript.

## Create a site

Use Node 20.19 or newer:

```bash
npx @briansunter/nib init my-site
cd my-site
npm run dev
```

The initializer creates the project and installs its dependencies. Use
`--no-install` when another tool will install them, or run the same command with
`bunx` or `pnpm dlx`.

There is no framework source to copy or maintain:

```text
my-site/
├── nib.config.ts
├── public/
├── src/
│   ├── islands/
│   ├── layouts/
│   ├── pages/
│   ├── site-shell.tsx
│   └── style.css
├── package.json
└── tsconfig.json
```

Upgrading `@briansunter/nib` upgrades the framework without replacing your site
files.

## Configure the site

`nib.config.ts` is the framework interface:

```tsx
import { defineConfig } from '@briansunter/nib'
import { SiteShell } from './src/site-shell'

export default defineConfig({
  site: {
    title: 'My Site',
    description: 'A short description of my site.',
    titleTemplate: '%s | My Site',
    navigation: [
      { label: 'Home', href: '/' },
      { label: 'Notes', href: '/notes/' },
    ],
  },
  shell: SiteShell,
})
```

Set `base: '/project/'` when the deployed site lives below a path. When `base`
is omitted, Nib uses `SITE_BASE_PATH`, derives the repository path in GitHub
Actions, or falls back to `/`.

The optional shell receives `children`, the resolved `route`, and `site`
configuration. Omit it for Nib’s minimal semantic shell or keep an app-owned
shell for complete control over the page chrome.

## Pages and routes

| Source | Output |
| --- | --- |
| `src/pages/page.tsx` | `/index.html` |
| `src/pages/about/page.tsx` | `/about/index.html` |
| `src/pages/notes/page.md` | `/notes/index.html` |
| `src/pages/404/page.tsx` | `/404.html` |

Each route folder contains one `page.tsx` or `page.md`, never both. Routes are
static and discovered at build time.

A TSX page can export typed metadata:

```tsx
import type { PageMeta } from '@briansunter/nib'

export const meta = {
  title: 'Hello',
  description: 'My first Nib page.',
} satisfies PageMeta

export default function HelloPage() {
  return <h1>Hello from Nib</h1>
}
```

Use `siteHref` for base-aware internal links:

```tsx
import { siteHref } from '@briansunter/nib'

<a href={siteHref('/notes/')}>Notes</a>
```

## Markdown and layouts

Markdown pages support GitHub-Flavored Markdown and validated frontmatter:

```md
---
title: Notes
description: A page written in Markdown.
layout: docs
---

# Notes

Write your content here.
```

Supported fields are `title`, `description`, `draft`, and `layout`. A flat
`layout: docs` name selects `src/layouts/docs.tsx` and passes the rendered
article as `children`.

## React islands

Keep state, effects, refs, and event handlers in `src/islands`:

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

The ID matches the path below `src/islands`:

```text
src/islands/counter.tsx      -> counter
src/islands/cart/summary.tsx -> cart/summary
```

Use the island from a page or Markdown layout:

```tsx
import Counter from '../../islands/counter'

export default function Page() {
  return <Counter initialCount={0} hydrate="visible" />
}
```

`hydrate` accepts `load` (default), `idle`, or `visible`. Props must be
JSON-serializable. Each top-level island owns an independent React root. If an
island renders another island definition, Nib composes that child into the same
root; the top-level island's hydration strategy controls the whole subtree.
Routes without islands contain no island client entry.

## Commands

| Command | Purpose |
| --- | --- |
| `nib init [directory]` | Scaffold a site and install dependencies |
| `nib dev` | Start development SSR with Vite refresh |
| `nib build` | Bundle and prerender every route |
| `nib preview` | Serve the generated static site |

The scaffold exposes these through `npm run dev`, `npm run build`, and
`npm run preview`. Deploy `dist/client`; `dist/server` is a build intermediate.

## Documentation

| Guide | Use it for |
| --- | --- |
| [Getting started](examples/docs/src/pages/docs/getting-started/page.md) | Scaffold a project and add a route |
| [Pages and routes](examples/docs/src/pages/docs/pages-and-routes/page.md) | Routing, metadata, links, and 404 behavior |
| [Markdown and layouts](examples/docs/src/pages/docs/markdown-and-layouts/page.md) | Content and reusable wrappers |
| [React islands](examples/docs/src/pages/docs/react-islands/page.md) | Hydration, props, and island constraints |
| [GitHub Pages](examples/docs/src/pages/docs/github-pages/page.md) | Base paths and static deployment |
| [Architecture](docs/architecture.md) | Framework and consumer seams |
| [Island design](docs/interactive-react-islands.md) | Independent SSR and hydration rationale |
| [HTML pages proposal](docs/html-pages-layouts-and-islands.md) | A future markup-first route format |

The rendered guides live at
[briansunter.github.io/nib/docs](https://briansunter.github.io/nib/docs/).

## Contributing to Nib

The repository keeps framework source under `src`, the published initializer
under `templates/default`, and the documentation site under `examples/docs`.

```bash
bun install --frozen-lockfile
bun run typecheck
bun run test
bun run build
bun run check:version-policy
```

`bun run test` builds the publishable framework first, then exercises unit,
type, scaffold, production-build, development-server, and package-consumer
behavior. Releases use Release Please and publish `@briansunter/nib` with npm
provenance.
