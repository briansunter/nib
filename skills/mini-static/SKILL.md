---
name: mini-static
description: Build and maintain small React/Vite static sites with Mini Static, including folder routes, Markdown pages, frontmatter layouts, SSR prerendering, and static hosting. Use when creating pages, editing layouts, running development or release checks, or troubleshooting route and Markdown behavior in a Mini Static repository.
---

# Mini Static

## Quick start

```bash
npm install
npm run dev
```

Use `npm run typecheck`, `npm test`, and `npm run build` before handing off a change. Deploy the generated `dist/client` directory.

## Workflows

### Add a page

- Put a React page at `src/pages/<route>/page.tsx` or a Markdown page at `src/pages/<route>/page.md`.
- Do not put both page types in one route folder.
- Export a default React component. Add `meta` with `title` and `description` when the page needs custom metadata.
- Update `src/site.config.ts` when navigation should expose the route.

### Add Markdown layout

- Create a React layout at `src/layouts/<name>.tsx`.
- Select it with `layout: <name>` in Markdown frontmatter.
- Keep layout names flat; nested layout paths are unsupported.
- The layout receives the rendered article as `children`.

### Validate behavior

- Use `npm run dev` for Vite Fast Refresh and SSR route checks.
- Use `npm test` for Markdown, metadata, path, and routing regressions.
- Use `npm run build` to verify client and server bundles plus prerendered HTML.
- Inspect `dist/client` when a change affects routes, metadata, layouts, or generated HTML.

## Constraints

Mini Static intentionally has no dynamic route parameters, nested route layouts, client router, server actions, or runtime data loaders. Preserve the folder-route and build-time rendering model unless the task explicitly expands the framework.
