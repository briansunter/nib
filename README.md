# Mini Static

A deliberately small TypeScript static-site starter built from React, Vite, Tailwind CSS, and Remark. It turns a folder of React and Markdown pages into a prerendered site with clean URLs, HTML metadata, optional Markdown layouts, and client hydration for interactive React pages.

The npm package contains the starter source and its AI skill. The generated site is still deployed from `dist/client`.

## Quick start

```bash
npm install
npm run dev
```

Open <http://localhost:5173>. Vite serves the site with Fast Refresh while the small Express wrapper renders each request through the SSR entry point. Set `PORT` to use a different port.

Run the production checks and preview the generated site with:

```bash
npm run typecheck
npm test
npm run build
npm run preview
```

Deploy `dist/client` to any static host. `npm run build` also creates the server bundle used during prerendering, then emits clean `index.html` files for every route.

## Pages and routes

Routes come from `src/pages`:

```text
src/pages/page.tsx                     -> /
src/pages/about/page.tsx               -> /about/
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

1. Add a repository secret named `NPM_TOKEN` with permission to publish `mini-static`.
2. Enable GitHub Actions to create and approve pull requests if the repository requires that setting.
3. Keep the default branch named `master`, or update the workflow trigger and Release Please target branch together.

Inspect the package without publishing it:

```bash
npm pack --dry-run
```

## Deliberate constraints

This framework prerenders a known set of folder routes. It intentionally omits dynamic parameters, nested route layouts, client-side routing, server actions, and runtime data loaders. Those are the point where a full framework becomes preferable.
