# Mini Static

Mini Static is a small React + Vite starter for file-routed static sites. Add a page file, write Markdown with frontmatter when you want, and get SSR development plus prerendered HTML for every route.

It is a starter/template rather than a runtime library. Clone or copy this repository, then make the site in `src/` your own.

## Quick start

```bash
git clone https://github.com/briansunter/nib.git my-site
cd my-site
bun install
bun run dev
```

Open <http://localhost:5173>. The example site is its own documentation site at <http://localhost:5173/docs/>.

Use a different port when needed:

```bash
PORT=4173 bun run dev
```

## Add pages

Routes are folders under `src/pages`. Each route contains one `page.tsx` or `page.md` file:

```text
src/pages/page.tsx                     -> /
src/pages/about/page.tsx               -> /about/
src/pages/docs/page.md                 -> /docs/
src/pages/docs/getting-started/page.md -> /docs/getting-started/
```

A route cannot contain both `page.tsx` and `page.md`. Dynamic parameters, client-side routing, and runtime data loaders are intentionally outside the framework’s scope.

### React page

```tsx
import type { PageMeta } from '../../framework/types'

export const meta: PageMeta = {
  title: 'About',
  description: 'A short description for search and social metadata.',
}

export default function Page() {
  return <h1>About</h1>
}
```

React pages can use normal React components. For links inside the site, use the base-aware helper so the same code works on `/` and on a GitHub project page:

```tsx
import { siteHref } from '../../framework/urls'

export default function Page() {
  return <a href={siteHref('/docs/')}>Read the docs</a>
}
```

### Markdown page

```md
---
title: Getting Started
description: Learn the basics.
layout: docs
---

# Getting started

Write standard Markdown, including GitHub-Flavored Markdown.
```

Supported frontmatter is `title`, `description`, `draft`, and `layout`. A page with `draft: true` is omitted from the route map and build output.

## Add a Markdown layout

Create `src/layouts/<name>.tsx`, then select it with `layout: <name>` in frontmatter. Layout names are flat filenames; nested layout paths are not supported.

```tsx
import type { ReactNode } from 'react'

export default function DocsLayout({ children }: { children: ReactNode }) {
  return <div className="docs-layout">{children}</div>
}
```

The layout receives the rendered Markdown article as `children`. Markdown without a layout uses the default article styling.

## Configure the site

Edit [`src/site.config.ts`](src/site.config.ts) for the site-wide title, description, title template, and navigation:

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

## Build and preview

Run the checks and generate the static site:

```bash
bun run typecheck
bun run test
bun run build
bun run preview
```

The build creates:

- `dist/client`: static HTML, JavaScript, CSS, and assets to upload to a host.
- `dist/server`: the temporary SSR bundle used to prerender the client output.

Deploy `dist/client` to any static host. The build writes an `index.html` for each known route, including a `404.html` fallback.

## GitHub Pages

The [Pages workflow](.github/workflows/pages.yml) runs typecheck, tests, and the production build for pull requests. A push to `master` deploys `dist/client` automatically through GitHub Pages.

For this repository, the generated site is [briansunter.github.io/nib](https://briansunter.github.io/nib/). The build detects the GitHub project name and uses `/nib/` as its base path, so assets, links, and client hydration continue to work below the repository path.

For a user site or custom domain, set `SITE_BASE_PATH=/` in the workflow environment before `bun run build`:

```yaml
env:
  SITE_BASE_PATH: /
```

Then enable **Settings → Pages → Build and deployment → Source → GitHub Actions** in the repository.

## AI agent skill

[`skills/mini-static/SKILL.md`](skills/mini-static/SKILL.md) gives an AI coding agent the repository-specific instructions for adding pages, editing Markdown layouts, checking builds, and preserving route constraints. Keep it with the project when asking an agent to maintain the site.

## Releases and npm

Use [Conventional Commits](https://www.conventionalcommits.org/) so Release Please can determine the next version:

```text
feat: add a page
fix: correct Markdown metadata
docs: improve the guide
chore: update dependencies
```

The [release workflow](.github/workflows/release.yml) uses Bun to install dependencies and run checks, then uses npm from GitHub Actions to publish `mini-static` with provenance. Release Please opens or updates a release PR; merging it creates the tag and GitHub release.

Mini Static intentionally stays in the `0.x` series for now. Release Please uses its pre-major bump rules, and CI refuses to publish any version with a nonzero major component. This prevents an accidental `1.0.0` or later major release.

The first publish is a one-time bootstrap from an authenticated maintainer machine:

```bash
npm publish --access public
```

After the package exists, configure an npm GitHub Actions trusted publisher for:

```text
owner:    briansunter
repo:     nib
workflow: release.yml
```

The workflow then publishes without a long-lived npm token.

## Useful commands

| Command | Purpose |
| --- | --- |
| `bun run dev` | Start the SSR development server with Vite refresh. |
| `bun run typecheck` | Check TypeScript without emitting files. |
| `bun run test` | Run the Vitest suite with coverage. |
| `bun run build` | Build, prerender, and write `dist/client`. |
| `bun run preview` | Serve the generated static site locally. |
| `bun pm pack --destination ./dist/package` | Inspect the npm tarball without publishing. |
