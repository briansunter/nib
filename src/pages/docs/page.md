---
title: Mini Static documentation
description: Learn how Mini Static turns React and Markdown files into a small static site.
layout: docs
---

# Mini Static

Mini Static is a small TypeScript static-site starter. It combines folder-based routing, React pages, Markdown content, build-time rendering, and Vite's development server.

## Start here

- [Getting started](./getting-started/) — install the project and add your first page.
- [Pages and routes](./pages-and-routes/) — understand file discovery and metadata.
- [Markdown and layouts](./markdown-and-layouts/) — write content with frontmatter and React layouts.
- [GitHub Pages](./github-pages/) — build and deploy this site automatically.
- [Releases](./releases/) — publish package releases with Release Please.

## The core loop

1. Add a `page.tsx` or `page.md` file under `src/pages`.
2. Run the dev server to see the route with Fast Refresh.
3. Run the production build to render every route to HTML.
4. Deploy `dist/client` to a static host.

The framework stays intentionally small. When a site needs dynamic route parameters, runtime data, or a client router, it is time to consider a larger framework.
