---
title: Pages and routes
description: Map files under src/pages to static routes and metadata.
layout: docs
---

# Pages and routes

Nib discovers page files under `src/pages` at build time. The final folder containing the page file becomes the route:

| Source file | URL |
| --- | --- |
| `src/pages/page.tsx` | `/` |
| `src/pages/about/page.tsx` | `/about/` |
| `src/pages/docs/page.md` | `/docs/` |
| `src/pages/docs/setup/page.md` | `/docs/setup/` |
| `src/pages/404/page.tsx` | `404.html` fallback |

Each route folder may contain `page.tsx` or `page.md`, but not both. Route names are static; Nib does not interpret `[id]` folders or add a client router.

## TSX pages and metadata

Export a default component and optional `meta`:

```tsx
import type { PageMeta } from '../../framework/types'

export const meta: PageMeta = {
  title: 'About',
  description: 'Learn about this site.',
}

export default function AboutPage() {
  return <h1>About</h1>
}
```

The site config supplies defaults. A page’s `title` and `description` override those defaults when present. `draft: true` prevents a page from entering the route map or generated output.

TSX pages, layouts, and ordinary components produce static HTML. Put state and event handlers in a [React island](../react-islands/) so only that boundary loads browser JavaScript.

## Navigation and links

Add top-level links in `src/site.config.ts`:

```ts
navigation: [
  { label: 'Home', href: '/' },
  { label: 'Docs', href: '/docs/' },
]
```

For internal links in TSX, use `siteHref`:

```tsx
import { siteHref } from '../../framework/urls'

<a href={siteHref('/docs/')}>Read the docs</a>
```

`siteHref` includes the Vite base path, which matters on GitHub project sites served below `/<repository>/`. Markdown links are resolved by the browser, so prefer relative links between Markdown pages.

## Not-found behavior

`src/pages/404/page.tsx` is prerendered as `404.html`. Unknown development requests use the same component, while a static host serves the generated file according to that host's fallback rules.
