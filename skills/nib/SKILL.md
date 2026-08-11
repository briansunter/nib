---
name: nib
description: Build, change, debug, validate, and release Nib static sites. Use for file-routed TSX, Markdown or configured data pages, typed collections, layouts, client behaviors, prerendering, base paths, deployment, or the @briansunter/nib release workflow.
---

# Maintain Nib

Treat Nib as a static-first framework dependency. React and TSX author complete
server-rendered HTML; browser JavaScript enters only through explicit client
behaviors or configured client integrations.

## Read the right source

- Read `README.md` for the user-facing model and commands.
- Read `docs/reference/architecture.md` before changing routing, rendering,
  behaviors, document output, builds, or base paths.
- Read the matching guide under `examples/docs/src/pages/docs` when changing a
  documented contract.
- Inspect package metadata and release scripts before release work.

## Make page changes

1. Put a route at `src/pages/<route>/page.tsx`, `page.md`, or one configured
   `page.<extension>` file.
2. Give every page a non-empty title.
3. Keep named Markdown layouts flat under `src/layouts` and folder layouts next
   to their page subtree.
4. Keep navigation app-owned and use `siteHref` for internal TSX links.
5. Use page sources for generated routes and collections for typed build-time
   lists.

Do not add runtime route parameters, server actions, runtime data loaders,
whole-page browser rendering, or inline JSX in Markdown without explicitly
changing Nib's scope.

## Make behavior changes

1. Keep essential content in the server-rendered element.
2. Wrap exactly one intrinsic element with `<Behavior name="feature">`.
3. Put the matching default export at
   `src/behaviors/feature/index.client.ts` or `.js`.
4. Type it as `(root: HTMLElement, signal: AbortSignal) => void | Promise<void>`
   with `ClientBehavior` from `@briansunter/nib`.
5. Scope DOM queries to `root` and register listeners with `{ signal }`.
6. Use `defer="idle"` only for non-urgent startup and `defer="visible"` only
   when observing the marked root is correct.
7. Import feature CSS from the behavior module; Nib links it on owning routes.

Do not author `data-nib-behavior`, `data-nib-defer`, or a parallel registry.
Nested behaviors must own distinct elements and clean up deepest first.

## Preserve static output

- Keep `siteHref`, Vite `base`, assets, and lazy imports base-aware.
- Confirm routes without behaviors omit the behavior script.
- Confirm a project without client features still runs Vite plugin build hooks
  but links no framework JavaScript.
- Deploy `dist/client`; treat `dist/server` as an intermediate bundle.
- Preserve the static 404 and trailing-slash policy.

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
| Client behavior | Confirm static markup, route script/CSS, interaction, and cleanup |
| Static rendering | Confirm the route has no `data-nib-behaviors` script |
| Base path | Build and request a root plus nested route with `SITE_BASE_PATH` |
| Documentation | Build docs and check local links and stale terminology |
| Release | Run version-policy checks and inspect the package tarball |

Use `bun run dev` for request-level SSR and `bun run preview` for generated
static output.

## Release safely

- Use `fix:` for patch releases and `feat:` for minor releases.
- Keep versions in `0.x.y`; major versions are blocked.
- Publish through the trusted-publishing workflow.
- Do not claim a release is live without checking GitHub and npm.

Keep `README.md`, the docs example, architecture reference, this skill, package
exports, templates, and consumer tests synchronized when a contract changes.
