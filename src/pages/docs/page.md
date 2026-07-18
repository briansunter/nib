---
title: Nib documentation
description: Learn how to build and publish a static site with Nib.
layout: docs
---

# Nib

Nib is a small TSX and Markdown starter for static sites. Put a page file in a route folder, add an explicit React island when a subtree needs browser interaction, and build a directory of prerendered HTML for deployment.

## Pick a starting point

- [Getting started](./getting-started/) — clone Nib, run it, and add your first route.
- [Pages and routes](./pages-and-routes/) — learn how file names become URLs.
- [React islands](./react-islands/) — add typed state and event handlers without hydrating the page shell.
- [Markdown and layouts](./markdown-and-layouts/) — write content and wrap it in React.
- [GitHub Pages](./github-pages/) — deploy the generated site automatically.
- [Releases](./releases/) — publish the scoped npm package with Release Please.

## The everyday workflow

1. Edit `src/site.config.ts` for the site name and navigation.
2. Add `src/pages/<route>/page.tsx` or `page.md`.
3. Add a module under `src/islands` when part of the route needs browser state or event handlers.
4. Run `bun run dev` and open the new URL.
5. Run `bun run build` to prerender every route.
6. Deploy `dist/client` to a static host.

Nib deliberately stays small. It does not provide dynamic parameters, client-side routing, runtime data loaders, or server actions. If a site needs those features, keep Nib’s static pages for the content-heavy parts and choose a larger framework for the dynamic application.
