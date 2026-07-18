# Mini Static

A deliberately small TypeScript static-site starter built from React, Vite, Tailwind CSS, and Remark. It turns a folder of React and Markdown pages into a prerendered site with clean URLs, HTML metadata, optional Markdown layouts, and client hydration for interactive React pages.

The npm package contains the starter source and its AI skill. The generated site is still deployed from `dist/client`.

## Quick start

```bash
bun install
bun run dev
```

Open <http://localhost:5173>. Vite serves the site with Fast Refresh while the small Express wrapper renders each request through the SSR entry point. Set `PORT` to use a different port.

The example site documents itself at <http://localhost:5173/docs/> using the same Markdown, frontmatter, layout, and prerendering pipeline it provides to other sites.

Run the production checks and preview the generated site with:

```bash
bun run typecheck
bun run test
bun run build
bun run preview
```

Deploy `dist/client` to any static host. `bun run build` also creates the server bundle used during prerendering, then emits clean `index.html` files for every route.

## GitHub Pages

[`pages.yml`](.github/workflows/pages.yml) runs typecheck, tests, and the production build for pull requests and pushes to `master`. Pushes to `master` then deploy the generated `dist/client` artifact to GitHub Pages.

Enable it once in the repository settings: **Settings → Pages → Build and deployment → Source → GitHub Actions**. The workflow derives the project-site base path from `GITHUB_REPOSITORY`, so assets and internal navigation work at `/<repository>/`. Local builds continue to use `/`; set `SITE_BASE_PATH=/` for a user Pages site or custom domain.

## Pages and routes

Routes come from `src/pages`:

```text
src/pages/page.tsx                     -> /
src/pages/about/page.tsx               -> /about/
src/pages/docs/page.md                 -> /docs/
src/pages/docs/getting-started/page.md -> /docs/getting-started/
src/pages/404/page.tsx                 -> /404.html fallback
```

A folder may contain either `page.tsx` or `page.md`, not both. `src/site.config.ts` owns the site title, description, title template, and navigation.

### React pages

React pages export a default component and may export typed metadata:

```tsx
import type { PageMeta } from '../../framework/types'

export const meta: PageMeta = {
  title: 'About',
  description: 'About this site.'
}

export default function Page() {
  return <h1>About</h1>
}
```

### Markdown pages

Markdown uses YAML frontmatter, Remark, and GitHub-Flavored Markdown:

```md
---
title: Getting Started
description: Learn the basics.
layout: docs
---

# Getting started

Markdown is processed at build time.
```

Add a layout under `src/layouts` and select it by its flat filename. For example, `src/layouts/docs.tsx` is selected with `layout: docs`.

```tsx
import type { ReactNode } from 'react'

export default function DocsLayout({ children }: { children: ReactNode }) {
  return <div className="docs-layout">{children}</div>
}
```

The layout receives the rendered Markdown article as `children`. The field is optional; Markdown without `layout` renders as the default article. Nested layout paths are intentionally unsupported.

## AI skill

The repository includes [`skills/mini-static/SKILL.md`](skills/mini-static/SKILL.md), a concise agent guide for adding pages, editing layouts, running checks, and respecting the framework's routing constraints. It is included in the npm package so an agent can use the same instructions alongside an installed copy.

## Releases and npm publishing

Releases use [Release Please](https://github.com/googleapis/release-please) and Conventional Commits:

```text
feat: add a page
fix: correct Markdown metadata
docs: improve the guide
chore: update dependencies
```

Pushes to `master` run `.github/workflows/release.yml`. Release Please opens or updates a release PR; merging that PR creates the tag and GitHub release. The workflow then checks out the tag, installs dependencies, runs typecheck/tests/build, and publishes `mini-static` to npm.

Before the first release:

1. Create the public `mini-static` package on npm. npm requires an existing package before its trusted publisher can be configured, so bootstrap this once from a maintainer machine with `npm publish --access public`.
2. In npm package settings, add a GitHub Actions trusted publisher for owner `briansunter`, repository `nib`, and workflow filename `release.yml`.
3. Enable GitHub Actions to create and approve pull requests if the repository requires that setting.
4. Keep the default branch named `master`, or update the workflow trigger and Release Please target branch together.

Inspect the package without publishing it:

```bash
bun pm pack --destination ./dist/package
```

## Deliberate constraints

This framework prerenders a known set of folder routes. It intentionally omits dynamic parameters, nested route layouts, client-side routing, server actions, and runtime data loaders. Those are the point where a full framework becomes preferable.
