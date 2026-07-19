---
title: Plugin content and routing
description: Add data formats, virtual routes, redirects, sitemap and RSS XML, and route inspection.
layout: docs
---

# Plugin content and routing

Nib plugins can contribute page-source adapters and virtual routes before the
route map is frozen. This supports optional packages for TOML or another data
format, virtual React pages, and static resources such as RSS XML.

Nib includes the first-party `@briansunter/nib/rss` helper for RSS 2.0 feeds.
It emits an `application/rss+xml` resource route, resolves internal item paths
with `base`, and leaves each project in charge of its own content data model.
The generic resource-route API remains available for Atom, JSON Feed, or a
custom feed format.

The `setup` hook returns typed page sources. The `routes` hook receives the
immutable file, data-page, and configured-redirect routes and can return page,
resource, or redirect routes. Every provider sees the same initial manifest, so
route generation does not depend on plugin order.

After Nib merges registrations and rejects duplicate paths, `routesResolved`
receives the complete immutable manifest. Use it for validation, reporting, and
indexes—not mutation.

## Sitemap

Nib includes an optional sitemap entry:

```ts
import { defineConfig } from '@briansunter/nib'
import { sitemap } from '@briansunter/nib/sitemap'

export default defineConfig({
  site: { title: 'Docs' },
  plugins: [
    sitemap({ site: 'https://docs.example.com' }),
  ],
})
```

It includes successful page routes, respects `base` and `trailingSlash`, and
emits `sitemap.xml` without adding a browser runtime.

## RSS

Create an RSS 2.0 feed with a typed static item list or an async item provider:

```ts
import { defineConfig } from '@briansunter/nib'
import { rss } from '@briansunter/nib/rss'

export default defineConfig({
  site: { title: 'Docs' },
  plugins: [
    rss({
      site: 'https://docs.example.com',
      title: 'Docs updates',
      description: 'Recent updates to the documentation.',
      items: [
        { title: 'Plugin content and routing', link: '/docs/plugin-content-and-routing/' },
      ],
    }),
  ],
})
```

`link` can be an absolute HTTP(S) URL or an absolute Nib route path. Route paths
receive the configured `base`, so the same config works under a project-site
deployment. Item fields support descriptions, content, publication dates,
authors, categories, GUIDs, and enclosures. `items` may instead be an async
function that receives the immutable initial route manifest.

## Redirects and trailing slashes

```ts
export default defineConfig({
  site: { title: 'Docs' },
  trailingSlash: 'always',
  redirects: {
    '/old-guide': '/guide',
    '/news': {
      destination: 'https://example.com/news',
      status: 302,
    },
  },
})
```

The supported policies are `ignore` (default), `always`, and `never`.
Development redirects matched non-canonical URLs. Static builds remain
directory-style because URL enforcement ultimately belongs to the deployment
host.

Static redirects use immediate meta refresh HTML because a static file cannot
choose its HTTP status. Development uses the configured `301`, `302`, `307`, or
`308` status and a `Location` header.

## Markdown extensions

The original `markdown` configuration accepts Unified plugins:

```ts
export default defineConfig({
  site: { title: 'Docs' },
  markdown: {
    remarkPlugins: [remarkToc],
    rehypePlugins: [rehypeExternalLinks],
  },
})
```

Remark plugins run after GitHub-Flavored Markdown parsing. Rehype plugins run
after Markdown-to-HTML-tree conversion and before serialization.

Typed document/head updates are intentionally not part of the plugin interface.
