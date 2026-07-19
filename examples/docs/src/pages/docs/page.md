---
title: Nib documentation
description: Learn how to build and publish a static site with Nib.
layout: docs
---

# Nib documentation

Nib is a self-contained static-site framework for React, Markdown, data pages, and opt-in islands. Scaffold a project, put a page file in a route folder, add a React island only when a subtree needs browser interaction, and deploy the prerendered output.

## Learn Nib

1. [Getting started](./getting-started/) — scaffold a Nib site and add a first route.
2. [Pages and routes](./pages-and-routes/) — map page files to URLs and metadata.
3. [Markdown and layouts](./markdown-and-layouts/) — write content and wrap it with TSX.
4. [Data pages and collections](./data-pages-and-collections/) — render custom formats and build typed indexes.
5. [React islands](./react-islands/) — add typed browser interaction without hydrating the page shell.
6. [Image optimization](./image-optimization/) — add static responsive local images with the optional plugin.
7. [Plugin content and routing](./plugin-content-and-routing/) — add formats, virtual routes, redirects, sitemap XML, and route inspection.
8. [GitHub Pages](./github-pages/) — deploy the static output with the correct base path.

Maintainers can use [Releases](./releases/) for versioning and npm publishing. The repository [architecture document](https://github.com/briansunter/nib/blob/master/docs/architecture.md) explains the complete rendering pipeline, and the [island design record](https://github.com/briansunter/nib/blob/master/docs/interactive-react-islands.md) captures the rationale. A separate [HTML pages proposal](https://github.com/briansunter/nib/blob/master/docs/html-pages-layouts-and-islands.md) records a possible future markup-first route format; it is not implemented in the current release.

## Three building blocks

| Building block | Use it for | Browser JavaScript |
| --- | --- | --- |
| TSX page | Typed, custom static markup | None by default |
| Markdown page | Articles, guides, and documentation | None by default |
| Data page | YAML, CSV, or another configured format | None by default |
| React island | State, effects, refs, and event handlers | Only for that island |

## The everyday workflow

1. Edit `nib.config.ts` for the site name, shell, base path, and navigation.
2. Add `src/pages/<route>/page.tsx`, `page.md`, or a configured data page.
3. Add `src/islands/<id>.tsx` only when part of the route needs browser behavior.
4. Run `bun run dev` and open the new URL.
5. Run your project’s typecheck and `nib build`.
6. Preview or deploy `dist/client`.

Nib deliberately omits dynamic route parameters, client-side routing, runtime data loaders, server actions, independently hydrated nested roots, and inline JSX in Markdown.
