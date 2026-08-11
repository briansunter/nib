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

Each route folder may contain `page.tsx`, `page.md`, or one configured
`page.<extension>` source, but not multiple page types. Route names are static;
Nib does not interpret `[id]` folders or create runtime routes. Native links are
the default; the [client-navigation plugin](../client-navigation/) can
optionally enhance navigation between these same static documents.

## TSX pages and metadata

Export a default component and its required `meta`:

```tsx
import type { PageMeta } from '@briansunter/nib'

export const meta: PageMeta = {
  title: 'About',
  description: 'Learn about this site.',
}

export default function AboutPage() {
  return <h1>About</h1>
}
```

The page title is required and is the document title by default. Description
and other metadata fields are optional. `draft: true` prevents a page from
entering the route map or generated output. Applications that want a site title,
title template, fallback description, or shared head elements can opt into
`siteMetadata()` from `@briansunter/nib`.

TSX pages, layouts, and ordinary components produce static HTML. Attach a [client behavior](../client-behaviors/) to an existing element when that route needs browser state or event handlers.

## Navigation and links

Keep navigation in an application module such as `src/site.ts`:

```ts
export const site = {
  navigation: [
    { label: 'Home', href: '/' },
    { label: 'Docs', href: '/docs/' },
  ],
} as const
```

Import the value in your shell or another component. Nib treats this as
ordinary application data and does not constrain its shape.

For internal links in TSX, use `siteHref`:

```tsx
import { siteHref } from '@briansunter/nib'

<a href={siteHref('/docs/')}>Read the docs</a>
```

`siteHref` includes the Vite base path, which matters on GitHub project sites served below `/<repository>/`. Markdown links are resolved by the browser, so prefer relative links between Markdown pages.

## Not-found behavior

`src/pages/404/page.tsx` is prerendered as `404.html`. Unknown development requests use the same component, while a static host serves the generated file according to that host's fallback rules.
