---
name: nib
description: Build, change, debug, validate, and release Nib static sites. Use for file-routed TSX, Markdown or configured data pages, typed collections, layouts, client enhancements, React islands, prerendering, base paths, deployment, or the @briansunter/nib release workflow.
---

# Maintain Nib

Treat Nib as a static-first framework dependency. React and TSX author complete
server-rendered HTML; browser JavaScript enters only through explicit client
enhancements, optional React islands, or the optional `src/client.ts`
initializer.

## Read the right source

- Read `README.md` for the user-facing model and commands.
- Read `docs/reference/architecture.md` before changing routing, rendering,
  enhancements, islands, document output, builds, or base paths.
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
   Keep links and forms on native document navigation; Nib has no client
   router, document-swap plugin, or navigation history API.
5. Use page sources for generated routes and collections for typed build-time
   lists.

Do not add runtime route parameters, server actions, runtime data loaders,
whole-page browser rendering, or inline JSX in Markdown without explicitly
changing Nib's scope.

## Make client enhancement changes

1. Keep essential content in the server-rendered element.
2. Spread `enhance('feature')` onto the intrinsic HTML element that owns the
   interaction.
3. Put the matching default export at
   `src/enhancements/feature/index.client.ts` or `.js`.
4. Type it as `(root: HTMLElement, signal: AbortSignal) => void | Promise<void>`
   with `ClientEnhancement` from `@briansunter/nib`.
5. Scope DOM queries to `root` and register listeners with `{ signal }`.
6. Use `enhance('feature', { when: 'visible' })` only when observing the marked
   root is correct; immediate startup is the default and `idle` is unsupported.
7. Import feature CSS from the enhancement module; Nib links it on owning routes.

Prefer `enhance()` in TSX. The final rendered HTML is the source of truth, so
keep raw `data-nib-enhancement` and `data-nib-when` markers valid when a source
cannot call the helper. Do not add a parallel registry. Nested enhancements
must own distinct elements and clean up deepest first.

## Make React island changes

1. Use an island only when a component needs React state, effects, or hooks in
   the browser; prefer `enhance()` for scoped DOM work.
2. Put the component in `src/islands/<id>.tsx` and default-export
   `island(Component)` from `@briansunter/nib/react`.
3. Use `{ when: 'load' }` (the default) or `{ when: 'visible' }`; there is no
   `idle` strategy.
4. Keep props JSON-serializable. Nib server-renders the initial island markup
   and serializes those props for hydration.
5. Put the island boundary in normal flow content. For a table, select, or
   another restricted HTML context, make the containing control subtree the
   island instead of rendering an island directly inside it.
6. Import island CSS from its island module so Nib can link it only on routes
   that render that island.

Island IDs are derived from the path below `src/islands`; do not maintain a
registry or assign an ID manually. Confirm island-free routes omit the island
runtime and that an island-free project ships no client React.

Use `src/client.ts` only for application-wide browser setup that has no scoped
enhancement root. Its default export must satisfy `ClientInitializer` from
`@briansunter/nib` and use the supplied `AbortSignal` for cleanup.

## Preserve static output

- Keep `siteHref`, Vite `base`, assets, and lazy imports base-aware.
- Confirm routes without enhancements omit the enhancement script.
- Confirm routes without islands omit the island script and client React.
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
| Client enhancement | Confirm static markup, route script/CSS, interaction, and cleanup |
| React island | Confirm initial HTML, serialized props, hydration timing, route CSS, and cleanup |
| Static rendering | Confirm the route has no `data-nib-enhancements` or `data-nib-islands` script |
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
