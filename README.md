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
- Build-time collections for indexes, navigation, and related content.
- React islands with `load`, `idle`, and `visible` hydration.
- Base-path support for GitHub Pages and other subpath deployments.
- A single `nib.config.ts` configuration point for site metadata, content sources, collections, and an optional app-owned shell.

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
`defineCollection` loads typed data shared across routes.

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

For implementation details and design rationale:

- [Architecture](docs/architecture.md)
- [React islands](docs/interactive-react-islands.md)
- [HTML pages proposal](docs/html-pages-layouts-and-islands.md) — proposed, not
  part of the current API

## Contributing

```bash
bun install --frozen-lockfile
bun run typecheck
bun run test
bun run build
bun run check:version-policy
```

Framework source lives in `src`, the published initializer in
`templates/default`, and the documentation site in `examples/docs`.
