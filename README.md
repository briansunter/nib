# Mini Static

A deliberately small TypeScript static-site generator built from React, Vite, Tailwind, and Remark.

## Features

- Folder-based routing
- React `page.tsx` files with default exports
- Markdown `page.md` files with YAML frontmatter
- Named React layouts selected by Markdown frontmatter
- Build-time SSR/prerendering to clean `index.html` paths
- React hydration for interactive pages
- Custom titles and descriptions
- Tailwind CSS v4 and Typography
- Custom static `404.html`
- Vitest coverage thresholds
- No client router and no production server

## Commands

```bash
npm install
npm run dev
npm test
npm run build
npm run preview
```

Deploy `dist/client` to any static host.

## Routing

```text
src/pages/page.tsx                    -> /
src/pages/about/page.tsx              -> /about/
src/pages/docs/getting-started/page.md -> /docs/getting-started/
src/pages/404/page.tsx                -> /404.html fallback
```

A folder may contain either `page.tsx` or `page.md`, not both.

## React page

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

## Markdown page

```md
---
title: Getting Started
description: Learn the basics.
layout: docs
---

# Getting started

Markdown is processed with Remark and GFM.
```

## Markdown layouts

Add a React layout under `src/layouts` and select it by name in a Markdown page's frontmatter:

```text
src/layouts/docs.tsx -> layout: docs
```

Layout names are flat filenames under `src/layouts`; nested layout paths are intentionally unsupported.

Layouts receive the rendered Markdown article as `children`:

```tsx
import type { ReactNode } from 'react'

export default function DocsLayout({ children }: { children: ReactNode }) {
  return <div className="docs-layout">{children}</div>
}
```

The layout is optional; Markdown pages without `layout` keep the default article rendering.

## Site configuration

Edit `src/site.config.ts` to change the default title, title template, description, and navigation.

## Deliberate constraints

This mini framework prerenders a known set of folder routes. It intentionally omits dynamic parameters, nested route layouts, client-side routing, server actions, and runtime data loaders. Those are the point where a full framework becomes preferable.
