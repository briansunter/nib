# Nib

Nib is a small React + Vite starter for static sites. You create routes with folders, write static templates in TSX or Markdown, add opt-in React islands where a page needs browser interactivity, and build a directory of prerendered HTML that can be hosted anywhere.

Nib is a starter/template, not a runtime library. Clone it, edit `src/`, and make the example site your own.

## Start a site

You need [Bun](https://bun.sh/) and Git:

```bash
git clone https://github.com/briansunter/nib.git my-site
cd my-site
bun install
bun run dev
```

Open <http://localhost:5173>. The example documentation is at <http://localhost:5173/docs/>.

The development server combines Vite refresh with server-side rendering, so a page looks close to its production output while you work. Set `PORT` when another service uses port 5173:

```bash
PORT=4173 bun run dev
```

## Make your first change

1. Edit [`src/site.config.ts`](src/site.config.ts) to set the site name and navigation.
2. Add a page under `src/pages`.
3. Run `bun run dev` and open the route.
4. Run `bun run build` before deploying.

## Add routes with folders

Nib discovers one `page.tsx` or `page.md` file in each route folder:

| File | URL |
| --- | --- |
| `src/pages/page.tsx` | `/` |
| `src/pages/about/page.tsx` | `/about/` |
| `src/pages/docs/page.md` | `/docs/` |
| `src/pages/docs/setup/page.md` | `/docs/setup/` |
| `src/pages/404/page.tsx` | `404.html` fallback |

Do not put both page types in the same folder. Routes are static and known at build time: dynamic parameters, client-side routing, server actions, and runtime data loaders are intentionally not part of Nib.

## Write a React page

React pages export a default component. Export `meta` when the page needs its own title or description:

```tsx
import type { PageMeta } from '../../framework/types'
import { siteHref } from '../../framework/urls'

export const meta: PageMeta = {
  title: 'About',
  description: 'Learn how this site works.',
}

export default function AboutPage() {
  return (
    <article>
      <h1>About</h1>
      <p>This page is rendered to HTML during the production build.</p>
      <a href={siteHref('/docs/')}>Read the docs</a>
    </article>
  )
}
```

Use `siteHref` for internal links. It adds the correct Vite base path when the site is deployed at a GitHub project URL such as `/nib/`.

React pages, layouts, and ordinary components render to static HTML and are not hydrated as one client root.

## Add an interactive React island

Put stateful browser components under `src/islands` and wrap the implementation with `defineIsland`. The island ID must match its path below that folder:

```tsx
// src/islands/counter.tsx
import { useState } from 'react'
import { defineIsland } from '../framework/islands'

function Counter({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount)
  return <button onClick={() => setCount((value) => value + 1)}>Count: {count}</button>
}

export default defineIsland('counter', Counter)
```

Use the resulting component from a TSX page or layout:

```tsx
import Counter from '../../islands/counter'

export default function Page() {
  return <Counter initialCount={0} hydrate="load" />
}
```

`hydrate` accepts `load`, `idle`, or `visible`. Island props are checked by TypeScript and again at build time; they must be JSON-serializable. Nib server-renders each island, hydrates it as an independent React root, and emits no client script tag on routes without islands. Keep browser-only APIs in event handlers or effects so the initial server and browser renders match. See the [islands guide](src/pages/docs/react-islands/page.md) for day-to-day use and the [design document](docs/interactive-react-islands.md) for the rendering pipeline and constraints.

## Write a Markdown page

Use Markdown for articles, guides, and documentation. YAML frontmatter supports `title`, `description`, `draft`, and `layout`:

```md
---
title: Setup
description: Install the project and run it locally.
layout: docs
---

# Setup

Run `bun install`, then `bun run dev`.
```

Markdown is rendered at build time with GitHub-Flavored Markdown. Tables, task lists, autolinks, and strikethrough are supported. A page with `draft: true` is left out of the route map and build output.

## Wrap Markdown in a layout

Create `src/layouts/<name>.tsx`:

```tsx
import type { ReactNode } from 'react'

export default function DocsLayout({ children }: { children: ReactNode }) {
  return <div className="docs-layout">{children}</div>
}
```

Select it with `layout: docs`. The layout receives the rendered article as `children` and may include React islands when Markdown needs an interactive control around its static content. Layout names are flat filenames, so `src/layouts/docs.tsx` is valid but nested layout paths are not.

## Configure the site

Edit [`src/site.config.ts`](src/site.config.ts):

```ts
export default {
  title: 'My Site',
  description: 'A short description of my site.',
  titleTemplate: '%s | My Site',
  navigation: [
    { label: 'Home', href: '/' },
    { label: 'Docs', href: '/docs/' },
  ],
}
```

The config supplies site-wide metadata and the header navigation. Page-level `meta` values override the defaults.

## Check, build, and preview

```bash
bun run typecheck
bun run test
bun run build
bun run preview
```

`bun run build` typechecks, builds the client and SSR bundles, and prerenders every route. The output is:

- `dist/client`: the deployable static site.
- `dist/server`: the temporary SSR bundle used during prerendering.

Upload or deploy `dist/client`; a production Node server is not required. Static routes reference no React client entry, while routes with islands load the shared island runtime and only the island modules they use. `bun run preview` serves the generated `dist/client` locally, so run it after `bun run build`.

## Deploy to GitHub Pages

The [Pages workflow](.github/workflows/pages.yml) runs checks for pull requests and deploys `dist/client` after pushes to `master`.

This repository is live at [briansunter.github.io/nib](https://briansunter.github.io/nib/). In GitHub Actions, Nib derives `/nib/` from `GITHUB_REPOSITORY`; assets, links, and dynamically imported island chunks therefore work below the project path.

One-time setup:

1. Open **Settings → Pages** in the repository.
2. Set **Build and deployment → Source** to **GitHub Actions**.
3. Push to `master`, or run the workflow manually from the Actions tab.

For a user Pages site or custom domain, set `SITE_BASE_PATH=/` in the workflow environment before `bun run build`.

## Ask an AI agent to maintain Nib

[`skills/nib/SKILL.md`](skills/nib/SKILL.md) is the repository-specific AI skill. It explains how to add routes and islands, edit Markdown layouts, preserve base-path behavior, run checks, and follow the release policy. Keep it with the repository when asking an agent to make changes.

## Publish releases

Nib uses [Release Please](https://github.com/googleapis/release-please) and Conventional Commits:

```text
feat: add a page          # minor 0.x release
fix: correct a link       # patch 0.x release
docs: improve the guide
chore: update dependencies
```

The package is published as [`@briansunter/nib`](https://www.npmjs.com/package/@briansunter/nib). The unscoped npm name `nib` is already registered, so the scope is required even though the product is simply called Nib.

The [release workflow](.github/workflows/release.yml) uses Bun for installation and validation, then npm from GitHub Actions for provenance-backed publishing. Nib allows patch and minor `0.x.y` versions and blocks major versions with `bun run check:version-policy`.

The first publish is a one-time bootstrap from an authenticated maintainer machine:

```bash
npm publish --access public
```

After the package exists, configure an npm trusted publisher for the `@briansunter/nib` package:

```text
owner:    briansunter
repo:     nib
workflow: release.yml
```

The release workflow can then publish without a long-lived npm token.

## Command reference

| Command | Use it for |
| --- | --- |
| `bun install` | Install dependencies. |
| `bun run dev` | Start the SSR development server with Vite refresh. |
| `bun run typecheck` | Check TypeScript without emitting files. |
| `bun run test` | Run the Vitest suite with coverage. |
| `bun run build` | Build and prerender `dist/client`. |
| `bun run preview` | Serve the generated static site locally. |
| `bun run check:version-policy` | Confirm the package is still `0.x.y`. |
| `bun pm pack --destination ./dist/package` | Inspect the npm tarball without publishing. |
