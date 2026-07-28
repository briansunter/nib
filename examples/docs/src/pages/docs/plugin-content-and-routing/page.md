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

Plugins declare typed `pageSources` directly. Nib also discovers source
definitions referenced by `fromPageSource()` collections, so a collection does
not require a duplicate top-level registration. The `routes` hook receives an
immutable snapshot and can return page, resource, or redirect routes. Providers
run in configuration order, and each later provider sees routes already added
by earlier plugins.

## Sitemap

Nib includes an optional sitemap entry:

```ts
import { defineConfig } from '@briansunter/nib'
import { sitemap } from '@briansunter/nib/sitemap'

export default defineConfig({
  origin: 'https://docs.example.com',
  plugins: [
    sitemap(),
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
  origin: 'https://docs.example.com',
  plugins: [
    rss({
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
function that receives the current immutable route manifest.

## Redirects and trailing slashes

```ts
export default defineConfig({
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
Development redirects matched non-canonical URLs. Static output uses directory
indexes for `ignore` and `always`, and extensionless leaf artifacts for
`never`. The deployment host remains responsible for mapping request URLs to
those artifacts and enforcing the public spelling.

Static redirects use immediate meta refresh HTML because a static file cannot
choose its HTTP status. Development uses the configured `301`, `302`, `307`, or
`308` status and a `Location` header.

## Markdown extensions

The original `markdown` configuration accepts Unified plugins:

```ts
export default defineConfig({
  markdown: {
    remarkPlugins: [remarkToc],
    rehypePlugins: [rehypeExternalLinks],
  },
})
```

Remark plugins run after GitHub-Flavored Markdown parsing. Rehype plugins run
after Markdown-to-HTML-tree conversion and before serialization.

Renderer plugins can return typed `HeadContribution` values from
`renderer().head(context)`.
