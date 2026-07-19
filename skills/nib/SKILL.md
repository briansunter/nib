---
name: nib
description: Build, change, debug, validate, and release Nib static sites. Use when working in a Nib repository on file-routed TSX, Markdown, or configured data pages, typed collections, folder layouts, React islands, static prerendering, base paths, GitHub Pages deployment, or the @briansunter/nib release workflow.
---

# Maintain Nib

Treat Nib as a framework dependency with a static-first rendering model. Preserve
complete HTML for every route and add browser JavaScript only through explicit
React islands.

## Read the right source

- Read `README.md` for the user-facing model and commands.
- Read `docs/architecture.md` before changing routing, rendering, Markdown,
  islands, document output, or base paths.
- Read the relevant page under `examples/docs/src/pages/docs` when changing a documented
  behavior.
- Inspect `package.json`, `.github/workflows`, and
  `scripts/check-version-policy.ts` before release work.

Keep these names exact:

- Nib: product and repository.
- `@briansunter/nib`: npm package only.
- TSX page and Markdown page: page types.
- React island: interactive hydration boundary.
- prerender: build operation.

## Make page changes

1. Put a route at `src/pages/<route>/page.tsx`, `page.md`, or a configured
   `page.<extension>` file, never multiple page types in one folder.
2. Export a default component from a TSX page; export typed `meta` when needed.
3. Use only `title`, `description`, `draft`, and `layout` in Markdown
   frontmatter.
4. Put flat Markdown layouts at `src/layouts/<name>.tsx`.
5. Update `nib.config.ts` when navigation should expose a route.
6. Use `siteHref` for internal TSX links so configured base paths are retained.
7. Use `definePageSource` for one-to-one or one-to-many custom data routes and
   `defineCollection` for typed build-time lists.

Do not add dynamic parameters, a client router, runtime data loaders, server
actions, nested layout names, or inline JSX in Markdown unless the task
explicitly changes Nib's scope.

## Make island changes

1. Keep pages, layouts, and ordinary components static.
2. Put browser state, effects, refs, and event handlers in
   `src/islands/<id>.tsx`.
3. Default-export `defineIsland('<id>', Component)`.
4. Match the ID to the normalized path below `src/islands`.
5. Use `hydrate="load"`, `"idle"`, or `"visible"` at the call site.
6. Pass JSON-serializable props only.
7. Read browser-only state in an effect or event handler so initial server and
   browser markup match.

Island definitions may render other island definitions. Nib composes them into
one React root, so place `hydrate` on the outermost island; that strategy controls
the whole subtree.

`visible` observes all element children and uses the parent element for a
text-only island root. Keep initial markup deterministic across SSR and the
browser.

## Preserve static output

- Keep `siteHref`, Vite `base`, asset URLs, and dynamic imports base-aware.
- Keep the marked island entry on routes with islands and remove it from static
  routes.
- Deploy `dist/client`; treat `dist/server` as an intermediate prerendering
  bundle.
- Preserve `404.html` generation and trailing-slash routes.

## Validate in proportion to the change

Always run:

```bash
bun run typecheck
bun run test
bun run build
```

Then inspect the relevant output:

| Change | Additional proof |
| --- | --- |
| Route, metadata, or layout | Open the generated route in `dist/client` |
| React island | Confirm SSR markup, client entry, and browser interaction |
| Static rendering | Confirm a no-island route has no `data-nib-islands` script |
| Base path or deployment | Run `SITE_BASE_PATH=/nib/ bun run build` and inspect URLs |
| Base-path development | Run `SITE_BASE_PATH=/nib/ bun run dev` and request `/nib/` plus a nested route |
| Documentation | Check local Markdown links and search for stale terminology |
| Release | Run `bun run check:version-policy` and inspect the package tarball |

Use `bun run dev` for request-level SSR checks and `bun run preview` for the
generated static site.

## Release safely

- Use `fix:` for patch releases and `feat:` for minor releases.
- Keep versions in `0.x.y`; major versions are blocked.
- Publish the scoped package through the trusted-publishing workflow.
- Do not claim a release is live without confirming the GitHub release and npm
  package.

## Keep documentation synchronized

When behavior or names change, update all affected layers:

1. `README.md`;
2. the relevant `examples/docs/src/pages/docs/**/page.md`;
3. `docs/architecture.md` for implementation contracts;
4. this skill;
5. package metadata and customer-facing site copy.

Prefer one canonical explanation with links over copying long passages between
files.
