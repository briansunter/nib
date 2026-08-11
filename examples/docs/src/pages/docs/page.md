---
title: Nib documentation
description: Learn how to build and publish a static site with Nib.
layout: docs
---

# Nib documentation

Nib turns React, Markdown, and typed data into complete static pages. Start with a route, add browser JavaScript only where interaction needs it, then deploy `dist/client` to any static host.

## Choose a guide

1. [Getting started](./getting-started/) — scaffold a site and publish your first route.
2. [Pages and routes](./pages-and-routes/) — turn folders into URLs and page metadata.
3. [Markdown and layouts](./markdown-and-layouts/) — write content inside reusable TSX layouts.
4. [Data pages and collections](./data-pages-and-collections/) — validate data, generate routes, and build indexes.
5. [Image optimization](./image-optimization/) — generate responsive local images at build time.
6. [Plugin content and routing](./plugin-content-and-routing/) — add formats, feeds, redirects, and virtual routes.
7. [Client behaviors](./client-behaviors/) — enhance one existing element instead of the page.
8. [Client navigation](./client-navigation/) — enhance native links with prefetching and document swaps.
9. [GitHub Pages](./github-pages/) — deploy the static output with the correct base path.

## Pick the lightest building block

| Building block | Use it for | Browser JavaScript |
| --- | --- | --- |
| TSX page | Typed, custom static markup | None by default |
| Markdown page | Articles, guides, and documentation | None by default |
| Data page | YAML, CSV, or another configured format | None by default |
| Client behavior | Scoped state, events, and DOM enhancement | Only on marked routes |

## Build loop

1. Configure framework behavior in `nib.config.ts`.
2. Add `src/pages/<route>/page.tsx`, `page.md`, or a configured data source.
3. Add `src/behaviors/<id>/index.client.ts` only when an element needs browser behavior.
4. Run the project’s typecheck and `nib build`.
5. Preview or deploy `dist/client`.

## Know the boundary

Nib does not provide runtime routes, runtime data loaders, server actions, whole-page hydration, or inline JSX in Markdown. Optional client navigation enhances the same static documents; content and links still work without it.

Maintaining Nib? Read [Releases](./releases/), the [architecture reference](https://github.com/briansunter/nib/blob/master/docs/reference/architecture.md), or the [client behavior design record](https://github.com/briansunter/nib/blob/master/docs/decisions/client-behaviors.md).
