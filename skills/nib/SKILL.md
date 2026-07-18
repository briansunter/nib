---
name: nib
description: Build and maintain small React/Vite static sites with Nib, including static TSX pages, interactive React islands, Markdown, frontmatter layouts, SSR prerendering, GitHub Pages, and npm releases. Use when creating pages or islands, editing layouts, running checks, or troubleshooting Nib rendering behavior.
---

# Nib

Nib is a small file-routed static-site starter. Work in `src/`, use Bun for local commands, and deploy the generated `dist/client` directory.

## Start here

```bash
bun install
bun run dev
```

Before handing off a change, run:

```bash
bun run typecheck
bun run test
bun run build
```

## Add a page

- Put a React page at `src/pages/<route>/page.tsx` or a Markdown page at `src/pages/<route>/page.md`.
- Do not put both page types in one route folder.
- Export a default React component. Add `meta` with `title` and `description` when a page needs custom metadata.
- Update `src/site.config.ts` when navigation should expose the route.
- Use `siteHref` from `src/framework/urls.ts` for internal links; it includes the GitHub Pages base path.

## Add Markdown content

- Put YAML frontmatter at the top of `page.md`.
- Supported fields are `title`, `description`, `draft`, and `layout`.
- Create a layout at `src/layouts/<name>.tsx` and select it with `layout: <name>`.
- Keep layout names flat; nested layout paths are unsupported.
- The layout receives the rendered article as `children`.

## Add an interactive island

- Keep pages, layouts, and ordinary React components static.
- Put browser state, effects, refs, and event handlers in `src/islands/<id>.tsx`.
- Default-export `defineIsland('<id>', Component)`. The ID must match its normalized path below `src/islands`.
- Use the definition from a page or layout with `hydrate="load"`, `hydrate="idle"`, or `hydrate="visible"`.
- Pass only JSON-serializable props. Do not pass functions, React nodes, class instances, dates, maps, sets, cycles, explicit `undefined`, or non-finite numbers.
- Do not nest islands. Make coordinated interactive controls one island with ordinary child components.

## Validate behavior

- Use `bun run dev` for Vite refresh and SSR route checks.
- Use `bun run test` for Markdown, metadata, path, and routing regressions.
- Use `bun run build` to verify client and server bundles plus prerendered HTML.
- Inspect `dist/client` when a change affects routes, metadata, layouts, or generated HTML.
- Confirm static routes have no `data-nib-islands` script and island routes contain SSR markup plus the marked client entry.
- Run `bun run check:version-policy` before release work. Nib accepts patch and minor `0.x.y` versions but rejects major versions.

## GitHub Pages

- `.github/workflows/pages.yml` checks pull requests and deploys `dist/client` from `master`.
- Keep internal navigation base-aware; GitHub project pages are served below `/<repository>/`.
- Island chunks and internal links must remain under Vite's configured base path.
- Use `SITE_BASE_PATH=/` for a user Pages site or custom domain.

## Releases

- Use Conventional Commits: `fix:` for patch releases and `feat:` for minor releases.
- The npm package is `@briansunter/nib`; publish from the release workflow with npm trusted publishing.
- Do not create major versions; the version-policy check blocks them.

## Constraints

Nib intentionally has no dynamic route parameters, nested route layouts, client router, server actions, runtime data loaders, nested islands, or arbitrary JSX inside Markdown. Preserve the folder-route and static-by-default rendering model unless the task explicitly expands the framework.
